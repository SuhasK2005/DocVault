import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { supabase } from "../services/supabase";

export default function UnlockScreen() {
  const setUnlocked = useAuthStore((state) => state.setUnlocked);
  const logout = useAuthStore((state) => state.logout);

  const [step, setStep] = useState<"biometrics" | "loading">("biometrics");

  const handleDeviceAuth = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // If device doesn't have biometrics/passcode, skip and unlock directly
      if (!hasHardware || !isEnrolled) {
        setUnlocked(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock DocVault",
        cancelLabel: "Cancel",
        fallbackLabel: "Use Device Passcode",
      });

      if (result.success) {
        setStep("loading");
        setUnlocked(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    logout();
  };

  const THEME = {
    bg: "#0e0e0e",
    surface: "#1a1919",
    surfaceBright: "#2c2c2c",
    accent: "#ff9157",
    textMuted: "#adaaaa",
    borderGlass: "rgba(173, 170, 170, 0.1)",
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar style="light" hidden={true} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              flex: 1,
              paddingHorizontal: 32,
              paddingTop: 100,
              paddingBottom: 48,
              justifyContent: "space-between",
            }}
          >
            <View>
              {/* Icon Header */}
              <View
                style={{
                  width: 64,
                  height: 64,
                  backgroundColor: "rgba(255, 145, 87, 0.1)",
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255, 145, 87, 0.2)",
                  marginBottom: 60,
                }}
              >
                <Feather
                  name="lock"
                  size={28}
                  color={THEME.accent}
                />
              </View>

              <View>
                <Text
                  style={{
                    color: THEME.textMuted,
                    fontFamily: "SpaceGrotesk_Bold",
                    fontSize: 13,
                    letterSpacing: 2,
                    marginBottom: 12,
                    textTransform: "uppercase",
                  }}
                >
                  SECURED ENTRY
                </Text>
                <Text
                  style={{
                    fontSize: 44,
                    fontFamily: "SpaceGrotesk_Bold",
                    color: "white",
                    letterSpacing: -1.5,
                    marginBottom: 16,
                    lineHeight: 48,
                  }}
                >
                  Vault{`\n`}Locked
                </Text>
                <Text
                  style={{
                    color: THEME.textMuted,
                    fontSize: 15,
                    fontFamily: "Manrope_Bold",
                    lineHeight: 24,
                    marginBottom: 60,
                  }}
                >
                  {step === "loading"
                    ? "Verifying secure enclave..."
                    : "App locked. Tap below to use your device biometrics or passcode to enter."}
                </Text>
              </View>

              {step === "loading" && (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 40,
                  }}
                >
                  <ActivityIndicator size="large" color={THEME.accent} />
                </View>
              )}

              {step === "biometrics" && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleDeviceAuth}
                  style={{
                    backgroundColor: THEME.accent,
                    borderRadius: 20,
                    paddingVertical: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: THEME.accent,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "black",
                      fontSize: 18,
                      fontFamily: "SpaceGrotesk_Bold",
                      marginRight: 12,
                    }}
                  >
                    Unlock App
                  </Text>
                  <Feather name="smile" size={20} color="black" />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ alignItems: "center" }}>
              <TouchableOpacity
                style={{ paddingVertical: 16, paddingHorizontal: 24 }}
                onPress={handleSignOut}
              >
                <Text
                  style={{
                    color: "#FF453A",
                    fontFamily: "Manrope_Bold",
                    fontSize: 12,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
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
