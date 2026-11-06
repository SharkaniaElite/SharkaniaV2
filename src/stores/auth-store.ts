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

    let active = true;
    let authSequence = 0;

    // Never trap the public app behind an indefinitely pending Auth request.
    const initTimeout = setTimeout(() => {
      if (active && get().isLoading) {
        set({ isLoading: false });
      }
    }, 5000);

    // IMPORTANT: Supabase Auth callbacks must remain synchronous.
    // Calling the SAME Supabase client and awaiting a query inside this
    // callback can deadlock the auth lock and freeze subsequent requests.
    // INITIAL_SESSION replaces a separate, duplicate getSession() request.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      clearTimeout(initTimeout);

      if (event === "SIGNED_OUT" || !session?.user) {
        authSequence++;
        posthog.reset();
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      const userId = session.user.id;
      const changedUser = get().user?.id !== userId;
      set({
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        ...(changedUser ? { profile: null } : {}),
      });
      posthog.identify(userId, { email: session.user.email });

      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION" && !changedUser) {
        return;
      }

      const sequenceAtSchedule = ++authSequence;

      // Scheduling outside the current callback releases the Auth lock before
      // fetchProfile() runs. The sequence guard prevents stale sign-in responses
      // from overwriting a later sign-out or a different account.
      setTimeout(() => {
        if (!active || authSequence !== sequenceAtSchedule) return;
        void fetchProfile(userId)
          .then((profile) => {
            if (!active || authSequence !== sequenceAtSchedule ||
                !get().isAuthenticated || get().user?.id !== userId) return;
            if (profile) posthog.setPersonProperties({ role: profile.role });
            set({ profile, isLoading: false });
          })
          .catch((error: unknown) => {
            if (active && authSequence === sequenceAtSchedule) {
              console.warn("Could not refresh the signed-in profile:", error);
            }
          });
      }, 0);
    });

    return () => {
      active = false;
      authSequence++;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
      // React StrictMode and route remounts must be able to re-subscribe.
      set({ initialized: false });
    };
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
    if (profile && get().user?.id === user.id && get().isAuthenticated) {
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
