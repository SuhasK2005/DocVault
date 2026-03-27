import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "../services/supabase";
import { useAuthStore } from "../stores/useAuthStore";
import CameraScreen from "../features/scanner/CameraScreen";
import CropScreen from "../features/scanner/CropScreen";
import FilterScreen from "../features/scanner/FilterScreen";
import PreviewScreen from "../features/scanner/PreviewScreen";
import { createPdfFromPages } from "../features/scanner/pdfUtils";
import { ScannerFilter, ScannerPage } from "../features/scanner/types";

type FolderNode = {
  id: string;
  name: string;
  parent_id: string | null;
};

type ScannerStep = "camera" | "crop" | "filter" | "preview";

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = React.useState<ScannerStep>("camera");
  const [capturedUri, setCapturedUri] = React.useState<string | null>(null);
  const [croppedUri, setCroppedUri] = React.useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = React.useState<ScannerFilter>("original");
  const [pages, setPages] = React.useState<ScannerPage[]>([]);
  const [fileName, setFileName] = React.useState("Scan");
  const [uploading, setUploading] = React.useState(false);

  const [folders, setFolders] = React.useState<FolderNode[]>([]);
  const [folderPickerVisible, setFolderPickerVisible] = React.useState(false);
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(
    route.params?.folderId || null,
  );

  React.useEffect(() => {
    if (!user?.id) return;

    const loadFolders = async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("Error", error.message || "Could not load folders");
        return;
      }

      setFolders((data || []) as FolderNode[]);
    };

    loadFolders();
  }, [user?.id]);

  const selectedFolderName = React.useMemo(() => {
    const picked = folders.find((folder) => folder.id === selectedFolderId);
    if (picked) return picked.name;
    if (route.params?.folderName) return route.params.folderName;
    return "No folder selected";
  }, [folders, route.params?.folderName, selectedFolderId]);

  const appendPage = React.useCallback(() => {
    if (!croppedUri) return;

    setPages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        imageUri: croppedUri,
        filter: selectedFilter,
      },
    ]);
    setCapturedUri(null);
    setCroppedUri(null);
    setSelectedFilter("original");
    setStep("preview");
  }, [croppedUri, selectedFilter]);

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert("Session Error", "Please sign in again and retry.");
      return;
    }

    if (!selectedFolderId) {
      Alert.alert("Folder Required", "Select a folder before saving.");
      return;
    }

    if (!fileName.trim()) {
      Alert.alert("Required", "Please enter a file name.");
      return;
    }

    if (!pages.length) {
      Alert.alert("Required", "Scan at least one page.");
      return;
    }

    try {
      setUploading(true);

      const pdf = await createPdfFromPages({
        pages,
        fileName,
      });

      const fileBase64 = await FileSystem.readAsStringAsync(pdf.uri, {
        // @ts-ignore Expo legacy file system typing
        encoding: "base64",
      });

      const { Buffer } = require("buffer");
      const fileBuffer = Buffer.from(fileBase64, "base64");
      const storagePath = `${user.id}/${Date.now()}-${pdf.fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("vault_documents")
        .upload(storagePath, fileBuffer, {
          contentType: "application/pdf",
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        folder_id: selectedFolderId,
        name: pdf.fileName,
        size_bytes: pdf.size ?? fileBuffer.length,
        mime_type: "application/pdf",
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Scanned document saved.");
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not save scanned document");
    } finally {
      setUploading(false);
    }
  };

  const renderContent = () => {
    if (step === "camera") {
      return (
        <CameraScreen
          onCaptured={(uri) => {
            setCapturedUri(uri);
            setStep("crop");
          }}
          onCancel={() => navigation.goBack()}
          pageCount={pages.length}
        />
      );
    }

    if (step === "crop" && capturedUri) {
      return (
        <CropScreen
          imageUri={capturedUri}
          onBack={() => setStep("camera")}
          onCropped={(uri) => {
            setCroppedUri(uri);
            setStep("filter");
          }}
        />
      );
    }

    if (step === "filter" && croppedUri) {
      return (
        <FilterScreen
          imageUri={croppedUri}
          selected={selectedFilter}
          onSelect={setSelectedFilter}
          onBack={() => setStep("crop")}
          onNext={appendPage}
        />
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-[#F4F4F5]">
        <View className="px-5 pt-2 pb-1 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="font-bold text-black">Close</Text>
          </TouchableOpacity>
          <Text className="font-bold text-black">Scanner</Text>
          <View style={{ width: 40 }} />
        </View>

        <PreviewScreen
          pages={pages}
          fileName={fileName}
          onChangeFileName={setFileName}
          selectedFolderName={selectedFolderName}
          onPickFolder={() => setFolderPickerVisible(true)}
          onAddPage={() => setStep("camera")}
          onSave={handleSave}
          onRemovePage={(pageId) =>
            setPages((prev) => prev.filter((page) => page.id !== pageId))
          }
          uploading={uploading}
        />

        <Modal visible={folderPickerVisible} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white rounded-t-[28px] pt-5 px-5 pb-8 h-[70%]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-2xl font-black text-black">Select Folder</Text>
                <TouchableOpacity onPress={() => setFolderPickerVisible(false)}>
                  <Feather name="x" size={22} color="black" />
                </TouchableOpacity>
              </View>

              <ScrollView>
                {folders.length === 0 ? (
                  <View className="py-8 items-center">
                    <Text className="text-neutral-500 font-bold">No folders found.</Text>
                  </View>
                ) : (
                  folders.map((folder) => {
                    const selected = selectedFolderId === folder.id;
                    return (
                      <TouchableOpacity
                        key={folder.id}
                        className={`p-4 rounded-xl border mb-3 ${
                          selected
                            ? "bg-black border-black"
                            : "bg-neutral-50 border-neutral-200"
                        }`}
                        onPress={() => {
                          setSelectedFolderId(folder.id);
                          setFolderPickerVisible(false);
                        }}
                      >
                        <Text
                          className={`font-bold ${
                            selected ? "text-white" : "text-black"
                          }`}
                        >
                          {folder.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  };

  if (uploading && step !== "preview") {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return renderContent();
}
