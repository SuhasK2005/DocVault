import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/useAuthStore";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";
import { isSupabaseConfigured, supabase } from "../services/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = React.useState(false);
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
    if (isLoading) {
      return;
    }

    const redirectTo = AuthSession.makeRedirectUri();

    console.log("Expected Return URL:", redirectTo);

    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        Alert.alert(
          "Configure Supabase",
          "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment before using Google login.",
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
        redirectTo,
      );

      if (result.type !== "success" || !result.url) {
        return;
      }

      // Handle # fragments which Supabase sometimes returns instead of ? query params
      // depending on the implicit vs explicit flow settings.
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
        // Try getting access_token if implicit flow was used
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
          "No auth code or access token returned from Google OAuth.",
        );
      }

      const { error: exchangeError, data: sessionData } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw exchangeError;
      }

      // Force an update to the auth store with the newly acquired session
      // This will trigger App.tsx to unmount LoginScreen and mount Dashboard/Unlock
      useAuthStore.getState().setSession(sessionData.session);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed";
      Alert.alert(
        "Login Failed",
        `${message}\n\nEnsure this Redirect URL is in Supabase:\n${redirectTo}`,
      );
    } finally {
      setIsLoading(false);
    }
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

          <Text className="text-[60px] font-black text-white leading-[65px] tracking-tighter">
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
                  {isLoading ? "Connecting..." : "Initiate Uplink"}
                </Text>
              </View>
              {isLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Feather name="arrow-right" size={24} color="black" />
              )}
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
