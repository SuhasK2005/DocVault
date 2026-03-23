import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function UnlockScreen() {
  const setUnlocked = useAuthStore((state) => state.setUnlocked);
  const logout = useAuthStore((state) => state.logout);
  const [password, setPassword] = useState("");

  const handleUnlock = () => {
    // Basic interaction simulate unlock
    setUnlocked(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-8 pt-32 pb-12 flex-col justify-between">
            <View>
              <View className="w-20 h-20 bg-neutral-900 rounded-full items-center justify-center mb-10 border border-neutral-800">
                <Feather name="key" size={32} color="#D4D4D8" />
              </View>

              <View>
                <Text className="text-[48px] font-black tracking-tighter mb-4 text-white leading-[48px]">
                  Vault{"\n"}Locked.
                </Text>
                <Text className="text-neutral-400 font-medium text-lg leading-relaxed mb-10">
                  Authenticate to derive your decryption keys and access local
                  data.
                </Text>
              </View>

              <View className="space-y-6">
                <View className="bg-neutral-900 rounded-[28px] border border-neutral-800 flex-row items-center px-6 py-2 h-20">
                  <Feather name="lock" size={20} color="#71717A" />
                  <TextInput
                    className="flex-1 text-white text-xl font-bold ml-4 tracking-wider h-full"
                    placeholder="Master Password"
                    placeholderTextColor="#52525B"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleUnlock}
                  className="w-full overflow-hidden rounded-[28px]"
                >
                  <LinearGradient
                    colors={["#ffffff", "#e4e4e7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="py-5 px-8 flex-row items-center justify-center h-20"
                  >
                    <Text className="text-black text-xl font-bold tracking-tight mr-3">
                      Decrypt Volumn
                    </Text>
                    <Feather name="unlock" size={20} color="black" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleUnlock}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-[28px] py-5 px-8 flex-row items-center justify-center h-20 mt-2"
                >
                  <Feather
                    name="smile"
                    size={20}
                    color="white"
                    className="mr-3"
                  />
                  <Text className="text-white text-xl font-bold tracking-tight ml-3">
                    Use FaceID
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <TouchableOpacity className="items-center py-4" onPress={logout}>
                <Text className="text-red-500 font-bold uppercase tracking-widest text-xs">
                  Terminate Session
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
