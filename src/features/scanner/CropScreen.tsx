import React from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  LayoutChangeEvent,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Polygon, Circle } from "react-native-svg";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { CropPoint } from "./types";

type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  imageUri: string;
  onBack: () => void;
  onCropped: (uri: string) => void;
};

const THEME = {
  bg: "#0e0e0e",
  surface: "#1a1919",
  surfaceBright: "#2c2c2c",
  accent: "#ff9157",
  textMuted: "#adaaaa",
  borderGlass: "rgba(173, 170, 170, 0.1)",
};

const TARGET_RATIO = 2 / 3;
const OUTPUT_WIDTH = 2400;
const OUTPUT_HEIGHT = 3600;

const HANDLE_RADIUS = 18;
const HANDLE_HIT = 32;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getCoverRect = (
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): Rect => {
  const imageRatio = imageWidth / imageHeight;
  const containerRatio = containerWidth / containerHeight;

  if (imageRatio > containerRatio) {
    const height = containerHeight;
    const width = height * imageRatio;
    return { x: (containerWidth - width) / 2, y: 0, width, height };
  } else {
    const width = containerWidth;
    const height = width / imageRatio;
    return { x: 0, y: (containerHeight - height) / 2, width, height };
  }
};

const fitRectToTargetWithinBounds = (
  rect: Rect,
  bounds: { width: number; height: number },
): Rect => {
  let width = rect.width;
  let height = rect.height;
  const currentRatio = width / height;

  if (currentRatio > TARGET_RATIO) {
    height = width / TARGET_RATIO;
  } else {
    width = height * TARGET_RATIO;
  }

  width = Math.min(width, bounds.width);
  height = Math.min(height, bounds.height);

  let centerX = rect.x + rect.width / 2;
  let centerY = rect.y + rect.height / 2;

  let x = centerX - width / 2;
  let y = centerY - height / 2;

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > bounds.width) x = bounds.width - width;
  if (y + height > bounds.height) y = bounds.height - height;

  return { x, y, width, height };
};

export default function CropScreen({ imageUri, onBack, onCropped }: Props) {
  const { width: screenWidth } = Dimensions.get("window");
  const GAP = 24;
  const frameWidth = screenWidth - GAP * 2;
  const frameHeight = frameWidth / TARGET_RATIO;

  const [containerRect, setContainerRect] = React.useState<Rect | null>(null);
  const [imageSize, setImageSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [points, setPoints] = React.useState<CropPoint[]>([]);

  React.useEffect(() => {
    Image.getSize(
      imageUri,
      (width, height) => setImageSize({ width, height }),
      () => Alert.alert("Error", "Could not read image dimensions."),
    );
  }, [imageUri]);

  const imageRect = React.useMemo(() => {
    if (!containerRect || !imageSize) return null;
    return getCoverRect(
      containerRect.width,
      containerRect.height,
      imageSize.width,
      imageSize.height,
    );
  }, [containerRect, imageSize]);

  // Set default points to match the 2:3 container completely
  React.useEffect(() => {
    if (!containerRect) return;
    setPoints([
      { x: 0, y: 0 },
      { x: containerRect.width, y: 0 },
      { x: containerRect.width, y: containerRect.height },
      { x: 0, y: containerRect.height },
    ]);
  }, [containerRect?.width, containerRect?.height]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setContainerRect({ x, y, width, height });
  };

  // Stable PanResponder refs to avoid re-creation every render
  const pointsRef = React.useRef(points);
  pointsRef.current = points;
  const imageRectRef = React.useRef(imageRect);
  imageRectRef.current = imageRect;
  const containerRectRef = React.useRef(containerRect);
  containerRectRef.current = containerRect;

  const initialPointsRef = React.useRef<CropPoint[]>([]);

  const panResponders = React.useRef(
    [0, 1, 2, 3].map((index) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          initialPointsRef.current = [...pointsRef.current];
        },
        onPanResponderMove: (
          _: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const cr = containerRectRef.current;
          const initial = initialPointsRef.current[index];
          if (!cr || !initial) return;

          setPoints((prev) => {
            const next = [...prev];
            next[index] = {
              x: clamp(initial.x + gesture.dx, 0, cr.width),
              y: clamp(initial.y + gesture.dy, 0, cr.height),
            };
            return next;
          });
        },
      }),
    ),
  ).current;

  const handleReset = () => {
    if (!containerRect) return;
    setPoints([
      { x: 0, y: 0 },
      { x: containerRect.width, y: 0 },
      { x: containerRect.width, y: containerRect.height },
      { x: 0, y: containerRect.height },
    ]);
  };

  const handleCrop = async () => {
    if (!imageRect || !imageSize || points.length !== 4) return;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const widthPx = Math.max(2, maxX - minX);
    const heightPx = Math.max(2, maxY - minY);

    const scaleX = imageSize.width / imageRect.width;
    const scaleY = imageSize.height / imageRect.height;

    const initialCropRect = {
      x: Math.max(0, (minX - imageRect.x) * scaleX),
      y: Math.max(0, (minY - imageRect.y) * scaleY),
      width: Math.min(imageSize.width, widthPx * scaleX),
      height: Math.min(imageSize.height, heightPx * scaleY),
    };

    const cropRect = fitRectToTargetWithinBounds(initialCropRect, {
      width: imageSize.width,
      height: imageSize.height,
    });

    const crop = {
      originX: cropRect.x,
      originY: cropRect.y,
      width: cropRect.width,
      height: cropRect.height,
    };

    try {
      setProcessing(true);
      const output = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop }, { resize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );
      onCropped(output.uri);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not crop image");
    } finally {
      setProcessing(false);
    }
  };

  // Build SVG polygon points string
  const polyPointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* Glassmorphic Header */}
      <BlurView
        tint="dark"
        intensity={80}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 56,
          paddingBottom: 24,
        }}
      >
        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: THEME.surfaceBright,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
          onPress={onBack}
        >
          <Feather name="arrow-left" size={20} color="white" />
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontFamily: "SpaceGrotesk_Bold",
            }}
          >
            Adjust Edges
          </Text>
          <Text
            style={{
              color: THEME.textMuted,
              fontSize: 10,
              fontFamily: "SpaceGrotesk_Bold",
              letterSpacing: 1,
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            CRITICAL ACCURACY
          </Text>
        </View>

        <TouchableOpacity
          style={{
            paddingHorizontal: 16,
            height: 44,
            borderRadius: 14,
            backgroundColor: THEME.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={handleCrop}
          disabled={processing || points.length !== 4}
        >
          {processing ? (
            <ActivityIndicator color="#3d1a08" size="small" />
          ) : (
            <Text
              style={{
                color: "#3d1a08",
                fontFamily: "SpaceGrotesk_Bold",
                fontSize: 14,
              }}
            >
              NEXT
            </Text>
          )}
        </TouchableOpacity>
      </BlurView>

      {/* Image + Crop overlay */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 24,
        }}
      >
        <View
          style={{
            width: frameWidth,
            height: frameHeight,
            overflow: "hidden",
            borderRadius: 16,
          }}
          onLayout={onLayout}
        >
          <Image
            source={{ uri: imageUri }}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />

          {points.length === 4 && containerRect && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: containerRect.width,
                height: containerRect.height,
              }}
              pointerEvents="box-none"
            >
              {/* SVG overlay — edge lines + handles */}
              <Svg
                width={containerRect.width}
                height={containerRect.height}
                style={{ position: "absolute", top: 0, left: 0 }}
                pointerEvents="none"
              >
                {/* Crop quad outline */}
                <Polygon
                  points={polyPointsStr}
                  fill="rgba(255,145,87,0.12)"
                  stroke={THEME.accent}
                  strokeWidth={3}
                  strokeLinejoin="round"
                />

                {/* Corner handles */}
                {points.map((p, i) => (
                  <React.Fragment key={i}>
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={HANDLE_RADIUS}
                      fill="white"
                      stroke={THEME.accent}
                      strokeWidth={4}
                      opacity={1}
                    />
                    <Circle cx={p.x} cy={p.y} r={6} fill={THEME.accent} />
                  </React.Fragment>
                ))}
              </Svg>

              {/* Draggable hit areas */}
              {points.map((point, index) => (
                <View
                  key={index}
                  {...panResponders[index].panHandlers}
                  style={{
                    position: "absolute",
                    left: point.x - HANDLE_HIT,
                    top: point.y - HANDLE_HIT,
                    width: HANDLE_HIT * 2,
                    height: HANDLE_HIT * 2,
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Bottom actions */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 40,
          paddingTop: 20,
          gap: 16,
        }}
      >
        <TouchableOpacity
          style={{
            paddingHorizontal: 24,
            height: 52,
            borderRadius: 16,
            backgroundColor: THEME.surface,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
          onPress={handleReset}
        >
          <Text
            style={{
              color: "white",
              fontFamily: "SpaceGrotesk_Bold",
              fontSize: 14,
            }}
          >
            RESET
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            paddingHorizontal: 32,
            height: 52,
            borderRadius: 16,
            backgroundColor: THEME.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={handleCrop}
          disabled={processing || points.length !== 4}
        >
          {processing ? (
            <ActivityIndicator color="#3d1a08" size="small" />
          ) : (
            <Text
              style={{
                color: "#3d1a08",
                fontFamily: "SpaceGrotesk_Bold",
                fontSize: 14,
              }}
            >
              CROP & CONTINUE
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
