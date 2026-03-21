// src/pages/player-dashboard.tsx
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { StatCard } from "../components/ui/stat-card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { NicknameClaim } from "../components/admin/nickname-claim";
import { useAuthStore } from "../stores/auth-store";
import { updateProfile } from "../lib/api/auth";
import { getFlag, getCountryName } from "../lib/countries";
import { Settings, User, LogOut, Link as LinkIcon, Camera } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { SEOHead } from "../components/seo/seo-head";

export function PlayerDashboardPage() {
  const { profile, user, refreshProfile, logout } = useAuthStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? "");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [claimOpen, setClaimOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Get user's nickname claims
  const { data: myClaims, refetch: refetchClaims } = useQuery({
    queryKey: ["my-claims", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nickname_claims")
        .select("*, players(nickname, poker_rooms(name))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Get linked players (approved claims)
  const { data: linkedPlayers } = useQuery({
    queryKey: ["my-linked-players", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, nickname, elo_rating, poker_rooms(name)")
        .eq("profile_id", user!.id);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  if (!profile || !user) {
    return <PageShell><div className="pt-20 min-h-screen flex items-center justify-center"><Spinner size="lg" /></div></PageShell>;
  }

  const MAX_AVATAR_BYTES = 100 * 1024; // 100 KB

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    // 1. Validar tamaño antes de gastar ancho de banda
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("size_exceeded");
      e.target.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "avif";
      
      /* CLAVE ROBUSTA: 
         - Usamos solo `${user.id}/...` porque el bucket 'avatars' ya se define en .from()
         - Agregamos un timestamp para evitar que el navegador cachee la imagen vieja
      */
      const fileName = `avatar-${Date.now()}.${ext}`;
      const path = `${user.id}/${fileName}`;

      // 2. Subida a Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) {
        // Esto aparecerá en tu consola (F12) para debuguear si falla el RLS
        console.error("Error detallado de Supabase Storage:", uploadError);
        throw uploadError;
      }

      // 3. Obtener URL Pública
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;

      // 4. Actualizar el perfil del usuario con la nueva URL
      await updateProfile(user.id, { avatar_url: avatarUrl });
      
      // 5. Refrescar estado global
      await refreshProfile();
      
      setMessage("Foto de perfil actualizada");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Error completo en el proceso:", err);
      setAvatarError("upload_failed");
    } finally {
      setAvatarUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const cleanCountry = countryCode.trim().toUpperCase();
      await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        country_code: cleanCountry.length === 2 ? cleanCountry : null,
        whatsapp: whatsapp.trim() || null,
      });
      await refreshProfile();
      setEditing(false);
      setMessage("Perfil actualizado");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Error al guardar");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent";
  const labelClass = "font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block";

  return (
    <PageShell>
      <SEOHead
  title="Mi Panel"
  path="/dashboard"
  noIndex={true}
/>
      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">Panel del Jugador</p>
              <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1">👋 Hola, {profile.display_name ?? "Jugador"}</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}><LogOut size={14} /> Cerrar Sesión</Button>
          </div>

          {/* Profile card */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full bg-sk-bg-4 border-2 border-sk-border-2 overflow-hidden flex items-center justify-center">
                    {profile.avatar_url
  ? <img src={`${profile.avatar_url}?t=${Date.now()}`} alt="Avatar" className="w-full h-full object-cover" />
                      : <span className="text-sk-xl font-extrabold text-sk-accent">{(profile.display_name ?? "?").charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <button
                    onClick={() => { setAvatarError(""); avatarFileRef.current?.click(); }}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sk-accent flex items-center justify-center hover:bg-sk-accent-hover transition-colors disabled:opacity-50"
                    title="Cambiar foto"
                  >
                    {avatarUploading
                      ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Camera size={12} className="text-sk-bg-0" />
                    }
                  </button>
                  <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </div>
                <h2 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2"><User size={18} /> Mi Perfil</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(!editing); if (!editing) { setDisplayName(profile.display_name ?? ""); setCountryCode(profile.country_code ?? ""); setWhatsapp(profile.whatsapp ?? ""); } }}>
                <Settings size={14} /> {editing ? "Cancelar" : "Editar"}
              </Button>
            </div>

            {/* Error avatar */}
            {avatarError === "size_exceeded" && (
              <div className="mb-4 bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red leading-relaxed">
                ⚠️ Tu imagen supera los <strong>100 KB</strong>. Para reducirla te recomendamos usar{" "}
                <a href="https://squoosh.app/" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:opacity-80">
                  squoosh.app
                </a>{" "}
                — selecciona formato <strong>AVIF</strong> y un tamaño máximo de <strong>1000×1000 px</strong>.
              </div>
            )}
            {avatarError === "upload_failed" && (
              <div className="mb-4 bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">
                Error al subir la imagen. Inténtalo de nuevo.
              </div>
            )}

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>WhatsApp</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sk-text-3 text-sk-sm">+</span>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="52 55 1234 5678"
                      className={`${inputClass} pl-7`}
                    />
                  </div>
                  <p className="text-[11px] text-sk-text-3 mt-1">Con código de país, ej: 52 55 1234 5678</p>
                </div>
                <div>
                  <label className={labelClass}>País (código de 2 letras)</label>
                  <input type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} placeholder="CL, AR, BR..." maxLength={2} className={inputClass} />
                  <p className="text-[11px] text-sk-text-3 mt-1">Deja vacío para no definir país</p>
                </div>
                <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>Guardar Cambios</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sk-sm">
                <div><span className="text-sk-text-2">Email:</span><p className="text-sk-text-1 font-semibold">{profile.email ?? user.email}</p></div>
                <div><span className="text-sk-text-2">Nombre:</span><p className="text-sk-text-1 font-semibold">{profile.display_name ?? "—"}</p></div>
                <div>
                  <span className="text-sk-text-2">WhatsApp:</span>
                  <p className="text-sk-text-1 font-semibold">
                    {profile.whatsapp
                      ? <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="text-sk-green hover:underline">+{profile.whatsapp}</a>
                      : <span className="text-sk-text-3">No definido</span>
                    }
                  </p>
                </div>
                <div><span className="text-sk-text-2">País:</span><p className="text-sk-text-1 font-semibold">{profile.country_code ? `${getFlag(profile.country_code)} ${getCountryName(profile.country_code)}` : "No definido"}</p></div>
                <div><span className="text-sk-text-2">Rol:</span><p className="text-sk-text-1 font-semibold capitalize">{profile.role}</p></div>
              </div>
            )}
            {message && <div className={`mt-4 rounded-md p-3 text-sk-sm ${message.includes("Error") ? "bg-sk-red-dim border border-sk-red/20 text-sk-red" : "bg-sk-green-dim border border-sk-green/20 text-sk-green"}`}>{message}</div>}
          </div>

          {/* Linked Nicknames */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2"><LinkIcon size={18} /> Mis Nicknames</h2>
              <Button variant="accent" size="sm" onClick={() => setClaimOpen(true)}>Reclamar Nickname</Button>
            </div>

            {(linkedPlayers ?? []).length > 0 ? (
              <div className="space-y-2">
                {(linkedPlayers ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-sk-bg-3 rounded-md px-4 py-3">
                    <div>
                      <span className="font-semibold text-sk-text-1 font-mono">{p.nickname}</span>
                      <span className="text-sk-xs text-sk-text-2 ml-2">({(p as unknown as { poker_rooms: { name: string } }).poker_rooms?.name})</span>
                    </div>
                    <span className="font-mono font-bold text-sk-accent">{Math.round(p.elo_rating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sk-sm text-sk-text-2">No tienes nicknames vinculados. Reclama uno para ver tus stats.</p>
            )}

            {/* Pending claims */}
            {(myClaims ?? []).filter((c) => c.status === "pending").length > 0 && (
              <div className="mt-4">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-2">Solicitudes Pendientes</p>
                <div className="space-y-2">
                  {(myClaims ?? []).filter((c) => c.status === "pending").map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-sk-bg-3 rounded-md px-4 py-2">
                      <span className="text-sk-sm text-sk-text-1">{(c as unknown as { players: { nickname: string } }).players?.nickname}</span>
                      <Badge variant="orange">Pendiente</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Nivel" value={String(profile.level)} accent="accent" />
            <StatCard label="XP Total" value={String(profile.xp)} accent="gold" />
            <StatCard label="Verificado" value={profile.is_verified ? "Sí" : "No"} />
            <StatCard label="Nicknames" value={String((linkedPlayers ?? []).length)} />
          </div>

          {/* Missions placeholder */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-8 text-center">
            <span className="text-3xl block mb-3">🎯</span>
            <p className="text-sk-text-2 text-sk-sm">Misiones y Logros estarán disponibles próximamente (Fase 9)</p>
          </div>
        </div>
      </div>

      <NicknameClaim isOpen={claimOpen} onClose={() => setClaimOpen(false)} onClaimed={() => refetchClaims()} />
    </PageShell>
  );
}
