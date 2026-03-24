import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import { supabase } from "../services/supabase";
import { deriveMasterKey } from "../services/encryption";

export default function UnlockScreen() {
  const setUnlocked = useAuthStore((state) => state.setUnlocked);
  const setMasterKey = useAuthStore((state) => state.setMasterKey);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState<"biometrics" | "loading" | "setup">("biometrics");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeviceAuth = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // If device doesn't have biometrics/passcode, skip directly to profile check
      if (!hasHardware || !isEnrolled) {
        setStep("loading");
        await checkUserProfile();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock DocVault",
        cancelLabel: "Cancel",
        fallbackLabel: "Use Device Passcode",
      });

      if (result.success) {
        setStep("loading");
        await checkUserProfile();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("master_hash, master_salt")
        .eq("id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile", error);
      }

      if (data && data.master_hash && data.master_salt) {
        // Existing user, securely unlocked via device!
        setUnlocked(true);
      } else {
        // New user, needs to set up the Master PIN
        setStep("setup");
      }
    } catch (e) {
      console.error(e);
      setStep("setup");
    }
  };

  const handleSetupMasterPin = async () => {
    if (password.trim() !== confirmPassword.trim()) {
      Alert.alert("Error", "PINs do not match.");
      return;
    }
    if (password.trim().length !== 6) {
      Alert.alert("Error", "Master PIN must be exactly 6 digits.");
      return;
    }

    setIsProcessing(true);
    try {
      const { derivedKeyHex, saltHex, authHash } = deriveMasterKey(password.trim());

      const { error } = await supabase.from("profiles").upsert({
        id: user?.id,
        master_hash: authHash,
        master_salt: saltHex,
      });

      if (error) throw error;

      // Save the newly derived key temporarily so they don't have to type it again this exact session
      setMasterKey(derivedKeyHex);
      setUnlocked(true);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to setup Master PIN.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    logout();
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
                <Feather name={step === "setup" ? "shield" : "lock"} size={32} color="#D4D4D8" />
              </View>

              <View>
                <Text className="text-[48px] font-black tracking-tighter mb-4 text-white leading-[48px]">
                  {step === "setup" ? "Secure\nVault." : "Vault\nLocked."}
                </Text>
                <Text className="text-neutral-400 font-medium text-lg leading-relaxed mb-10">
                  {step === "setup"
                    ? "Welcome! Please set a 6-digit Master PIN. You will need this later to encrypt or open your files."
                    : step === "loading"
                    ? "Verifying secure enclave..."
                    : "App locked. Tap below to use your device biometrics or passcode to enter."}
                </Text>
              </View>

              {step === "loading" && (
                <View className="items-center justify-center py-10">
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              )}

              {step === "biometrics" && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleDeviceAuth}
                  className="w-full overflow-hidden rounded-[28px] mt-2"
                >
                  <LinearGradient
                    colors={["#ffffff", "#e4e4e7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="py-5 px-8 flex-row items-center justify-center h-20"
                  >
                    <Text className="text-black text-xl font-bold tracking-tight mr-3">
                      Unlock App
                    </Text>
                    <Feather name="smile" size={20} color="black" />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {step === "setup" && (
                <View className="space-y-4">
                  <View className="bg-neutral-900 rounded-[28px] border border-neutral-800 flex-row items-center px-6 py-2 h-20">
                    <Feather name="key" size={20} color="#71717A" />
                    <TextInput
                      className="flex-1 text-white text-xl font-bold ml-4 tracking-wider h-full"
                      placeholder="Create 6-digit PIN"
                      placeholderTextColor="#52525B"
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={6}
                      value={password}
                      onChangeText={(val) => setPassword(val.replace(/[^0-9]/g, ""))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isProcessing}
                    />
                  </View>

                  <View className="bg-neutral-900 rounded-[28px] border border-neutral-800 flex-row items-center px-6 py-2 h-20">
                    <Feather name="key" size={20} color="#71717A" />
                    <TextInput
                      className="flex-1 text-white text-xl font-bold ml-4 tracking-wider h-full"
                      placeholder="Confirm 6-digit PIN"
                      placeholderTextColor="#52525B"
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={6}
                      value={confirmPassword}
                      onChangeText={(val) => setConfirmPassword(val.replace(/[^0-9]/g, ""))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isProcessing}
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleSetupMasterPin}
                    className="w-full overflow-hidden rounded-[28px] mt-2"
                  >
                    <LinearGradient
                      colors={["#ffffff", "#e4e4e7"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="py-5 px-8 flex-row items-center justify-center h-20"
                    >
                      <Text className="text-black text-xl font-bold tracking-tight mr-3">
                        {isProcessing ? "Encrypting..." : "Complete Setup"}
                      </Text>
                      <Feather name="check" size={20} color="black" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View>
              <TouchableOpacity
                className="items-center py-4"
                onPress={handleSignOut}
              >
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
