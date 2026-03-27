import React from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import { useAuthStore } from "./src/stores/useAuthStore";
import { supabase } from "./src/services/supabase";
import LoginScreen from "./src/screens/LoginScreen";
import UnlockScreen from "./src/screens/UnlockScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import AllDocumentsScreen from "./src/screens/AllDocumentsScreen";
import DocumentViewerScreen from "./src/screens/DocumentViewerScreen";
import ScannerScreen from "./src/screens/ScannerScreen";

import * as Linking from "expo-linking";
import { useFonts } from 'expo-font';

// Direct require of font assets to bypass Metro resolution issues with the package index
const SpaceGrotesk_400Regular = require('@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf');
const SpaceGrotesk_700Bold = require('@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf');
const Manrope_400Regular = require('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf');
const Manrope_700Bold = require('@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf');

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [Linking.createURL("/")],
  // Intercept and ignore deep links so React Navigation doesn't try to parse them
  // (We handle the OAuth deep link manually in LoginScreen.tsx using WebBrowser)
  async getInitialURL() {
    return null;
  },
  subscribe(listener: any) {
    return () => {};
  },
  config: {
    screens: {
      Login: "",
      Unlock: "unlock",
      Dashboard: "dashboard",
      AllDocuments: "documents",
      DocumentViewer: "viewer",
      Scanner: "scanner",
    },
  },
};

export default function App() {
  const user = useAuthStore((state) => state.user);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);
  const setSession = useAuthStore((state) => state.setSession);
  const setUnlocked = useAuthStore((state) => state.setUnlocked);
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const setAuthReady = useAuthStore((state) => state.setAuthReady);
  const backgroundAtRef = React.useRef<number | null>(null);

  const [fontsLoaded] = useFonts({
    SpaceGrotesk: SpaceGrotesk_400Regular,
    SpaceGrotesk_Bold: SpaceGrotesk_700Bold,
    Manrope: Manrope_400Regular,
    Manrope_Bold: Manrope_700Bold,
  });

  React.useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      setSession(data.session);
      setAuthReady(true);
      setUnlocked(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUnlocked(false);
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "background" || state === "inactive") {
          backgroundAtRef.current = Date.now();
          return;
        }

        if (state === "active" && backgroundAtRef.current) {
          const elapsedMs = Date.now() - backgroundAtRef.current;
          // Phase 1 rule: relock only if app stayed in background for >= 30 seconds.
          if (elapsedMs >= 30_000) {
            setUnlocked(false);
          }
          backgroundAtRef.current = null;
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [setAuthReady, setSession, setUnlocked]);

  if (!isAuthReady || !fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !isUnlocked ? (
          <Stack.Screen name="Unlock" component={UnlockScreen} />
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="AllDocuments" component={AllDocumentsScreen} />
            <Stack.Screen
              name="DocumentViewer"
              component={DocumentViewerScreen}
            />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
