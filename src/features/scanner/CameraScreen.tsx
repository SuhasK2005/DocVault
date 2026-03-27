import React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraType,
  CameraView,
  FlashMode,
  useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

type Props = {
  onCaptured: (uri: string) => void;
  onCancel: () => void;
  pageCount?: number;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const DOC_W = SCREEN_W * 0.82;
const DOC_H = DOC_W * 1.35; // ~A4 ratio

export default function CameraScreen({
  onCaptured,
  onCancel,
  pageCount = 0,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = React.useState<CameraType>("back");
  const [flash, setFlash] = React.useState<FlashMode>("off");
  const [cameraRef, setCameraRef] = React.useState<CameraView | null>(null);
  const [capturing, setCapturing] = React.useState(false);

  // Scan-line animation
  const scanAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  // Capture-button pulse animation
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCapture = async () => {
    if (!cameraRef || capturing) return;
    try {
      setCapturing(true);
      triggerPulse();
      const result = await cameraRef.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (result?.uri) {
        onCaptured(result.uri);
      }
    } finally {
      setCapturing(false);
    }
  };

  const handleGalleryImport = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      onCaptured(pickerResult.assets[0].uri);
    }
  };

  /* ---------- Permission states ---------- */

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Text className="text-white text-center text-base font-bold mb-5">
          Camera permission is required to scan documents.
        </Text>
        <TouchableOpacity
          className="bg-white px-5 py-3 rounded-xl"
          onPress={requestPermission}
        >
          <Text className="text-black font-bold">Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity className="mt-4" onPress={onCancel}>
          <Text className="text-neutral-300 font-bold">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ---------- Camera UI ---------- */

  const scanLineTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DOC_H - 4],
  });

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing={facing}
        enableTorch={flash === "on"}
        ref={(ref) => setCameraRef(ref)}
      />

      {/* Dark overlay + document frame cutout */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        pointerEvents="none"
      >
        {/* Top mask */}
        <View
          style={{
            height: (SCREEN_H - DOC_H) / 2,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        />

        <View style={{ flexDirection: "row", height: DOC_H }}>
          {/* Left mask */}
          <View
            style={{
              width: (SCREEN_W - DOC_W) / 2,
              backgroundColor: "rgba(0,0,0,0.45)",
            }}
          />

          {/* Document frame (clear area) */}
          <View
            style={{
              width: DOC_W,
              height: DOC_H,
              borderWidth: 2,
              borderColor: "rgba(34,211,238,0.7)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Grid lines (rule of thirds) */}
            <View
              style={{
                position: "absolute",
                top: "33.33%",
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            />
            <View
              style={{
                position: "absolute",
                top: "66.66%",
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: "33.33%",
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: "66.66%",
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            />

            {/* Corner accents */}
            {[
              { top: -1, left: -1 },
              { top: -1, right: -1 },
              { bottom: -1, left: -1 },
              { bottom: -1, right: -1 },
            ].map((pos, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  ...pos,
                  width: 24,
                  height: 24,
                  borderColor: "#22D3EE",
                  borderTopWidth: pos.top !== undefined ? 3 : 0,
                  borderBottomWidth: pos.bottom !== undefined ? 3 : 0,
                  borderLeftWidth: pos.left !== undefined ? 3 : 0,
                  borderRightWidth: pos.right !== undefined ? 3 : 0,
                }}
              />
            ))}

            {/* Animated scan line */}
            <Animated.View
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                height: 2,
                borderRadius: 1,
                backgroundColor: "rgba(34,211,238,0.55)",
                transform: [{ translateY: scanLineTranslateY }],
              }}
            />
          </View>

          {/* Right mask */}
          <View
            style={{
              width: (SCREEN_W - DOC_W) / 2,
              backgroundColor: "rgba(0,0,0,0.45)",
            }}
          />
        </View>

        {/* Bottom mask */}
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
      </View>

      {/* Top bar */}
      <View
        className="absolute top-14 left-0 right-0 flex-row items-center justify-between px-6"
      >
        <TouchableOpacity
          className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
          onPress={onCancel}
        >
          <Feather name="x" size={20} color="white" />
        </TouchableOpacity>

        <Text className="text-white/80 font-bold text-sm tracking-wide">
          SCAN DOCUMENT
        </Text>

        <TouchableOpacity
          className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
          onPress={() => setFlash((prev) => (prev === "off" ? "on" : "off"))}
        >
          <Feather
            name={flash === "on" ? "zap" : "zap-off"}
            size={18}
            color={flash === "on" ? "#FBBF24" : "white"}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom bar */}
      <View className="absolute bottom-10 left-0 right-0 items-center">
        <View className="flex-row items-center justify-center" style={{ gap: 36 }}>
          {/* Gallery import */}
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-black/50 items-center justify-center border border-white/20"
            onPress={handleGalleryImport}
          >
            <Feather name="image" size={20} color="white" />
          </TouchableOpacity>

          {/* Capture button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: "white",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#22D3EE",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 8,
              }}
              onPress={handleCapture}
              disabled={capturing}
            >
              {capturing ? (
                <ActivityIndicator color="black" />
              ) : (
                <View
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    borderWidth: 3,
                    borderColor: "#111",
                  }}
                />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Page count badge */}
          <View
            className="w-12 h-12 rounded-full bg-black/50 items-center justify-center border border-white/20"
          >
            <Text className="text-white font-black text-base">
              {pageCount}
            </Text>
            <Text
              style={{ fontSize: 8, marginTop: -2 }}
              className="text-white/60 font-bold"
            >
              PAGES
            </Text>
          </View>
        </View>

        <TouchableOpacity className="mt-5" onPress={onCancel}>
          <Text className="text-white/70 font-bold text-sm">Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
