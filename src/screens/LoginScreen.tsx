import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import Svg, { Path } from "react-native-svg";
import { isSupabaseConfigured, supabase } from "../services/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGoogleLogin = async () => {
    if (isLoading) {
      return;
    }

    const redirectTo = AuthSession.makeRedirectUri();

    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        Alert.alert(
          "Configure Supabase",
          "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment before using Google login."
        );
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error("Failed to initialize Google sign-in URL.");
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type !== "success" || !result.url) {
        return;
      }

      const urlToParse = result.url.replace("#", "?");
      const parsed = Linking.parse(urlToParse);

      const authError =
        typeof parsed.queryParams?.error_description === "string"
          ? parsed.queryParams.error_description
          : typeof parsed.queryParams?.error === "string"
          ? parsed.queryParams.error
          : null;

      if (authError) {
        throw new Error(authError);
      }

      const code =
        parsed.queryParams?.code && typeof parsed.queryParams.code === "string"
          ? parsed.queryParams.code
          : null;

      if (!code) {
        const access_token =
          parsed.queryParams?.access_token &&
          typeof parsed.queryParams.access_token === "string"
            ? parsed.queryParams.access_token
            : null;

        const refresh_token =
          parsed.queryParams?.refresh_token &&
          typeof parsed.queryParams.refresh_token === "string"
            ? parsed.queryParams.refresh_token
            : null;

        if (access_token && refresh_token) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
          if (sessionError) throw sessionError;
          useAuthStore.getState().setSession(sessionData.session);
          return;
        }

        throw new Error(
          "No auth code or access token returned from Google OAuth."
        );
      }

      const { error: exchangeError, data: sessionData } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw exchangeError;
      }

      useAuthStore.getState().setSession(sessionData.session);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed";
      Alert.alert(
        "Login Failed",
        `${message}\n\nEnsure this Redirect URL is in Supabase:\n${redirectTo}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const THEME = {
    bg: "#121212",
    accent: "#FF8A4C", // Orange/Coral from the image
    cardBg: "#1C1C1E",
    cardBorder: "#2C2C2E",
    btnDark: "#262628",
    textMuted: "#A1A1AA",
  };

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar style="light" hidden={true} />

      <SafeAreaView className="flex-1 justify-between px-6 pb-10 pt-16">
        {/* Top Section: Icon & Branding */}
        <View className="items-center">
          <View
            style={{
              width: 56,
              height: 64,
              backgroundColor: "rgba(255,138,76,0.06)", // Slight orange tint
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,138,76,0.15)",
              marginBottom: 16,
            }}
          >
            <Feather name="shield" size={28} color={THEME.accent} />
          </View>

          <Text
            style={{
              color: THEME.textMuted,
              fontFamily: "SpaceGrotesk_Bold",
              fontSize: 11,
              letterSpacing: 6,
              marginBottom: 48,
            }}
          >
            KINETIC VAULT
          </Text>

          {/* Hero Typography */}
          <Text
            style={{
              fontSize: 44,
              fontFamily: "SpaceGrotesk_Bold",
              color: "white",
              textAlign: "center",
              lineHeight: 48,
              letterSpacing: -1,
            }}
          >
            Secure Your
          </Text>
          <Text
            style={{
              fontSize: 44,
              fontFamily: "SpaceGrotesk_Bold",
              color: THEME.accent,
              textAlign: "center",
              lineHeight: 48,
              letterSpacing: -1,
            }}
          >
            Digital Vault
          </Text>

          {/* Subtitle */}
          <Text
            style={{
              marginTop: 28,
              fontSize: 15,
              color: THEME.textMuted,
              textAlign: "center",
              lineHeight: 24,
              paddingHorizontal: 12,
              fontWeight: "400",
            }}
          >
            Step into the high-end private{"\n"}
            environment for your most sensitive data.{"\n"}
            Weightless security, editorial precision,{"\n"}
            and absolute privacy.
          </Text>
        </View>

        {/* Login Card Layer */}
        <View className="items-center w-full">
          <View
            style={{
              width: "100%",
              backgroundColor: THEME.cardBg,
              borderRadius: 32,
              padding: 24,
              paddingVertical: 32,
              borderWidth: 1,
              borderColor: THEME.cardBorder,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.5,
              shadowRadius: 30,
              elevation: 10,
            }}
          >
            {/* Primary Google Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleGoogleLogin}
              disabled={isLoading}
              style={{
                backgroundColor: "#262628", // Dark premium background for the button
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      backgroundColor: "white",
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      position: "absolute",
                      left: 16,
                    }}
                  >
                    <Svg width="18" height="18" viewBox="0 0 24 24">
                      <Path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <Path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <Path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z"
                        fill="#FBBC05"
                      />
                      <Path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </Svg>
                  </View>
                  <Text
                    style={{
                      color: "white",
                      fontFamily: "Manrope_Bold",
                      fontSize: 16,
                      marginLeft: 8,
                    }}
                  >
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Separator */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginVertical: 24,
              }}
            >
              <View
                style={{ flex: 1, height: 1, backgroundColor: "#333333" }}
              />
              <Text
                style={{
                  color: "#666666",
                  fontSize: 10,
                  fontFamily: "Manrope_Bold",
                  letterSpacing: 1.5,
                  marginHorizontal: 12,
                }}
              >
                SECURED ENTRY
              </Text>
              <View
                style={{ flex: 1, height: 1, backgroundColor: "#333333" }}
              />
            </View>

            {/* Placeholder Key-File Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                Alert.alert("Key-File Access", "This feature is coming soon.")
              }
              style={{
                backgroundColor: THEME.btnDark,
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather
                name="key"
                size={16}
                color="#A1A1AA"
                style={{ position: "absolute", left: 20 }}
              />
              <Text
                style={{
                  color: "white",
                  fontFamily: "Manrope_Bold",
                  fontSize: 15,
                }}
              >
                Use Key-File Access
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Area */}
        <View className="items-center mt-6">
          <Text
            style={{
              color: "#555555",
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            By entering, you agree to our{" "}
            <Text style={{ color: "#888888" }}>Digital Statutes</Text>
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Feather name="lock" size={12} color="#666666" />
              <Text
                style={{
                  color: "#666666",
                  fontSize: 10,
                  fontFamily: "Manrope_Bold",
                  letterSpacing: 1,
                }}
              >
                AES-256
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Feather name="share-2" size={12} color="#666666" />
              <Text
                style={{
                  color: "#666666",
                  fontSize: 10,
                  fontFamily: "Manrope_Bold",
                  letterSpacing: 1,
                }}
              >
                P2P NODE
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
