import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from "react-native";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function LoginScreen() {
  const setUser = useAuthStore((state) => state.setUser);
  const pulse = React.useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.95,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const handleGoogleLogin = async () => {
    setUser({ id: "docvault-founder", email: "founder@docvault.io" });
  };

  return (
    <View className="flex-1 bg-[#0A0A0A]">
      <StatusBar style="light" hidden={true} />

      {/* Dynamic Background abstract shapes */}
      <Animated.View
        style={{ transform: [{ scale: pulse }] }}
        className="absolute top-[-10%] right-[-10%] w-[120%] h-[60%] opacity-30 rounded-full blur-[100px]"
      >
        <LinearGradient
          colors={[
            "rgba(79, 70, 229, 0.4)",
            "rgba(6, 182, 212, 0.1)",
            "transparent",
          ]}
          className="flex-1 rounded-full"
        />
      </Animated.View>

      <SafeAreaView className="flex-1 justify-between px-8 pb-12 pt-24">
        <View>
          <View className="w-16 h-16 bg-white/10 rounded-3xl items-center justify-center mb-10 border border-white/10">
            <Feather name="shield" size={28} color="#D4D4D8" />
          </View>

          <Text className="text-[64px] font-black text-white leading-[65px] tracking-tighter">
            Fortify.{"\n"}Everything.
          </Text>

          <Text className="mt-6 text-lg text-neutral-400 font-medium tracking-tight pr-4 leading-relaxed">
            The world's most elegant zero-knowledge vault. Your keys, your data,
            absolute privacy.
          </Text>
        </View>

        <View className="w-full space-y-5">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleGoogleLogin}
            className="w-full overflow-hidden rounded-[32px]"
          >
            <LinearGradient
              colors={["#ffffff", "#e4e4e7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="py-5 px-8 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-black rounded-full items-center justify-center mr-4">
                  <Feather name="globe" size={18} color="white" />
                </View>
                <Text className="text-black text-xl font-bold tracking-tight">
                  Initiate Uplink
                </Text>
              </View>
              <Feather name="arrow-right" size={24} color="black" />
            </LinearGradient>
          </TouchableOpacity>

          <View className="flex-row items-center justify-center space-x-2 mt-4">
            <Feather name="lock" size={14} color="#52525B" />
            <Text className="text-neutral-500 font-semibold tracking-wide text-xs uppercase">
              E2E ENCRYPTED ARCHITECTURE
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
