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
import * as WebBrowser from "expo-web-browser";
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

  const openPdfInBrowser = async () => {
    try {
      const url =
        remotePdfUrl || (await getSignedDocumentUrl(params.storagePath, 90));
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not open PDF in browser.";
      Alert.alert("Error", message);
    }
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
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white text-lg font-bold mb-2 text-center">
            Unable to open file
          </Text>
          <Text className="text-neutral-400 text-center mb-6">{error}</Text>
          <TouchableOpacity
            className="bg-white py-3 px-6 rounded-xl"
            onPress={loadDocument}
          >
            <Text className="text-black font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-neutral-400 mt-3 font-semibold">
            Loading document...
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
            <View className="flex-1 items-center justify-center px-8">
              <ActivityIndicator size="large" color="#ffffff" />
              <Text className="text-neutral-400 mt-3 font-semibold">
                Preparing PDF viewer...
              </Text>
            </View>
          );
        }

        return (
          <View className="flex-1 bg-neutral-950 rounded-2xl overflow-hidden items-center justify-center px-8">
            <Text className="text-neutral-200 text-center mb-4">
              PDF inline preview needs additional native modules. Open it in the
              browser.
            </Text>
            <TouchableOpacity
              className="bg-white py-3 px-6 rounded-xl"
              onPress={openPdfInBrowser}
            >
              <Text className="text-black font-bold">Open PDF</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View className="flex-1 bg-neutral-950 rounded-2xl overflow-hidden">
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
        <View className="flex-1 items-center justify-center bg-neutral-950 rounded-2xl overflow-hidden">
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
        <View className="flex-1 bg-neutral-950 rounded-2xl px-4 py-4">
          {isEditingText ? (
            <TextInput
              className="flex-1 text-neutral-100 text-base leading-6"
              multiline
              autoFocus
              textAlignVertical="top"
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Start typing..."
              placeholderTextColor="#737373"
            />
          ) : (
            <TouchableOpacity
              activeOpacity={0.95}
              className="flex-1"
              onPress={handleEditText}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-neutral-100 text-base leading-6">
                  {textContent || "Tap to edit this note."}
                </Text>
              </ScrollView>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-lg font-bold mb-2 text-center">
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
          <Text className="text-black font-bold">Open File</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]">
      <StatusBar style="light" />

      <View className="px-5 pt-2 pb-4 flex-row items-center justify-between">
        <TouchableOpacity
          className="w-11 h-11 rounded-xl border border-neutral-800 items-center justify-center"
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color="#FAFAFA" />
        </TouchableOpacity>

        <View className="flex-1 mx-4">
          <Text className="text-white text-base font-bold" numberOfLines={1}>
            {params?.name || "Document Viewer"}
          </Text>
          <Text className="text-neutral-500 text-xs mt-1 uppercase tracking-wide">
            {kind === "unsupported" ? "External Viewer" : `${kind} preview`}
          </Text>
        </View>

        {kind === "text" ? (
          <TouchableOpacity
            className="px-4 h-11 rounded-xl border bg-orange-500 border-neutral-800 items-center justify-center"
            onPress={isEditingText ? handleSaveText : handleEditText}
            disabled={savingText}
          >
            {savingText ? (
              <ActivityIndicator size="small" color="#FAFAFA" />
            ) : (
              <Text className="text-neutral-100 font-bold">
                {isEditingText ? "Save" : "Edit"}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="w-11 h-11 rounded-xl border border-neutral-800 items-center justify-center"
            onPress={openWithFallback}
          >
            <Feather name="share-2" size={18} color="#FAFAFA" />
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-1 px-4 pb-4">{renderBody()}</View>
    </SafeAreaView>
  );
}
