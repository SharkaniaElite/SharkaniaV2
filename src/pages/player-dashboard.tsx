// src/pages/player-dashboard.tsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { StatCard } from "../components/ui/stat-card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Spinner } from "../components/ui/spinner";
import { NicknameClaim } from "../components/admin/nickname-claim";
import { useAuthStore } from "../stores/auth-store";
import { updateProfile } from "../lib/api/auth";
import { getFlag, getCountryName } from "../lib/countries";
import { Settings, User, LogOut, Link as LinkIcon, Camera, Flame, Download, ArrowUpRight, Trophy, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PlayerStatsGrid } from "../components/players/player-stats-grid";
import { EloChart } from "../components/players/elo-chart";
import { TournamentHistoryTable } from "../components/players/tournament-history-table";
import { usePlayer, usePlayerEloHistory, usePlayerTournamentResults, useUnifiedEloHistory, useUnifiedTournamentResults } from "../hooks/use-players";
import { getUnifiedPlayerStats } from "../lib/api/players";
import { supabase } from "../lib/supabase";
import { SEOHead } from "../components/seo/seo-head";
import { SharkCoin } from "../components/ui/shark-coin";
import { MissionsPanel } from "../components/gamification/missions-panel"; 
import { cn } from "../lib/cn";
import "../styles/arena-player-experience.css";

export function PlayerDashboardPage() {
  const { profile, user, refreshProfile, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const ignitionPanelRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? "");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [claimOpen, setClaimOpen] = useState(false);
  const [wptInput, setWptInput] = useState("");
  const [isSubmittingWpt, setIsSubmittingWpt] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // 🔥 Estados para la vinculación de Ignition Poker
  const hasIgnitionRequest = user?.user_metadata?.ignition_league_player === true || profile?.ignition_league_player === true;
  const isIgnitionLinked = profile?.ignition_status === 'verified';
  const [ignitionEmail, setIgnitionEmail] = useState(user?.user_metadata?.ignition_email ?? "");
  const [ignitionNickname, setIgnitionNickname] = useState(user?.user_metadata?.ignition_nickname ?? "");
  const [isSubmittingIgnition, setIsSubmittingIgnition] = useState(false);
  const [isHighlighting, setIsHighlighting] = useState(false);

  // Efecto para iluminar el panel si viene redirigido desde la Landing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("highlight") === "ignition") {
      setIsHighlighting(true);
      window.history.replaceState({}, '', location.pathname);
      
      setTimeout(() => {
        ignitionPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);

      setTimeout(() => setIsHighlighting(false), 4000);
    }
  }, [location]);

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

  const primaryPlayerId = linkedPlayers?.[0]?.id;
  const primaryPlayerSlug = linkedPlayers?.[0]?.slug;
  const hasMultipleNicknames = (linkedPlayers ?? []).length > 1;
  const { data: fullPlayer } = usePlayer(primaryPlayerId || "");

  const { data: unifiedStats } = useQuery({
    queryKey: ["dashboard-unified-stats", primaryPlayerSlug],
    queryFn: () => getUnifiedPlayerStats(primaryPlayerSlug!),
    enabled: !!primaryPlayerSlug && hasMultipleNicknames,
  });

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

  const { data: unifiedResults, isLoading: unifiedResultsLoading } = useUnifiedTournamentResults(
    hasMultipleNicknames ? user?.id : undefined
  );
  const { data: individualResults, isLoading: individualResultsLoading } = usePlayerTournamentResults(
    !hasMultipleNicknames ? primaryPlayerId || "" : undefined
  );
  const tournamentResults = hasMultipleNicknames ? unifiedResults ?? [] : individualResults ?? [];
  const isLoadingResults = hasMultipleNicknames ? unifiedResultsLoading : individualResultsLoading;

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
    return <PageShell variant="arena"><div className="arena-player-workspace flex items-center justify-center"><Spinner size="lg" /></div></PageShell>;
  }

  const MAX_AVATAR_BYTES = 100 * 1024;

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
    <PageShell variant="arena">
      <SEOHead title="Mi panel de póker" description="Espacio privado para gestionar tu perfil, nicknames vinculados, misiones y estadísticas en Sharkania." path="/dashboard" noIndex={true} />
      <div className="arena-player-workspace">
        <div className="arena-player-wrap">
          <header className="arena-player-hero" aria-labelledby="arena-player-dashboard-title">
            <div className="arena-player-hero-main">
              <span className="arena-player-kicker">SHARKANIA ARENA / CUENTA DE JUGADOR</span>
              <h1 id="arena-player-dashboard-title">TU PANEL DE <em>PÓKER.</em></h1>
              <p>Bienvenido, <strong>{profile.display_name ?? "Jugador"}</strong>. Gestiona tus nicknames, consulta tus resultados registrados y sigue tus actividades del circuito de póker.</p>
              <div className="arena-player-hero-actions">
                <Link to="/ranking"><Trophy size={15} aria-hidden="true" /> Ranking ELO <ArrowUpRight size={14} aria-hidden="true" /></Link>
                <Link to="/calendar"><CalendarDays size={15} aria-hidden="true" /> Torneos de póker <ArrowUpRight size={14} aria-hidden="true" /></Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut}><LogOut size={14} /> Cerrar sesión</Button>
              </div>
            </div>
            <div className="arena-player-hero-bottom">
              <span>PERFIL / RECOMPENSAS / ESTADÍSTICAS</span>
              <strong>{(linkedPlayers ?? []).length} nicknames vinculados</strong>
            </div>
          </header>
          <nav className="arena-player-quicklinks" aria-label="Secciones de tu cuenta">
            <a href="#mi-perfil">Mi perfil</a>
            <a href="#mis-nicknames">Nicknames</a>
            <a href="#ignition-mi-liga">Liga Ignition</a>
            <a href="#misiones">Misiones</a>
            <a href="#mis-estadisticas">Mis estadísticas</a>
          </nav>

         {/* Profile card */}
          <div id="mi-perfil" className="arena-player-panel arena-player-anchor p-5 sm:p-6 mb-6">
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
                    aria-label="Cambiar foto de perfil"
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sk-accent flex items-center justify-center hover:bg-sk-accent-hover transition-colors disabled:opacity-50"
                  >
                    {avatarUploading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera size={12} className="text-sk-bg-0" />}
                  </button>
                  <input ref={avatarFileRef} type="file" accept="image/*" aria-label="Subir foto de perfil" onChange={handleAvatarUpload} className="hidden" />
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
                <div><label htmlFor="arena-player-name" className={labelClass}>Nombre</label><input id="arena-player-name" type="text" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} /></div>
                <div>
                  <label htmlFor="arena-player-whatsapp" className={labelClass}>WhatsApp</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sk-text-3 text-sk-sm">+</span>
                    <input id="arena-player-whatsapp" type="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="52 55 1234 5678" className={`${inputClass} pl-7`} />
                  </div>
                </div>
                <div><label htmlFor="arena-player-country" className={labelClass}>País (código de 2 letras)</label><input id="arena-player-country" type="text" autoComplete="country" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className={inputClass} /></div>
                <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>Guardar Cambios</Button>
              </div>
            ) : (
              <div className="arena-player-profile-data grid grid-cols-2 gap-4 text-sk-sm">
                <div><span className="text-sk-text-2">Email:</span><p className="text-sk-text-1 font-semibold">{profile.email ?? user.email}</p></div>
                <div><span className="text-sk-text-2">Nombre:</span><p className="text-sk-text-1 font-semibold">{profile.display_name ?? "—"}</p></div>
                <div><span className="text-sk-text-2">WhatsApp:</span><p className="text-sk-text-1 font-semibold">{profile.whatsapp ? `+${profile.whatsapp}` : "No definido"}</p></div>
                <div><span className="text-sk-text-2">País:</span><p className="text-sk-text-1 font-semibold">{profile.country_code ? `${getFlag(profile.country_code)} ${getCountryName(profile.country_code)}` : "No definido"}</p></div>
                <div><span className="text-sk-text-2">Rol:</span><p className="text-sk-text-1 font-semibold capitalize">{profile.role}</p></div>
              </div>
            )}
            {message && <div role="status" className={`mt-4 rounded-md p-3 text-sk-sm ${message.includes("Error") ? "bg-sk-red-dim text-sk-red" : "bg-sk-green-dim text-sk-green"}`}>{message}</div>}
          </div>

          {/* 🎁 ZONA VIP WPT GLOBAL */}
          <div className="arena-player-panel p-5 sm:p-6 mb-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2 mb-1">
                  🎁 Beneficios VIP WPT Global
                </h2>
                <p className="text-sk-sm text-sk-text-3">
                  Vincula tu cuenta WPT creada con código <strong className="text-sk-accent">FPHL</strong> para desbloquear toda la Bóveda gratis.
                </p>
              </div>

              {profile.wpt_status === "verified" ? (
                <Badge variant="green">¡Verificado VIP!</Badge>
              ) : profile.wpt_status === "pending" ? (
                <Badge variant="orange">En Revisión...</Badge>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <input 
                    type="text" 
                    aria-label="Nickname en WPT Global"
                    placeholder="Tu Nick en WPT..." 
                    value={wptInput}
                    onChange={(e) => setWptInput(e.target.value)}
                    className="w-full sm:w-40 bg-sk-bg-2 border border-sk-border-2 rounded-md py-1.5 px-3 text-sk-sm text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent"
                  />
                  <Button 
                    variant="accent" 
                    size="sm" 
                    className="w-full sm:w-auto whitespace-nowrap"
                    onClick={async () => {
                      if (!wptInput.trim()) return;
                      setIsSubmittingWpt(true);
                      try {
                        const { error: requestError } = await supabase.from("profiles").update({
                          wpt_nickname: wptInput.trim(),
                          wpt_status: "pending"
                        }).eq("id", user.id);
                        if (requestError) throw requestError;
                        alert("Validación WPT enviada al administrador.");
                        setTimeout(() => window.location.reload(), 1500);
                      } catch (e) {
                        console.error(e);
                      }
                      setIsSubmittingWpt(false);
                    }} 
                    isLoading={isSubmittingWpt}
                  >
                    Enviar a revisión
                  </Button>
                </div>
              )}
            </div>
            {profile.wpt_status === "rejected" && (
              <p className="text-sk-sm text-sk-red mt-3 bg-sk-red-dim border border-sk-red/20 p-2 rounded">
                Tu validación fue rechazada. Asegúrate de haber usado nuestro enlace o contáctanos.
              </p>
            )}
          </div>

          {/* 🔥 ZONA IGNITION POKER (SMART HIGHLIGHT CON NUEVA VALIDACIÓN) */}
          <div 
            ref={ignitionPanelRef}
            id="ignition-mi-liga"
            className={cn(
              "arena-player-panel arena-ignition-dashboard-panel arena-player-anchor rounded-lg p-5 sm:p-6 mb-6 transition-all duration-1000",
              isHighlighting 
                ? "bg-gradient-to-r from-orange-600/30 to-red-600/20 border-2 border-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.4)] scale-[1.02]"
                : "bg-gradient-to-r from-orange-900/20 to-red-900/10 border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.05)]"
            )}
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="lg:max-w-md">
                <h2 className="text-sk-md font-bold text-white flex items-center gap-2 mb-1">
                  <Flame size={18} className="text-orange-500" /> Liga SHARKANIA
                </h2>
                <p className="text-sk-sm text-sk-text-3">
                  Vincula tu <strong className="text-orange-400">Email y Nickname</strong> de Ignition Póker para participar en la Liga SHARKANIA: buy-in US$3,30, US$100 garantizados por fecha, reentry y registro tardío durante 60 minutos. Recibirás el acceso a los torneos y podrás sumar puntos para el ranking mensual. La vinculación es necesaria para acreditar tus posiciones y premios.
                </p>

                {!isIgnitionLinked && (
                  <a 
                    href="https://record.revenuenetwork.com/_s_OAdmC6KUepsRaI0hkgHmNd7ZgqdRLk/1/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-400 hover:text-orange-300 mt-3 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full transition-colors w-max"
                  >
                    <Download size={14} /> ¿No tienes cuenta en Ignition? Créala aquí
                  </a>
                )}
              </div>

              {(isIgnitionLinked || hasIgnitionRequest) ? (
                <div className="flex flex-col items-start lg:items-end bg-black/30 p-3 rounded-lg border border-white/5 w-full lg:w-auto">
                  <Badge variant={isIgnitionLinked ? 'green' : 'orange'}>{isIgnitionLinked ? '¡Vinculado a Ignition!' : 'Solicitud en revisión'}</Badge>
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-sk-text-3 font-mono flex justify-between gap-4">
                      <span>Email:</span> <strong className="text-white">{user?.user_metadata?.ignition_email}</strong>
                    </p>
                    <p className="text-[11px] text-sk-text-3 font-mono flex justify-between gap-4">
                      <span>Nickname:</span> <strong className="text-orange-400">{user?.user_metadata?.ignition_nickname}</strong>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <div className="w-full space-y-2">
                    <input
                      type="email"
                      aria-label="Correo electrónico de Ignition Poker"
                      autoComplete="email"
                      placeholder="Correo de Ignition..."
                      value={ignitionEmail}
                      onChange={(e) => setIgnitionEmail(e.target.value)}
                      className="w-full bg-black/40 border border-orange-500/30 rounded-md py-2 px-3 text-sk-sm text-white font-mono focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      aria-label="Nickname en Ignition Poker"
                      placeholder="Nickname en Ignition..."
                      value={ignitionNickname}
                      onChange={(e) => setIgnitionNickname(e.target.value)}
                      className="w-full bg-black/40 border border-orange-500/30 rounded-md py-2 px-3 text-sk-sm text-white font-mono focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  {/* 🔥 BOTÓN VINCULAR CON EL IS_LOADING AGREGADO DE VUELTA Y NUEVA LÓGICA */}
                  <Button
                    variant="accent"
                    size="sm"
                    className="w-full sm:w-auto sm:self-stretch whitespace-nowrap bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 border-none text-white font-bold"
                    isLoading={isSubmittingIgnition}
                    onClick={async () => {
                      if (!ignitionEmail.trim() || !ignitionEmail.includes("@")) {
                        alert("Ingresa un correo válido.");
                        return;
                      }
                      if (!ignitionNickname.trim()) {
                        alert("Ingresa tu Nickname de Ignition.");
                        return;
                      }
                      setIsSubmittingIgnition(true);
                      try {
                        const emailToLink = ignitionEmail.trim();
                        const nickToLink = ignitionNickname.trim();

                        // 1. CONSULTAMOS AL GUARDIA DE SEGURIDAD
                        const { data: isDuplicate, error: rpcError } = await supabase.rpc("check_ignition_duplicate", {
                          p_email: emailToLink,
                          p_nickname: nickToLink,
                          p_user_id: user.id
                        });

                        if (rpcError) throw rpcError;

                        // 2. BLOQUEAMOS SI ESTÁ DUPLICADO
                        if (isDuplicate) {
                          alert("⚠️ Error: Este correo o Nickname de Ignition ya está vinculado a otra cuenta de Sharkania.");
                          setIsSubmittingIgnition(false);
                          return;
                        }

                        // 3. SI ESTÁ LIBRE, LO VINCULAMOS
                        
                        // A) Actualizamos la sesión del navegador para que el usuario vea el cambio
                        const { error: authError } = await supabase.auth.updateUser({
                          data: {
                            ignition_league_player: true,
                            ignition_email: emailToLink,
                            ignition_nickname: nickToLink,
                          }
                        });
                        
                        if (authError) throw authError;

                        // B) 🔥 EL BUG ESTABA AQUÍ: Guardamos los datos en la tabla profiles para el Admin
                        const { error: profileError } = await supabase.from('profiles').update({
                          ignition_league_player: true,
                          ignition_email: emailToLink,
                          ignition_nickname: nickToLink,
                          ignition_status: 'pending'
                        }).eq('id', user.id);

                        if (profileError) throw profileError;

                        alert("Solicitud de vinculación enviada. Quedará pendiente de verificación administrativa.");
                        window.location.reload();
                      } catch (e) {
                        console.error(e);
                        alert("Error al vincular tu correo.");
                      }
                      setIsSubmittingIgnition(false);
                    }}
                  >
                    Vincular
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Linked Nicknames */}
          <div id="mis-nicknames" className="arena-player-panel arena-player-anchor p-5 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2"><LinkIcon size={18} /> Mis Nicknames & Validaciones</h2>
              <Button variant="accent" size="sm" onClick={() => setClaimOpen(true)}>Reclamar Nickname</Button>
            </div>

            {(linkedPlayers ?? []).length > 0 ? (
              <div className="space-y-2">
                {(linkedPlayers ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-sk-bg-3 rounded-md px-4 py-2.5 border border-sk-border-2">
                    <div>
                      <span className="font-semibold text-sk-text-1 font-mono text-sk-sm">{p.nickname}</span>
                      <span className="text-[11px] text-sk-text-3 ml-2">({(p as any).poker_rooms?.name})</span>
                    </div>
                    <span className="font-mono font-bold text-sk-accent text-sk-sm">{Math.round(p.elo_rating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sk-sm text-sk-text-2">No tienes nicknames vinculados. Reclama uno para ver tus stats y opciones VIP.</p>
            )}

            {/* Pending claims (Screenshot) */}
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
          <div className="arena-player-stats-strip grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Shark Coins" value={String(profile.shark_coins_balance ?? 0)} accent="accent" icon="🦈" />
            <StatCard label="Nivel" value={String(profile.level)} accent="cyan" />
            <StatCard label="XP Total" value={String(profile.xp)} accent="gold" />
            <StatCard label="Nicknames" value={String((linkedPlayers ?? []).length)} />
          </div>

          {/* 🎯 PANEL DE MISIONES Y RECOMPENSAS */}
          <div id="misiones" className="arena-player-missions arena-player-anchor mb-10 mt-10">
            <h2 className="text-sk-xl font-extrabold text-sk-text-1 mb-4 flex items-center gap-2">
              🎯 Misiones Activas
            </h2>
            <MissionsPanel />
          </div>

          {/* ── Perfil de Estadísticas Privadas ── */}
          {primaryPlayerId && fullPlayer ? (
            <div id="mis-estadisticas" className="arena-player-anchor mt-12 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sk-2xl font-extrabold text-sk-text-1">Mis Estadísticas</h2>
                  <p className="text-sk-sm text-sk-text-3">Resultados y evolución de tus nicknames vinculados</p>
                </div>
                <Badge variant="green">Perfil vinculado</Badge>
              </div>
              <PlayerStatsGrid player={displayPlayer ?? fullPlayer} hasAccess={true} />
              <EloChart history={eloHistory ?? []} isLoading={isLoadingElo} />
              <div className="arena-player-panel p-5 sm:p-6">
                <h3 className="text-sk-md font-bold text-sk-text-1 mb-4 flex items-center gap-2">🎯 Mi Historial de Torneos</h3>
                <TournamentHistoryTable results={(tournamentResults as any) ?? []} isLoading={isLoadingResults} hasAccess={true} />
              </div>
            </div>
          ) : (
            (!linkedPlayers || linkedPlayers.length === 0) && (
              <div id="mis-estadisticas" className="arena-player-panel arena-player-anchor p-6 sm:p-8 text-center mt-8">
                <span className="text-4xl block mb-4">📊</span>
                <h3 className="text-sk-lg font-extrabold text-sk-text-1 mb-2">Desbloquea tus estadísticas avanzadas</h3>
                <p className="text-sk-sm text-sk-text-2 max-w-md mx-auto mb-6">
                  Reclama tu nickname en la sección superior para identificar tu perfil y consultar las métricas disponibles de tus resultados registrados.
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