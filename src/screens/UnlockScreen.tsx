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
  ActivityIndicator,
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

  const [step, setStep] = useState<"biometrics" | "loading" | "setup">(
    "biometrics"
  );
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
      const { derivedKeyHex, saltHex, authHash } = deriveMasterKey(
        password.trim()
      );

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
                  name={step === "setup" ? "shield" : "lock"}
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
                  {step === "setup" ? "Secure Your\nVault" : "Vault\nLocked"}
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
                  {step === "setup"
                    ? "Welcome! Please set a 6-digit Master PIN. You will need this later to encrypt or open your files."
                    : step === "loading"
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

              {step === "setup" && (
                <View style={{ gap: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: THEME.surface,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: THEME.borderGlass,
                      paddingHorizontal: 20,
                      height: 64,
                    }}
                  >
                    <Feather name="key" size={20} color={THEME.textMuted} />
                    <TextInput
                      style={{
                        flex: 1,
                        color: "white",
                        fontSize: 20,
                        fontFamily: "SpaceGrotesk_Bold",
                        marginLeft: 16,
                        letterSpacing: 4,
                      }}
                      placeholder="Create 6-digit PIN"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={6}
                      value={password}
                      onChangeText={(val) =>
                        setPassword(val.replace(/[^0-9]/g, ""))
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isProcessing}
                    />
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: THEME.surface,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: THEME.borderGlass,
                      paddingHorizontal: 20,
                      height: 64,
                    }}
                  >
                    <Feather name="key" size={20} color={THEME.textMuted} />
                    <TextInput
                      style={{
                        flex: 1,
                        color: "white",
                        fontSize: 20,
                        fontFamily: "SpaceGrotesk_Bold",
                        marginLeft: 16,
                        letterSpacing: 4,
                      }}
                      placeholder="Confirm 6-digit PIN"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={6}
                      value={confirmPassword}
                      onChangeText={(val) =>
                        setConfirmPassword(val.replace(/[^0-9]/g, ""))
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isProcessing}
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleSetupMasterPin}
                    style={{
                      backgroundColor: THEME.accent,
                      borderRadius: 20,
                      paddingVertical: 18,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 16,
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
                      {isProcessing ? "Encrypting..." : "Complete Setup"}
                    </Text>
                    {!isProcessing && (
                      <Feather name="check" size={20} color="black" />
                    )}
                  </TouchableOpacity>
                </View>
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
