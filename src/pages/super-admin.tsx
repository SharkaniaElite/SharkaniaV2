// src/pages/super-admin.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { StatCard } from "../components/ui/stat-card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { EntityForm, deleteEntity } from "../components/admin/entity-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { FlagIcon } from "../components/ui/flag-icon";
import {
  Check, X as XIcon, Plus, Trash2, Pencil,
  ExternalLink, Settings, AlertCircle,
  Image, Save, Eye, RefreshCw, Power, MessageCircle
} from "lucide-react";
import { SEOHead } from "../components/seo/seo-head";
import {
  getBannersConfig, saveBannersConfig,
  DEFAULT_BANNERS,
  type BannersConfig, type BannerConfig,
} from "../lib/api/site-settings";

import { MissionsAdminTab } from "../components/admin/missions-admin-tab";
import { PostHogStatsCard } from "../components/admin/posthog-stats-card";
import { syncAllUnifiedElos } from "../lib/api/elo-engine";
import { AnalyticsTab } from "../components/admin/analytics-tab";

// ── Tipos ─────────────────────────────────────────────────

type AdminTab = "overview" | "users" | "requests" | "missions" | "rooms" | "scoring" | "banners" | "glossary" | "analytics";

// ── Descripción de cada slot de banner ───────────────────

const SLOT_INFO = {
  super: {
    title: "Super Banner Global",
    description: "Aparece FIJO en la parte superior de TODAS las páginas, justo debajo del menú.",
    desktop: { size: "1780×121 px", label: "Top Super Banner", hint: "Formato ultra ancho. Alta visibilidad y persistente al hacer scroll." },
    mobile:  { size: "870×200 px", label: "Wide banner", hint: "Se ajusta al ancho del dispositivo móvil." },
  },
  mid: {
    title: "Banner Mid-Article",
    description: "Aparece dentro del artículo después del 3er título H2.",
    desktop: { size: "728×90 px", label: "Leaderboard horizontal", hint: "Formato estándar editorial. Máximo impacto sin interrumpir la lectura." },
    mobile:  { size: "870×200 px", label: "Wide banner", hint: "Se escala al ancho completo de la pantalla en móvil." },
  },
  final: {
    title: "Banner Final de Artículo",
    description: "Aparece al terminar el contenido del artículo, antes del CTA de Sharkania.",
    desktop: { size: "870×200 px", label: "Wide banner", hint: "Zona de alta intención: el lector terminó el artículo." },
    mobile:  { size: "870×200 px", label: "Wide banner", hint: "Mismo banner en móvil al final del artículo." },
  },
  sidebar: {
    title: "Banner Sidebar",
    description: "Aparece flotando en la columna derecha en pantallas grandes.",
    desktop: { size: "300×250 px", label: "Rectangle", hint: "Formato cuadrado/rectangular. Ideal para conversiones." },
    mobile:  null,
  }
} as const;

type SlotKey = keyof typeof SLOT_INFO;

// ── Componente BannerSlotEditor ───────────────────────────

function BannerSlotEditor({
  slotKey,
  value,
  onChange,
}: {
  slotKey: SlotKey;
  value: BannersConfig["slots"][SlotKey];
  onChange: (v: BannersConfig["slots"][SlotKey]) => void;
}) {
  const info = SLOT_INFO[slotKey];

  const updateSide = (side: "desktop" | "mobile", field: keyof BannerConfig, val: string | number) => {
    const current = value[side] ?? {
      src: "", href: "", width: 0, height: 0, label: "",
    };
    onChange({ ...value, [side]: { ...current, [field]: val } });
  };

  const resetSide = (side: "desktop" | "mobile") => {
    const def = DEFAULT_BANNERS.slots[slotKey][side];
    onChange({ ...value, [side]: def });
  };

  const sides: Array<{ key: "desktop" | "mobile"; label: string; info: any }> = [
    { key: "desktop", label: "Desktop", info: info.desktop },
    ...(info.mobile ? [{ key: "mobile" as const, label: "Mobile", info: info.mobile }] : []),
  ];

  return (
    <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-sk-border-2 bg-sk-bg-3">
        <div className="flex items-center gap-2 mb-1">
          <Image size={15} className="text-sk-accent" />
          <h3 className="text-sk-md font-bold text-sk-text-1">{info.title}</h3>
        </div>
        <p className="text-sk-xs text-sk-text-3">{info.description}</p>
      </div>

      <div className={`grid gap-0 ${sides.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {sides.map(({ key: side, info: sideInfo }, i) => {
          if (!sideInfo) return null;
          const banner = value[side];
          const isEmpty = !banner?.src && !banner?.href;

          return (
            <div
              key={side}
              className={cn(
                "p-5",
                i < sides.length - 1 && "md:border-r border-b md:border-b-0 border-sk-border-2"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      "text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded",
                      side === "desktop" ? "bg-sk-accent-dim text-sk-accent" : "bg-sk-purple-dim text-sk-purple"
                    )}>
                      {side === "desktop" ? "💻 Desktop" : "📱 Mobile"}
                    </span>
                    <span className="text-[10px] font-mono text-sk-text-4">{sideInfo.size}</span>
                  </div>
                  <p className="text-[11px] text-sk-text-3">{sideInfo.label}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => resetSide(side)}
                    title="Restaurar valor por defecto"
                    className="text-sk-text-3 hover:text-sk-accent transition-colors p-1"
                  >
                    <RefreshCw size={12} />
                  </button>
                  {banner?.src && (
                    <button
                      onClick={() => window.open(banner.src, "_blank")}
                      title="Vista previa de imagen"
                      className="text-sk-text-3 hover:text-sk-accent transition-colors p-1"
                    >
                      <Eye size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-sk-bg-3 border border-sk-border-1 rounded-md px-3 py-2 mb-4">
                <p className="text-[10px] text-sk-text-3 leading-relaxed">
                  💡 {sideInfo.hint}
                </p>
              </div>

              {banner?.src && (
                <div className="mb-4 rounded-lg overflow-hidden border border-sk-border-2 bg-sk-bg-3">
                  <img
                    src={banner.src}
                    alt="Preview banner"
                    style={{ width: "100%", height: "auto", display: "block", maxHeight: "120px", objectFit: "contain" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sk-accent" />
                    URL de la imagen (src)
                    <span className="text-sk-text-4 normal-case ml-auto">{sideInfo.size}</span>
                  </label>
                  <input
                    type="url"
                    value={banner?.src ?? ""}
                    onChange={(e) => updateSide(side, "src", e.target.value)}
                    placeholder={`https://wptpartners.ck-cdn.com/tn/serve/?cid=XXXXXX`}
                    className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent placeholder:text-sk-text-4"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sk-gold" />
                    Link de destino (href)
                  </label>
                  <input
                    type="url"
                    value={banner?.href ?? ""}
                    onChange={(e) => updateSide(side, "href", e.target.value)}
                    placeholder="https://tracking.wptpartners.com/visit/?bta=35660&nci=XXXXX"
                    className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent placeholder:text-sk-text-4"
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-sk-border-2">
                  <h4 className="text-[11px] font-bold text-sk-text-1 mb-3 flex items-center gap-1.5">
                    <span className="text-base">🇺🇸</span> Tráfico Estados Unidos (ACR)
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 block">Imagen USA (us_src)</label>
                      <input
                        type="url"
                        value={banner?.us_src ?? ""}
                        onChange={(e) => updateSide(side, "us_src", e.target.value)}
                        placeholder="https://www.acrpoker.eu/..."
                        className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent placeholder:text-sk-text-4"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 block">Link Afiliado USA (us_href)</label>
                      <input
                        type="url"
                        value={banner?.us_href ?? ""}
                        onChange={(e) => updateSide(side, "us_href", e.target.value)}
                        placeholder="https://go.wpnaffiliates.com/..."
                        className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent placeholder:text-sk-text-4"
                      />
                    </div>
                  </div>
                </div>

                {isEmpty ? (
                  <div className="flex items-center gap-2 text-[11px] text-sk-text-4 mt-3">
                    <XIcon size={11} className="text-sk-red" />
                    Sin banner configurado
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-sk-green mt-3">
                    <Check size={11} />
                    Banner configurado
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {slotKey === "sidebar" && (
          <div className="p-5 flex items-center justify-center border-t border-sk-border-2 md:border-t-0 md:border-l md:border-sk-border-2">
            <div className="text-center">
              <span className="text-2xl block mb-2">📵</span>
              <p className="text-sk-xs text-sk-text-3">El sidebar no aparece<br />en dispositivos móviles</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export function SuperAdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [reqCategory, setReqCategory] = useState<"clubs" | "claims" | "wpt" | "latin">("clubs");
  const [reqView, setReqView] = useState<"pending" | "history">("pending");
  const [entityForm, setEntityForm] = useState<{
    table: string;
    title: string;
    fields: Array<{
      key: string; label: string;
      type: "text" | "number" | "select" | "textarea" | "checkbox";
      required?: boolean;
      options?: Array<{ value: string; label: string }>;
      placeholder?: string;
    }>;
    data: Record<string, unknown> | null;
  } | null>(null);

  const [selectedUser, setSelectedUser]   = useState<Record<string, any> | null>(null);
  const [editingUser, setEditingUser]     = useState(false);
  const [userEditData, setUserEditData]   = useState<Record<string, string>>({});
  const [savingUser, setSavingUser]       = useState(false);
  const [claimSearch, setClaimSearch]     = useState("");
  const [claimResults, setClaimResults]   = useState<any[]>([]);
  const [claimSearching, setClaimSearching] = useState(false);

  const [bannersConfig, setBannersConfig] = useState<BannersConfig | null>(null);
  const [bannersSaving, setBannersSaving] = useState(false);
  const [bannersSaved, setBannersSaved]   = useState(false);
  const [bannersLoading, setBannersLoading] = useState(false);

  const [isSyncingElo, setIsSyncingElo] = useState(false);
  
  const handleSyncElo = async () => {
    if (!confirm("¿Estás seguro de sincronizar los ELOs de toda la base de datos? Esto materializará el 'unified_elo' para que el ranking sea preciso.")) return;
    setIsSyncingElo(true);
    try {
      const res = await syncAllUnifiedElos();
      alert(res.message);
    } catch (e: any) {
      alert("Error crítico: " + e.message);
    } finally {
      setIsSyncingElo(false);
    }
  };

  const queryClient = useQueryClient();
  const refresh     = () => queryClient.invalidateQueries();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [players, clubs, tournaments, leagues, pendingClubs, pendingClaims, pendingMissions] = await Promise.all([
        supabase.from("players").select("*", { count: "exact", head: true }),
        supabase.from("clubs").select("*", { count: "exact", head: true }),
        supabase.from("tournaments").select("*", { count: "exact", head: true }),
        supabase.from("leagues").select("*", { count: "exact", head: true }),
        supabase.from("club_registration_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("nickname_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("player_missions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        players: players.count ?? 0, clubs: clubs.count ?? 0,
        tournaments: tournaments.count ?? 0, leagues: leagues.count ?? 0,
        pendingClubs: pendingClubs.count ?? 0, pendingClaims: pendingClaims.count ?? 0,
        pendingMissions: pendingMissions.count ?? 0,
      };
    },
  });

  const { data: allClubs } = useQuery({
    queryKey: ["admin-all-clubs"],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("id, name, country_code, is_approved, is_demo, created_by").order("name");
      return data ?? [];
    },
    enabled: tab === "overview",
  });

  const { data: clubRequests } = useQuery({
    queryKey: ["admin-club-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("club_registration_requests").select("*, profiles(display_name, email, whatsapp, country_code)").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: tab === "requests",
  });

  const { data: nicknameClaims } = useQuery({
    queryKey: ["admin-nickname-claims"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nickname_claims").select("*, profiles:user_id (display_name, email, whatsapp), players:player_id (nickname)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: tab === "requests",
  });

  const { data: wptValidations, refetch: refetchWpt } = useQuery({
    queryKey: ["admin-wpt-validations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email, whatsapp, wpt_nickname, wpt_status")
        .not("wpt_status", "is", null) // Trae pendientes, verificados y rechazados
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
    enabled: tab === "requests",
  });

  const { data: latinValidations, refetch: refetchLatin } = useQuery({
    queryKey: ["admin-latin-validations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email, whatsapp, latin_nickname, latin_status")
        .not("latin_status", "is", null) // Trae pendientes, contactados, etc.
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
    enabled: tab === "requests",
  });

  const { data: rooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => {
      const { data } = await supabase.from("poker_rooms").select("*").order("name");
      return data ?? [];
    },
    enabled: tab === "rooms",
  });

  const { data: scoringSystems } = useQuery({
    queryKey: ["admin-scoring"],
    queryFn: async () => {
      const { data } = await supabase.from("scoring_systems").select("*").order("name");
      return data ?? [];
    },
    enabled: tab === "scoring",
  });

  const { data: glossaryTerms } = useQuery({
    queryKey: ["admin-glossary"],
    queryFn: async () => {
      const { data } = await supabase.from("glossary_terms").select("*").order("term");
      return data ?? [];
    },
    enabled: tab === "glossary",
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, email, whatsapp, country_code, avatar_url, role, created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: tab === "users",
  });

  const { data: selectedUserPlayers, refetch: refetchSelectedUserPlayers } = useQuery({
    queryKey: ["admin-user-players", selectedUser?.id],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("id, nickname, elo_rating, poker_rooms(name)").eq("profile_id", selectedUser!.id);
      return data ?? [];
    },
    enabled: !!selectedUser?.id,
  });

  const handleLoadBanners = async () => {
    if (bannersConfig) return; 
    setBannersLoading(true);
    try {
      const cfg = await getBannersConfig();
      setBannersConfig(cfg);
    } finally {
      setBannersLoading(false);
    }
  };

  const handleSaveBanners = async () => {
    if (!bannersConfig) return;
    setBannersSaving(true);
    try {
      await saveBannersConfig(bannersConfig);
      queryClient.invalidateQueries({ queryKey: ["site-settings-banners"] });
      setBannersSaved(true);
      setTimeout(() => setBannersSaved(false), 3000);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setBannersSaving(false);
    }
  };

  const handleReloadBanners = async () => {
    setBannersLoading(true);
    try {
      const cfg = await getBannersConfig();
      setBannersConfig(cfg);
    } finally {
      setBannersLoading(false);
    }
  };

  const handleToggleClubStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm(`¿Estás seguro de que quieres ${currentStatus ? "DESACTIVAR" : "ACTIVAR"} este club?`)) return;
    await supabase.from("clubs").update({ is_approved: !currentStatus }).eq("id", id);
    refresh();
    queryClient.invalidateQueries({ queryKey: ["clubs"] });
  };

  const handleApproveClub = async (req: { id: string; user_id: string; club_name: string; country_code?: string; description?: string }) => {
    const { data: club } = await supabase.from("clubs").insert({ name: req.club_name, country_code: req.country_code, description: req.description, is_approved: true, created_by: req.user_id }).select().single();
    if (!club) return;
    await supabase.from("club_admins").insert({ club_id: club.id, user_id: req.user_id, role: "owner" });
    await supabase.from("profiles").update({ role: "club_admin" }).eq("id", req.user_id);
    await supabase.from("club_registration_requests").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", req.id);
    refresh();
  };

  const handleRejectRequest = async (id: string, table: string) => {
    await supabase.from(table).update({ status: "rejected", resolved_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };

  const handleDeleteEntity = async (table: string, id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await deleteEntity(table, id);
    refresh();
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    await supabase.from("profiles").update({
      display_name: userEditData.display_name || null,
      email: userEditData.email || null,
      whatsapp: userEditData.whatsapp || null,
      country_code: userEditData.country_code?.toUpperCase().slice(0, 2) || null,
    }).eq("id", selectedUser.id);
    setSelectedUser({ ...selectedUser, ...userEditData });
    setEditingUser(false);
    setSavingUser(false);
    queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const handleClaimSearch = async (q: string) => {
    setClaimSearch(q);
    if (q.length < 2) { setClaimResults([]); return; }
    setClaimSearching(true);
    const { data } = await supabase.from("players").select("id, nickname, poker_rooms(name), profile_id").ilike("nickname", `%${q}%`).limit(10);
    setClaimResults(data ?? []);
    setClaimSearching(false);
  };

  const handleAdminClaim = async (playerId: string) => {
    if (!selectedUser) return;
    await supabase.from("players").update({ profile_id: selectedUser.id }).eq("id", playerId);
    await supabase.from("nickname_claims").insert({ user_id: selectedUser.id, player_id: playerId, screenshot_url: "admin-claim", status: "approved", resolved_at: new Date().toISOString() });
    setClaimSearch(""); setClaimResults([]);
    refetchSelectedUserPlayers();
  };

  const handleUnlinkPlayer = async (playerId: string) => {
    if (!confirm("¿Desvincular este nickname del perfil?")) return;
    await supabase.from("players").update({ profile_id: null }).eq("id", playerId);
    refetchSelectedUserPlayers();
  };

  const roomFields = [
    { key: "name", label: "Nombre", type: "text" as const, required: true },
    { key: "website_url", label: "Website", type: "text" as const, placeholder: "https://..." },
  ];

  const scoringFields = [
    { key: "name", label: "Nombre", type: "text" as const, required: true },
    { key: "description", label: "Descripción", type: "textarea" as const },
    { key: "type", label: "Tipo", type: "select" as const, options: [{ value: "simple", label: "Simple" }, { value: "complex", label: "Complex" }] },
  ];

  const glossaryFields = [
    { key: "term", label: "Término", type: "text" as const, required: true },
    { key: "slug", label: "Slug", type: "text" as const, required: true, placeholder: "ej: icm-poker" },
    { key: "short_definition", label: "Definición corta", type: "textarea" as const, required: true },
    { key: "full_definition", label: "Definición completa", type: "textarea" as const },
    { key: "category", label: "Categoría", type: "select" as const, required: true, options: [
      { value: "estrategia", label: "Estrategia" },
      { value: "torneos", label: "Torneos" },
      { value: "estadisticas", label: "Estadísticas" },
      { value: "mental-game", label: "Mental Game" },
      { value: "jugadores", label: "Jugadores" },
      { value: "formatos", label: "Formatos" },
      { value: "plataformas", label: "Plataformas" },
      { value: "sharkania", label: "Sharkania" },
    ]},
    { key: "sort_order", label: "Orden", type: "number" as const },
    { key: "is_active", label: "Activo", type: "checkbox" as const },
  ];

  const pendingWpt = wptValidations?.filter((w: any) => w.wpt_status === "pending").length ?? 0;
  const pendingLatin = latinValidations?.filter((l: any) => l.latin_status === "pending").length ?? 0;
  
  const pendingTotal = (stats?.pendingClubs ?? 0) + (stats?.pendingClaims ?? 0) + pendingWpt + pendingLatin;

  const TABS: { key: AdminTab; label: string; badge?: number }[] = [
    { key: "overview",  label: "General" },
    { key: "analytics", label: "Analytics" },
    { key: "users",     label: "Usuarios" },
    { key: "requests",  label: "Solicitudes", badge: pendingTotal > 0 ? pendingTotal : undefined },
    { key: "missions",  label: "Misiones", badge: (stats?.pendingMissions ?? 0) > 0 ? stats!.pendingMissions : undefined },
    { key: "rooms",     label: "Salas" },
    { key: "scoring",   label: "Scoring" },
    { key: "banners",   label: "Banners" },
    { key: "glossary",  label: "Glosario", badge: glossaryTerms?.length },
  ];

  return (
    <PageShell>
      <SEOHead title="Super Admin" path="/admin" noIndex={true} />
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">

          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-red mb-3">Super Admin</p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1">⚡ Panel de Administración</h1>
          </div>

          <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  if (t.key === "banners") handleLoadBanners();
                }}
                className={cn(
                  "text-sk-sm font-medium px-4 py-2 rounded-sm whitespace-nowrap transition-all duration-100 relative",
                  tab === t.key ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs" : "text-sk-text-2 hover:text-sk-text-1"
                )}
              >
                {t.label}
                {t.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sk-red text-[9px] font-bold text-white flex items-center justify-center">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ══ OVERVIEW ══ */}
          {tab === "overview" && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <PostHogStatsCard />
                <StatCard label="Jugadores" value={formatNumber(stats?.players ?? 0)} accent="accent" />
                <StatCard label="Clubes" value={formatNumber(stats?.clubs ?? 0)} accent="green" />
                <StatCard label="Torneos" value={formatNumber(stats?.tournaments ?? 0)} accent="gold" />
                <StatCard label="Ligas" value={formatNumber(stats?.leagues ?? 0)} />
              </div>

              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Settings size={16} className="text-sk-accent" />
                  <h2 className="text-sk-md font-bold text-sk-text-1">Herramientas de Sistema</h2>
                </div>
                <p className="text-sk-xs text-sk-text-3 mb-4">Ejecuta rutinas de mantenimiento y sincronización de base de datos. Úsalo con precaución.</p>
                <div className="flex gap-3 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSyncElo}
                    isLoading={isSyncingElo}
                    className="border-sk-border-3 hover:border-sk-accent hover:text-sk-accent transition-colors"
                  >
                    <RefreshCw size={14} className={isSyncingElo ? "animate-spin" : ""} />
                    Sincronizar ELOs Unificados (Backfill)
                  </Button>
                </div>
              </div>

              {pendingTotal > 0 && (
                <div className="bg-sk-gold-dim border border-sk-gold/20 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle size={18} className="text-sk-gold shrink-0" />
                  <div className="flex-1">
                    <p className="text-sk-sm font-semibold text-sk-gold">{pendingTotal} solicitud(es) pendiente(s)</p>
                    <p className="text-sk-xs text-sk-text-3">
                      {stats?.pendingClubs ? `${stats.pendingClubs} club(es)` : ""}
                      {stats?.pendingClubs && stats?.pendingClaims ? " · " : ""}
                      {stats?.pendingClaims ? `${stats.pendingClaims} nickname claim(s)` : ""}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setTab("requests")}>Ver solicitudes</Button>
                </div>
              )}
              <div>
                <h2 className="text-sk-md font-bold text-sk-text-1 mb-3">Clubes ({allClubs?.length ?? 0})</h2>
                <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sk-sm">
                    <thead>
                      <tr>{["Club","País","Estado","Acciones"].map((h,i) => <th key={i} className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(allClubs ?? []).map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 border-b border-sk-border-2"><div className="flex items-center gap-2"><span className="font-semibold text-sk-text-1">{c.name}</span>{c.is_demo && <Badge variant="muted">Demo</Badge>}</div></td>
                          <td className="py-3 px-4 border-b border-sk-border-2"><span className="inline-flex items-center gap-1.5"><FlagIcon countryCode={c.country_code} /> {c.country_code ?? "—"}</span></td>
                          <td className="py-3 px-4 border-b border-sk-border-2">
                            <Badge variant={c.is_approved ? "green" : "muted"}>{c.is_approved ? "Activo" : "Inactivo"}</Badge>
                          </td>
                          <td className="py-3 px-4 border-b border-sk-border-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleToggleClubStatus(c.id, c.is_approved)}
                                className={cn(
                                  "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded transition-all",
                                  c.is_approved
                                    ? "bg-sk-bg-4 text-sk-text-3 hover:bg-sk-red/10 hover:text-sk-red border border-transparent hover:border-sk-red/30"
                                    : "bg-sk-accent/10 text-sk-accent hover:bg-sk-accent/20 border border-transparent"
                                )}
                              >
                                <Power size={11} />
                                {c.is_approved ? "Desactivar" : "Activar"}
                              </button>
                              
                              <Link to="/admin/club" className="inline-flex items-center gap-1 text-sk-xs font-semibold text-sk-accent hover:underline">
                                <Settings size={12} /> Gestionar
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-sk-text-4 mt-2">Para gestionar torneos, resultados y ligas usa el <Link to="/admin/club" className="text-sk-accent hover:underline">Panel de Club Admin</Link>.</p>
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <AnalyticsTab />
          )}

          {/* ══ USUARIOS ══ */}
          {tab === "users" && (
            <div className="flex gap-6 min-h-[600px]">
              <div className={`flex flex-col gap-2 overflow-y-auto ${selectedUser ? "w-72 shrink-0" : "w-full"}`}>
                <h2 className="text-sk-md font-bold text-sk-text-1 mb-2">Usuarios ({profiles?.length ?? 0})</h2>
                {(profiles ?? []).map((p) => (
                  <button key={p.id} onClick={() => { setSelectedUser(p); setEditingUser(false); setClaimSearch(""); setClaimResults([]); }}
                    className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all", selectedUser?.id === p.id ? "bg-sk-accent-dim border-sk-accent" : "bg-sk-bg-2 border-sk-border-2 hover:border-sk-border-3")}>
                    <div className="w-9 h-9 rounded-full bg-sk-bg-4 border border-sk-border-2 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sk-sm font-bold text-sk-accent">{(p.display_name ?? p.email ?? "?").charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sk-sm font-semibold text-sk-text-1 truncate">{p.display_name ?? "—"}</p>
                      <p className="text-[11px] text-sk-text-3 truncate">{p.email}</p>
                    </div>
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0", p.role === "super_admin" ? "bg-sk-red-dim text-sk-red" : p.role === "club_admin" ? "bg-sk-accent-dim text-sk-accent" : "bg-sk-bg-4 text-sk-text-3")}>{p.role}</span>
                  </button>
                ))}
              </div>
              {selectedUser && (
                <div className="flex-1 bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 overflow-y-auto">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-border-2 overflow-hidden flex items-center justify-center">
                        {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sk-xl font-bold text-sk-accent">{(selectedUser.display_name ?? selectedUser.email ?? "?").charAt(0).toUpperCase()}</span>}
                      </div>
                      <div>
                        <h3 className="text-sk-lg font-bold text-sk-text-1">{selectedUser.display_name ?? "Sin nombre"}</h3>
                        <p className="text-[10px] text-sk-text-4 font-mono mt-0.5">{selectedUser.id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => { setEditingUser(!editingUser); setUserEditData({ display_name: selectedUser.display_name ?? "", email: selectedUser.email ?? "", whatsapp: selectedUser.whatsapp ?? "", country_code: selectedUser.country_code ?? "" }); }}>
                        <Pencil size={13} /> {editingUser ? "Cancelar" : "Editar"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}><XIcon size={13} /></Button>
                    </div>
                  </div>
                  {editingUser ? (
                    <div className="space-y-3 mb-6 p-4 bg-sk-bg-3 rounded-lg border border-sk-border-2">
                      {[{ key: "display_name", label: "Nombre", placeholder: "Nombre completo" }, { key: "email", label: "Email", placeholder: "correo@ejemplo.com" }, { key: "whatsapp", label: "WhatsApp", placeholder: "56 9 1234 5678" }, { key: "country_code", label: "País (2 letras)", placeholder: "CL" }].map((f) => (
                        <div key={f.key}>
                          <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1 block">{f.label}</label>
                          <input type="text" value={userEditData[f.key] ?? ""} onChange={(e) => setUserEditData({ ...userEditData, [f.key]: e.target.value })} placeholder={f.placeholder} className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent" />
                        </div>
                      ))}
                      <Button variant="accent" size="sm" onClick={handleSaveUser} isLoading={savingUser}><Check size={13} /> Guardar cambios</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {[{ label: "Email", value: selectedUser.email }, { label: "WhatsApp", value: selectedUser.whatsapp ? `+${selectedUser.whatsapp}` : null }, { label: "País", value: selectedUser.country_code }, { label: "Rol", value: selectedUser.role }].map((item) => (
                        <div key={item.label} className="bg-sk-bg-3 rounded-md p-3">
                          <p className="text-[10px] font-mono uppercase tracking-wide text-sk-text-3 mb-1">{item.label}</p>
                          <p className="text-sk-sm font-semibold text-sk-text-1">{item.value ?? "—"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mb-6">
                    <h4 className="text-sk-sm font-bold text-sk-text-1 mb-3">Nicknames vinculados</h4>
                    {(selectedUserPlayers ?? []).length === 0 ? <p className="text-sk-xs text-sk-text-3">Sin nicknames vinculados</p> : (selectedUserPlayers ?? []).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-sk-bg-3 rounded-md px-3 py-2 mb-2">
                        <div><span className="font-mono font-semibold text-sk-text-1 text-sk-sm">{p.nickname}</span><span className="text-sk-xs text-sk-text-3 ml-2">({p.poker_rooms?.name ?? "—"}) · ELO: {Math.round(p.elo_rating)}</span></div>
                        <button onClick={() => handleUnlinkPlayer(p.id)} className="text-sk-text-3 hover:text-sk-red transition-colors p-1"><XIcon size={13} /></button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-sk-sm font-bold text-sk-text-1 mb-3">Vincular nickname (como admin)</h4>
                    <div className="relative">
                      <input type="text" value={claimSearch} onChange={(e) => handleClaimSearch(e.target.value)} placeholder="Buscar nickname..." className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 pl-3 pr-8 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent" />
                      {claimSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin" />}
                    </div>
                    {claimResults.length > 0 && (
                      <div className="mt-1 border border-sk-border-2 rounded-md overflow-hidden bg-sk-bg-2">
                        {claimResults.map((p: any) => (
                          <button key={p.id} onClick={() => handleAdminClaim(p.id)} className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.03] border-b border-sk-border-2 last:border-b-0 transition-colors">
                            <div><span className="font-mono font-semibold text-sk-text-1 text-sk-sm">{p.nickname}</span><span className="text-sk-xs text-sk-text-3 ml-2">{p.poker_rooms?.name ?? "—"}</span></div>
                            {p.profile_id ? <Badge variant="orange">Ya vinculado</Badge> : <span className="text-sk-xs text-sk-accent font-semibold">Vincular →</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ SOLICITUDES (NUEVO DISEÑO CON SUB-TABS Y MODO HISTORIAL) ══ */}
          {tab === "requests" && (
            <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
              
              {/* Menú Lateral de Categorías */}
              <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
                <h2 className="text-sk-md font-bold text-sk-text-1 mb-2 px-2">Categorías</h2>
                {[
                  { id: "clubs", label: "Clubes", count: clubRequests?.filter(r => r.status === "pending").length || 0 },
                  { id: "claims", label: "Nickname Claims", count: nicknameClaims?.filter(c => c.status === "pending").length || 0 },
                  { id: "wpt", label: "Validaciones WPT", count: wptValidations?.filter(w => w.wpt_status === "pending").length || 0 },
                  { id: "latin", label: "LatinAllin Onboarding", count: latinValidations?.filter(l => l.latin_status === "pending").length || 0 },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setReqCategory(cat.id as any); setReqView("pending"); }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                      reqCategory === cat.id 
                        ? "bg-sk-bg-3 border-sk-border-2 shadow-sk-xs" 
                        : "bg-transparent border-transparent hover:bg-sk-bg-2"
                    )}
                  >
                    <span className={cn("text-sk-sm font-semibold", reqCategory === cat.id ? "text-sk-text-1" : "text-sk-text-3")}>
                      {cat.label}
                    </span>
                    {cat.count > 0 && (
                      <span className="bg-sk-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Contenido Principal de Solicitudes */}
              <div className="flex-1 bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 overflow-hidden flex flex-col">
                
                {/* Control de vista: Pendientes vs Historial */}
                <div className="flex items-center justify-between border-b border-sk-border-2 pb-4 mb-6 shrink-0">
                  <h3 className="text-sk-lg font-bold text-sk-text-1">
                    {reqCategory === "clubs" && "Solicitudes de Clubes"}
                    {reqCategory === "claims" && "Validación de Nicknames"}
                    {reqCategory === "wpt" && "VIP WPT Global"}
                    {reqCategory === "latin" && "Onboarding LatinAllin"}
                  </h3>
                  <div className="flex gap-1 bg-sk-bg-0 border border-sk-border-2 rounded-md p-0.5">
                    <button
                      onClick={() => setReqView("pending")}
                      className={cn("px-4 py-1.5 rounded-sm text-sk-sm font-medium transition-all", reqView === "pending" ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs" : "text-sk-text-3 hover:text-sk-text-1")}
                    >
                      Pendientes
                    </button>
                    <button
                      onClick={() => setReqView("history")}
                      className={cn("px-4 py-1.5 rounded-sm text-sk-sm font-medium transition-all", reqView === "history" ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs" : "text-sk-text-3 hover:text-sk-text-1")}
                    >
                      Historial
                    </button>
                  </div>
                </div>

                {/* Área Scrollable para Tarjetas / Tablas */}
                <div className="flex-1 overflow-y-auto pr-2">
                  
                  {/* --- CATEGORÍA: CLUBES --- */}
                  {reqCategory === "clubs" && reqView === "pending" && (
                    <div className="space-y-3">
                      {clubRequests?.filter(r => r.status === "pending").map((req) => (
                        <div key={req.id} className="bg-sk-bg-0 border border-sk-border-2 rounded-lg p-5">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-sk-md font-bold text-sk-text-1">{req.club_name}</p>
                              <p className="text-sk-xs text-sk-text-3">Solicitante: {req.profiles?.display_name}{req.profiles?.email && <span className="ml-2 text-sk-text-4">({req.profiles.email})</span>}</p>
                              {req.profiles?.whatsapp && <a href={`https://wa.me/${req.profiles.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-sk-xs text-sk-green hover:underline">WhatsApp: +{req.profiles.whatsapp}</a>}
                              {req.description && <p className="text-sk-xs text-sk-text-2 mt-1">{req.description}</p>}
                              {req.country_code && <span className="inline-flex items-center gap-1 mt-1 text-sk-xs text-sk-text-3"><FlagIcon countryCode={req.country_code} /> {req.country_code}</span>}
                            </div>
                            <Badge variant="orange">Pendiente</Badge>
                          </div>
                          <div className="flex gap-2 pt-3 border-t border-sk-border-2">
                            <Button variant="accent" size="sm" onClick={() => handleApproveClub(req)}><Check size={13} /> Aprobar Club</Button>
                            <Button variant="danger" size="sm" onClick={() => handleRejectRequest(req.id, "club_registration_requests")}><XIcon size={13} /> Rechazar</Button>
                          </div>
                        </div>
                      ))}
                      {clubRequests?.filter(r => r.status === "pending").length === 0 && <EmptyState icon="📋" title="Todo al día" description="No hay clubes pendientes de aprobación." />}
                    </div>
                  )}

                  {reqCategory === "clubs" && reqView === "history" && (
                    <table className="w-full text-left text-sk-sm">
                      <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
                        <tr><th className="p-3 rounded-tl-lg">Club</th><th className="p-3">Solicitante</th><th className="p-3 rounded-tr-lg">Estado</th></tr>
                      </thead>
                      <tbody className="divide-y divide-sk-border-2">
                        {clubRequests?.filter(r => r.status !== "pending").map(req => (
                          <tr key={req.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-semibold text-sk-text-1">{req.club_name}</td>
                            <td className="p-3 text-sk-text-2">{req.profiles?.display_name ?? "—"}</td>
                            <td className="p-3"><Badge variant={req.status === "approved" ? "green" : "muted"}>{req.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* --- CATEGORÍA: CLAIMS --- */}
                  {reqCategory === "claims" && reqView === "pending" && (
                    <div className="grid grid-cols-1 gap-4">
                      {nicknameClaims?.filter(c => c.status === "pending").map((claim) => (
                        <div key={claim.id} className="bg-sk-bg-0 border border-sk-border-2 rounded-lg p-5 flex flex-col md:flex-row gap-5">
                          <div className="shrink-0">
                            <p className="text-[10px] font-mono uppercase text-sk-text-3 mb-2">Prueba</p>
                            <a href={claim.screenshot_url} target="_blank" rel="noreferrer" className="block relative w-24 h-24 bg-sk-bg-3 border border-sk-border-2 rounded-md overflow-hidden group">
                              {claim.screenshot_url ? <img src={claim.screenshot_url} alt="Prueba" className="w-full h-full object-cover group-hover:scale-110 transition-transform" /> : <div className="flex h-full items-center justify-center text-xs text-sk-text-4">Sin img</div>}
                            </a>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sk-lg font-bold text-sk-text-1">{claim.players?.nickname}</h3>
                            <p className="text-sk-sm text-sk-text-2"><span className="text-sk-text-3 font-mono text-[10px] uppercase">Usuario:</span> {claim.profiles?.display_name}</p>
                            <p className="text-sk-sm text-sk-text-2"><span className="text-sk-text-3 font-mono text-[10px] uppercase">Email:</span> {claim.profiles?.email}</p>
                            <div className="flex gap-2 mt-4">
                              <Button variant="accent" size="sm" onClick={async () => {
                                const { error: linkError } = await supabase.from("players").update({ profile_id: claim.user_id }).eq("id", claim.player_id);
                                if (linkError) return alert("Error vinculando: " + linkError.message);
                                await supabase.from("nickname_claims").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", claim.id);
                                refresh();
                              }}><Check size={14} /> Vincular</Button>
                              <Button variant="danger" size="sm" onClick={() => handleRejectRequest(claim.id, "nickname_claims")}><XIcon size={14} /> Rechazar</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {nicknameClaims?.filter(c => c.status === "pending").length === 0 && <EmptyState icon="🏷️" title="Sin claims" />}
                    </div>
                  )}

                  {reqCategory === "claims" && reqView === "history" && (
                    <table className="w-full text-left text-sk-sm">
                      <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
                        <tr><th className="p-3">Nickname</th><th className="p-3">Usuario</th><th className="p-3">Prueba</th><th className="p-3">Estado</th></tr>
                      </thead>
                      <tbody className="divide-y divide-sk-border-2">
                        {nicknameClaims?.filter(c => c.status !== "pending").map(c => (
                          <tr key={c.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-bold text-sk-text-1">{c.players?.nickname}</td>
                            <td className="p-3 text-sk-text-2">{c.profiles?.display_name ?? "—"}</td>
                            <td className="p-3 text-[11px]">
                              {c.screenshot_url ? <a href={c.screenshot_url} target="_blank" rel="noreferrer" className="text-sk-accent hover:underline inline-flex items-center gap-1"><ExternalLink size={10}/> Ver Imagen</a> : "—"}
                            </td>
                            <td className="p-3"><Badge variant={c.status === "approved" ? "green" : "muted"}>{c.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* --- CATEGORÍA: WPT --- */}
                  {reqCategory === "wpt" && reqView === "pending" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {wptValidations?.filter(w => w.wpt_status === "pending").map((val: any) => (
                        <div key={val.id} className="bg-sk-bg-0 border border-sk-accent/20 rounded-lg p-5">
                          <p className="text-sk-sm font-bold text-sk-text-1 mb-1">Usuario: <span className="text-sk-accent">{val.display_name ?? val.email}</span></p>
                          <p className="text-sk-sm font-bold text-sk-text-1">Nick reclamado: <span className="font-mono text-sk-gold">{val.wpt_nickname}</span></p>
                          <div className="flex gap-2 pt-3 border-t border-sk-border-2 mt-3">
                            <Button variant="accent" size="sm" className="flex-1" onClick={async () => {
                              await supabase.from("profiles").update({ wpt_status: "verified", wpt_verified_at: new Date().toISOString() }).eq("id", val.id);
                              refetchWpt();
                            }}><Check size={13} /> Aprobar</Button>
                            <Button variant="danger" size="sm" onClick={async () => {
                              await supabase.from("profiles").update({ wpt_status: "rejected" }).eq("id", val.id);
                              refetchWpt();
                            }}><XIcon size={13} /></Button>
                          </div>
                        </div>
                      ))}
                      {wptValidations?.filter(w => w.wpt_status === "pending").length === 0 && <EmptyState icon="🎁" title="Todo validado" />}
                    </div>
                  )}

                  {reqCategory === "wpt" && reqView === "history" && (
                    <table className="w-full text-left text-sk-sm">
                      <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
                        <tr><th className="p-3">WPT Nickname</th><th className="p-3">Usuario</th><th className="p-3">Estado</th></tr>
                      </thead>
                      <tbody className="divide-y divide-sk-border-2">
                        {wptValidations?.filter(w => w.wpt_status !== "pending").map((w:any) => (
                          <tr key={w.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-bold text-sk-gold">{w.wpt_nickname}</td>
                            <td className="p-3 text-sk-text-2">{w.display_name ?? w.email}</td>
                            <td className="p-3"><Badge variant={w.wpt_status === "verified" ? "green" : "muted"}>{w.wpt_status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* --- CATEGORÍA: LATINALLIN --- */}
                  {reqCategory === "latin" && reqView === "pending" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {latinValidations?.filter(l => l.latin_status === "pending").map((val: any) => (
                        <div key={val.id} className="bg-sk-bg-0 border border-sk-accent/30 rounded-lg p-5">
                          <p className="text-sk-sm font-bold text-sk-text-1 mb-1">Nombre: <span className="text-sk-accent">{val.display_name ?? "—"}</span></p>
                          <p className="text-sk-md font-black text-sk-text-1 mb-3">Nick ClubGG: <span className="font-mono text-sk-green">{val.latin_nickname}</span></p>
                          {val.whatsapp && (
                            <a href={`https://wa.me/${val.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-sk-sm text-sk-green hover:underline font-bold flex items-center gap-1 mb-3">
                              <MessageCircle size={14} /> WhatsApp: +{val.whatsapp}
                            </a>
                          )}
                          <div className="flex pt-3 border-t border-sk-border-2 mt-2">
                            <Button variant="accent" size="sm" className="w-full" onClick={async () => {
                              if (!confirm("¿Ya lo contactaste y lo aceptaste en ClubGG?")) return;
                              await supabase.from("profiles").update({ latin_status: "contacted" }).eq("id", val.id);
                              refetchLatin();
                            }}>
                              <Check size={14} /> Marcar Contactado
                            </Button>
                          </div>
                        </div>
                      ))}
                      {latinValidations?.filter(l => l.latin_status === "pending").length === 0 && <EmptyState icon="📱" title="Bandeja limpia" />}
                    </div>
                  )}

                  {reqCategory === "latin" && reqView === "history" && (
                    <table className="w-full text-left text-sk-sm">
                      <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
                        <tr><th className="p-3">Nick ClubGG</th><th className="p-3">Usuario</th><th className="p-3">Estado</th></tr>
                      </thead>
                      <tbody className="divide-y divide-sk-border-2">
                        {latinValidations?.filter(l => l.latin_status !== "pending").map((l:any) => (
                          <tr key={l.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-bold text-sk-green">{l.latin_nickname}</td>
                            <td className="p-3 text-sk-text-2">{l.display_name ?? l.email}</td>
                            <td className="p-3"><Badge variant="green">Contactado</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* ══ MISIONES ══ */}
          {tab === "missions" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Revisión de Misiones</h2>
              </div>
              <MissionsAdminTab />
            </div>
          )}

          {/* ══ SALAS ══ */}
          {tab === "rooms" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Salas ({rooms?.length})</h2>
                <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "poker_rooms", title: "Sala", fields: roomFields, data: null })}><Plus size={14} /> Crear</Button>
              </div>
              <AdminTable
                headers={["Sala", "Website"]}
                rows={(rooms ?? []).map((r) => ({
                  id: r.id,
                  cells: [<span className="font-semibold text-sk-text-1">{r.name}</span>, r.website_url ? <a href={r.website_url} target="_blank" rel="noreferrer" className="text-sk-accent text-sk-xs hover:underline inline-flex items-center gap-1">{r.website_url} <ExternalLink size={10} /></a> : <span className="text-sk-text-3 text-sk-xs">—</span>],
                  onEdit: () => setEntityForm({ table: "poker_rooms", title: "Sala", fields: roomFields, data: r }),
                  onDelete: () => handleDeleteEntity("poker_rooms", r.id, r.name),
                }))}
              />
            </div>
          )}

          {/* ══ SCORING ══ */}
          {tab === "scoring" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Scoring Systems ({scoringSystems?.length})</h2>
                <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "scoring_systems", title: "Scoring System", fields: scoringFields, data: null })}><Plus size={14} /> Crear</Button>
              </div>
              <AdminTable
                headers={["Nombre", "Tipo", "Descripción"]}
                rows={(scoringSystems ?? []).map((s) => ({
                  id: s.id,
                  cells: [<span className="font-semibold text-sk-text-1">{s.name}</span>, <Badge variant="accent">{s.type}</Badge>, <span className="text-sk-text-2 text-sk-xs line-clamp-1">{s.description ?? "—"}</span>],
                  onEdit: () => setEntityForm({ table: "scoring_systems", title: "Scoring System", fields: scoringFields, data: s }),
                  onDelete: () => handleDeleteEntity("scoring_systems", s.id, s.name),
                }))}
              />
            </div>
          )}

          {/* ══ GLOSARIO ══ */}
          {tab === "glossary" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Glosario ({glossaryTerms?.length})</h2>
                <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "glossary_terms", title: "Término", fields: glossaryFields, data: null })}><Plus size={14} /> Crear</Button>
              </div>
              <AdminTable
                headers={["Término", "Categoría", "Slug", "Activo"]}
                rows={(glossaryTerms ?? []).map((t: Record<string, unknown>) => ({
                  id: t.id as string,
                  cells: [
                    <span className="font-semibold text-sk-text-1">{t.term as string}</span>,
                    <Badge variant="accent">{t.category as string}</Badge>,
                    <span className="font-mono text-sk-xs text-sk-text-2">{t.slug as string}</span>,
                    (t.is_active as boolean) ? <Badge variant="green">Sí</Badge> : <Badge variant="muted">No</Badge>,
                  ],
                  onEdit: () => setEntityForm({ table: "glossary_terms", title: "Término", fields: glossaryFields, data: t }),
                  onDelete: () => handleDeleteEntity("glossary_terms", t.id as string, t.term as string),
                }))}
              />
            </div>
          )}

          {/* ══ BANNERS ══ */}
          {tab === "banners" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-sk-md font-bold text-sk-text-1 mb-1">Gestión de Banners</h2>
                  <p className="text-sk-xs text-sk-text-3">
                    Los cambios se guardan en Supabase y se aplican en todos los artículos del blog sin necesidad de redeploy.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleReloadBanners} isLoading={bannersLoading}>
                    <RefreshCw size={13} /> Recargar
                  </Button>
                  <Button
                    variant={bannersSaved ? "secondary" : "accent"}
                    size="sm"
                    onClick={handleSaveBanners}
                    isLoading={bannersSaving}
                    disabled={!bannersConfig || bannersSaving}
                  >
                    {bannersSaved ? <><Check size={13} /> ¡Guardado!</> : <><Save size={13} /> Guardar cambios</>}
                  </Button>
                </div>
              </div>

              {bannersLoading && (
                <div className="flex items-center justify-center py-20 gap-3">
                  <div className="w-5 h-5 border-2 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin" />
                  <span className="text-sk-sm text-sk-text-3">Cargando configuración...</span>
                </div>
              )}

              {!bannersLoading && bannersConfig && (
                <>
                  <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg">🎁</span>
                      <div>
                        <h3 className="text-sk-sm font-bold text-sk-text-1">Código de bono</h3>
                        <p className="text-sk-xs text-sk-text-3">Se muestra debajo de cada banner como recordatorio para el usuario.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={bannersConfig.bonusCode}
                        onChange={(e) => setBannersConfig({ ...bannersConfig, bonusCode: e.target.value.toUpperCase() })}
                        placeholder="FPHL"
                        maxLength={12}
                        className="w-40 bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-md text-sk-accent font-mono font-bold tracking-widest uppercase focus:outline-none focus:border-sk-accent"
                      />
                      <span className="text-sk-xs text-sk-text-3">Aparece como: <span className="text-sk-accent font-mono font-bold">{bannersConfig.bonusCode || "FPHL"}</span></span>
                    </div>
                  </div>

                  {(Object.keys(SLOT_INFO) as SlotKey[]).map((slotKey) => (
                    <BannerSlotEditor
                      key={slotKey}
                      slotKey={slotKey}
                      value={bannersConfig.slots[slotKey]}
                      onChange={(v) => setBannersConfig({
                        ...bannersConfig,
                        slots: { ...bannersConfig.slots, [slotKey]: v },
                      })}
                    />
                  ))}

                  <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-sk-border-2 bg-sk-bg-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🎯</span>
                        <h3 className="text-sk-md font-bold text-sk-text-1">Banner Flotante (Popup)</h3>
                      </div>
                      <p className="text-sk-xs text-sk-text-3">
                        Aparece automáticamente después de un delay. Visible en todas las páginas. Se expande al pasar el cursor mostrando la imagen completa.
                      </p>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setBannersConfig({
                            ...bannersConfig,
                            floatingCta: { ...((bannersConfig as any).floatingCta ?? {}), active: !((bannersConfig as any).floatingCta?.active ?? true) },
                          })}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            (bannersConfig as any).floatingCta?.active !== false ? "bg-sk-accent" : "bg-sk-bg-4"
                          )}
                        >
                          <span className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                            (bannersConfig as any).floatingCta?.active !== false ? "translate-x-5" : "translate-x-0.5"
                          )} />
                        </button>
                        <span className="text-sk-sm text-sk-text-2">
                          {(bannersConfig as any).floatingCta?.active !== false ? "Activo" : "Desactivado"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: "title", label: "Título (texto pequeño)", placeholder: "$10,000 gratis en WPT" },
                          { key: "description", label: "Descripción (texto gris)", placeholder: "Juega los Elite Freerolls..." },
                          { key: "image", label: "URL de imagen (al expandirse)", placeholder: "https://..." },
                          { key: "link", label: "URL de destino", placeholder: "https://tracking.wptpartners.com/..." },
                        ].map((f) => (
                          <div key={f.key}>
                            <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 block">{f.label}</label>
                            <input
                              type="text"
                              value={bannersConfig.floatingCta?.[f.key as keyof import("../lib/api/site-settings").FloatingConfig] as string ?? ""}
                              onChange={(e) => setBannersConfig({
                                ...bannersConfig,
                                floatingCta: { ...bannersConfig.floatingCta, [f.key]: e.target.value },
                              })}
                              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-xs text-sk-text-1 focus:outline-none focus:border-sk-accent font-mono"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-sk-border-2 bg-sk-bg-0/30 p-4 rounded-lg">
                        <div className="col-span-full flex items-center gap-2 mb-2">
                          <span className="text-xl">🇺🇸</span>
                          <div>
                            <h4 className="text-sk-sm font-bold text-sk-text-1">Tráfico de Estados Unidos (ACR)</h4>
                            <p className="text-[10px] text-sk-text-3">Si se detecta IP de USA, estos valores sobrescribirán a los de arriba.</p>
                          </div>
                        </div>
                        {[
                          { key: "us_title", label: "Título USA", placeholder: "Juega en Americas Cardroom" },
                          { key: "us_description", label: "Descripción USA", placeholder: "Aceptamos jugadores de EE.UU." },
                          { key: "us_image", label: "URL de imagen USA", placeholder: "https://www.acrpoker.eu/..." },
                          { key: "us_link", label: "URL de destino USA", placeholder: "https://go.wpnaffiliates.com/..." },
                        ].map((f) => (
                          <div key={f.key}>
                            <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 block">{f.label}</label>
                            <input
                              type="text"
                              value={bannersConfig.floatingCta?.[f.key as keyof import("../lib/api/site-settings").FloatingConfig] as string ?? ""}
                              onChange={(e) => setBannersConfig({
                                ...bannersConfig,
                                floatingCta: { ...bannersConfig.floatingCta, [f.key]: e.target.value },
                              })}
                              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-xs text-sk-text-1 focus:outline-none focus:border-sk-accent font-mono"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 block">Delay (ms) — tiempo antes de aparecer</label>
                          <input
                            type="number"
                            value={(bannersConfig as any).floatingCta?.delay ?? 6000}
                            onChange={(e) => setBannersConfig({
                              ...bannersConfig,
                              floatingCta: { ...((bannersConfig as any).floatingCta ?? {}), delay: Number(e.target.value) },
                            } as any)}
                            min={0}
                            step={1000}
                            className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
                          />
                          <p className="text-[10px] text-sk-text-4 mt-1">6000 = 6 segundos</p>
                        </div>
                        <div>
                          <label className="font-mono text-[10px] uppercase tracking-wide text-sk-text-3 mb-1.5 block">Scroll Trigger (0–1) — en página Ranking</label>
                          <input
                            type="number"
                            value={(bannersConfig as any).floatingCta?.scrollTrigger ?? 0.35}
                            onChange={(e) => setBannersConfig({
                              ...bannersConfig,
                              floatingCta: { ...((bannersConfig as any).floatingCta ?? {}), scrollTrigger: Number(e.target.value) },
                            } as any)}
                            min={0}
                            max={1}
                            step={0.05}
                            className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
                          />
                          <p className="text-[10px] text-sk-text-4 mt-1">0.35 = aparece al 35% del scroll</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-sk-border-2">
                    <Button
                      variant={bannersSaved ? "secondary" : "accent"}
                      size="md"
                      onClick={handleSaveBanners}
                      isLoading={bannersSaving}
                      disabled={bannersSaving}
                    >
                      {bannersSaved ? <><Check size={14} /> ¡Cambios guardados!</> : <><Save size={14} /> Guardar todos los cambios</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {entityForm && (
        <EntityForm
          isOpen={true}
          onClose={() => setEntityForm(null)}
          onSaved={refresh}
          table={entityForm.table}
          title={entityForm.title}
          fields={entityForm.fields}
          initialData={entityForm.data}
        />
      )}
    </PageShell>
  );
}

// ── Reusable Admin Table ──────────────────────────────────

function AdminTable({ headers, rows }: {
  headers: string[];
  rows: Array<{ id: string; cells: React.ReactNode[]; onEdit?: () => void; onDelete?: () => void }>;
}) {
  return (
    <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
      <table className="w-full border-collapse text-sk-sm">
        <thead>
          <tr>
            {headers.map((h, i) => <th key={i} className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left whitespace-nowrap">{h}</th>)}
            <th className="bg-sk-bg-3 py-3 px-4 border-b border-sk-border-2 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
              {row.cells.map((cell, i) => <td key={i} className="py-3 px-4 border-b border-sk-border-2">{cell}</td>)}
              <td className="py-3 px-4 border-b border-sk-border-2">
                <div className="flex gap-1">
                  {row.onEdit && <button onClick={row.onEdit} className="text-sk-text-2 hover:text-sk-accent transition-colors p-1" title="Editar"><Pencil size={13} /></button>}
                  {row.onDelete && <button onClick={row.onDelete} className="text-sk-text-2 hover:text-sk-red transition-colors p-1" title="Eliminar"><Trash2 size={13} /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}