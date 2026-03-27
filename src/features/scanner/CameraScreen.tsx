import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CameraType, CameraView, FlashMode, useCameraPermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";

type Props = {
  onCaptured: (uri: string) => void;
  onCancel: () => void;
};

const THEME = {
  bg: "#0e0e0e",
  surface: "#1a1919",
  surfaceBright: "#2c2c2c",
  accent: "#ff9157",
  textMuted: "#adaaaa",
  borderGlass: "rgba(173, 170, 170, 0.1)",
};

export default function CameraScreen({ onCaptured, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = React.useState<CameraType>("back");
  const [flash, setFlash] = React.useState<FlashMode>("off");
  const [cameraRef, setCameraRef] = React.useState<CameraView | null>(null);
  const [capturing, setCapturing] = React.useState(false);

  const handleCapture = async () => {
    if (!cameraRef || capturing) return;
    try {
      setCapturing(true);
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

  if (!permission) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: THEME.bg }}>
        <ActivityIndicator color={THEME.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: THEME.bg, paddingHorizontal: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: THEME.surface, alignItems: "center", justifyContent: "center", marginBottom: 24, borderWidth: 1, borderColor: THEME.borderGlass }}>
          <Feather name="camera" size={32} color={THEME.accent} />
        </View>
        <Text style={{ color: "white", textAlign: "center", fontSize: 20, fontFamily: "SpaceGrotesk_Bold", marginBottom: 12 }}>
          Camera Access Required
        </Text>
        <Text style={{ color: THEME.textMuted, textAlign: "center", fontSize: 14, fontFamily: "Manrope_Bold", lineHeight: 22, marginBottom: 32 }}>
          To securely scan documents into your vault, we need permission to use the camera.
        </Text>
        
        <TouchableOpacity
          style={{ width: "100%", height: 56, borderRadius: 16, backgroundColor: THEME.accent, alignItems: "center", justifyContent: "center" }}
          onPress={requestPermission}
        >
          <Text style={{ color: "#3d1a08", fontFamily: "SpaceGrotesk_Bold", fontSize: 16 }}>
            GRANT PERMISSION
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 24 }} onPress={onCancel}>
          <Text style={{ color: THEME.textMuted, fontFamily: "Manrope_Bold", fontSize: 14 }}>
            Maybe Later
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <CameraView
        style={{ flex: 1 }}
        facing={facing}
        enableTorch={flash === "on"}
        ref={(ref) => setCameraRef(ref)}
      />

      {/* Guide Overlay */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
        <View style={{ width: "80%", height: "70%", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderRadius: 24, borderStyle: "dashed" }} />
        <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "SpaceGrotesk_Bold", fontSize: 12, marginTop: 16, letterSpacing: 1 }}>
          ALIGN DOCUMENT WITHIN FRAME
        </Text>
      </View>

      {/* Top Controls */}
      <View style={{ position: "absolute", top: 56, right: 24, left: 24, flexDirection: "row", justifyContent: "space-between" }}>
        <TouchableOpacity
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
          onPress={onCancel}
        >
          <Feather name="x" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: flash === "on" ? THEME.accent : "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
          onPress={() => setFlash((prev) => (prev === "off" ? "on" : "off"))}
        >
          <Feather name={flash === "on" ? "zap" : "zap-off"} size={20} color={flash === "on" ? "#3d1a08" : "white"} />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={{ position: "absolute", bottom: 60, left: 0, right: 0, alignItems: "center" }}>
        <TouchableOpacity
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "white",
          }}
          onPress={handleCapture}
          disabled={capturing}
        >
          {capturing ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "white" }} />
          )}
        </TouchableOpacity>
        <Text style={{ color: "white", fontFamily: "Manrope_Bold", fontSize: 13, marginTop: 20 }}>
          Capture Scan
        </Text>
      </View>
    </View>
  );
}
