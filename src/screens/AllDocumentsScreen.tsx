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
import { Image } from "react-native";
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
  created_at?: string;
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

  const [sortOrder, setSortOrder] = useState<
    "date_desc" | "date_asc" | "name_asc"
  >("date_desc");

  const [documentActionVisible, setDocumentActionVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentNode | null>(
    null,
  );
  const [openingDocument, setOpeningDocument] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState(false);

  const [documentRenameVisible, setDocumentRenameVisible] = useState(false);
  const [documentRenameValue, setDocumentRenameValue] = useState("");
  const [renamingDocument, setRenamingDocument] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
        created_at: doc.created_at,
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
    let list = [...folders];

    // Sorting logic
    if (sortOrder === "date_desc") {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    } else if (sortOrder === "date_asc") {
      list.sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime(),
      );
    } else if (sortOrder === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const q = folderSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [folderSearch, folders, sortOrder]);

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
    Alert.alert("Add to Vault", "Choose an action", [
      { text: "Upload File", onPress: handleUploadFromFiles },
      { text: "Upload from Gallery", onPress: handleUploadFromGallery },
      { text: "Scan Document", onPress: handleScanDocument },
      { text: "Create Note", onPress: () => setNoteModalVisible(true) },
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

  const openDocumentViewer = (doc: DocumentNode | null = selectedDocument) => {
    if (!doc?.storage_path || openingDocument) {
      return;
    }

    setOpeningDocument(true);
    setDocumentActionVisible(false);

    navigation.navigate("DocumentViewer", {
      id: doc.id,
      name: doc.name,
      storagePath: doc.storage_path,
      mimeType: doc.mime_type,
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
  const handleFolderLongPress = (folder: FolderNode) => {
    Alert.alert(folder.name, "Choose an action", [
      { text: "Rename", onPress: () => openFolderRename(folder) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDeleteFolder(folder),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSortPress = () => {
    Alert.alert("Sort Folders", "Choose sorting order", [
      { text: "Date (Newest)", onPress: () => setSortOrder("date_desc") },
      { text: "Date (Oldest)", onPress: () => setSortOrder("date_asc") },
      { text: "Name (A-Z)", onPress: () => setSortOrder("name_asc") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const THEME = {
    bg: "#0e0e0e",
    surface: "#1a1919",
    surfaceBright: "#2c2c2c",
    accent: "#ff9157",
    textMuted: "#adaaaa",
    borderGlass: "rgba(173, 170, 170, 0.1)",
  };

  const filteredDocumentsForView = useMemo(() => {
    let list = [...documents];

    // Sorting logic
    if (sortOrder === "date_desc") {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    } else if (sortOrder === "date_asc") {
      list.sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime(),
      );
    } else if (sortOrder === "name_asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const q = folderSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((doc) => doc.name.toLowerCase().includes(q));
  }, [folderSearch, documents, sortOrder]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={{ marginRight: 16 }}
            onPress={() => {
              if (folderStack.length > 0) {
                setFolderStack((prev) => prev.slice(0, -1));
              } else {
                navigation.goBack();
              }
            }}
          >
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
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
          <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
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
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Title Area */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, marginTop: 12 }}>
        <Text
          style={{
            color: THEME.textMuted,
            fontFamily: "SpaceGrotesk_Bold",
            fontSize: 13,
            letterSpacing: 2,
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          Central Directory
        </Text>
        <Text
          style={{
            fontSize: 40,
            fontFamily: "SpaceGrotesk_Bold",
            color: "white",
            letterSpacing: -1.5,
          }}
        >
          {currentFolderId ? currentFolderName : "DocVault"}
        </Text>

        {/* Status Pill */}
        
      </View>

      {/* Action Row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <TouchableOpacity
          style={{
            width: 52,
            height: 52,
            backgroundColor:
              viewMode === "grid" ? THEME.surfaceBright : THEME.surface,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            borderWidth: 1,
            borderColor: viewMode === "grid" ? THEME.accent : THEME.borderGlass,
          }}
          onPress={() => setViewMode("grid")}
        >
          <Feather
            name="grid"
            size={20}
            color={viewMode === "grid" ? "white" : THEME.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            width: 52,
            height: 52,
            backgroundColor:
              viewMode === "list" ? THEME.surfaceBright : THEME.surface,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 24,
            borderWidth: 1,
            borderColor: viewMode === "list" ? THEME.accent : THEME.borderGlass,
          }}
          onPress={() => setViewMode("list")}
        >
          <Feather
            name="list"
            size={20}
            color={viewMode === "list" ? "white" : THEME.textMuted}
          />
        </TouchableOpacity>

        {/* Vertical Separator */}
        <View
          style={{
            width: 1,
            height: 32,
            backgroundColor: THEME.surfaceBright,
            marginHorizontal: 16,
          }}
        />

        <TouchableOpacity
          onPress={() => setFolderModalVisible(true)}
          style={{
            width: 52,
            height: 52,
            backgroundColor: THEME.surface,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 16,
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
        >
          <Feather name="folder-plus" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleUploadPress}
          disabled={uploading}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: THEME.accent,
            paddingHorizontal: 12,
            height: 52,
            borderRadius: 16,
            justifyContent: "center",
          }}
        >
          {uploading ? (
            <ActivityIndicator color="#3d1a08" size="small" />
          ) : (
            <>
              <Feather name="plus-circle" size={18} color="#3d1a08" />
              <Text
                numberOfLines={1}
                style={{
                  color: "#3d1a08",
                  fontFamily: "SpaceGrotesk_Bold",
                  fontSize: 14,
                  marginLeft: 6,
                }}
              >
                Upload
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 24, marginTop: 32, marginBottom: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: THEME.surface,
            borderRadius: 20,
            paddingHorizontal: 16,
            height: 60,
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
        >
          <Feather name="search" size={20} color={THEME.textMuted} />
          <TextInput
            style={{
              flex: 1,
              color: "white",
              fontFamily: "Manrope_Bold",
              fontSize: 16,
              marginLeft: 12,
            }}
            placeholder="Search folders..."
            placeholderTextColor={THEME.textMuted}
            value={folderSearch}
            onChangeText={setFolderSearch}
          />
          <TouchableOpacity
            onPress={handleSortPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingLeft: 12,
            }}
          >
            <Feather name="filter" size={14} color={THEME.textMuted} />
            <Text
              style={{
                color: THEME.textMuted,
                fontFamily: "Manrope_Bold",
                marginLeft: 6,
                fontSize: 13,
              }}
            >
              {sortOrder === "date_desc"
                ? "Newest"
                : sortOrder === "date_asc"
                  ? "Oldest"
                  : "Name"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 40,
            }}
          >
            <ActivityIndicator color={THEME.accent} />
          </View>
        ) : filteredFoldersForView.length === 0 && documents.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 40,
              backgroundColor: THEME.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: THEME.borderGlass,
            }}
          >
            <Feather
              name="inbox"
              size={40}
              color={THEME.textMuted}
              style={{ marginBottom: 16 }}
            />
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontFamily: "SpaceGrotesk_Bold",
              }}
            >
              Vault Empty
            </Text>
            <Text
              style={{
                color: THEME.textMuted,
                textAlign: "center",
                marginTop: 8,
                marginHorizontal: 32,
              }}
            >
              Securely upload documents, create nested folders, or scan your
              files into the vault.
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: viewMode === "grid" ? "row" : "column",
              flexWrap: viewMode === "grid" ? "wrap" : "nowrap",
              justifyContent: "flex-start",
              paddingBottom: 40,
              gap: viewMode === "grid" ? 16 : 0,
              rowGap: viewMode === "grid" ? 16 : 0,
            }}
          >


            {filteredFoldersForView.map((folder) => (
              <TouchableOpacity
                onPress={() =>
                  setFolderStack((prev) => [
                    ...prev,
                    { id: folder.id, name: folder.name },
                  ])
                }
                onLongPress={() => handleFolderLongPress(folder)}
                key={folder.id}
                style={
                  viewMode === "grid"
                    ? {
                        backgroundColor: THEME.surface,
                        borderRadius: 24,
                        padding: 16,
                        width: "47.5%",
                        aspectRatio: 1,
                        marginBottom: 0,
                        borderWidth: 1,
                        borderColor: THEME.borderGlass,
                        justifyContent: "space-between",
                      }
                    : {
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        backgroundColor: THEME.surface,
                        borderRadius: 20,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: THEME.borderGlass,
                        width: "100%",
                      }
                }
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: viewMode === "grid" ? 0 : 16,
                    backgroundColor: THEME.surfaceBright,
                  }}
                >
                  <Feather name="folder" size={20} color="white" />
                </View>
                <View style={{ flex: viewMode === "grid" ? 0 : 1 }}>
                  <Text
                    style={{
                      color: "white",
                      fontFamily: "SpaceGrotesk_Bold",
                      fontSize: 16,
                      marginBottom: 4,
                      marginTop: viewMode === "grid" ? 8 : 0,
                    }}
                    numberOfLines={viewMode === "grid" ? 2 : 1}
                  >
                    {folder.name}
                  </Text>
                  {viewMode === "list" && (
                    <Text
                      style={{
                        color: THEME.textMuted,
                        fontFamily: "Manrope_Bold",
                        fontSize: 12,
                      }}
                    >
                      Secure Folder
                    </Text>
                  )}
                </View>
                {viewMode === "list" && (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: THEME.surfaceBright,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="chevron-right" size={16} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {filteredDocumentsForView.length > 0 && (
              <Text
                style={{
                  color: THEME.textMuted,
                  fontSize: 13,
                  fontFamily: "SpaceGrotesk_Bold",
                  marginVertical: 12,
                  marginLeft: 4,
                  letterSpacing: 2,
                  width: "100%",
                }}
              >
                FILES
              </Text>
            )}

            {filteredDocumentsForView.map((file) => (
              <TouchableOpacity
                onPress={() => openDocumentViewer(file)}
                onLongPress={() => {
                  setSelectedDocument(file);
                  setDocumentRenameValue(file.name);
                  setDocumentActionVisible(true);
                }}
                key={file.id}
                style={
                  viewMode === "grid"
                    ? {
                        backgroundColor: THEME.surface,
                        borderRadius: 24,
                        padding: 16,
                        width: "47.5%",
                        aspectRatio: 1,
                        marginBottom: 0,
                        borderWidth: 1,
                        borderColor: THEME.borderGlass,
                        justifyContent: "space-between",
                      }
                    : {
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        backgroundColor: THEME.surface,
                        borderRadius: 20,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: THEME.borderGlass,
                        width: "100%",
                      }
                }
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: viewMode === "grid" ? 0 : 16,
                    backgroundColor: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Feather
                    name={file.type as any}
                    size={20}
                    color={file.color}
                  />
                </View>
                <View style={{ flex: viewMode === "grid" ? 0 : 1 }}>
                  <Text
                    style={{
                      color: "white",
                      fontFamily: "SpaceGrotesk_Bold",
                      fontSize: 16,
                      marginBottom: 4,
                      marginTop: viewMode === "grid" ? 8 : 0,
                    }}
                    numberOfLines={viewMode === "grid" ? 2 : 1}
                  >
                    {file.name}
                  </Text>
                  {viewMode === "list" && (
                    <Text
                      style={{
                        color: THEME.textMuted,
                        fontFamily: "Manrope_Bold",
                        fontSize: 12,
                      }}
                    >
                      {file.size}
                    </Text>
                  )}
                </View>
                {viewMode === "list" && (
                  <Feather
                    name="more-vertical"
                    size={20}
                    color={THEME.textMuted}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* --- Modals for Folders actions --- */}
      <Modal visible={folderModalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
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
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <Feather
                name="folder-plus"
                size={32}
                color={THEME.accent}
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{
                  color: "white",
                  fontSize: 20,
                  fontFamily: "SpaceGrotesk_Bold",
                }}
              >
                Create Folder
              </Text>
              <Text
                style={{ color: THEME.textMuted, fontSize: 13, marginTop: 4 }}
              >
                Parent: {currentFolderName}
              </Text>
            </View>
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
              placeholder="Folder name"
              placeholderTextColor={THEME.textMuted}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 16, alignItems: "center" }}
                onPress={() => setFolderModalVisible(false)}
              >
                <Text
                  style={{ color: THEME.textMuted, fontFamily: "Manrope_Bold" }}
                >
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
                  <ActivityIndicator color="#3d1a08" />
                ) : (
                  <Text
                    style={{
                      color: "#3d1a08",
                      fontFamily: "SpaceGrotesk_Bold",
                    }}
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={manageFoldersVisible} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
          <View
            style={{
              backgroundColor: THEME.surface,
              paddingTop: 24,
              paddingHorizontal: 24,
              paddingBottom: 40,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
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
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 24,
                  fontFamily: "SpaceGrotesk_Bold",
                }}
              >
                Manage Folders
              </Text>
              <TouchableOpacity onPress={() => setManageFoldersVisible(false)}>
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
              placeholder="Search folders"
              placeholderTextColor={THEME.textMuted}
              value={manageSearch}
              onChangeText={setManageSearch}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {manageFoldersList.map((folder) => (
                <View
                  key={folder.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    backgroundColor: THEME.surfaceBright,
                    borderRadius: 20,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "white",
                        fontFamily: "Manrope_Bold",
                        fontSize: 16,
                      }}
                      numberOfLines={1}
                    >
                      {folder.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: THEME.surface,
                      borderWidth: 1,
                      borderColor: THEME.borderGlass,
                      marginRight: 8,
                    }}
                    onPress={() => openFolderRename(folder)}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontFamily: "Manrope_Bold",
                        fontSize: 12,
                      }}
                    >
                      Rename
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: "#FF453A",
                    }}
                    onPress={() => handleDeleteFolder(folder)}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontFamily: "Manrope_Bold",
                        fontSize: 12,
                      }}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={folderRenameVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
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
              Rename Folder
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
              value={folderRenameValue}
              onChangeText={setFolderRenameValue}
              placeholder="Folder name"
              placeholderTextColor={THEME.textMuted}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 16, alignItems: "center" }}
                onPress={() => setFolderRenameVisible(false)}
              >
                <Text
                  style={{ color: THEME.textMuted, fontFamily: "Manrope_Bold" }}
                >
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
                  Keyboard.dismiss();
                  handleRenameFolder();
                }}
                disabled={renamingFolder}
              >
                {renamingFolder ? (
                  <ActivityIndicator color="#3d1a08" />
                ) : (
                  <Text
                    style={{
                      color: "#3d1a08",
                      fontFamily: "SpaceGrotesk_Bold",
                    }}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- Modals for Documents --- */}
      <Modal visible={documentActionVisible} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
          <View
            style={{
              backgroundColor: THEME.surface,
              paddingTop: 24,
              paddingHorizontal: 24,
              paddingBottom: 40,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              borderWidth: 1,
              borderColor: THEME.borderGlass,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 24,
                  fontFamily: "SpaceGrotesk_Bold",
                }}
              >
                Document Options
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedDocument(null);
                  setDocumentActionVisible(false);
                }}
              >
                <Feather name="x" size={24} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>
            <Text
              style={{
                color: THEME.accent,
                fontSize: 14,
                fontFamily: "Manrope_Bold",
                marginBottom: 24,
              }}
              numberOfLines={1}
            >
              {selectedDocument?.name}
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: THEME.surfaceBright,
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                marginBottom: 12,
              }}
              onPress={openRenameDocument}
            >
              <Text
                style={{
                  color: "white",
                  fontFamily: "Manrope_Bold",
                  fontSize: 16,
                }}
              >
                Rename
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: THEME.surfaceBright,
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                marginBottom: 12,
              }}
              onPress={openMoveModal}
            >
              <Text
                style={{
                  color: "white",
                  fontFamily: "Manrope_Bold",
                  fontSize: 16,
                }}
              >
                Move to Folder
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: "#FF453A",
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
              }}
              onPress={handleDeleteDocument}
              disabled={deletingDocument}
            >
              {deletingDocument ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text
                  style={{
                    color: "white",
                    fontFamily: "SpaceGrotesk_Bold",
                    fontSize: 16,
                  }}
                >
                  Delete
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={documentRenameVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
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
              Rename Document
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
              value={documentRenameValue}
              onChangeText={setDocumentRenameValue}
              placeholder="Document name"
              placeholderTextColor={THEME.textMuted}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 16, alignItems: "center" }}
                onPress={() => setDocumentRenameVisible(false)}
              >
                <Text
                  style={{ color: THEME.textMuted, fontFamily: "Manrope_Bold" }}
                >
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
                onPress={handleRenameDocument}
                disabled={renamingDocument}
              >
                {renamingDocument ? (
                  <ActivityIndicator color="#3d1a08" />
                ) : (
                  <Text
                    style={{
                      color: "#3d1a08",
                      fontFamily: "SpaceGrotesk_Bold",
                    }}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={moveModalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
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
            <View style={{ alignItems: "center", marginBottom: 20 }}>
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
                }}
              >
                Move to Folder
              </Text>
              <Text
                style={{ color: THEME.textMuted, fontSize: 13, marginTop: 4 }}
              >
                Destination: {moveTargetFolderName}
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 250, marginBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {moveStack.length > 0 ? (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    backgroundColor: THEME.surfaceBright,
                    borderRadius: 16,
                    marginBottom: 8,
                  }}
                  onPress={() => setMoveStack((prev) => prev.slice(0, -1))}
                >
                  <Feather name="arrow-left" size={18} color="white" />
                  <Text
                    style={{
                      color: "white",
                      fontFamily: "Manrope_Bold",
                      marginLeft: 12,
                    }}
                  >
                    Back
                  </Text>
                </TouchableOpacity>
              ) : null}

              {visibleMoveFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 16,
                    backgroundColor: THEME.surfaceBright,
                    borderRadius: 16,
                    marginBottom: 8,
                  }}
                  onPress={() =>
                    setMoveStack((prev) => [
                      ...prev,
                      { id: folder.id, name: folder.name },
                    ])
                  }
                >
                  <Text
                    style={{
                      color: "white",
                      fontFamily: "Manrope_Bold",
                      fontSize: 15,
                    }}
                    numberOfLines={1}
                  >
                    {folder.name}
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={THEME.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 16, alignItems: "center" }}
                onPress={() => {
                  setMoveModalVisible(false);
                  setSelectedDocument(null);
                  setMoveStack([]);
                }}
              >
                <Text
                  style={{ color: THEME.textMuted, fontFamily: "Manrope_Bold" }}
                >
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
                onPress={handleMoveDocument}
                disabled={movingDocument || !moveTargetFolderId}
              >
                {movingDocument ? (
                  <ActivityIndicator color="#3d1a08" />
                ) : (
                  <Text
                    style={{
                      color: "#3d1a08",
                      fontFamily: "SpaceGrotesk_Bold",
                    }}
                  >
                    Move Here
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={noteModalVisible} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View
              style={{
                backgroundColor: THEME.surface,
                paddingTop: 24,
                paddingHorizontal: 24,
                paddingBottom: 40,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                height: 600,
                borderWidth: 1,
                borderColor: THEME.borderGlass,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 24,
                    fontFamily: "SpaceGrotesk_Bold",
                  }}
                >
                  Create Note
                </Text>
                <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
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
                  fontSize: 18,
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
                  marginBottom: 24,
                  textAlignVertical: "top",
                }}
                placeholderTextColor={THEME.textMuted}
                placeholder="Write your notes here..."
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
                value={noteContent}
                onChangeText={setNoteContent}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 16, alignItems: "center" }}
                  onPress={() => {
                    Keyboard.dismiss();
                    setNoteModalVisible(false);
                  }}
                >
                  <Text
                    style={{
                      color: THEME.textMuted,
                      fontFamily: "Manrope_Bold",
                      fontSize: 16,
                    }}
                  >
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
                  onPress={handleCreateNote}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#3d1a08" />
                  ) : (
                    <Text
                      style={{
                        color: "#3d1a08",
                        fontFamily: "SpaceGrotesk_Bold",
                        fontSize: 16,
                      }}
                    >
                      Save Note
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
