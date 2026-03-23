import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from "react-native";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function DashboardScreen() {
  const logout = useAuthStore((state) => state.logout);
  const setUnlocked = useAuthStore((state) => state.setUnlocked);

  const lockVault = () => {
    setUnlocked(false);
  };

  const recentFiles = [
    {
      id: 1,
      name: "Tax_Returns_2025.pdf",
      type: "file-text",
      size: "2.4 MB",
      color: "#4F46E5",
    },
    {
      id: 2,
      name: "recovery_seeds.txt",
      type: "shield",
      size: "12 KB",
      color: "#059669",
    },
    {
      id: 3,
      name: "Passport_Copy.jpg",
      type: "image",
      size: "4.1 MB",
      color: "#EA580C",
    },
    {
      id: 4,
      name: "API_Keys.env",
      type: "key",
      size: "2 KB",
      color: "#D97706",
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F4F4F5]">
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row justify-between items-end px-8 pt-6 pb-4">
        <View>
          <Text className="text-sm text-neutral-500 font-bold uppercase tracking-widest mb-1">
            Status: Encrypted
          </Text>
          <Text className="text-4xl font-black text-black tracking-tighter">
            My Vault.
          </Text>
        </View>
        <TouchableOpacity
          className="w-14 h-14 bg-black rounded-full items-center justify-center shadow-lg shadow-black/20"
          onPress={lockVault}
          activeOpacity={0.8}
        >
          <Feather name="lock" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Storage Bento Grid */}
        <View className="flex-row justify-between mb-4">
          <View className="w-[48%]">
            <LinearGradient
              colors={["#18181B", "#27272A"]}
              className="p-6 rounded-[32px] h-[180px] justify-between shadow-xl shadow-neutral-900/10"
            >
              <View className="w-12 h-12 bg-white/10 rounded-full items-center justify-center">
                <Feather name="folder" size={24} color="white" />
              </View>
              <View>
                <Text className="text-white text-3xl font-black mb-1">14</Text>
                <Text className="text-neutral-400 font-bold text-sm">
                  Documents
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View className="w-[48%] flex-col justify-between">
            <View className="bg-white p-5 rounded-[28px] h-[85px] mb-2 justify-center border border-neutral-200 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Feather name="shield" size={22} color="#059669" />
                <Text className="text-2xl font-black text-black">8</Text>
              </View>
              <Text className="text-neutral-500 font-bold text-xs mt-1">
                Secure Notes
              </Text>
            </View>
            <View className="bg-white p-5 rounded-[28px] h-[85px] justify-center border border-neutral-200 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Feather name="key" size={22} color="#4F46E5" />
                <Text className="text-2xl font-black text-black">24</Text>
              </View>
              <Text className="text-neutral-500 font-bold text-xs mt-1">
                Passwords
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions (Floating Pill style) */}
        <View className="bg-white rounded-full p-2 flex-row justify-between items-center mb-10 shadow-lg shadow-neutral-200/50 border border-neutral-100">
          <TouchableOpacity className="flex-1 py-4 items-center rounded-full bg-neutral-100/50 flex-row justify-center mx-1">
            <Feather name="upload" size={18} color="black" />
            <Text className="font-bold text-black ml-2">Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity className="w-14 h-14 bg-black rounded-full items-center justify-center mx-1">
            <Feather name="plus" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 py-4 items-center rounded-full bg-neutral-100/50 flex-row justify-center mx-1">
            <Feather name="edit-2" size={18} color="black" />
            <Text className="font-bold text-black ml-2">Note</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Files List */}
        <View>
          <Text className="text-xl font-black text-black mb-6 px-2 tracking-tight">
            Recent Activity
          </Text>
        </View>

        <View className="mb-20">
          {recentFiles.map((file, index) => (
            <View
              key={file.id}
              className="flex-row items-center p-4 bg-white rounded-[24px] mb-3 shadow-sm border border-neutral-100"
            >
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
                style={{ backgroundColor: file.color + "15" }}
              >
                <Feather name={file.type as any} size={24} color={file.color} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-black font-bold text-lg mb-1 tracking-tight"
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                <View className="flex-row items-center">
                  <Feather name="lock" size={12} color="#737373" />
                  <Text className="text-neutral-500 font-bold text-xs ml-1">
                    {file.size} • AES-256
                  </Text>
                </View>
              </View>
              <TouchableOpacity className="w-10 h-10 items-center justify-center bg-neutral-50 rounded-full">
                <Feather name="more-horizontal" size={20} color="black" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
