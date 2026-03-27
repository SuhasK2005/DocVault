import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import { createClient } from "@supabase/supabase-js";

const AUTH_STORAGE_DIR = `${FileSystem.documentDirectory}supabase-auth`;
const SECURE_STORE_SAFE_LIMIT = 1900;

const filePathForKey = (key: string) =>
  `${AUTH_STORAGE_DIR}/${encodeURIComponent(key)}.txt`;

const ensureAuthStorageDir = async () => {
  const info = await FileSystem.getInfoAsync(AUTH_STORAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUTH_STORAGE_DIR, {
      intermediates: true,
    });
  }
};

const ExpoAuthStorageAdapter = {
  getItem: async (key: string) => {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue != null) {
      return secureValue;
    }

    const filePath = filePathForKey(key);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return null;
    }

    return FileSystem.readAsStringAsync(filePath);
  },

  setItem: async (key: string, value: string) => {
    if (value.length <= SECURE_STORE_SAFE_LIMIT) {
      await SecureStore.setItemAsync(key, value);

      const filePath = filePathForKey(key);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
      return;
    }

    await ensureAuthStorageDir();
    await SecureStore.deleteItemAsync(key);
    await FileSystem.writeAsStringAsync(filePathForKey(key), value);
  },

  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
    await FileSystem.deleteAsync(filePathForKey(key), { idempotent: true });
  },
};

// TODO: Need your actual Supabase URL & Anon Key from project settings
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const isSupabaseConfigured =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
  !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoAuthStorageAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
