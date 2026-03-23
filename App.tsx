import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import { useAuthStore } from "./src/stores/useAuthStore";
import LoginScreen from "./src/screens/LoginScreen";
import UnlockScreen from "./src/screens/UnlockScreen";
import DashboardScreen from "./src/screens/DashboardScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const user = useAuthStore((state) => state.user);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !isUnlocked ? (
          <Stack.Screen name="Unlock" component={UnlockScreen} />
        ) : (
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
