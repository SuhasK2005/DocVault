import { create } from "zustand";

interface AuthState {
  user: any | null; // We will use Supabase User type later
  masterKey: string | null;
  isUnlocked: boolean;
  setUser: (user: any | null) => void;
  setMasterKey: (key: string | null) => void;
  setUnlocked: (status: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  masterKey: null,
  isUnlocked: false,
  setUser: (user) => set({ user }),
  setMasterKey: (masterKey) => set({ masterKey }),
  setUnlocked: (isUnlocked) => set({ isUnlocked }),
  logout: () => set({ user: null, masterKey: null, isUnlocked: false }),
}));
