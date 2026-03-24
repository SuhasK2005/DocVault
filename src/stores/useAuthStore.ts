import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
//
interface AuthState {
  user: User | null;
  session: Session | null;
  masterKey: string | null;
  isUnlocked: boolean;
  isAuthReady: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setMasterKey: (key: string | null) => void;
  setUnlocked: (status: boolean) => void;
  setAuthReady: (status: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  masterKey: null,
  isUnlocked: false,
  isAuthReady: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setMasterKey: (masterKey) => set({ masterKey }),
  setUnlocked: (isUnlocked) => set({ isUnlocked }),
  setAuthReady: (isAuthReady) => set({ isAuthReady }),
  logout: () =>
    set({
      user: null,
      session: null,
      masterKey: null,
      isUnlocked: false,
      isAuthReady: true,
    }),
}));
