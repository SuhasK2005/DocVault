import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { supabase } from "../services/supabase";
import { deriveMasterKey } from "../services/encryption";
import { useAuthStore } from "../stores/useAuthStore";

export default function AllDocumentsScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [unlockingDocument, setUnlockingDocument] = useState(false);

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIconAndColor = (mimeType: string | null) => {
    if (!mimeType) return { type: "file", color: "#737373" };
    if (mimeType.startsWith("image/")) return { type: "image", color: "#EA580C" };
    if (mimeType === "application/pdf") return { type: "file-text", color: "#4F46E5" };
    if (mimeType.includes("word") || mimeType.includes("text/")) return { type: "file-text", color: "#059669" };
    return { type: "file", color: "#4F46E5" };
  };

  const fetchAllDocuments = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        size: formatBytes(doc.size_bytes),
        mime_type: doc.mime_type,
        storage_path: doc.storage_path,
        ...getFileIconAndColor(doc.mime_type),
      }));

      setDocuments(formatted);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not load documents");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAllDocuments();
    }, [user?.id]),
  );

  const handleDocumentPress = (doc: any) => {
    setSelectedDocument(doc);
    setPinModalVisible(true);
  };

  const verifyAccessDocument = async () => {
    if (enteredPin.length < 6) return Alert.alert("Error", "Enter 6-digit PIN");
    if (!selectedDocument?.storage_path) return Alert.alert("Error", "Document not found.");

    try {
      setUnlockingDocument(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("master_salt, master_hash")
        .eq("id", user?.id)
        .single();

      if (!profile) {
        Alert.alert("Error", "Profile not found.");
        return;
      }

      const { authHash } = deriveMasterKey(enteredPin, profile.master_salt);
      if (authHash !== profile.master_hash) {
        Alert.alert("Access Denied", "Incorrect Master PIN");
        return;
      }

      setPinModalVisible(false);
      setEnteredPin("");

      const { data } = await supabase.storage
        .from("vault_documents")
        .createSignedUrl(selectedDocument.storage_path, 300);

      if (!data?.signedUrl) {
        Alert.alert("Error", "Could not generate link to view file.");
        return;
      }

      if (!FileSystem.cacheDirectory) {
        Alert.alert("Error", "Could not access local cache.");
        return;
      }

      const safeName = (selectedDocument.name || "document")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .trim();
      const localUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;

      await FileSystem.downloadAsync(data.signedUrl, localUri);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Opened", `Downloaded file to: ${localUri}`);
        return;
      }

      await Sharing.shareAsync(localUri, {
        dialogTitle: selectedDocument.name || "Open document",
        mimeType: selectedDocument.mime_type || undefined,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not open document");
    } finally {
      setUnlockingDocument(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F4F4F5]">
      <StatusBar style="dark" />

      <View className="flex-row items-center justify-between px-6 pt-4 pb-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-11 h-11 bg-white rounded-full items-center justify-center border border-neutral-200"
        >
          <Feather name="arrow-left" size={20} color="black" />
        </TouchableOpacity>
        <Text className="text-2xl font-black text-black">All Documents</Text>
        <View className="w-11 h-11" />
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="black" />
          </View>
        ) : documents.length === 0 ? (
          <View className="bg-white rounded-[24px] p-6 border border-neutral-100">
            <Text className="text-black font-bold text-lg">No documents yet</Text>
            <Text className="text-neutral-500 mt-1">Upload, scan, or create a note from Dashboard.</Text>
          </View>
        ) : (
          <View className="pb-12">
            {documents.map((file) => (
              <TouchableOpacity
                onPress={() => handleDocumentPress(file)}
                key={file.id}
                className="flex-row items-center p-4 bg-white rounded-[24px] mb-3 shadow-sm border border-neutral-100"
              >
                <View
                  className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: file.color + "15" }}
                >
                  <Feather name={file.type as any} size={24} color={file.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-black font-bold text-lg mb-1" numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text className="text-neutral-500 font-bold text-xs">{file.size}</Text>
                </View>
                <View className="w-10 h-10 items-center justify-center bg-neutral-50 rounded-full">
                  <Feather name="chevron-right" size={20} color="black" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={pinModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="bg-white p-6 rounded-[32px] w-[85%] items-center shadow-2xl">
            <Feather name="lock" size={40} color="black" className="mb-4" />
            <Text className="text-xl font-black text-black mb-2 text-center">Unlock Document</Text>
            <Text className="text-neutral-500 text-center mb-6">Enter your Master PIN to view.</Text>
            <TextInput
              className="w-full bg-neutral-100 rounded-2xl p-4 text-center text-2xl font-black tracking-widest mb-6"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              value={enteredPin}
              onChangeText={setEnteredPin}
              placeholder="------"
            />
            <View className="flex-row w-full space-x-3 gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                onPress={() => {
                  setPinModalVisible(false);
                  setEnteredPin("");
                }}
              >
                <Text className="font-bold text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black py-4 rounded-xl items-center"
                onPress={verifyAccessDocument}
                disabled={unlockingDocument}
              >
                {unlockingDocument ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Unlock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
