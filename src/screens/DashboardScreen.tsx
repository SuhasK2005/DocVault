import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  const [activeDestinationFolderId, setActiveDestinationFolderId] = useState<string | null>(null);
  const actionLockRef = useRef(false);
  const pickerLockRef = useRef(false);

  const currentPickerFolderId = useMemo(
    () => (pickerStack.length ? pickerStack[pickerStack.length - 1].id : null),
    [pickerStack],
  );

  const currentPickerFolderName = useMemo(
    () =>
      pickerStack.length
        ? pickerStack[pickerStack.length - 1].name
        : "File Hub",
    [pickerStack],
  );

  const visiblePickerFolders = useMemo(() => {
    return folders.filter(
      (folder) => (folder.parent_id || null) === currentPickerFolderId,
    );
  }, [folders, currentPickerFolderId]);

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
          })),
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
            setTimeout(resolve, 500 + attempt * 250),
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

      if (!result.canceled && result.assets?.length) {
        setScannedImageUri(result.assets[0].uri);
        setScanModalVisible(true);
      }
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
        "Nested folders need folders.parent_id in your database. Run migration 03_nested_folders.sql and try again.",
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

  const runPendingAction = async () => {
    if (
      launchingAction ||
      actionLockRef.current ||
      documentPickerBusy ||
      mediaPickerBusy
    ) {
      return;
    }

    if (!pendingAction) {
      setFolderPickerVisible(false);
      return;
    }

    if (!currentPickerFolderId) {
      Alert.alert("Folder Required", "Open a folder and select that location.");
      return;
    }

    actionLockRef.current = true;
    const actionToRun = pendingAction;
    const folderId = currentPickerFolderId;
    setActiveDestinationFolderId(folderId);
    setLaunchingAction(true);
    setPendingAction(null);
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

  return (
    <SafeAreaView className="flex-1 bg-[#F4F4F5]">
      <StatusBar style="dark" />

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
                    {documentsCount}
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
                <Feather name="folder-plus" size={22} color="#059669" />
                <Text className="text-2xl font-black text-black">
                  {folders.length}
                </Text>
              </View>
              <Text className="text-neutral-500 font-bold text-xs mt-1">
                Folders
              </Text>
            </View>
            <View className="bg-white p-5 rounded-[28px] h-[85px] justify-center border border-neutral-200 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Feather name="layers" size={22} color="#4F46E5" />
              </View>
              <Text className="text-neutral-500 font-bold text-xs mt-1">
                File Hub
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-full p-2 flex-row justify-between items-center mb-8 shadow-lg shadow-neutral-200/50 border border-neutral-100">
          <TouchableOpacity
            className="flex-1 py-4 items-center rounded-full bg-neutral-100/50 flex-row justify-center mx-1"
            onPress={() => openFolderPicker("uploadFiles")}
            disabled={uploading || launchingAction || documentPickerBusy || mediaPickerBusy}
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
            onPress={() => openFolderPicker("scan")}
            disabled={uploading || launchingAction || documentPickerBusy || mediaPickerBusy}
          >
            <Feather name="camera" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-4 items-center rounded-full bg-neutral-100/50 flex-row justify-center mx-1"
            onPress={() => openFolderPicker("note")}
            disabled={uploading || launchingAction || documentPickerBusy || mediaPickerBusy}
          >
            <Feather name="edit-2" size={18} color="black" />
            <Text className="font-bold text-black ml-2">Note</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between mb-4 px-2">
          <Text className="text-xl font-black text-black tracking-tight">
            Recent Folders
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("AllDocuments")}>
            <Text className="text-black font-bold">See All</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-4">
          {recentFolders.length === 0 ? (
            <View className="bg-white rounded-[24px] p-5 border border-neutral-100">
              <Text className="text-black font-bold text-lg">
                No folders yet
              </Text>
              <Text className="text-neutral-500 mt-1">
                Create your first folder to start organizing files.
              </Text>
            </View>
          ) : (
            recentFolders.map((folder) => (
              <TouchableOpacity
                key={folder.id}
                onPress={() => navigation.navigate("AllDocuments")}
                className="flex-row items-center p-4 bg-white rounded-[24px] mb-3 shadow-sm border border-neutral-100"
              >
                <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4 bg-[#18181B]">
                  <Feather name="folder" size={24} color="white" />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-black font-bold text-lg mb-1"
                    numberOfLines={1}
                  >
                    {folder.name}
                  </Text>
                  <Text className="text-neutral-500 font-bold text-xs">
                    Open in File Hub
                  </Text>
                </View>
                <View className="w-10 h-10 items-center justify-center bg-neutral-50 rounded-full">
                  <Feather name="chevron-right" size={20} color="black" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View className="mb-20 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-black py-4 rounded-2xl items-center"
            onPress={() => navigation.navigate("AllDocuments")}
          >
            <Text className="text-white font-bold">See All Folders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-white py-4 rounded-2xl items-center border border-neutral-200"
            onPress={() => {
              setCreateParentId(null);
              setFolderCreateVisible(true);
            }}
          >
            <Text className="text-black font-bold">Create Folder</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={folderPickerVisible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="bg-white p-6 rounded-[32px] w-[90%] items-center shadow-2xl">
            <Feather name="folder" size={40} color="black" className="mb-4" />
            <Text className="text-xl font-black text-black mb-2 text-center">
              Choose Destination Folder
            </Text>
            <Text className="text-neutral-500 text-center mb-4">
              Current: {currentPickerFolderName}
            </Text>

            <ScrollView className="w-full max-h-72 mb-4">
              {pickerStack.length > 0 ? (
                <TouchableOpacity
                  className="w-full py-3 px-4 rounded-xl mb-2 bg-neutral-100 flex-row items-center"
                  onPress={() => {
                    setPickerStack((prev) => prev.slice(0, -1));
                  }}
                >
                  <Feather name="arrow-left" size={18} color="black" />
                  <Text className="font-bold text-black ml-2">Back</Text>
                </TouchableOpacity>
              ) : null}

              {visiblePickerFolders.map((folder) => (
                <View
                  key={folder.id}
                  className="w-full py-3 px-4 rounded-xl mb-2 bg-neutral-100 flex-row items-center justify-between"
                >
                  <TouchableOpacity
                    className="flex-1"
                    onPress={() => executeActionForFolder(folder.id)}
                  >
                    <Text className="font-bold text-black" numberOfLines={1}>
                      {folder.name}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="pl-3"
                    onPress={() =>
                      setPickerStack((prev) => [
                        ...prev,
                        { id: folder.id, name: folder.name },
                      ])
                    }
                  >
                    <Feather name="chevron-right" size={18} color="black" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View className="flex-row w-full gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                onPress={() => {
                  setFolderPickerVisible(false);
                  setPendingAction(null);
                  setPickerStack([]);
                  setActiveDestinationFolderId(null);
                }}
              >
                <Text className="font-bold text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black py-4 rounded-xl items-center"
                onPress={runPendingAction}
                disabled={
                  uploading ||
                  launchingAction ||
                  documentPickerBusy ||
                  mediaPickerBusy
                }
              >
                {uploading || launchingAction || documentPickerBusy || mediaPickerBusy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">
                    Select & Continue
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="mt-4"
              onPress={() => {
                setCreateParentId(currentPickerFolderId);
                setFolderPickerVisible(false);
                setFolderCreateVisible(true);
              }}
            >
              <Text className="text-black font-bold">
                Create New Folder Here
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={folderCreateVisible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="bg-white p-6 rounded-[32px] w-[85%] items-center shadow-2xl">
            <Feather
              name="folder-plus"
              size={40}
              color="black"
              className="mb-4"
            />
            <Text className="text-xl font-black text-black mb-2 text-center">
              Create Folder
            </Text>
            <Text className="text-neutral-500 text-center mb-4">
              Parent:{" "}
              {createParentId
                ? folders.find((f) => f.id === createParentId)?.name || "Folder"
                : "File Hub"}
            </Text>
            <TextInput
              className="w-full bg-neutral-100 rounded-2xl p-4 text-left text-lg font-bold mb-6"
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              placeholderTextColor="#737373"
            />
            <View className="flex-row w-full gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                onPress={() => {
                  setFolderCreateVisible(false);
                  setNewFolderName("");
                }}
              >
                <Text className="font-bold text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black py-4 rounded-xl items-center"
                onPress={handleCreateFolder}
                disabled={creatingFolder}
              >
                {creatingFolder ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={noteModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={24}
            className="w-full"
          >
          <View className="bg-white pt-6 px-6 pb-10 rounded-t-[32px] h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-black text-black">
                Secure Note
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setNoteModalVisible(false);
                }}
              >
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <TextInput
              className="text-xl font-bold bg-neutral-100 p-4 rounded-xl mb-4"
              placeholderTextColor="gray"
              placeholder="Note Title"
              value={noteTitle}
              onChangeText={setNoteTitle}
            />
            <TextInput
              className="flex-1 text-black bg-neutral-100 p-4 rounded-xl mb-6 text-lg"
              placeholderTextColor="gray"
              placeholder="Write your notes here..."
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              textAlignVertical="top"
              value={noteContent}
              onChangeText={setNoteContent}
            />
            <View className="flex-row gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-full items-center"
                onPress={() => {
                  Keyboard.dismiss();
                  setNoteModalVisible(false);
                }}
              >
                <Text className="text-black font-bold text-lg">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black py-4 rounded-full items-center"
                onPress={handleCreateNote}
              >
                <Text className="text-white font-bold text-lg">Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
            <View className="flex-row w-full gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                onPress={() => {
                  setScanModalVisible(false);
                  setScannedImageUri(null);
                  setScannedFileName("");
                }}
              >
                <Text className="font-bold text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-[#4F46E5] py-4 rounded-xl items-center"
                onPress={handleSaveScannedDoc}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Save PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
