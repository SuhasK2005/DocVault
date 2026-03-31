import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
//
interface AuthState {
  user: User | null;
  session: Session | null;
  isUnlocked: boolean;
  isAuthReady: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setUnlocked: (status: boolean) => void;
  setAuthReady: (status: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isUnlocked: false,
  isAuthReady: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setUnlocked: (isUnlocked) => set({ isUnlocked }),
  setAuthReady: (isAuthReady) => set({ isAuthReady }),
  logout: () =>
    set({
      user: null,
      session: null,
      isUnlocked: false,
      isAuthReady: true,
    }),
}));
