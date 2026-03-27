import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { WebView } from "react-native-webview";
import { BlurView } from "expo-blur";
import { supabase } from "../services/supabase";

let PdfComponent: any = null;
try {
  // In Expo Go this module may be unavailable; fallback UI is handled below.
  PdfComponent = require("react-native-pdf").default;
} catch {
  PdfComponent = null;
}

type ViewerKind = "pdf" | "image" | "text" | "unsupported";

type ViewerRouteParams = {
  id: string;
  name: string;
  storagePath: string;
  mimeType?: string | null;
};

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json", "log", "xml"]);
const DOCUMENT_CACHE_DIR = `${FileSystem.cacheDirectory}docvault-view-cache`;

const getExtension = (value: string) => {
  const clean = value.split("?")[0];
  const dot = clean.lastIndexOf(".");
  if (dot === -1) return "";
  return clean.slice(dot + 1).toLowerCase();
};

const detectViewerKind = (params: ViewerRouteParams): ViewerKind => {
  const extFromName = getExtension(params.name || "");
  const extFromPath = getExtension(params.storagePath || "");
  const ext = extFromName || extFromPath;
  const mime = (params.mimeType || "").toLowerCase();

  if (ext === "pdf" || mime === "application/pdf") {
    return "pdf";
  }
  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith("image/")) {
    return "image";
  }
  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith("text/")) {
    return "text";
  }

  return "unsupported";
};

const getSignedDocumentUrl = async (
  storagePath: string,
  expiresInSeconds = 120,
) => {
  const { data, error } = await supabase.storage
    .from("vault_documents")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Unable to create secure download URL.");
  }

  return data.signedUrl;
};

const ensureDocumentCacheDir = async () => {
  const info = await FileSystem.getInfoAsync(DOCUMENT_CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOCUMENT_CACHE_DIR, {
      intermediates: true,
    });
  }
};

const getDocumentCachePath = async (storagePath: string, fileName: string) => {
  await ensureDocumentCacheDir();

  const normalizedName = (fileName || "document")
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 80);
  const encodedKey = encodeURIComponent(storagePath);

  return `${DOCUMENT_CACHE_DIR}/${encodedKey}__${normalizedName}`;
};

const THEME = {
  bg: "#0e0e0e",
  surface: "#1a1919",
  surfaceBright: "#2c2c2c",
  accent: "#ff9157",
  textMuted: "#adaaaa",
  borderGlass: "rgba(173, 170, 170, 0.1)",
};

export default function DocumentViewerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as ViewerRouteParams;

  const [loading, setLoading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [remotePdfUrl, setRemotePdfUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>("");
  const [textDraft, setTextDraft] = useState<string>("");
  const [isEditingText, setIsEditingText] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = useMemo(() => detectViewerKind(params), [params]);

  const loadDocument = useCallback(async () => {
    if (!params?.storagePath) {
      setError("Invalid document reference.");
      return;
    }

    setError(null);

    try {
      const cachePath = await getDocumentCachePath(
        params.storagePath,
        params.name,
      );
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);

      if (cacheInfo.exists) {
        setLocalUri(cachePath);

        if (kind === "pdf" && !PdfComponent) {
          const signedUrl = await getSignedDocumentUrl(params.storagePath, 120);
          setRemotePdfUrl(signedUrl);
        }

        if (kind === "text") {
          const content = await FileSystem.readAsStringAsync(cachePath);
          setTextContent(content);
          setTextDraft(content);
          setIsEditingText(false);
        }
        return;
      }

      setLoading(true);
      const signedUrl = await getSignedDocumentUrl(params.storagePath, 90);
      if (kind === "pdf" && !PdfComponent) {
        setRemotePdfUrl(signedUrl);
      }
      const downloadResult = await FileSystem.downloadAsync(
        signedUrl,
        cachePath,
      );
      setLocalUri(downloadResult.uri);

      if (kind === "text") {
        const content = await FileSystem.readAsStringAsync(downloadResult.uri);
        setTextContent(content);
        setTextDraft(content);
        setIsEditingText(false);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not open this document.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [kind, params?.name, params?.storagePath]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const openWithFallback = async () => {
    if (!localUri) {
      Alert.alert("Not Ready", "The file is not available yet.");
      return;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert("Unsupported", "Sharing is not available on this device.");
      return;
    }

    await Sharing.shareAsync(localUri);
  };

  const handleEditText = () => {
    if (kind !== "text") return;
    setIsEditingText(true);
  };

  const handleSaveText = async () => {
    if (kind !== "text" || savingText) return;
    if (textDraft === textContent) {
      setIsEditingText(false);
      return;
    }

    try {
      setSavingText(true);
      const { Buffer } = require("buffer");
      const payload = Buffer.from(textDraft, "utf-8");

      const { error: uploadError } = await supabase.storage
        .from("vault_documents")
        .upload(params.storagePath, payload, {
          contentType: "text/plain; charset=utf-8",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("documents")
        .update({ size_bytes: Buffer.byteLength(textDraft, "utf8") })
        .eq("id", params.id);

      if (dbError) throw dbError;

      setTextContent(textDraft);
      setIsEditingText(false);
      Alert.alert("Saved", "Note updated successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save this note.";
      Alert.alert("Error", message);
    } finally {
      setSavingText(false);
    }
  };

  const renderBody = () => {
    if (error) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <View
            style={{
              backgroundColor: THEME.surface,
              padding: 32,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: THEME.borderGlass,
              alignItems: "center",
              width: "100%",
            }}
          >
            <Feather
              name="alert-triangle"
              size={48}
              color="#FF453A"
              style={{ marginBottom: 20 }}
            />
            <Text
              style={{
                color: "white",
                fontSize: 20,
                fontFamily: "SpaceGrotesk_Bold",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Vault Error
            </Text>
            <Text
              style={{
                color: THEME.textMuted,
                textAlign: "center",
                marginBottom: 24,
                fontFamily: "Manrope_Bold",
              }}
            >
              {error}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: THEME.accent,
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: 16,
              }}
              onPress={loadDocument}
            >
              <Text style={{ color: "#3d1a08", fontFamily: "SpaceGrotesk_Bold" }}>
                Retry Access
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={THEME.accent} />
          <Text
            style={{
              color: THEME.textMuted,
              marginTop: 16,
              fontFamily: "SpaceGrotesk_Bold",
              letterSpacing: 1,
            }}
          >
            DECRYPTING...
          </Text>
        </View>
      );
    }

    if (!localUri) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-400">Preparing file...</Text>
        </View>
      );
    }

    if (kind === "pdf") {
      if (!PdfComponent) {
        if (!remotePdfUrl) {
          return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color={THEME.accent} />
            </View>
          );
        }

        const gviewUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
          remotePdfUrl
        )}`;

        return (
          <View
            style={{
              flex: 1,
              backgroundColor: THEME.surface,
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: THEME.borderGlass,
            }}
          >
            <WebView
              source={{ uri: gviewUrl }}
              originWhitelist={["*"]}
              startInLoadingState
              renderLoading={() => (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: THEME.bg,
                  }}
                >
                  <ActivityIndicator size="large" color={THEME.accent} />
                </View>
              )}
            />
          </View>
        );
      }

      return (
        <View
          style={{
            flex: 1,
            backgroundColor: THEME.surface,
            borderRadius: 24,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
        >
          <PdfComponent
            source={{ uri: localUri, cache: true }}
            style={{ flex: 1 }}
            trustAllCerts={false}
          />
        </View>
      );
    }

    if (kind === "image") {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: THEME.surface,
            borderRadius: 24,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
        >
          <Image
            source={{ uri: localUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
      );
    }

    if (kind === "text") {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: THEME.surface,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
        >
          {isEditingText ? (
            <TextInput
              style={{
                flex: 1,
                color: "white",
                fontSize: 16,
                fontFamily: "Manrope_Bold",
                lineHeight: 24,
              }}
              multiline
              autoFocus
              textAlignVertical="top"
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Secure entry..."
              placeholderTextColor={THEME.textMuted}
            />
          ) : (
            <TouchableOpacity
              activeOpacity={0.95}
              style={{ flex: 1 }}
              onPress={handleEditText}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text
                  style={{
                    color: "white",
                    fontSize: 16,
                    fontFamily: "Manrope_Bold",
                    lineHeight: 24,
                  }}
                >
                  {textContent || "This vault entry is empty. Tap to edit."}
                </Text>
              </ScrollView>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-lg font-[Manrope_Bold] mb-2 text-center">
          Unsupported Preview Type
        </Text>
        <Text className="text-neutral-400 text-center mb-6">
          This file type cannot be rendered in-app yet. Open it with another
          app.
        </Text>
        <TouchableOpacity
          className="bg-white py-3 px-6 rounded-xl"
          onPress={openWithFallback}
        >
          <Text className="text-black font-[Manrope_Bold]">Open File</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar style="light" />

      {/* Glassmorphic Header */}
      <View style={{ position: "relative", zIndex: 10 }}>
        <BlurView
          tint="dark"
          intensity={80}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 24,
          }}
        >
          <TouchableOpacity
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: THEME.surfaceBright,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: THEME.borderGlass,
            }}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={20} color="white" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 16 }}>
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontFamily: "SpaceGrotesk_Bold",
              }}
              numberOfLines={1}
            >
              {params?.name || "Vault Document"}
            </Text>
            <Text
              style={{
                color: THEME.textMuted,
                fontSize: 10,
                fontFamily: "SpaceGrotesk_Bold",
                marginTop: 2,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {kind === "unsupported" ? "External Link" : `${kind} ACCESS`}
            </Text>
          </View>

          {kind === "text" ? (
            <TouchableOpacity
              style={{
                paddingHorizontal: 20,
                height: 48,
                borderRadius: 16,
                backgroundColor: THEME.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={isEditingText ? handleSaveText : handleEditText}
              disabled={savingText}
            >
              {savingText ? (
                <ActivityIndicator size="small" color="#3d1a08" />
              ) : (
                <Text
                  style={{
                    color: "#3d1a08",
                    fontFamily: "SpaceGrotesk_Bold",
                    fontSize: 14,
                  }}
                >
                  {isEditingText ? "SYNC" : "EDIT"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: THEME.surfaceBright,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: THEME.borderGlass,
              }}
              onPress={openWithFallback}
            >
              <Feather name="share-2" size={20} color="white" />
            </TouchableOpacity>
          )}
        </BlurView>
      </View>

      <View style={{ flex: 1, padding: 24 }}>{renderBody()}</View>
    </SafeAreaView>
  );
}
