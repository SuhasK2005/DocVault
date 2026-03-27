import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../services/supabase";
import { useAuthStore } from "../stores/useAuthStore";

type FolderNode = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string;
};

type DocumentNode = {
  id: string;
  folder_id: string | null;
  name: string;
  size: string;
  mime_type: string | null;
  storage_path: string;
  type: string;
  color: string;
};

export default function AllDocumentsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const user = useAuthStore((state) => state.user);
  const lastOpenedFolderFromRouteRef = useRef<string | null>(null);
  const [routeFolderHydrated, setRouteFolderHydrated] = useState(false);

  const [documents, setDocuments] = useState<DocumentNode[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [allFolders, setAllFolders] = useState<FolderNode[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supportsNestedFolders, setSupportsNestedFolders] = useState(true);

  const [folderStack, setFolderStack] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [folderSearch, setFolderSearch] = useState("");

  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [manageFoldersVisible, setManageFoldersVisible] = useState(false);
  const [manageSearch, setManageSearch] = useState("");
  const [folderRenameVisible, setFolderRenameVisible] = useState(false);
  const [selectedFolderForRename, setSelectedFolderForRename] =
    useState<FolderNode | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(false);

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const [documentActionVisible, setDocumentActionVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentNode | null>(
    null,
  );
  const [openingDocument, setOpeningDocument] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState(false);

  const [documentRenameVisible, setDocumentRenameVisible] = useState(false);
  const [documentRenameValue, setDocumentRenameValue] = useState("");
  const [renamingDocument, setRenamingDocument] = useState(false);

  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [moveStack, setMoveStack] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [movingDocument, setMovingDocument] = useState(false);

  const currentFolderId = useMemo(
    () => (folderStack.length ? folderStack[folderStack.length - 1].id : null),
    [folderStack],
  );

  const currentFolderName = useMemo(
    () =>
      folderStack.length
        ? folderStack[folderStack.length - 1].name
        : "File Hub",
    [folderStack],
  );

  const moveTargetFolderId = useMemo(
    () => (moveStack.length ? moveStack[moveStack.length - 1].id : null),
    [moveStack],
  );

  const moveTargetFolderName = useMemo(
    () =>
      moveStack.length ? moveStack[moveStack.length - 1].name : "File Hub",
    [moveStack],
  );

  const visibleMoveFolders = useMemo(
    () =>
      allFolders.filter(
        (folder) => (folder.parent_id || null) === moveTargetFolderId,
      ),
    [allFolders, moveTargetFolderId],
  );

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
    if (mimeType.includes("word") || mimeType.includes("text/")) {
      return { type: "file-text", color: "#059669" };
    }
    return { type: "file", color: "#4F46E5" };
  };

  const fetchAllDocuments = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      let query = supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (currentFolderId) {
        query = query.eq("folder_id", currentFolderId);
      } else {
        query = query.is("folder_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map((doc: any) => ({
        id: doc.id,
        folder_id: doc.folder_id,
        name: doc.name,
        size: formatBytes(doc.size_bytes),
        mime_type: doc.mime_type,
        storage_path: doc.storage_path,
        ...getFileIconAndColor(doc.mime_type),
      })) as DocumentNode[];

      setDocuments(formatted);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not load documents");
    } finally {
      setLoading(false);
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

        const normalized = ((fallbackData || []) as any[]).map((folder) => ({
          id: folder.id,
          name: folder.name,
          parent_id: null,
          created_at: folder.created_at,
        })) as FolderNode[];

        setFolders(
          normalized.filter((folder) => (currentFolderId ? false : true)),
        );
        setAllFolders(normalized);
        return;
      }

      setSupportsNestedFolders(true);
      const list = (data || []) as FolderNode[];
      setAllFolders(list);
      setFolders(
        list.filter((folder) => (folder.parent_id || null) === currentFolderId),
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not load folders");
    }
  };

  useEffect(() => {
    const requestedFolderId = route.params?.openFolderId as string | undefined;
    if (requestedFolderId) {
      setRouteFolderHydrated(false);
      return;
    }

    setRouteFolderHydrated(true);
  }, [route.params?.openFolderId]);

  useFocusEffect(
    useCallback(() => {
      fetchFolders();

      if (!routeFolderHydrated) {
        return;
      }

      fetchAllDocuments();
    }, [user?.id, currentFolderId, routeFolderHydrated]),
  );

  useEffect(() => {
    const requestedFolderId = route.params?.openFolderId as string | undefined;
    if (!requestedFolderId || routeFolderHydrated) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRouteFolderHydrated(true);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [route.params?.openFolderId, routeFolderHydrated]);

  useEffect(() => {
    const requestedFolderId = route.params?.openFolderId as string | undefined;
    if (!requestedFolderId || !allFolders.length) {
      return;
    }

    if (lastOpenedFolderFromRouteRef.current === requestedFolderId) {
      return;
    }

    const folderById = new Map(allFolders.map((folder) => [folder.id, folder]));
    const path: Array<{ id: string; name: string }> = [];
    const visited = new Set<string>();

    let cursor = folderById.get(requestedFolderId);
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id);
      path.push({ id: cursor.id, name: cursor.name });
      cursor = cursor.parent_id ? folderById.get(cursor.parent_id) : undefined;
    }

    if (!path.length) {
      setRouteFolderHydrated(true);
      return;
    }

    path.reverse();
    setFolderStack(path);
    lastOpenedFolderFromRouteRef.current = requestedFolderId;
    navigation.setParams({ openFolderId: undefined });
    setRouteFolderHydrated(true);
  }, [allFolders, navigation, route.params?.openFolderId]);

  const filteredFoldersForView = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [folderSearch, folders]);

  const manageFoldersList = useMemo(() => {
    const q = manageSearch.trim().toLowerCase();
    if (!q) return allFolders;
    return allFolders.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [allFolders, manageSearch]);

  const uploadAssetToCurrentFolder = async (params: {
    uri: string;
    name: string;
    mimeType: string;
    size?: number | null;
  }) => {
    if (!currentFolderId) {
      Alert.alert(
        "Folder Required",
        "Open a folder and upload inside that folder.",
      );
      return;
    }

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
        folder_id: currentFolderId,
        name: params.name,
        size_bytes: params.size ?? fileBuffer.length,
        mime_type: params.mimeType,
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Document uploaded.");
      fetchAllDocuments();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not upload document");
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
      await uploadAssetToCurrentFolder({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        size: file.size,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not pick file");
    }
  };

  const handleUploadFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Gallery access is needed.");
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

      await uploadAssetToCurrentFolder({
        uri: image.uri,
        name,
        mimeType: image.mimeType || "image/jpeg",
        size: image.fileSize,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not pick image");
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
    if (!currentFolderId) {
      Alert.alert(
        "Folder Required",
        "Open a folder and scan inside that folder.",
      );
      return;
    }

    navigation.navigate("Scanner", {
      folderId: currentFolderId,
      folderName: currentFolderName,
    });
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      Alert.alert("Required", "Title and content cannot be empty.");
      return;
    }
    if (!currentFolderId) {
      Alert.alert(
        "Folder Required",
        "Open a folder and save notes inside that folder.",
      );
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
        folder_id: currentFolderId,
        name: fileName,
        size_bytes: Buffer.byteLength(noteContent, "utf8"),
        mime_type: "text/plain",
        storage_path: storagePath,
        is_encrypted: false,
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Secure note saved.");
      setNoteModalVisible(false);
      setNoteTitle("");
      setNoteContent("");
      fetchAllDocuments();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not save note");
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentPress = (doc: DocumentNode) => {
    setSelectedDocument(doc);
    setDocumentActionVisible(true);
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument?.id) return;

    try {
      setDeletingDocument(true);

      if (selectedDocument.storage_path) {
        await supabase.storage
          .from("vault_documents")
          .remove([selectedDocument.storage_path]);
      }

      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", selectedDocument.id)
        .eq("user_id", user?.id);

      if (error) throw error;

      setDocumentActionVisible(false);
      setSelectedDocument(null);
      fetchAllDocuments();
      Alert.alert("Deleted", "Document removed.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not delete document");
    } finally {
      setDeletingDocument(false);
    }
  };

  const openRenameDocument = () => {
    if (!selectedDocument) return;
    setDocumentRenameValue(selectedDocument.name);
    setDocumentActionVisible(false);
    setDocumentRenameVisible(true);
  };

  const handleRenameDocument = async () => {
    if (!selectedDocument?.id || !documentRenameValue.trim()) {
      Alert.alert("Required", "Document name is required.");
      return;
    }

    try {
      setRenamingDocument(true);
      const { error } = await supabase
        .from("documents")
        .update({ name: documentRenameValue.trim() })
        .eq("id", selectedDocument.id)
        .eq("user_id", user?.id);

      if (error) throw error;

      setDocumentRenameVisible(false);
      setSelectedDocument(null);
      fetchAllDocuments();
      Alert.alert("Renamed", "Document renamed successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not rename document");
    } finally {
      setRenamingDocument(false);
    }
  };

  const openMoveModal = () => {
    if (!selectedDocument) return;
    setMoveStack([]);
    setDocumentActionVisible(false);
    setMoveModalVisible(true);
  };

  const openDocumentViewer = () => {
    if (!selectedDocument?.storage_path || openingDocument) {
      return;
    }

    setOpeningDocument(true);
    setDocumentActionVisible(false);

    navigation.navigate("DocumentViewer", {
      id: selectedDocument.id,
      name: selectedDocument.name,
      storagePath: selectedDocument.storage_path,
      mimeType: selectedDocument.mime_type,
    });

    setTimeout(() => setOpeningDocument(false), 350);
  };

  const handleMoveDocument = async () => {
    if (!selectedDocument?.id) return;
    if (!moveTargetFolderId) {
      Alert.alert("Folder Required", "Open the destination folder first.");
      return;
    }

    if (selectedDocument.folder_id === moveTargetFolderId) {
      Alert.alert("No Change", "Document is already in this folder.");
      return;
    }

    try {
      setMovingDocument(true);
      const { error } = await supabase
        .from("documents")
        .update({ folder_id: moveTargetFolderId })
        .eq("id", selectedDocument.id)
        .eq("user_id", user?.id);

      if (error) throw error;

      setMoveModalVisible(false);
      setSelectedDocument(null);
      fetchAllDocuments();
      Alert.alert("Moved", "Document moved successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not move document");
    } finally {
      setMovingDocument(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert("Required", "Folder name is required.");
      return;
    }

    if (!supportsNestedFolders && currentFolderId) {
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
        ...(supportsNestedFolders && currentFolderId
          ? { parent_id: currentFolderId }
          : {}),
      });

      if (error) throw error;

      setFolderModalVisible(false);
      setNewFolderName("");
      fetchFolders();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const openFolderRename = (folder: FolderNode) => {
    setSelectedFolderForRename(folder);
    setFolderRenameValue(folder.name);
    setFolderRenameVisible(true);
  };

  const handleRenameFolder = async () => {
    console.log("[FolderRename] submit", {
      selectedFolderId: selectedFolderForRename?.id ?? null,
      currentValue: folderRenameValue,
      userId: user?.id ?? null,
    });

    if (!selectedFolderForRename?.id || !folderRenameValue.trim()) {
      console.log("[FolderRename] blocked: missing folder id or empty name");
      Alert.alert("Required", "Folder name is required.");
      return;
    }
    if (!user?.id) {
      console.log("[FolderRename] blocked: missing user session");
      Alert.alert("Session Error", "Please sign in again and retry.");
      return;
    }

    const folderId = selectedFolderForRename.id;
    const updatedName = folderRenameValue.trim();
    if (updatedName === selectedFolderForRename.name) {
      console.log("[FolderRename] no-op: same folder name");
      setFolderRenameVisible(false);
      setSelectedFolderForRename(null);
      setFolderRenameValue("");
      return;
    }

    try {
      setRenamingFolder(true);
      console.log("[FolderRename] updating", {
        folderId,
        updatedName,
        userId: user.id,
      });

      const { data, error } = await supabase
        .from("folders")
        .update({ name: updatedName })
        .eq("id", folderId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      console.log("[FolderRename] response", {
        data,
        error,
      });

      if (error) throw error;
      if (!data?.id) {
        throw new Error("Folder rename failed. Please try again.");
      }

      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId ? { ...folder, name: updatedName } : folder,
        ),
      );
      setAllFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId ? { ...folder, name: updatedName } : folder,
        ),
      );
      setFolderStack((prev) =>
        prev.map((entry) =>
          entry.id === folderId ? { ...entry, name: updatedName } : entry,
        ),
      );

      setFolderRenameVisible(false);
      setSelectedFolderForRename(null);
      setFolderRenameValue("");
      fetchFolders();
      console.log("[FolderRename] success", { folderId, updatedName });
      Alert.alert("Renamed", "Folder renamed successfully.");
    } catch (err: any) {
      console.error("[FolderRename] failed", err);
      Alert.alert("Error", err?.message || "Could not rename folder");
    } finally {
      setRenamingFolder(false);
    }
  };

  const handleDeleteFolder = async (folder: FolderNode) => {
    Alert.alert(
      "Delete Folder",
      `Delete ${folder.name}? Child folders will also be removed and documents will move out of deleted folders.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("folders")
                .delete()
                .eq("id", folder.id)
                .eq("user_id", user?.id);

              if (error) throw error;

              fetchFolders();
              fetchAllDocuments();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not delete folder");
            }
          },
        },
      ],
    );
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
        <Text className="text-2xl font-black text-black" numberOfLines={1}>
          {currentFolderName}
        </Text>
        {currentFolderId ? (
          <TouchableOpacity
            onPress={() => setFolderModalVisible(true)}
            className="w-11 h-11 bg-white rounded-full items-center justify-center border border-neutral-200"
          >
            <Feather name="folder-plus" size={18} color="black" />
          </TouchableOpacity>
        ) : (
          <View className="w-11 h-11" />
        )}
      </View>

      {currentFolderId ? (
        <View className="px-6 pb-2">
          <View className="bg-white rounded-full p-2 flex-row justify-between items-center shadow-lg shadow-neutral-200/50 border border-neutral-100">
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
        </View>
      ) : null}

      {currentFolderId === null ? (
        <View className="px-6 pb-2">
          <View className="bg-white rounded-[24px] p-4 border border-neutral-100">
            <TextInput
              className="bg-neutral-100 rounded-xl px-4 py-3 font-bold text-black"
              placeholder="Search folders"
              placeholderTextColor="#737373"
              value={folderSearch}
              onChangeText={setFolderSearch}
            />
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity
                className="flex-1 bg-black py-3 rounded-xl items-center"
                onPress={() => setFolderModalVisible(true)}
              >
                <Text className="text-white font-bold">Create Folder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-3 rounded-xl items-center"
                onPress={() => setManageFoldersVisible(true)}
              >
                <Text className="text-black font-bold">Manage Folders</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView
        className="flex-1 px-6 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="black" />
          </View>
        ) : filteredFoldersForView.length === 0 && documents.length === 0 ? (
          <View className="bg-white rounded-[24px] p-6 border border-neutral-100">
            <Text className="text-black font-bold text-lg">
              Nothing here yet
            </Text>
            <Text className="text-neutral-500 mt-1">
              Create folders, upload documents, or scan directly inside this
              folder.
            </Text>
          </View>
        ) : (
          <View className="pb-12">
            {currentFolderId ? (
              <TouchableOpacity
                onPress={() => setFolderStack((prev) => prev.slice(0, -1))}
                className="flex-row items-center p-4 bg-white rounded-[24px] mb-3 shadow-sm border border-neutral-100"
              >
                <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4 bg-neutral-100">
                  <Feather name="arrow-up-left" size={24} color="black" />
                </View>
                <View className="flex-1">
                  <Text className="text-black font-bold text-lg mb-1">
                    Back
                  </Text>
                  <Text className="text-neutral-500 font-bold text-xs">
                    {folderStack.length === 1
                      ? "Go back to File Hub"
                      : "Go to parent folder"}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {filteredFoldersForView.map((folder) => (
              <TouchableOpacity
                onPress={() =>
                  setFolderStack((prev) => [
                    ...prev,
                    { id: folder.id, name: folder.name },
                  ])
                }
                key={folder.id}
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
                    Folder
                  </Text>
                </View>
                <View className="w-10 h-10 items-center justify-center bg-neutral-50 rounded-full">
                  <Feather name="chevron-right" size={20} color="black" />
                </View>
              </TouchableOpacity>
            ))}

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
                  <Feather
                    name={file.type as any}
                    size={24}
                    color={file.color}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-black font-bold text-lg mb-1"
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                  <Text className="text-neutral-500 font-bold text-xs">
                    {file.size}
                  </Text>
                </View>
                <View className="w-10 h-10 items-center justify-center bg-neutral-50 rounded-full">
                  <Feather name="chevron-right" size={20} color="black" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={folderModalVisible} transparent animationType="slide">
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
              Parent: {currentFolderName}
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
                  setFolderModalVisible(false);
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

      <Modal visible={manageFoldersVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white pt-6 px-6 pb-8 rounded-t-[32px] h-[78%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-black text-black">
                Manage Folders
              </Text>
              <TouchableOpacity onPress={() => setManageFoldersVisible(false)}>
                <Feather name="x" size={22} color="black" />
              </TouchableOpacity>
            </View>
            <TextInput
              className="bg-neutral-100 rounded-xl px-4 py-3 font-bold text-black mb-4"
              placeholder="Search folders"
              placeholderTextColor="#737373"
              value={manageSearch}
              onChangeText={setManageSearch}
            />

            <ScrollView>
              {manageFoldersList.map((folder) => (
                <View
                  key={folder.id}
                  className="flex-row items-center p-4 bg-neutral-50 rounded-[18px] mb-3 border border-neutral-200"
                >
                  <View className="flex-1">
                    <Text
                      className="font-bold text-black text-base"
                      numberOfLines={1}
                    >
                      {folder.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="px-3 py-2 rounded-lg bg-white border border-neutral-200 mr-2"
                    onPress={() => openFolderRename(folder)}
                  >
                    <Text className="font-bold text-black">Rename</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="px-3 py-2 rounded-lg bg-red-600"
                    onPress={() => handleDeleteFolder(folder)}
                  >
                    <Text className="font-bold text-white">Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={folderRenameVisible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="bg-white p-6 rounded-[28px] w-[85%] items-center shadow-2xl">
            <Text className="text-xl font-black text-black mb-4">
              Rename Folder
            </Text>
            <TextInput
              className="w-full bg-neutral-100 rounded-2xl p-4 text-left text-lg font-bold mb-6"
              value={folderRenameValue}
              onChangeText={setFolderRenameValue}
              placeholder="Folder name"
            />
            <View className="flex-row w-full gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                onPress={() => setFolderRenameVisible(false)}
              >
                <Text className="font-bold text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black py-4 rounded-xl items-center"
                onPress={() => {
                  Keyboard.dismiss();
                  handleRenameFolder();
                }}
                disabled={renamingFolder}
              >
                {renamingFolder ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={documentActionVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white pt-6 px-6 pb-10 rounded-t-[32px]">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-2xl font-black text-black">
                Document Options
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDocumentActionVisible(false);
                  setSelectedDocument(null);
                }}
              >
                <Feather name="x" size={22} color="black" />
              </TouchableOpacity>
            </View>
            <Text className="text-neutral-500 mb-6" numberOfLines={1}>
              {selectedDocument?.name || ""}
            </Text>

            <TouchableOpacity
              className="bg-neutral-100 py-4 rounded-xl items-center mb-3"
              onPress={openRenameDocument}
            >
              <Text className="font-bold text-black">Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-neutral-100 py-4 rounded-xl items-center mb-3"
              onPress={openMoveModal}
            >
              <Text className="font-bold text-black">Move to Folder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-neutral-100 py-4 rounded-xl items-center mb-3"
              onPress={openDocumentViewer}
              disabled={openingDocument || !selectedDocument?.storage_path}
            >
              <Text className="font-bold text-black">
                {openingDocument ? "Opening..." : "View"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-red-600 py-4 rounded-xl items-center mb-3"
              onPress={handleDeleteDocument}
              disabled={deletingDocument}
            >
              {deletingDocument ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-bold text-white">Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={documentRenameVisible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="bg-white p-6 rounded-[28px] w-[85%] items-center shadow-2xl">
            <Text className="text-xl font-black text-black mb-4">
              Rename Document
            </Text>
            <TextInput
              className="w-full bg-neutral-100 rounded-2xl p-4 text-left text-lg font-bold mb-6"
              value={documentRenameValue}
              onChangeText={setDocumentRenameValue}
              placeholder="Document name"
            />
            <View className="flex-row w-full gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                onPress={() => setDocumentRenameVisible(false)}
              >
                <Text className="font-bold text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black py-4 rounded-xl items-center"
                onPress={handleRenameDocument}
                disabled={renamingDocument}
              >
                {renamingDocument ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={moveModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="bg-white p-6 rounded-[32px] w-[90%] items-center shadow-2xl">
            <Feather name="folder" size={40} color="black" className="mb-4" />
            <Text className="text-xl font-black text-black mb-2 text-center">
              Move to Folder
            </Text>
            <Text className="text-neutral-500 text-center mb-4">
              Current destination: {moveTargetFolderName}
            </Text>

            <ScrollView className="w-full max-h-72 mb-4">
              {moveStack.length > 0 ? (
                <TouchableOpacity
                  className="w-full py-3 px-4 rounded-xl mb-2 bg-neutral-100 flex-row items-center"
                  onPress={() => setMoveStack((prev) => prev.slice(0, -1))}
                >
                  <Feather name="arrow-left" size={18} color="black" />
                  <Text className="font-bold text-black ml-2">Back</Text>
                </TouchableOpacity>
              ) : null}

              {visibleMoveFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  className="w-full py-3 px-4 rounded-xl mb-2 bg-neutral-100 flex-row items-center justify-between"
                  onPress={() =>
                    setMoveStack((prev) => [
                      ...prev,
                      { id: folder.id, name: folder.name },
                    ])
                  }
                >
                  <Text className="font-bold text-black" numberOfLines={1}>
                    {folder.name}
                  </Text>
                  <Feather name="chevron-right" size={18} color="black" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row w-full gap-2">
              <TouchableOpacity
                className="flex-1 bg-neutral-200 py-4 rounded-xl items-center"
                onPress={() => {
                  setMoveModalVisible(false);
                  setSelectedDocument(null);
                  setMoveStack([]);
                }}
              >
                <Text className="font-bold text-black">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-black py-4 rounded-xl items-center"
                onPress={handleMoveDocument}
                disabled={movingDocument || !moveTargetFolderId}
              >
                {movingDocument ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Move Here</Text>
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
                  <Text className="text-white font-bold text-lg">
                    Save Note
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
