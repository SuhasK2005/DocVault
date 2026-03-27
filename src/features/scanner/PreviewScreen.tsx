import React from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ScannerPage } from "./types";

type FolderOption = {
  id: string;
  name: string;
};

const THEME = {
  bg: "#0e0e0e",
  surface: "#1a1919",
  surfaceBright: "#2c2c2c",
  accent: "#ff9157",
  textMuted: "#adaaaa",
  borderGlass: "rgba(173, 170, 170, 0.1)",
};

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
  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "white", fontSize: 28, fontFamily: "SpaceGrotesk_Bold" }}>Scan Preview</Text>
        <View style={{ backgroundColor: THEME.surfaceBright, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: THEME.borderGlass }}>
          <Text style={{ color: THEME.accent, fontSize: 12, fontFamily: "SpaceGrotesk_Bold" }}>{pages.length} PAGES</Text>
        </View>
      </View>

      <ScrollView style={{ paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: THEME.textMuted, fontSize: 12, fontFamily: "SpaceGrotesk_Bold", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
          DOCUMENT DETAILS
        </Text>
        <TextInput
          style={{
            backgroundColor: THEME.surface,
            borderRadius: 18,
            paddingHorizontal: 20,
            paddingVertical: 16,
            color: "white",
            fontFamily: "Manrope_Bold",
            fontSize: 16,
            borderWidth: 1,
            borderColor: THEME.borderGlass,
            marginBottom: 16,
          }}
          value={fileName}
          onChangeText={onChangeFileName}
          placeholder="Document name"
          placeholderTextColor="rgba(255,255,255,0.3)"
        />

        <TouchableOpacity
          style={{
            backgroundColor: THEME.surface,
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: THEME.borderGlass,
            marginBottom: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
          onPress={onPickFolder}
        >
          <View>
            <Text style={{ color: THEME.textMuted, fontSize: 11, fontFamily: "SpaceGrotesk_Bold", marginBottom: 4, textTransform: "uppercase" }}>
              VAULT LOCATION
            </Text>
            <Text style={{ color: "white", fontSize: 16, fontFamily: "Manrope_Bold" }}>{selectedFolderName}</Text>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: THEME.surfaceBright, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-right" size={20} color="white" />
          </View>
        </TouchableOpacity>

        <Text style={{ color: THEME.textMuted, fontSize: 12, fontFamily: "SpaceGrotesk_Bold", marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>
          CAPTURED PAGES
        </Text>

        {pages.map((page, index) => (
          <View
            key={page.id}
            style={{
              backgroundColor: THEME.surface,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: THEME.borderGlass,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: THEME.surfaceBright, alignItems: "center", justifyContent: "center", marginRight: 16 }}>
              <Feather name="file-text" size={24} color={THEME.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "white", fontSize: 16, fontFamily: "Manrope_Bold" }}>Page {index + 1}</Text>
              <Text style={{ color: THEME.textMuted, fontSize: 12, fontFamily: "Manrope_Regular", marginTop: 2 }}>Ready for vault</Text>
            </View>
            {pages.length > 1 ? (
              <TouchableOpacity
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(239, 68, 68, 0.1)", alignItems: "center", justifyContent: "center" }}
                onPress={() => onRemovePage(page.id)}
              >
                <Feather name="trash-2" size={18} color="#ef4444" />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }}>
        <TouchableOpacity
          style={{
            backgroundColor: "transparent",
            borderRadius: 18,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: THEME.borderGlass,
            marginBottom: 12,
            flexDirection: "row",
          }}
          onPress={onAddPage}
          disabled={uploading}
        >
          <Feather name="plus" size={18} color="white" style={{ marginRight: 8 }} />
          <Text style={{ color: "white", fontFamily: "SpaceGrotesk_Bold", fontSize: 16 }}>
            ADD ANOTHER PAGE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: THEME.accent,
            borderRadius: 18,
            height: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={onSave}
          disabled={uploading || pages.length === 0}
        >
          {uploading ? (
            <ActivityIndicator color="#3d1a08" />
          ) : (
            <Text style={{ color: "#3d1a08", fontFamily: "SpaceGrotesk_Bold", fontSize: 18 }}>
              SECURE & UPLOAD PDF
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
