import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../services/supabase";
import { deriveMasterKey } from "../services/encryption";

const { width } = Dimensions.get("window");

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const logout = useAuthStore((state) => state.logout);
  const setUnlocked = useAuthStore((state) => state.setUnlocked);
  const user = useAuthStore((state) => state.user);
  const [uploading, setUploading] = useState(false);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);

  // Scan Modal State
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);
  const [scannedFileName, setScannedFileName] = useState("");

  // Note Modal State
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  // PIN Unlock State
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [profileSecurity, setProfileSecurity] = useState<{
    master_salt: string;
    master_hash: string;
  } | null>(null);
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
    if (mimeType.startsWith("image/"))
      return { type: "image", color: "#EA580C" };
    if (mimeType === "application/pdf")
      return { type: "file-text", color: "#4F46E5" };
    if (mimeType.includes("word") || mimeType.includes("text/"))
      return { type: "file-text", color: "#059669" };
    return { type: "file", color: "#4F46E5" };
  };

  const fetchDocuments = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData = data.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          size: formatBytes(doc.size_bytes),
          mime_type: doc.mime_type,
          storage_path: doc.storage_path,
          ...getFileIconAndColor(doc.mime_type),
        }));
        setRecentFiles(formattedData);
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user?.id]);

  useEffect(() => {
    const fetchProfileSecurity = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("master_salt, master_hash")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setProfileSecurity(data);
        }
      } catch {
        // Non-blocking: we'll retry during unlock if prefetch fails.
      }
    };

    fetchProfileSecurity();
  }, [user?.id]);

  const lockVault = () => {
    setUnlocked(false);
  };

  const uploadAssetToVault = async (params: {
    uri: string;
    name: string;
    mimeType: string;
    size?: number | null;
  }) => {
    setUploading(true);
    try {
      const fileBase64 = await FileSystem.readAsStringAsync(params.uri, {
        // @ts-ignore
        encoding: "base64",
      });

      const storagePath = `${user?.id}/${Date.now()}-${params.name}`;

      const { Buffer } = require("buffer");
      const fileBuffer = Buffer.from(fileBase64, "base64");

      const { error: uploadError } = await supabase.storage
        .from("vault_documents")
        .upload(storagePath, fileBuffer, {
          contentType: params.mimeType || "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user?.id,
        name: params.name,
        size_bytes: params.size ?? fileBuffer.length,
        mime_type: params.mimeType,
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "File uploaded into the vault.");
      fetchDocuments();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error Uploading", err.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      await uploadAssetToVault({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        size: file.size,
      });
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error Uploading", err.message || "Something went wrong");
    }
  };

  const handleUploadFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Gallery access is needed to pick images",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const image = result.assets[0];
      const fallbackExt = image.uri.split(".").pop() || "jpg";
      const name = image.fileName || `gallery-${Date.now()}.${fallbackExt}`;

      await uploadAssetToVault({
        uri: image.uri,
        name,
        mimeType: image.mimeType || "image/jpeg",
        size: image.fileSize,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to open gallery");
    }
  };

  const handleUploadPress = () => {
    Alert.alert("Upload Document", "Choose source", [
      { text: "Choose from Files", onPress: handleUploadFromFiles },
      { text: "Choose from Gallery", onPress: handleUploadFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const handleScanDocument = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to scan documents",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setScannedImageUri(result.assets[0].uri);
        setScanModalVisible(true);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to open camera");
    }
  };

  const handleSaveScannedDoc = async () => {
    if (!scannedImageUri || !scannedFileName) {
      Alert.alert("Required", "Please enter a file name");
      return;
    }

    setUploading(true);
    try {
      // Convert Image to PDF
      const html = `<html><body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;"><img src="${scannedImageUri}" style="max-width:100%;max-height:100%;object-fit:contain;"/></body></html>`;
      const { uri: pdfUri } = await Print.printToFileAsync({ html });

      const fileBase64 = await FileSystem.readAsStringAsync(pdfUri, {
        // @ts-ignore
        encoding: "base64",
      });

      const fileName = scannedFileName.endsWith(".pdf")
        ? scannedFileName
        : `${scannedFileName}.pdf`;
      const storagePath = `${user?.id}/${Date.now()}-${fileName}`;

      const { Buffer } = require("buffer");
      const fileBuffer = Buffer.from(fileBase64, "base64");

      const { error: uploadError } = await supabase.storage
        .from("vault_documents")
        .upload(storagePath, fileBuffer, { contentType: "application/pdf" });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user?.id,
        name: fileName,
        size_bytes: fileBase64.length * 0.75, // approximate
        mime_type: "application/pdf",
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Scanned document saved as PDF!");
      setScanModalVisible(false);
      setScannedFileName("");
      setScannedImageUri(null);
      fetchDocuments();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!noteTitle || !noteContent) {
      Alert.alert("Required", "Title and content cannot be empty.");
      return;
    }
    setUploading(true);
    try {
      const fileName = noteTitle.endsWith(".txt")
        ? noteTitle
        : `${noteTitle}.txt`;
      const storagePath = `${user?.id}/${Date.now()}-${fileName}`;
      const { Buffer } = require("buffer");
      const fileBuffer = Buffer.from(noteContent, "utf-8");

      const { error: uploadError } = await supabase.storage
        .from("vault_documents")
        .upload(storagePath, fileBuffer, { contentType: "text/plain" });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user?.id,
        name: fileName,
        size_bytes: Buffer.byteLength(noteContent, "utf8"),
        mime_type: "text/plain",
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Secure note saved!");
      setNoteModalVisible(false);
      setNoteTitle("");
      setNoteContent("");
      fetchDocuments();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentPress = (doc: any) => {
    setSelectedDocument(doc);
    setPinModalVisible(true);
  };

  const verifyAccessDocument = async () => {
    if (enteredPin.length < 6) return Alert.alert("Error", "Enter 6-digit PIN");
    if (!selectedDocument?.storage_path)
      return Alert.alert("Error", "Document not found.");

    try {
      setUnlockingDocument(true);

      let security = profileSecurity;
      if (!security && user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("master_salt, master_hash")
          .eq("id", user.id)
          .single();

        if (profile) {
          security = profile;
          setProfileSecurity(profile);
        }
      }

      if (!security) return Alert.alert("Error", "Profile not found.");

      const { authHash } = deriveMasterKey(enteredPin, security.master_salt);

      if (authHash === security.master_hash) {
        setPinModalVisible(false);
        setEnteredPin("");

        // Create a signed URL and download locally for reliable opening.
        const { data } = await supabase.storage
          .from("vault_documents")
          .createSignedUrl(selectedDocument.storage_path, 300);

        if (data?.signedUrl) {
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
        } else {
          Alert.alert("Error", "Could not generate link to view file.");
        }
      } else {
        Alert.alert("Access Denied", "Incorrect Master PIN");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not open document");
    } finally {
      setUnlockingDocument(false);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-[#F4F4F5]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row justify-between items-end px-8 pt-6 pb-4">
        <View>
          <Text className="text-sm text-neutral-500 font-bold uppercase tracking-widest mb-1">
            Status: Encrypted
          </Text>
          <Text className="text-4xl font-black text-black tracking-tighter">
            My Vault.
          </Text>
        </View>
        <TouchableOpacity
          className="w-14 h-14 bg-black rounded-full items-center justify-center shadow-lg shadow-black/20"
          onPress={lockVault}
          activeOpacity={0.8}
        >
          <Feather name="lock" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Storage Bento Grid */}
        <View className="flex-row justify-between mb-4">
          <View className="w-[48%]">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate("AllDocuments")}
            >
              <LinearGradient
                colors={["#18181B", "#27272A"]}
                className="p-6 rounded-[32px] h-[180px] justify-between shadow-xl shadow-neutral-900/10"
              >
                <View className="w-12 h-12 bg-white/10 rounded-full items-center justify-center">
                  <Feather name="folder" size={24} color="white" />
                </View>
                <View>
                  <Text className="text-white text-3xl font-black mb-1">
                    {recentFiles.length}
                  </Text>
                  <Text className="text-neutral-400 font-bold text-sm">
                    Documents
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View className="w-[48%] flex-col justify-between">
            <View className="bg-white p-5 rounded-[28px] h-[85px] mb-2 justify-center border border-neutral-200 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Feather name="shield" size={22} color="#059669" />
                <Text className="text-2xl font-black text-black">8</Text>
              </View>
              <Text className="text-neutral-500 font-bold text-xs mt-1">
                Secure Notes
              </Text>
            </View>
            <View className="bg-white p-5 rounded-[28px] h-[85px] justify-center border border-neutral-200 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Feather name="key" size={22} color="#4F46E5" />
                <Text className="text-2xl font-black text-black">24</Text>
              </View>
              <Text className="text-neutral-500 font-bold text-xs mt-1">
                Passwords
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions (Floating Pill style) */}
        <View className="bg-white rounded-full p-2 flex-row justify-between items-center mb-10 shadow-lg shadow-neutral-200/50 border border-neutral-100">
          <TouchableOpacity
            className="flex-1 py-4 items-center rounded-full bg-neutral-100/50 flex-row justify-center mx-1"
            onPress={handleUploadPress}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="black" size="small" />
            ) : (
              <Feather name="upload" size={18} color="black" />
            )}
            <Text className="font-bold text-black ml-2">Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="w-14 h-14 bg-black rounded-full items-center justify-center mx-1"
            onPress={handleScanDocument}
          >
            <Feather name="camera" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-4 items-center rounded-full bg-neutral-100/50 flex-row justify-center mx-1"
            onPress={() => setNoteModalVisible(true)}
          >
            <Feather name="edit-2" size={18} color="black" />
            <Text className="font-bold text-black ml-2">Note</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Files List */}
        <View>
          <Text className="text-xl font-black text-black mb-6 px-2 tracking-tight">
            Recent Activity
          </Text>
        </View>

        <View className="mb-20">
          {recentFiles.slice(0, 3).map((file) => (
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
                <Text
                  className="text-black font-bold text-lg mb-1 tracking-tight"
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                <View className="flex-row items-center">
                  <Feather name="lock" size={12} color="#737373" />
                  <Text className="text-neutral-500 font-bold text-xs ml-1">
                    {file.size} • AES-256
                  </Text>
                </View>
              </View>
              <View className="w-10 h-10 items-center justify-center bg-neutral-50 rounded-full">
                <Feather name="chevron-right" size={20} color="black" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pin Unlock Modal */}
        <Modal visible={pinModalVisible} transparent animationType="slide">
          <View className="flex-1 justify-center items-center bg-black/60">
            <View className="bg-white p-6 rounded-[32px] w-[85%] items-center shadow-2xl">
              <Feather name="lock" size={40} color="black" className="mb-4" />
              <Text className="text-xl font-black text-black mb-2 text-center">
                Unlock Document
              </Text>
              <Text className="text-neutral-500 text-center mb-6">
                Enter your Master PIN to view.
              </Text>
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

        {/* Note Creation Modal */}
        <Modal visible={noteModalVisible} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white pt-6 px-6 pb-10 rounded-t-[32px] h-[80%]">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-black text-black">
                  Secure Note
                </Text>
                <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                  <Feather name="x" size={24} color="black" />
                </TouchableOpacity>
              </View>
              <TextInput
                className="text-xl font-bold bg-neutral-100 p-4 rounded-xl mb-4"
                placeholderTextColor={"gray"}
                placeholder="Note Title"
                value={noteTitle}
                onChangeText={setNoteTitle}
              />
              <TextInput
                className="flex-1 text-black bg-neutral-100 p-4 rounded-xl mb-6 text-lg"
                placeholderTextColor={"gray"}
                placeholder="Write your notes here..."
                multiline
                textAlignVertical="top"
                value={noteContent}
                onChangeText={setNoteContent}
              />
              <TouchableOpacity
                className="bg-black py-4 rounded-full items-center"
                onPress={handleCreateNote}
              >
                <Text className="text-white font-bold text-lg">Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Scan Save Modal */}
        <Modal visible={scanModalVisible} transparent animationType="fade">
          <View className="flex-1 justify-center items-center bg-black/60">
            <View className="bg-white p-6 rounded-[32px] w-[85%] items-center shadow-2xl">
              <Feather
                name="file-text"
                size={40}
                color="#4F46E5"
                className="mb-4"
              />
              <Text className="text-xl font-black text-black mb-2 text-center">
                Save Scanned Document
              </Text>
              <Text className="text-neutral-500 text-center mb-6">
                Enter a name for your PDF document.
              </Text>
              <TextInput
                className="w-full bg-neutral-100 rounded-2xl p-4 text-left text-lg font-bold mb-6"
                value={scannedFileName}
                onChangeText={setScannedFileName}
                placeholder="e.g. Scan"
              />
              <View className="flex-row w-full space-x-3 gap-2">
                <TouchableOpacity
                  className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                  onPress={() => setScanModalVisible(false)}
                >
                  <Text className="font-bold text-black">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-[#4F46E5] py-4 rounded-xl items-center"
                  onPress={handleSaveScannedDoc}
                >
                  <Text className="font-bold text-white">Save PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}
