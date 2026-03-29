import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Image,
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

type ScannerStep =
  | "camera"
  | "crop"
  | "cropped_preview"
  | "preview"
  | "final_pdf_preview";

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = React.useState<ScannerStep>("camera");
  const [capturedUri, setCapturedUri] = React.useState<string | null>(null);
  const [croppedUri, setCroppedUri] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState<ScannerPage[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [finalPdfUri, setFinalPdfUri] = React.useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = React.useState(false);

  const [folders, setFolders] = React.useState<FolderNode[]>([]);
  const [folderPickerVisible, setFolderPickerVisible] = React.useState(false);
  const [pickerStack, setPickerStack] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
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

  const currentPickerFolderId = React.useMemo(
    () => (pickerStack.length ? pickerStack[pickerStack.length - 1].id : null),
    [pickerStack],
  );

  const currentPickerFolderName = React.useMemo(
    () =>
      pickerStack.length
        ? pickerStack[pickerStack.length - 1].name
        : "Main Vault",
    [pickerStack],
  );

  const visiblePickerFolders = React.useMemo(() => {
    return folders.filter(
      (folder) => (folder.parent_id || null) === currentPickerFolderId,
    );
  }, [folders, currentPickerFolderId]);

  const foldersWithChildren = React.useMemo(() => {
    const parentSet = new Set<string>();
    folders.forEach((folder) => {
      if (folder.parent_id) {
        parentSet.add(folder.parent_id);
      }
    });
    return parentSet;
  }, [folders]);

  const selectedFolderName = React.useMemo(() => {
    const picked = folders.find((folder) => folder.id === selectedFolderId);
    if (picked) return picked.name;
    if (route.params?.folderName) return route.params.folderName;
    return "Select folder";
  }, [folders, route.params?.folderName, selectedFolderId]);

  const handlePickerFolderTap = (folder: FolderNode) => {
    if (foldersWithChildren.has(folder.id)) {
      setPickerStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
      return;
    }

    setSelectedFolderId(folder.id);
    setFolderPickerVisible(false);
  };

  const appendPage = React.useCallback((uri: string) => {
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
  }, []);

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
        fileName: fileName.trim() || "Scan",
      });

      setFinalPdfUri(pdf.uri);
      setStep("final_pdf_preview");

      // Start background upload
      (async () => {
        try {
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

          setUploadComplete(true);
          Alert.alert("Success", "Scanned document saved to vault.");
        } catch (err: any) {
          Alert.alert(
            "Upload Error",
            err?.message || "Could not save scanned document in background.",
          );
        } finally {
          setUploading(false);
        }
      })();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not generate PDF");
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
          onCancel={() => {
            if (pages.length > 0) {
              setStep("preview");
            } else {
              navigation.goBack();
            }
          }}
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
            setStep("cropped_preview");
          }}
        />
      );
    }

    if (step === "cropped_preview" && croppedUri) {
      return (
        <View style={{ flex: 1, backgroundColor: THEME.bg }}>
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
              onPress={() => setStep("crop")}
            >
              <Feather name="arrow-left" size={20} color="white" />
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  fontFamily: "SpaceGrotesk_Bold",
                }}
              >
                Confirm Crop
              </Text>
              <Text
                style={{
                  color: THEME.textMuted,
                  fontSize: 10,
                  fontFamily: "SpaceGrotesk_Bold",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                QUALITY CHECK
              </Text>
            </View>

            <View style={{ width: 44 }} />
          </BlurView>

          <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 20 }}>
            <View
              style={{
                width: "100%",
                aspectRatio: 2 / 3,
                alignSelf: "center",
                borderRadius: 24,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: THEME.borderGlass,
                backgroundColor: "#ffffff",
              }}
            >
              <Image
                source={{ uri: croppedUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", padding: 24, gap: 16 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                height: 56,
                borderRadius: 18,
                backgroundColor: THEME.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: THEME.borderGlass,
              }}
              onPress={() => setStep("camera")}
            >
              <Text
                style={{
                  color: "white",
                  fontFamily: "SpaceGrotesk_Bold",
                  fontSize: 16,
                }}
              >
                RETAKE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 2,
                height: 56,
                borderRadius: 18,
                backgroundColor: THEME.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => appendPage(croppedUri)}
            >
              <Text
                style={{
                  color: "#3d1a08",
                  fontFamily: "SpaceGrotesk_Bold",
                  fontSize: 16,
                }}
              >
                CONTINUE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (step === "final_pdf_preview" && finalPdfUri) {
      return (
        <View style={{ flex: 1, backgroundColor: THEME.bg }}>
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
            <View style={{ width: 44 }} />

            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  fontFamily: "SpaceGrotesk_Bold",
                }}
              >
                Final Document
              </Text>
              <Text
                style={{
                  color: THEME.textMuted,
                  fontSize: 10,
                  fontFamily: "SpaceGrotesk_Bold",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {uploadComplete ? "UPLOADED" : "SECURING..."}
              </Text>
            </View>

            {uploadComplete ? (
              <TouchableOpacity
                style={{
                  paddingHorizontal: 16,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: THEME.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => navigation.goBack()}
              >
                <Text
                  style={{
                    color: "#3d1a08",
                    fontFamily: "SpaceGrotesk_Bold",
                    fontSize: 14,
                  }}
                >
                  DONE
                </Text>
              </TouchableOpacity>
            ) : (
              <ActivityIndicator color={THEME.accent} />
            )}
          </BlurView>

          <View
            style={{
              flex: 1,
              margin: 24,
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: THEME.borderGlass,
              backgroundColor: THEME.surface,
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {pages.map((p, idx) => (
                <View
                  key={p.id}
                  style={{ marginBottom: 20, paddingHorizontal: 16 }}
                >
                  <View
                    style={{
                      alignSelf: "flex-start",
                      marginBottom: 8,
                      backgroundColor: THEME.surfaceBright,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: THEME.borderGlass,
                    }}
                  >
                    <Text
                      style={{
                        color: THEME.accent,
                        fontSize: 10,
                        fontFamily: "SpaceGrotesk_Bold",
                      }}
                    >
                      PAGE {idx + 1}
                    </Text>
                  </View>

                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 2 / 3,
                      backgroundColor: "#ffffff",
                      borderRadius: 10,
                      overflow: "hidden",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35,
                      shadowRadius: 10,
                      elevation: 7,
                    }}
                  >
                    <Image
                      source={{ uri: p.imageUri }}
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#ffffff",
                      }}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Status Overlay */}
            {!uploadComplete && (
              <BlurView
                tint="dark"
                intensity={40}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 20,
                  alignItems: "center",
                }}
              >
                <ActivityIndicator
                  color={THEME.accent}
                  style={{ marginBottom: 8 }}
                />
                <Text
                  style={{
                    color: "white",
                    fontFamily: "SpaceGrotesk_Bold",
                    fontSize: 12,
                  }}
                >
                  SYNCING TO VAULT...
                </Text>
              </BlurView>
            )}
          </View>

          {uploadComplete && (
            <View style={{ paddingBottom: 40, alignItems: "center" }}>
              <View
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Feather name="check-circle" size={16} color="#22c55e" />
                <Text
                  style={{
                    color: "#22c55e",
                    fontFamily: "Manrope_Bold",
                    fontSize: 14,
                  }}
                >
                  Safe in Vault
                </Text>
              </View>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: THEME.bg }}>
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
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontFamily: "SpaceGrotesk_Bold",
              }}
            >
              Scanner
            </Text>
            <Text
              style={{
                color: THEME.textMuted,
                fontSize: 10,
                fontFamily: "SpaceGrotesk_Bold",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
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

        <Modal visible={folderPickerVisible} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.85)",
            }}
          >
            <View
              style={{
                backgroundColor: THEME.surface,
                borderRadius: 32,
                width: "90%",
                padding: 24,
                borderWidth: 1,
                borderColor: THEME.borderGlass,
              }}
            >
              <View className="items-center mb-6">
                <Feather
                  name="folder"
                  size={32}
                  color={THEME.accent}
                  style={{ marginBottom: 12 }}
                />
                <Text
                  style={{
                    color: "white",
                    fontSize: 20,
                    fontFamily: "SpaceGrotesk_Bold",
                    textAlign: "center",
                    marginBottom: 4,
                  }}
                >
                  Vault Location
                </Text>
                <Text style={{ color: THEME.textMuted, fontSize: 13 }}>
                  In: {currentPickerFolderName}
                </Text>
              </View>

              <ScrollView
                style={{ maxHeight: 300, marginBottom: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Back up button */}
                {pickerStack.length > 0 && (
                  <TouchableOpacity
                    style={{
                      padding: 16,
                      backgroundColor: THEME.surfaceBright,
                      borderRadius: 16,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                    onPress={() => setPickerStack((prev) => prev.slice(0, -1))}
                  >
                    <Feather name="arrow-left" size={16} color="white" />
                    <Text
                      style={{
                        color: "white",
                        fontFamily: "Manrope_Bold",
                        marginLeft: 8,
                      }}
                    >
                      Back Up
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Vault Root Picker (only at top level) */}
                {pickerStack.length === 0 && (
                  <TouchableOpacity
                    style={{
                      padding: 16,
                      backgroundColor:
                        selectedFolderId === null
                          ? THEME.surfaceBright
                          : "transparent",
                      borderWidth: 1,
                      borderColor:
                        selectedFolderId === null
                          ? THEME.accent
                          : THEME.borderGlass,
                      borderRadius: 16,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                    onPress={() => {
                      setSelectedFolderId(null);
                      setFolderPickerVisible(false);
                    }}
                  >
                    <Feather name="shield" size={16} color={THEME.accent} />
                    <Text
                      style={{
                        color: "white",
                        fontFamily: "Manrope_Bold",
                        marginLeft: 12,
                      }}
                    >
                      Main Vault
                    </Text>
                  </TouchableOpacity>
                )}

                {visiblePickerFolders.length === 0 && pickerStack.length > 0 ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text
                      style={{ color: THEME.textMuted, fontStyle: "italic" }}
                    >
                      No subfolders here.
                    </Text>
                  </View>
                ) : (
                  visiblePickerFolders.map((folder) => {
                    const selected = selectedFolderId === folder.id;
                    return (
                      <TouchableOpacity
                        key={folder.id}
                        style={{
                          padding: 16,
                          backgroundColor: selected
                            ? THEME.surfaceBright
                            : "transparent",
                          borderWidth: 1,
                          borderColor: selected
                            ? THEME.accent
                            : THEME.borderGlass,
                          borderRadius: 16,
                          marginBottom: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                        onPress={() => handlePickerFolderTap(folder)}
                      >
                        <Text
                          style={{
                            color: selected ? "white" : THEME.textMuted,
                            fontFamily: "Manrope_Bold",
                            fontSize: 15,
                          }}
                          numberOfLines={1}
                        >
                          {folder.name}
                        </Text>
                        {foldersWithChildren.has(folder.id) && (
                          <Feather
                            name="chevron-right"
                            size={16}
                            color={THEME.textMuted}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: THEME.surfaceBright,
                    padding: 16,
                    borderRadius: 16,
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setFolderPickerVisible(false);
                    setPickerStack([]);
                  }}
                >
                  <Text style={{ color: "white", fontFamily: "Manrope_Bold" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                {/* Always allow selecting current folder if not already selected */}
                {currentPickerFolderId !== selectedFolderId && (
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: THEME.accent,
                      padding: 16,
                      borderRadius: 16,
                      alignItems: "center",
                    }}
                    onPress={() => {
                      setSelectedFolderId(currentPickerFolderId);
                      setFolderPickerVisible(false);
                    }}
                  >
                    <Text
                      style={{ color: "black", fontFamily: "Manrope_Bold" }}
                    >
                      Select Folder
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

  if (uploading && step !== "preview") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: THEME.bg,
        }}
      >
        <ActivityIndicator color={THEME.accent} />
        <Text
          style={{
            color: THEME.textMuted,
            fontFamily: "SpaceGrotesk_Bold",
            marginTop: 16,
          }}
        >
          PREPARING VAULT...
        </Text>
      </View>
    );
  }

  return renderContent();
}
