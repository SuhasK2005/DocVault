import React from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as ImageManipulator from "expo-image-manipulator";
import { CropPoint } from "./types";

type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  imageUri: string;
  onBack: () => void;
  onCropped: (uri: string) => void;
};

const HANDLE_RADIUS = 16;
const HANDLE_HIT = 28;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getContainRect = (
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): Rect => {
  const imageRatio = imageWidth / imageHeight;
  const containerRatio = containerWidth / containerHeight;

  if (imageRatio > containerRatio) {
    const width = containerWidth;
    const height = width / imageRatio;
    return { x: 0, y: (containerHeight - height) / 2, width, height };
  }

  const height = containerHeight;
  const width = height * imageRatio;
  return { x: (containerWidth - width) / 2, y: 0, width, height };
};

const defaultPoints = (ir: Rect, pad: number = 20): CropPoint[] => [
  { x: ir.x + pad, y: ir.y + pad },
  { x: ir.x + ir.width - pad, y: ir.y + pad },
  { x: ir.x + ir.width - pad, y: ir.y + ir.height - pad },
  { x: ir.x + pad, y: ir.y + ir.height - pad },
];

export default function CropScreen({ imageUri, onBack, onCropped }: Props) {
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
    return getContainRect(
      containerRect.width,
      containerRect.height,
      imageSize.width,
      imageSize.height,
    );
  }, [containerRect, imageSize]);

  // Set default points when imageRect is ready
  React.useEffect(() => {
    if (!imageRect) return;
    setPoints(defaultPoints(imageRect));
  }, [imageRect?.x, imageRect?.y, imageRect?.width, imageRect?.height]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setContainerRect({ x, y, width, height });
  };

  // Stable PanResponder refs to avoid re-creation every render
  const pointsRef = React.useRef(points);
  pointsRef.current = points;
  const imageRectRef = React.useRef(imageRect);
  imageRectRef.current = imageRect;

  const panResponders = React.useRef(
    [0, 1, 2, 3].map((index) => {
      let initialPoint = { x: 0, y: 0 };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const currentPoints = pointsRef.current;
          if (currentPoints[index]) {
            initialPoint = { ...currentPoints[index] };
          }
        },
        onPanResponderMove: (
          _: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const ir = imageRectRef.current;
          if (!ir) return;
          setPoints((prev) => {
            const next = [...prev];
            next[index] = {
              x: clamp(
                initialPoint.x + gesture.dx,
                ir.x,
                ir.x + ir.width,
              ),
              y: clamp(
                initialPoint.y + gesture.dy,
                ir.y,
                ir.y + ir.height,
              ),
            };
            return next;
          });
        },
      });
    }),
  ).current;

  const handleReset = () => {
    if (!imageRect) return;
    setPoints(defaultPoints(imageRect));
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

    const crop = {
      originX: Math.max(0, (minX - imageRect.x) * scaleX),
      originY: Math.max(0, (minY - imageRect.y) * scaleY),
      width: Math.min(imageSize.width, widthPx * scaleX),
      height: Math.min(imageSize.height, heightPx * scaleY),
    };

    try {
      setProcessing(true);
      const output = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
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
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-14 pb-3">
        <TouchableOpacity onPress={onBack}>
          <Text className="text-white font-bold">Back</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-base">Adjust Edges</Text>
        <TouchableOpacity
          onPress={handleCrop}
          disabled={processing || points.length !== 4}
        >
          {processing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-cyan-400 font-bold">Next</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Image + Crop overlay */}
      <View className="flex-1 mx-4 mb-4" onLayout={onLayout}>
        <Image
          source={{ uri: imageUri }}
          resizeMode="contain"
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
                fill="rgba(34,211,238,0.08)"
                stroke="#22D3EE"
                strokeWidth={2}
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
                    stroke="#22D3EE"
                    strokeWidth={3}
                    opacity={0.9}
                  />
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill="#22D3EE"
                  />
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

      {/* Bottom actions */}
      <View className="flex-row items-center justify-center pb-8" style={{ gap: 16 }}>
        <TouchableOpacity
          className="px-5 py-3 rounded-xl bg-neutral-800 border border-neutral-600"
          onPress={handleReset}
        >
          <Text className="text-white font-bold text-sm">Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="px-8 py-3 rounded-xl bg-cyan-500"
          onPress={handleCrop}
          disabled={processing || points.length !== 4}
        >
          {processing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white font-bold text-sm">Crop & Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
