// src/lib/api/auth.ts
import { supabase } from "../supabase";
import type { Profile, UserRole } from "../../types";

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  role: UserRole = "player",
  // 🔥 1. ACTUALIZAMOS EL TIPADO DE EXTRA PARA ACEPTAR IGNITION
  extra?: { 
    country_code?: string; 
    whatsapp?: string;
    ignition_league_player?: boolean;
    ignition_email?: string;
    ignition_nickname?: string;
  },
  captchaToken?: string // 🛡️ AÑADIDO: Token de Turnstile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/welcome`, // 👈 REDIRECCIÓN MÁGICA
      captchaToken, // 🛡️ ENVIADO A SUPABASE AUTH
      data: {
        display_name: displayName,
        role,
        // Supabase trigger leerá estos campos para poblar profiles
        country_code: extra?.country_code ?? null,
        whatsapp: extra?.whatsapp ?? null,
        // 🔥 2. PASAMOS LOS DATOS PARA QUE SE GUARDEN EN USER_METADATA DE SUPABASE
        ignition_league_player: extra?.ignition_league_player ?? null,
        ignition_email: extra?.ignition_email ?? null,
        ignition_nickname: extra?.ignition_nickname ?? null,
      },
    },
  });
  if (error) throw error;

  // Si el trigger no escribe los datos a tiempo, forzamos la inyección manual
  if (data.user) {
    const updatePayload: any = {};
    
    // Inyectamos datos base
    if (extra?.country_code) updatePayload.country_code = extra.country_code;
    if (extra?.whatsapp) updatePayload.whatsapp = extra.whatsapp;
    
    // 🔥 Inyectamos explícitamente los datos de Ignition para que aparezcan en el panel
    if (extra?.ignition_league_player) {
      updatePayload.ignition_league_player = true;
      updatePayload.ignition_email = extra.ignition_email ?? email;
      updatePayload.ignition_nickname = extra.ignition_nickname;
      updatePayload.ignition_status = 'verified';
      updatePayload.ignition_linked_at = new Date().toISOString();
      updatePayload.ignition_password_sent = false; // Los dejamos como pendientes
    }

    // Solo hacemos la actualización si hay algo que actualizar
    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", data.user.id);
    }
  }

  return data;
}

export async function signIn(email: string, password: string, captchaToken?: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: {
      captchaToken, // 🛡️ Enviamos el token al endpoint de login
    }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "display_name" | "country_code" | "whatsapp" | "avatar_url">>
) {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) throw error;

  const profile = await getProfile(userId);
  if (!profile) throw new Error("Profile not found after update");
  return profile;
}

// Agrega esto al final de src/lib/api/auth.ts
export async function resetPasswordForEmail(email: string, captchaToken?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
    captchaToken, // 🛡️ Protegemos también este formulario contra bots
  });
  if (error) throw error;
}

export async function updateUserPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}