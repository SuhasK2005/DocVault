import React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import { Feather } from "@expo/vector-icons";
import Svg, { Defs, Mask, Rect } from "react-native-svg";

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

const SCAN_RATIO = 2 / 3;

export default function CameraScreen({ onCaptured, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = React.useState<CameraType>("back");
  const [flash, setFlash] = React.useState<FlashMode>("off");
  const [cameraRef, setCameraRef] = React.useState<CameraView | null>(null);
  const [capturing, setCapturing] = React.useState(false);

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const GAP = 24;
  const frameWidth = screenWidth - GAP * 2;
  const frameHeight = frameWidth / SCAN_RATIO;

  const scanLineAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (permission?.granted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2500,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2500,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [permission?.granted]);

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
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: THEME.bg,
        }}
      >
        <ActivityIndicator color={THEME.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: THEME.bg,
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: THEME.surface,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
        >
          <Feather name="camera" size={32} color={THEME.accent} />
        </View>
        <Text
          style={{
            color: "white",
            textAlign: "center",
            fontSize: 20,
            fontFamily: "SpaceGrotesk_Bold",
            marginBottom: 12,
          }}
        >
          Camera Access Required
        </Text>
        <Text
          style={{
            color: THEME.textMuted,
            textAlign: "center",
            fontSize: 14,
            fontFamily: "Manrope_Bold",
            lineHeight: 22,
            marginBottom: 32,
          }}
        >
          To securely scan documents into your vault, we need permission to use
          the camera.
        </Text>

        <TouchableOpacity
          style={{
            width: "100%",
            height: 56,
            borderRadius: 16,
            backgroundColor: THEME.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={requestPermission}
        >
          <Text
            style={{
              color: "#3d1a08",
              fontFamily: "SpaceGrotesk_Bold",
              fontSize: 16,
            }}
          >
            GRANT PERMISSION
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 24 }} onPress={onCancel}>
          <Text
            style={{
              color: THEME.textMuted,
              fontFamily: "Manrope_Bold",
              fontSize: 14,
            }}
          >
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

      {/* SVG Mask Overlay */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      >
        <Svg height="100%" width="100%">
          <Defs>
            <Mask id="mask">
              <Rect height="100%" width="100%" fill="white" />
              <Rect
                x={(screenWidth - frameWidth) / 2}
                y={(screenHeight - frameHeight) / 2}
                width={frameWidth}
                height={frameHeight}
                rx={16}
                fill="black"
              />
            </Mask>
          </Defs>
          <Rect
            height="100%"
            width="100%"
            fill="rgba(0,0,0,0.7)"
            mask="url(#mask)"
          />
        </Svg>

        {/* Glowy Orange Border */}
        <View
          style={{
            position: "absolute",
            top: (screenHeight - frameHeight) / 2,
            left: (screenWidth - frameWidth) / 2,
            width: frameWidth,
            height: frameHeight,
            borderWidth: 2,
            borderRadius: 16,
            borderColor: THEME.accent,
            shadowColor: THEME.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Moving Scan Line */}
          <Animated.View
            style={{
              width: "100%",
              height: 4,
              backgroundColor: THEME.accent,
              position: "absolute",
              top: 0,
              shadowColor: THEME.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 8,
              transform: [
                {
                  translateY: scanLineAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(0, frameHeight - 4)],
                  }),
                },
              ],
            }}
          />
        </View>
      </View>

      {/* Top Controls */}
      <View
        style={{
          position: "absolute",
          top: 80,
          right: 24,
          left: 24,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
          onPress={onCancel}
        >
          <Feather name="x" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: flash === "on" ? THEME.accent : "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
          onPress={() => setFlash((prev) => (prev === "off" ? "on" : "off"))}
        >
          <Feather
            name={flash === "on" ? "zap" : "zap-off"}
            size={20}
            color={flash === "on" ? "#3d1a08" : "white"}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
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
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: "white",
              }}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
