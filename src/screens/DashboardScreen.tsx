import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { supabase } from "../services/supabase";
import { useAuthStore } from "../stores/useAuthStore";

let globalDocumentPickerActive = false;
let globalMediaPickerActive = false;

type PendingAction = "uploadFiles" | "uploadGallery" | "scan" | "note" | null;

type FolderNode = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string;
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const setUnlocked = useAuthStore((state) => state.setUnlocked);

  const [documentsCount, setDocumentsCount] = useState(0);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [pickerStack, setPickerStack] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [folderCreateVisible, setFolderCreateVisible] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [supportsNestedFolders, setSupportsNestedFolders] = useState(true);

  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);
  const [scannedFileName, setScannedFileName] = useState("");

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const [launchingAction, setLaunchingAction] = useState(false);
  const [documentPickerBusy, setDocumentPickerBusy] = useState(false);
  const [mediaPickerBusy, setMediaPickerBusy] = useState(false);
  const [activeDestinationFolderId, setActiveDestinationFolderId] = useState<
    string | null
  >(null);
  const actionLockRef = useRef(false);
  const pickerLockRef = useRef(false);

  const currentPickerFolderId = useMemo(
    () => (pickerStack.length ? pickerStack[pickerStack.length - 1].id : null),
    [pickerStack]
  );

  const currentPickerFolderName = useMemo(
    () =>
      pickerStack.length
        ? pickerStack[pickerStack.length - 1].name
        : "File Hub",
    [pickerStack]
  );

  const visiblePickerFolders = useMemo(() => {
    return folders.filter(
      (folder) => (folder.parent_id || null) === currentPickerFolderId
    );
  }, [folders, currentPickerFolderId]);

  const foldersWithChildren = useMemo(() => {
    const parentSet = new Set<string>();
    folders.forEach((folder) => {
      if (folder.parent_id) {
        parentSet.add(folder.parent_id);
      }
    });
    return parentSet;
  }, [folders]);

  const recentFolders = useMemo(() => folders.slice(0, 4), [folders]);

  const fetchDocumentsCount = async () => {
    if (!user?.id) return;
    try {
      const { count, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) throw error;
      setDocumentsCount(count || 0);
    } catch {
      setDocumentsCount(0);
    }
  };

  const fetchRecentDocuments = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, size_bytes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentDocs(data || []);
    } catch {
      setRecentDocs([]);
    }
  };

  const fetchFolders = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("folders")
        .select("id, name, parent_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        const missingParentColumn =
          error.message?.toLowerCase().includes("parent_id") ||
          error.code === "42703";

        if (!missingParentColumn) throw error;

        setSupportsNestedFolders(false);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("folders")
          .select("id, name, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (fallbackError) throw fallbackError;

        setFolders(
          ((fallbackData || []) as any[]).map((folder) => ({
            id: folder.id,
            name: folder.name,
            parent_id: null,
            created_at: folder.created_at,
          }))
        );
        return;
      }

      setSupportsNestedFolders(true);
      setFolders((data || []) as FolderNode[]);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not load folders");
    }
  };

  useEffect(() => {
    fetchDocumentsCount();
    fetchRecentDocuments();
    fetchFolders();
  }, [user?.id]);

  const lockVault = () => {
    setUnlocked(false);
  };

  const uploadAssetToVault = async (params: {
    uri: string;
    name: string;
    mimeType: string;
    size?: number | null;
    folderId: string;
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
        folder_id: params.folderId,
        name: params.name,
        size_bytes: params.size ?? fileBuffer.length,
        mime_type: params.mimeType,
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "File uploaded into selected folder.");
      fetchDocumentsCount();
    } catch (err: any) {
      Alert.alert("Error Uploading", err.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFromFiles = async (folderId: string) => {
    if (documentPickerBusy || mediaPickerBusy || pickerLockRef.current) return;

    try {
      if (globalDocumentPickerActive) {
        Alert.alert("Please wait", "Another file picker is already open.");
        return;
      }

      pickerLockRef.current = true;
      setDocumentPickerBusy(true);

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      await new Promise((resolve) => setTimeout(resolve, 700));

      let result: DocumentPicker.DocumentPickerResult | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          globalDocumentPickerActive = true;
          result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
          });
          break;
        } catch (err: any) {
          const message = String(err?.message || "").toLowerCase();
          const isPickerOverlap = message.includes("picking in progress");

          if (!isPickerOverlap || attempt === 4) {
            throw err;
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 500 + attempt * 250)
          );
        } finally {
          globalDocumentPickerActive = false;
        }
      }

      if (!result) {
        Alert.alert("Error Uploading", "Could not open document picker.");
        return;
      }

      if (result.canceled) return;

      const file = result.assets[0];
      await uploadAssetToVault({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        size: file.size,
        folderId,
      });
    } catch (err: any) {
      Alert.alert("Error Uploading", err.message || "Something went wrong");
    } finally {
      pickerLockRef.current = false;
      setDocumentPickerBusy(false);
    }
  };

  const handleUploadFromGallery = async (folderId: string) => {
    if (mediaPickerBusy || documentPickerBusy || globalMediaPickerActive) {
      Alert.alert("Please wait", "Another picker is still closing.");
      return;
    }

    try {
      setMediaPickerBusy(true);
      globalMediaPickerActive = true;

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      await new Promise((resolve) => setTimeout(resolve, 350));

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Gallery access is needed to pick images"
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
        folderId,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to open gallery");
    } finally {
      globalMediaPickerActive = false;
      setMediaPickerBusy(false);
    }
  };

  const handleScanDocument = async () => {
    if (mediaPickerBusy || documentPickerBusy || globalMediaPickerActive) {
      Alert.alert("Please wait", "Another picker is still closing.");
      return;
    }

    try {
      setMediaPickerBusy(true);
      globalMediaPickerActive = true;

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Instead of using ImagePicker here, we will navigate to our new Scanner feature
      navigation.navigate("Scanner", {
        folderId: activeDestinationFolderId,
        folderName: currentPickerFolderName,
      });
      // Close the picker
      setScanModalVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to open camera");
    } finally {
      globalMediaPickerActive = false;
      setMediaPickerBusy(false);
    }
  };

  const handleSaveScannedDoc = async () => {
    if (!scannedImageUri || !scannedFileName.trim()) {
      Alert.alert("Required", "Please enter a file name");
      return;
    }
    if (!activeDestinationFolderId) {
      Alert.alert("Folder Required", "Choose a destination folder first.");
      return;
    }

    setUploading(true);
    try {
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
        folder_id: activeDestinationFolderId,
        name: fileName,
        size_bytes: fileBase64.length * 0.75,
        mime_type: "application/pdf",
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Scanned document saved as PDF!");
      setScanModalVisible(false);
      setScannedFileName("");
      setScannedImageUri(null);
      fetchDocumentsCount();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not save scan");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!noteTitle || !noteContent) {
      Alert.alert("Required", "Title and content cannot be empty.");
      return;
    }
    if (!activeDestinationFolderId) {
      Alert.alert("Folder Required", "Choose a destination folder first.");
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
        folder_id: activeDestinationFolderId,
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
      fetchDocumentsCount();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not save note");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert("Required", "Folder name is required.");
      return;
    }

    if (!supportsNestedFolders && createParentId) {
      Alert.alert(
        "Schema Update Needed",
        "Nested folders need folders.parent_id in your database. Run migration 03_nested_folders.sql and try again."
      );
      return;
    }

    try {
      setCreatingFolder(true);
      const { error } = await supabase.from("folders").insert({
        user_id: user?.id,
        name: newFolderName.trim(),
        ...(supportsNestedFolders && createParentId
          ? { parent_id: createParentId }
          : {}),
      });

      if (error) throw error;

      setFolderCreateVisible(false);
      setNewFolderName("");
      fetchFolders();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const openFolderPicker = (action: PendingAction) => {
    if (uploading || launchingAction || documentPickerBusy || mediaPickerBusy) {
      return;
    }

    setPendingAction(action);
    setPickerStack([]);
    setActiveDestinationFolderId(null);
    setFolderPickerVisible(true);
  };

  const executeActionForFolder = async (folderId: string) => {
    if (!pendingAction) return;
    if (
      launchingAction ||
      actionLockRef.current ||
      documentPickerBusy ||
      mediaPickerBusy
    ) {
      return;
    }

    actionLockRef.current = true;
    const actionToRun = pendingAction;
    setActiveDestinationFolderId(folderId);
    setPendingAction(null);
    setLaunchingAction(true);
    setFolderPickerVisible(false);

    try {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      await new Promise((resolve) => setTimeout(resolve, 350));
      setLaunchingAction(false);

      if (actionToRun === "uploadFiles") {
        await handleUploadFromFiles(folderId);
      } else if (actionToRun === "uploadGallery") {
        await handleUploadFromGallery(folderId);
      } else if (actionToRun === "scan") {
        await handleScanDocument();
      } else if (actionToRun === "note") {
        setNoteModalVisible(true);
      }
    } finally {
      actionLockRef.current = false;
      setLaunchingAction(false);
    }
  };

  const handlePickerFolderTap = (folder: FolderNode) => {
    if (foldersWithChildren.has(folder.id)) {
      setPickerStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
      return;
    }

    executeActionForFolder(folder.id);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(dateString).getTime()) / 1000
    );
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
  };

  const getDocIconAndColor = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return { name: "file-text", color: "#FF7C3D" }; // Primary Orange
    if (["jpg", "jpeg", "png"].includes(ext || ""))
      return { name: "image", color: "#4F46E5" }; // Indigo
    if (ext === "zip") return { name: "archive", color: "#06B6D4" }; // Cyan
    return { name: "file", color: "#A1A1AA" };
  };

  const THEME = {
    bg: "#0e0e0e",
    surface: "#1a1919",
    surfaceBright: "#2c2c2c",
    accent: "#ff9157",
    textMuted: "#adaaaa",
    borderGlass: "rgba(173, 170, 170, 0.1)",
  };

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar style="light" />

      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 60,
          paddingBottom: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Feather name="shield" size={20} color={THEME.accent} />
          <Text
            style={{
              color: THEME.accent,
              fontSize: 20,
              fontFamily: "SpaceGrotesk_Bold",
              marginLeft: 8,
              letterSpacing: -0.5,
            }}
          >
            DOCVAULT
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Feather name="search" size={22} color={THEME.textMuted} />
          {user?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          ) : (
            <View
              style={{
                width: 32,
                height: 32,
                backgroundColor: THEME.surfaceBright,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="user" size={16} color="white" />
            </View>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Text
            style={{
              color: THEME.accent,
              fontFamily: "SpaceGrotesk_Bold",
              fontSize: 10,
              letterSpacing: 4,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Access Granted
          </Text>
          <Text
            style={{
              fontSize: 40,
              fontFamily: "SpaceGrotesk_Bold",
              color: "white",
              letterSpacing: -1.5,
              marginBottom: 16,
            }}
          >
            The Curator
          </Text>

          {/* Status Pill */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: THEME.surface,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 16,
              alignSelf: "flex-start",
              borderWidth: 1,
              borderColor: THEME.borderGlass,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: THEME.accent,
                marginRight: 8,
                shadowColor: THEME.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 6,
                elevation: 4,
              }}
            />
            <Text
              style={{
                color: THEME.textMuted,
                fontSize: 12,
                fontFamily: "Manrope_Bold",
              }}
            >
              System Secure • Vault Tier 1
            </Text>
          </View>
        </View>

        {/* Quick Actions Component */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 24,
            paddingBottom: 40,
            gap: 12,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => openFolderPicker("scan")}
            style={{
              flex: 1,
              backgroundColor: THEME.surface,
              paddingVertical: 24,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name="maximize"
              size={24}
              color={THEME.accent}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={{
                color: THEME.accent,
                fontSize: 10,
                fontFamily: "SpaceGrotesk_Bold",
                textAlign: "center",
                lineHeight: 14,
              }}
            >
              SCAN{"\n"}DOCUMENT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => openFolderPicker("uploadFiles")}
            style={{
              flex: 1,
              backgroundColor: THEME.surface,
              paddingVertical: 24,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name="upload-cloud"
              size={24}
              color={THEME.accent}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={{
                color: THEME.accent,
                fontSize: 10,
                fontFamily: "SpaceGrotesk_Bold",
                textAlign: "center",
                lineHeight: 14,
              }}
            >
              UPLOAD{"\n"}FILE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => openFolderPicker("note")}
            style={{
              flex: 1,
              backgroundColor: THEME.surface,
              paddingVertical: 24,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name="file-text"
              size={24}
              color={THEME.accent}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={{
                color: THEME.accent,
                fontSize: 10,
                fontFamily: "SpaceGrotesk_Bold",
                textAlign: "center",
                lineHeight: 14,
              }}
            >
              ADD{"\n"}NOTE
            </Text>
          </TouchableOpacity>
        </View>

        {/* Vault Folders Horizontal Scroll */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-end mb-4">
            <Text
              style={{
                color: "white",
                fontSize: 20,
                fontFamily: "SpaceGrotesk_Bold",
                letterSpacing: -0.5,
              }}
            >
              Vault Folders
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("AllDocuments")}
            >
              <Text
                style={{ color: THEME.accent, fontFamily: "Manrope_Bold", fontSize: 13 }}
              >
                See All
              </Text>
            </TouchableOpacity>
          </View>

          {recentFolders.length === 0 ? (
            <View
              style={{
                backgroundColor: THEME.surface,
                borderRadius: 24,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: THEME.borderGlass,
              }}
            >
              <Text style={{ color: THEME.textMuted }}>No folders yet.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ overflow: "visible" }}
            >
              {recentFolders.map((folder, index) => (
                <TouchableOpacity
                  key={folder.id}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate("AllDocuments", {
                      openFolderId: folder.id,
                    })
                  }
                  style={{
                    backgroundColor: THEME.surface,
                    borderRadius: 24,
                    padding: 20,
                    width: 140,
                    height: 140,
                    marginRight: 16,
                    borderWidth: 1,
                    borderColor: THEME.borderGlass,
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      backgroundColor: THEME.surfaceBright,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="folder" size={20} color="white" />
                  </View>
                  <View>
                    <Text
                      style={{
                        color: "white",
                        fontFamily: "Manrope_Bold",
                        fontSize: 15,
                        marginBottom: 4,
                      }}
                      numberOfLines={1}
                    >
                      {folder.name}
                    </Text>
                    <Text style={{ color: THEME.textMuted, fontSize: 11 }}>
                      Encrypted
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Recent Activity List */}
        <View className="px-6 pb-32">
          <Text
            style={{
              color: "white",
              fontSize: 20,
              fontFamily: "SpaceGrotesk_Bold",
              letterSpacing: -0.5,
              marginBottom: 16,
            }}
          >
            Recent Activity
          </Text>

          {recentDocs.length === 0 ? (
            <View className="items-center py-6">
              <Text style={{ color: THEME.textMuted }}>
                No recent documents.
              </Text>
            </View>
          ) : (
            recentDocs.map((doc) => {
              const { name, color } = getDocIconAndColor(doc.name);
              return (
                <View
                  key={doc.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: "rgba(255,255,255,0.03)",
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 16,
                    }}
                  >
                    <Feather name={name as any} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "white",
                        fontSize: 15,
                        fontFamily: "Manrope_Bold",
                        marginBottom: 4,
                      }}
                      numberOfLines={1}
                    >
                      {doc.name}
                    </Text>
                    <Text style={{ color: THEME.textMuted, fontSize: 12 }}>
                      Added {formatTimeAgo(doc.created_at)} •{" "}
                      {formatBytes(doc.size_bytes)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* --- Modals --- */}
      {/* Target Folder Picker Modal */}
      <Modal visible={folderPickerVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/80">
          <View
            style={{
              backgroundColor: THEME.surface,
              padding: 24,
              borderRadius: 32,
              width: "90%",
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
                Select Destination
              </Text>
              <Text style={{ color: THEME.textMuted, fontSize: 13 }}>
                Current: {currentPickerFolderName}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
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
                    style={{ color: "white", fontFamily: "Manrope_Bold", marginLeft: 8 }}
                  >
                    Back Up
                  </Text>
                </TouchableOpacity>
              )}

              {visiblePickerFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={{
                    padding: 16,
                    backgroundColor: THEME.surfaceBright,
                    borderRadius: 16,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onPress={() => handlePickerFolderTap(folder)}
                >
                  <Text
                    style={{ color: "white", fontFamily: "Manrope_Bold" }}
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
              ))}
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
                  setPendingAction(null);
                  setPickerStack([]);
                }}
              >
                <Text style={{ color: "white", fontFamily: "Manrope_Bold" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: THEME.accent,
                  padding: 16,
                  borderRadius: 16,
                  alignItems: "center",
                }}
                onPress={() => {
                  setCreateParentId(currentPickerFolderId);
                  setFolderPickerVisible(false);
                  setFolderCreateVisible(true);
                }}
              >
                <Text style={{ color: "black", fontFamily: "Manrope_Bold" }}>
                  New Folder
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Folder Modal */}
      <Modal visible={folderCreateVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/80 flex-row">
          <View
            style={{
              backgroundColor: THEME.surface,
              padding: 24,
              borderRadius: 32,
              width: "90%",
              borderWidth: 1,
              borderColor: THEME.borderGlass,
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 20,
                fontFamily: "SpaceGrotesk_Bold",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              New Folder
            </Text>
            <TextInput
              style={{
                backgroundColor: THEME.surfaceBright,
                color: "white",
                padding: 16,
                borderRadius: 16,
                fontFamily: "Manrope_Bold",
                fontSize: 16,
                marginBottom: 20,
              }}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="e.g. Tax Documents"
              placeholderTextColor={THEME.textMuted}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 16, alignItems: "center" }}
                onPress={() => {
                  setFolderCreateVisible(false);
                  setNewFolderName("");
                }}
              >
                <Text style={{ color: THEME.textMuted, fontFamily: "Manrope_Bold" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: THEME.accent,
                  padding: 16,
                  borderRadius: 16,
                  alignItems: "center",
                }}
                onPress={handleCreateFolder}
                disabled={creatingFolder}
              >
                {creatingFolder ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text style={{ color: "black", fontFamily: "Manrope_Bold" }}>
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Note Modal */}
      <Modal visible={noteModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/80">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <View
              style={{
                backgroundColor: THEME.surface,
                padding: 24,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                height: 500,
                borderTopWidth: 1,
                borderColor: THEME.borderGlass,
              }}
            >
              <View className="flex-row justify-between items-center mb-6">
                <Text
                  style={{ color: "white", fontSize: 20, fontFamily: "SpaceGrotesk_Bold" }}
                >
                  Create Note
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setNoteModalVisible(false);
                  }}
                >
                  <Feather name="x" size={24} color={THEME.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={{
                  backgroundColor: THEME.surfaceBright,
                  color: "white",
                  padding: 16,
                  borderRadius: 16,
                  fontFamily: "Manrope_Bold",
                  fontSize: 16,
                  marginBottom: 16,
                }}
                placeholderTextColor={THEME.textMuted}
                placeholder="Note Title"
                value={noteTitle}
                onChangeText={setNoteTitle}
              />
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: THEME.surfaceBright,
                  color: "white",
                  padding: 16,
                  borderRadius: 16,
                  fontSize: 16,
                  marginBottom: 20,
                  textAlignVertical: "top",
                }}
                placeholderTextColor={THEME.textMuted}
                placeholder="Write sensitive details here..."
                multiline
                returnKeyType="done"
                blurOnSubmit
                value={noteContent}
                onChangeText={setNoteContent}
              />
              <TouchableOpacity
                style={{
                  backgroundColor: THEME.accent,
                  padding: 16,
                  borderRadius: 16,
                  alignItems: "center",
                }}
                onPress={handleCreateNote}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text
                    style={{ color: "black", fontFamily: "SpaceGrotesk_Bold", fontSize: 16 }}
                  >
                    Encrypt & Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
