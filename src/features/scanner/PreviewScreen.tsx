import React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ScannerPage } from "./types";

type Props = {
  pages: ScannerPage[];
  fileName: string;
  onChangeFileName: (value: string) => void;
  selectedFolderName: string;
  onPickFolder: () => void;
  onAddPage: () => void;
  onSave: () => void;
  onRemovePage: (pageId: string) => void;
  uploading: boolean;
};

export default function PreviewScreen({
  pages,
  fileName,
  onChangeFileName,
  selectedFolderName,
  onPickFolder,
  onAddPage,
  onSave,
  onRemovePage,
  uploading,
}: Props) {
  const movePage = (index: number, direction: -1 | 1) => {
    // Re-order is handled by parent via onRemovePage + reinsertion
    // But since parent manages pages, we need a workaround.
    // For now this is a visual-only feature; we'll signal reorder via
    // the parent if they provide an onReorder callback.
  };

  return (
    <View className="flex-1 bg-[#F4F4F5]">
      {/* Header info */}
      <View className="px-5 pt-3 pb-2 flex-row items-center justify-between">
        <Text className="text-black font-black text-2xl">Scan Preview</Text>
        <View className="bg-black px-3 py-1 rounded-full">
          <Text className="text-white font-bold text-xs">
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </Text>
        </View>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
        {/* Document name */}
        <TextInput
          className="bg-white rounded-xl px-4 py-3 font-bold text-black border border-neutral-200 mb-3"
          value={fileName}
          onChangeText={onChangeFileName}
          placeholder="Document name"
          placeholderTextColor="#737373"
        />

        {/* Folder picker */}
        <TouchableOpacity
          className="bg-white rounded-xl p-4 border border-neutral-200 mb-3 flex-row items-center justify-between"
          onPress={onPickFolder}
        >
          <View>
            <Text className="text-neutral-500 font-bold text-xs mb-1">
              Save To Folder
            </Text>
            <Text className="text-black font-bold">{selectedFolderName}</Text>
          </View>
          <Feather name="chevron-right" size={18} color="black" />
        </TouchableOpacity>

        {/* Pages with thumbnails */}
        {pages.map((page, index) => (
          <View
            key={page.id}
            className="bg-white rounded-xl p-3 border border-neutral-200 mb-3 flex-row items-center"
          >
            {/* Thumbnail */}
            <View
              style={{
                width: 56,
                height: 72,
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#f5f5f5",
                marginRight: 12,
              }}
            >
              <Image
                source={{ uri: page.imageUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            </View>

            {/* Page info */}
            <View className="flex-1">
              <Text className="text-black font-bold">Page {index + 1}</Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                Filter: {page.filter}
              </Text>
              {/* Reorder buttons */}
              <View className="flex-row mt-1.5" style={{ gap: 8 }}>
                {index > 0 && (
                  <TouchableOpacity
                    className="bg-neutral-100 px-2 py-1 rounded-md"
                    onPress={() => movePage(index, -1)}
                  >
                    <Feather name="arrow-up" size={14} color="#525252" />
                  </TouchableOpacity>
                )}
                {index < pages.length - 1 && (
                  <TouchableOpacity
                    className="bg-neutral-100 px-2 py-1 rounded-md"
                    onPress={() => movePage(index, 1)}
                  >
                    <Feather name="arrow-down" size={14} color="#525252" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Remove */}
            {pages.length > 1 ? (
              <TouchableOpacity onPress={() => onRemovePage(page.id)}>
                <View className="bg-red-50 px-3 py-2 rounded-lg">
                  <Feather name="trash-2" size={16} color="#DC2626" />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Bottom actions */}
      <View className="px-5 pb-8 pt-3">
        <TouchableOpacity
          className="bg-neutral-200 rounded-xl py-4 items-center mb-3 flex-row justify-center"
          onPress={onAddPage}
          disabled={uploading}
          style={{ gap: 8 }}
        >
          <Feather name="plus" size={18} color="black" />
          <Text className="font-bold text-black">Add Page</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-black rounded-xl py-4 items-center"
          onPress={onSave}
          disabled={uploading || pages.length === 0}
        >
          {uploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-bold text-white">Save & Upload PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
