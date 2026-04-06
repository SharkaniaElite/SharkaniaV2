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
import { PlayerStatsGrid } from "../components/players/player-stats-grid";
import { EloChart } from "../components/players/elo-chart";
import { TournamentHistoryTable } from "../components/players/tournament-history-table";
import { usePlayer, usePlayerEloHistory, usePlayerTournamentResults, useUnifiedEloHistory, useUnifiedTournamentResults } from "../hooks/use-players";
import { getUnifiedPlayerStats } from "../lib/api/players";
import { supabase } from "../lib/supabase";
import { SEOHead } from "../components/seo/seo-head";
import { SharkCoin } from "../components/ui/shark-coin";
// 👇 IMPORTAMOS EL NUEVO PANEL DE MISIONES
import { MissionsPanel } from "../components/gamification/missions-panel"; 

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
        .select("id, nickname, slug, elo_rating, poker_rooms(name)")
        .eq("profile_id", user!.id);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // ── Datos completos para el Perfil Privado ──
  const primaryPlayerId = linkedPlayers?.[0]?.id;
  const primaryPlayerSlug = linkedPlayers?.[0]?.slug;
  const hasMultipleNicknames = (linkedPlayers ?? []).length > 1;
  const { data: fullPlayer } = usePlayer(primaryPlayerId || "");

  // Stats unificadas (solo se usa si tiene múltiples nicknames)
  const { data: unifiedStats } = useQuery({
    queryKey: ["dashboard-unified-stats", primaryPlayerSlug],
    queryFn: () => getUnifiedPlayerStats(primaryPlayerSlug!),
    enabled: !!primaryPlayerSlug && hasMultipleNicknames,
  });

  // ELO History: unificado si tiene aliases, individual si no
  const { data: unifiedElo, isLoading: unifiedEloLoading } = useUnifiedEloHistory(
    hasMultipleNicknames ? primaryPlayerSlug : undefined
  );
  const { data: individualElo, isLoading: individualEloLoading } = usePlayerEloHistory(
    !hasMultipleNicknames ? primaryPlayerId || "" : undefined
  );
  const eloHistory = hasMultipleNicknames
    ? (unifiedElo ?? []).map((e) => ({
        id: `${e.recorded_at}-${e.nickname}`,
        player_id: "",
        tournament_id: "",
        elo_before: Number(e.elo_after) - Number(e.elo_change),
        elo_after: Number(e.elo_after),
        elo_change: Number(e.elo_change),
        recorded_at: e.recorded_at,
      }))
    : individualElo ?? [];
  const isLoadingElo = hasMultipleNicknames ? unifiedEloLoading : individualEloLoading;

  // Tournament Results: unificado si tiene aliases, individual si no
  const { data: unifiedResults, isLoading: unifiedResultsLoading } = useUnifiedTournamentResults(
    hasMultipleNicknames ? user?.id : undefined
  );
  const { data: individualResults, isLoading: individualResultsLoading } = usePlayerTournamentResults(
    !hasMultipleNicknames ? primaryPlayerId || "" : undefined
  );
  const tournamentResults = hasMultipleNicknames ? unifiedResults ?? [] : individualResults ?? [];
  const isLoadingResults = hasMultipleNicknames ? unifiedResultsLoading : individualResultsLoading;

  // Player con stats unificadas para el StatsGrid
  const displayPlayer = hasMultipleNicknames && fullPlayer && unifiedStats
    ? {
        ...fullPlayer,
        elo_rating: eloHistory.length > 0 ? eloHistory[eloHistory.length - 1]!.elo_after : fullPlayer.elo_rating,
        elo_peak: eloHistory.length > 0 ? Math.max(...eloHistory.map((e) => Number(e.elo_after))) : fullPlayer.elo_peak,
        total_tournaments: unifiedStats.total_tournaments,
        total_cashes: unifiedStats.total_cashes,
        total_wins: unifiedStats.total_wins,
        total_prize_won: unifiedStats.total_prize_won,
        total_buy_ins_spent: unifiedStats.total_buy_ins_spent,
      }
    : fullPlayer;

  if (!profile || !user) {
    return <PageShell><div className="pt-20 min-h-screen flex items-center justify-center"><Spinner size="lg" /></div></PageShell>;
  }

  const MAX_AVATAR_BYTES = 100 * 1024; // 100 KB

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("size_exceeded");
      e.target.value = "";
      return;
    }

    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "avif";
      const fileName = `avatar-${Date.now()}.${ext}`;
      const path = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;

      await updateProfile(user.id, { avatar_url: avatarUrl });
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
      <SEOHead title="Mi Panel" path="/dashboard" noIndex={true} />
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full bg-sk-bg-4 border-2 border-sk-accent overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(0,255,204,0.15)]">
                    {profile.avatar_url
                      ? <img src={`${profile.avatar_url}?t=${Date.now()}`} alt="Avatar" className="w-full h-full object-cover" />
                      : <span className="text-sk-xl font-extrabold text-sk-accent">{(profile.display_name ?? "?").charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <button
                    onClick={() => { setAvatarError(""); avatarFileRef.current?.click(); }}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sk-accent flex items-center justify-center hover:bg-sk-accent-hover transition-colors disabled:opacity-50"
                  >
                    {avatarUploading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera size={12} className="text-sk-bg-0" />}
                  </button>
                  <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </div>
                <div>
                  <h2 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2 mb-1"><User size={18} /> Mi Perfil</h2>
                  <div className="inline-flex items-center gap-1.5 bg-sk-bg-3 border border-sk-accent/30 rounded-full px-2.5 py-0.5 mt-1">
                    <SharkCoin size={16} />
                    <span className="font-mono text-sk-xs font-bold text-sk-accent">
                      {(profile.shark_coins_balance ?? 0).toLocaleString()} Coins
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(!editing); if (!editing) { setDisplayName(profile.display_name ?? ""); setCountryCode(profile.country_code ?? ""); setWhatsapp(profile.whatsapp ?? ""); } }}>
                <Settings size={14} /> {editing ? "Cancelar" : "Editar"}
              </Button>
            </div>

            {avatarError === "size_exceeded" && (
              <div className="mb-4 bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red leading-relaxed">
                ⚠️ Tu imagen supera los <strong>100 KB</strong>. Usa squoosh.app.
              </div>
            )}
            {avatarError === "upload_failed" && (
              <div className="mb-4 bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">
                Error al subir la imagen. Inténtalo de nuevo.
              </div>
            )}

            {editing ? (
              <div className="space-y-4">
                <div><label className={labelClass}>Nombre</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>WhatsApp</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sk-text-3 text-sk-sm">+</span>
                    <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="52 55 1234 5678" className={`${inputClass} pl-7`} />
                  </div>
                </div>
                <div><label className={labelClass}>País (código de 2 letras)</label><input type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className={inputClass} /></div>
                <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>Guardar Cambios</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sk-sm">
                <div><span className="text-sk-text-2">Email:</span><p className="text-sk-text-1 font-semibold">{profile.email ?? user.email}</p></div>
                <div><span className="text-sk-text-2">Nombre:</span><p className="text-sk-text-1 font-semibold">{profile.display_name ?? "—"}</p></div>
                <div><span className="text-sk-text-2">WhatsApp:</span><p className="text-sk-text-1 font-semibold">{profile.whatsapp ? `+${profile.whatsapp}` : "No definido"}</p></div>
                <div><span className="text-sk-text-2">País:</span><p className="text-sk-text-1 font-semibold">{profile.country_code ? `${getFlag(profile.country_code)} ${getCountryName(profile.country_code)}` : "No definido"}</p></div>
                <div><span className="text-sk-text-2">Rol:</span><p className="text-sk-text-1 font-semibold capitalize">{profile.role}</p></div>
              </div>
            )}
            {message && <div className={`mt-4 rounded-md p-3 text-sk-sm ${message.includes("Error") ? "bg-sk-red-dim text-sk-red" : "bg-sk-green-dim text-sk-green"}`}>{message}</div>}
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
                      <span className="text-sk-xs text-sk-text-2 ml-2">({(p as any).poker_rooms?.name})</span>
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
                      <span className="text-sk-sm text-sk-text-1">{(c as any).players?.nickname}</span>
                      <Badge variant="orange">Pendiente</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Shark Coins" value={String(profile.shark_coins_balance ?? 0)} accent="accent" icon="🦈" />
            <StatCard label="Nivel" value={String(profile.level)} accent="cyan" />
            <StatCard label="XP Total" value={String(profile.xp)} accent="gold" />
            <StatCard label="Nicknames" value={String((linkedPlayers ?? []).length)} />
          </div>

          {/* 🎯 PANEL DE MISIONES Y RECOMPENSAS (NUEVO) */}
          <div className="mb-10 mt-10">
            <h2 className="text-sk-xl font-extrabold text-sk-text-1 mb-4 flex items-center gap-2">
              🎯 Misiones Activas
            </h2>
            <MissionsPanel />
          </div>

          {/* ── Perfil de Estadísticas Privadas ── */}
          {primaryPlayerId && fullPlayer ? (
            <div className="mt-12 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sk-2xl font-extrabold text-sk-text-1">Mis Estadísticas</h2>
                  <p className="text-sk-sm text-sk-text-3">Modo Premium desbloqueado para tu cuenta</p>
                </div>
                <Badge variant="green">VIP Gratis</Badge>
              </div>
              <PlayerStatsGrid player={displayPlayer ?? fullPlayer} hasAccess={true} />
              <EloChart history={eloHistory ?? []} isLoading={isLoadingElo} />
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6">
                <h3 className="text-sk-md font-bold text-sk-text-1 mb-4 flex items-center gap-2">🎯 Mi Historial de Torneos</h3>
                <TournamentHistoryTable results={(tournamentResults as any) ?? []} isLoading={isLoadingResults} hasAccess={true} />
              </div>
            </div>
          ) : (
            (!linkedPlayers || linkedPlayers.length === 0) && (
              <div className="bg-gradient-to-br from-sk-bg-2 to-sk-bg-3 border border-sk-border-2 rounded-xl p-8 text-center mt-8 shadow-sk-lg">
                <span className="text-4xl block mb-4">📊</span>
                <h3 className="text-sk-lg font-extrabold text-sk-text-1 mb-2">Desbloquea tus estadísticas avanzadas</h3>
                <p className="text-sk-sm text-sk-text-2 max-w-md mx-auto mb-6">
                  Reclama tu nickname en la sección superior para acceder a tu ROI, Profit, Gráfico de ELO y métricas detalladas <strong>gratis de por vida</strong>.
                </p>
                <Button variant="accent" onClick={() => setClaimOpen(true)}>Reclamar mi primer Nickname</Button>
              </div>
            )
          )}
        </div>
      </div>
      <NicknameClaim isOpen={claimOpen} onClose={() => setClaimOpen(false)} onClaimed={() => refetchClaims()} />
    </PageShell>
  );
}