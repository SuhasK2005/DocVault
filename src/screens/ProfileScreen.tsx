import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../stores/useAuthStore";
import { supabase } from "../services/supabase";

const THEME = {
  bg: "#0e0e0e",
  surface: "#1a1919",
  surfaceBright: "#2c2c2c",
  accent: "#ff9157",
  textMuted: "#adaaaa",
  borderGlass: "rgba(173, 170, 170, 0.1)",
};

const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    Alert.alert(
      "Terminate Session",
      "Are you sure you want to logout of the vault?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              logout();
            } catch (err: any) {
              Alert.alert("Logout Error", err.message);
            }
          },
        },
      ],
    );
  };

  const SettingsItem = ({
    icon,
    title,
    subtitle,
    onPress,
  }: {
    icon: string;
    title: string;
    subtitle: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: THEME.surface,
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: THEME.borderGlass,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          backgroundColor: THEME.surfaceBright,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 16,
        }}
      >
        <Feather name={icon as any} size={20} color={THEME.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: "white",
            fontSize: 16,
            fontFamily: "SpaceGrotesk_Bold",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: THEME.textMuted,
            fontSize: 12,
            fontFamily: "Manrope",
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={THEME.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 24,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 44,
            height: 44,
            backgroundColor: THEME.surface,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: THEME.borderGlass,
          }}
        >
          <Feather name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: "white",
            fontSize: 16,
            fontFamily: "SpaceGrotesk_Bold",
            letterSpacing: 2,
            marginRight: 44, // Offset for back button to center title
          }}
        >
          DOCVAULT
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, paddingHorizontal: 24 }}
      >
        {/* Profile Card */}
        <View
          style={{
            backgroundColor: THEME.surface,
            borderRadius: 32,
            padding: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor: THEME.borderGlass,
            marginBottom: 32,
          }}
        >
          {user?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                marginBottom: 16,
              }}
            />
          ) : (
            <View
              style={{
                width: 100,
                height: 100,
                backgroundColor: THEME.surfaceBright,
                borderRadius: 50,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Feather name="user" size={48} color="white" />
            </View>
          )}
          <Text
            style={{
              color: "white",
              fontSize: 24,
              fontFamily: "SpaceGrotesk_Bold",
              marginBottom: 4,
            }}
          >
            {user?.user_metadata?.full_name || "The Curator"}
          </Text>
          <Text
            style={{
              color: THEME.textMuted,
              fontSize: 14,
              fontFamily: "Manrope",
              marginBottom: 24,
            }}
          >
            Locked Security Level 1
          </Text>

          {/* Storage Bar */}
          <View style={{ width: "100%", marginTop: 16 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 13,
                  fontFamily: "SpaceGrotesk_Bold",
                }}
              >
                Storage Capacity
              </Text>
              <Text
                style={{
                  color: THEME.accent,
                  fontSize: 13,
                  fontFamily: "SpaceGrotesk_Bold",
                }}
              >
                85% Full
              </Text>
            </View>
            <View
              style={{
                height: 6,
                backgroundColor: THEME.surfaceBright,
                borderRadius: 3,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: "85%",
                  backgroundColor: THEME.accent,
                }}
              />
            </View>
            <Text
              style={{
                color: THEME.textMuted,
                fontSize: 12,
                fontFamily: "Manrope",
              }}
            >
              850 GB / 1 TB
            </Text>
          </View>
        </View>

        {/* Preferences Section */}
        <Text
          style={{
            color: THEME.textMuted,
            fontSize: 12,
            fontFamily: "SpaceGrotesk_Bold",
            letterSpacing: 4,
            marginBottom: 16,
            marginLeft: 4,
            textTransform: "uppercase",
          }}
        >
          Preferences & Identity
        </Text>
        <SettingsItem
          icon="shield"
          title="Security Protocols"
          subtitle="Biometric & 2FA keys"
        />
        <SettingsItem
          icon="smartphone"
          title="Interface Appearance"
          subtitle="Dark mode & Kinetic glow"
        />
        <SettingsItem
          icon="bell"
          title="Signal Alerts"
          subtitle="Critical access notifications"
        />

        {/* Support Section */}
        <Text
          style={{
            color: THEME.textMuted,
            fontSize: 12,
            fontFamily: "SpaceGrotesk_Bold",
            letterSpacing: 4,
            marginTop: 24,
            marginBottom: 16,
            marginLeft: 4,
            textTransform: "uppercase",
          }}
        >
          Support & Legal
        </Text>
        <SettingsItem
          icon="help-circle"
          title="Vault Support"
          subtitle="Get help with your vault"
        />
        <SettingsItem
          icon="file-text"
          title="Privacy Policy"
          subtitle="Your data rights"
        />

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 24,
            marginTop: 32,
            marginBottom: 48,
            backgroundColor: "rgba(255, 115, 81, 0.05)",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(255, 115, 81, 0.1)",
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              backgroundColor: "rgba(255, 115, 81, 0.1)",
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 16,
            }}
          >
            <Feather name="log-out" size={20} color="#ff7351" />
          </View>
          <View>
            <Text
              style={{
                color: "#ff7351",
                fontSize: 16,
                fontFamily: "SpaceGrotesk_Bold",
              }}
            >
              Terminate Session
            </Text>
            <Text
              style={{
                color: "rgba(255, 115, 81, 0.6)",
                fontSize: 12,
                fontFamily: "Manrope",
                marginTop: 2,
              }}
            >
              Logout of the Vault
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;
