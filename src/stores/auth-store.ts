// src/stores/auth-store.ts
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  initialize: () => () => void;
  setProfile: (profile: Profile) => void;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Failed to fetch profile:", error.message);
      return null;
    }
    return data as Profile;
  } catch {
    console.warn("Profile fetch exception");
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,

  initialize: () => {
    // Prevent double initialization
    if (get().initialized) return () => {};
    set({ initialized: true });

    // Get initial session with timeout
    const initTimeout = setTimeout(() => {
      // If still loading after 5 seconds, force ready state
      if (get().isLoading) {
        console.warn("Auth init timeout - forcing ready state");
        set({ isLoading: false });
      }
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(initTimeout);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        set({
          user: session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    }).catch(() => {
      clearTimeout(initTimeout);
      set({ isLoading: false });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // On sign out, immediately clear everything
      if (event === "SIGNED_OUT" || !session) {
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      // On sign in or token refresh
      if (session?.user) {
        set({ user: session.user, isAuthenticated: true });

        // Only fetch profile on actual sign in, not on every token refresh
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          const profile = await fetchProfile(session.user.id);
          set({ profile, isLoading: false });
        }
      }
    });

    return () => subscription.unsubscribe();
  },

  setProfile: (profile) => set({ profile }),

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await fetchProfile(user.id);
    if (profile) set({ profile });
  },

  logout: async () => {
    // Immediately clear state FIRST (prevents UI hanging)
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Then try to sign out from Supabase (fire and forget)
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore errors - state is already cleared
    }
  },
}));
