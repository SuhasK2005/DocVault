import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { ScannerFilter } from "./types";

import * as FileSystem from "expo-file-system/legacy";

type Props = {
  imageUri: string;
  selected: ScannerFilter;
  onBack: () => void;
  onSelect: (filter: ScannerFilter) => void;
  onNext: () => void;
};

const FILTER_CSS: Record<ScannerFilter, string> = {
  original: "none",
  grayscale: "grayscale(100%)",
  bw: "grayscale(100%) contrast(220%) brightness(120%)",
  enhanced: "contrast(135%) brightness(108%) saturate(110%)",
  shadow: "brightness(140%) contrast(160%) saturate(90%)",
};

const OPTIONS: Array<{ key: ScannerFilter; label: string; desc: string }> = [
  { key: "original", label: "Original", desc: "No changes" },
  { key: "grayscale", label: "Grayscale", desc: "Black & white tones" },
  { key: "bw", label: "B & W", desc: "High contrast" },
  { key: "enhanced", label: "Enhanced", desc: "Vivid & crisp" },
  { key: "shadow", label: "No Shadow", desc: "Remove shadows" },
];

const buildPreviewHtml = (uri: string, filter: ScannerFilter) => `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        html, body { margin:0; padding:0; background:#000; overflow:hidden; }
        .wrap { width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; }
        img { width:100%; height:100%; object-fit:contain; filter:${FILTER_CSS[filter]}; }
      </style>
    </head>
    <body>
      <div class="wrap"><img src="${uri}" /></div>
    </body>
  </html>
`;

const buildThumbnailHtml = (uri: string, filter: ScannerFilter) => `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        html, body { margin:0; padding:0; background:#1a1a1a; overflow:hidden; }
        .wrap { width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; }
        img { width:100%; height:100%; object-fit:cover; filter:${FILTER_CSS[filter]}; }
      </style>
    </head>
    <body>
      <div class="wrap"><img src="${uri}" /></div>
    </body>
  </html>
`;

export default function FilterScreen({
  imageUri,
  selected,
  onBack,
  onSelect,
  onNext,
}: Props) {
  const [base64Uri, setBase64Uri] = React.useState<string>(imageUri);

  React.useEffect(() => {
    // WebViews in Expo Go don't consistently load file:// uris.
    // Convert to base64 data uri for robust HTML rendering.
    const loadBase64 = async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          // @ts-ignore
          encoding: "base64",
        });
        setBase64Uri(`data:image/jpeg;base64,${base64}`);
      } catch (e) {
        console.warn("Could not read image as base64", e);
      }
    };
    loadBase64();
  }, [imageUri]);

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-3">
        <TouchableOpacity onPress={onBack}>
          <Text className="text-white font-bold">Back</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-base">Apply Filter</Text>
        <TouchableOpacity onPress={onNext}>
          <Text className="text-cyan-400 font-bold">Use</Text>
        </TouchableOpacity>
      </View>

      {/* Main preview */}
      <View className="flex-1 mx-4 rounded-2xl overflow-hidden border border-neutral-800">
        <WebView
          key={`preview-${selected}`}
          source={{
            html: buildPreviewHtml(base64Uri, selected),
            baseUrl: "",
          }}
          originWhitelist={["*"]}
          scrollEnabled={false}
          style={{ backgroundColor: "#000" }}
        />
      </View>

      {/* Filter thumbnails */}
      <View className="bg-black pt-3 pb-6 px-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, gap: 10 }}
        >
          {OPTIONS.map((option) => {
            const isSelected = selected === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => onSelect(option.key)}
                style={{
                  width: 80,
                  alignItems: "center",
                }}
              >
                {/* Thumbnail */}
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    overflow: "hidden",
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? "#22D3EE" : "#404040",
                    transform: [{ scale: isSelected ? 1.08 : 1 }],
                  }}
                >
                  <WebView
                    source={{
                      html: buildThumbnailHtml(base64Uri, option.key),
                      baseUrl: "",
                    }}
                    originWhitelist={["*"]}
                    scrollEnabled={false}
                    pointerEvents="none"
                    style={{ backgroundColor: "#1a1a1a" }}
                  />
                </View>
                {/* Label */}
                <Text
                  className={`text-xs mt-1.5 font-bold ${
                    isSelected ? "text-cyan-400" : "text-neutral-400"
                  }`}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
