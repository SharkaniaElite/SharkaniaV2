// src/stores/auth-store.ts
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";
import type { User } from "@supabase/supabase-js";
import posthog from "posthog-js";

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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,

  initialize: () => {
    if (get().initialized) return () => {};
    set({ initialized: true });

    const initTimeout = setTimeout(() => {
      if (get().isLoading) {
        set({ isLoading: false });
      }
    }, 5000);

    // 1. CARGA INICIAL
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(initTimeout);
      if (session?.user) {
        // 🎯 IDENTIFICACIÓN INMEDIATA (Rápida)
        posthog.identify(session.user.id, {
          email: session.user.email,
        });

        const profile = await fetchProfile(session.user.id);
        
        // 🎯 ACTUALIZACIÓN DE PROPIEDADES (Con camelCase)
        if (profile) {
          posthog.setPersonProperties({ role: profile.role });
        }

        set({
          user: session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    });

    // 2. ESCUCHA DE CAMBIOS
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        posthog.reset();
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      if (session?.user) {
        // Identificar rápido para ganar la carrera contra el cambio de página
        posthog.identify(session.user.id, {
          email: session.user.email,
        });

        set({ user: session.user, isAuthenticated: true });

        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          const profile = await fetchProfile(session.user.id);
          
          if (profile) {
            posthog.setPersonProperties({ role: profile.role });
          }

          set({ profile, isLoading: false });
        }
      }
    });

    return () => subscription.unsubscribe();
  },

  setProfile: (profile) => {
    set({ profile });
    const { user } = get();
    if (user) {
      posthog.setPersonProperties({ role: profile.role });
    }
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await fetchProfile(user.id);
    if (profile) {
      set({ profile });
      posthog.setPersonProperties({ role: profile.role });
    }
  },

  logout: async () => {
    posthog.reset();
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    });

    await supabase.auth.signOut();
  },
}));