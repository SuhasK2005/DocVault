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
import PreviewScreen from "../features/scanner/PreviewScreen";
import { createPdfFromPages } from "../features/scanner/pdfUtils";
import { ScannerPage } from "../features/scanner/types";
import { BlurView } from "expo-blur";

const THEME = {
  bg: "#0e0e0e",
  surface: "#1a1919",
  surfaceBright: "#2c2c2c",
  accent: "#ff9157",
  textMuted: "#adaaaa",
  borderGlass: "rgba(173, 170, 170, 0.1)",
};

type FolderNode = {
  id: string;
  name: string;
  parent_id: string | null;
};

type ScannerStep = "camera" | "crop" | "preview";

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = React.useState<ScannerStep>("camera");
  const [capturedUri, setCapturedUri] = React.useState<string | null>(null);
  const [croppedUri, setCroppedUri] = React.useState<string | null>(null);
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

  const appendPage = React.useCallback(
    (uri: string) => {
      setPages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          imageUri: uri,
        },
      ]);
      setCapturedUri(null);
      setCroppedUri(null);
      setStep("preview");
    },
    []
  );

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
        />
      );
    }

    if (step === "crop" && capturedUri) {
      return (
        <CropScreen
          imageUri={capturedUri}
          onBack={() => setStep("camera")}
          onCropped={(uri) => {
            appendPage(uri);
          }}
        />
      );
    }



    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
        <BlurView
          tint="dark"
          intensity={80}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingTop: 56,
            paddingBottom: 24,
          }}
        >
          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: THEME.surfaceBright,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: THEME.borderGlass,
            }}
            onPress={() => navigation.goBack()}
          >
            <Feather name="x" size={20} color="white" />
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 18, fontFamily: "SpaceGrotesk_Bold" }}>
              Scanner
            </Text>
            <Text style={{ color: THEME.textMuted, fontSize: 10, fontFamily: "SpaceGrotesk_Bold", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
              VAULT INTAKE
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </BlurView>

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
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.8)" }}>
            <View
              style={{
                backgroundColor: THEME.surface,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: 40,
                height: "80%",
                borderWidth: 1,
                borderColor: THEME.borderGlass,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 24,
                }}
              >
                <Text style={{ color: "white", fontSize: 24, fontFamily: "SpaceGrotesk_Bold" }}>
                  Vault Location
                </Text>
                <TouchableOpacity onPress={() => setFolderPickerVisible(false)}>
                  <Feather name="x" size={24} color={THEME.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {folders.length === 0 ? (
                  <View style={{ paddingVertical: 32, alignItems: "center" }}>
                    <Text style={{ color: THEME.textMuted, fontFamily: "Manrope_Bold" }}>
                      No folders found.
                    </Text>
                  </View>
                ) : (
                  folders.map((folder) => {
                    const selected = selectedFolderId === folder.id;
                    return (
                      <TouchableOpacity
                        key={folder.id}
                        style={{
                          padding: 16,
                          borderRadius: 20,
                          backgroundColor: selected ? THEME.surfaceBright : "transparent",
                          borderWidth: 1,
                          borderColor: selected ? THEME.accent : THEME.borderGlass,
                          marginBottom: 12,
                        }}
                        onPress={() => {
                          setSelectedFolderId(folder.id);
                          setFolderPickerVisible(false);
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "white" : THEME.textMuted,
                            fontFamily: "Manrope_Bold",
                            fontSize: 16,
                          }}
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: THEME.bg }}>
        <ActivityIndicator color={THEME.accent} />
        <Text style={{ color: THEME.textMuted, fontFamily: "SpaceGrotesk_Bold", marginTop: 16 }}>
          PREPARING VAULT...
        </Text>
      </View>
    );
  }

  return renderContent();
}
