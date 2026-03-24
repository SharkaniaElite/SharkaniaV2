// src/pages/club-admin.tsx
import { useState, useEffect } from "react";
import { PageShell } from "../components/layout/page-shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatCard } from "../components/ui/stat-card";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import { ResultsUpload } from "../components/admin/results-upload";
import { ResultsEditor } from "../components/admin/results-editor";
import { TournamentForm } from "../components/admin/tournament-form";
import { LeagueForm } from "../components/admin/league-form";
import { ClubPlayersTab } from "../components/admin/club-players-tab";
import { TemplatesTab } from "../components/admin/templates-tab";
import { BulkDeleteBar } from "../components/admin/bulk-delete-bar";
import { useAuthStore } from "../stores/auth-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { deleteTournamentSafe } from "../lib/api/tournaments";
import { formatCurrency } from "../lib/format";
import { cn } from "../lib/cn";
import { Plus, Trash2, Pencil, Save, ChevronDown } from "lucide-react";
import type { TournamentWithDetails, Tournament, League } from "../types";
import { SEOHead } from "../components/seo/seo-head";
import { InfoTooltip } from "../components/ui/info-tooltip";
import { ADMIN_HELP } from "../lib/admin-help-texts";

type TabKey = "templates" | "tournaments" | "players" | "leagues" | "stats" | "info";

export function ClubAdminPage() {
  const { user, profile } = useAuthStore();
  const queryClient = useQueryClient();
  const isSuperAdmin = profile?.role === "super_admin";

  const [activeTab, setActiveTab] = useState<TabKey>("templates");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [uploadTournament, setUploadTournament] = useState<TournamentWithDetails | null>(null);
  const [editResultsTournament, setEditResultsTournament] = useState<TournamentWithDetails | null>(null);
  const [editTournament, setEditTournament] = useState<Tournament | null | undefined>(undefined);
  const [editLeague, setEditLeague] = useState<League | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<string[]>([]);

  // Club info editing
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    description: "", email: "", whatsapp: "", website_url: "",
    discord_url: "", telegram_url: "", instagram_url: "",
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Query: clubs the user can manage ──
  // Super admin: ALL approved clubs
  // Club admin: only their clubs via club_admins
  const { data: adminClubs, isLoading } = useQuery({
    queryKey: ["my-admin-clubs", user?.id, isSuperAdmin],
    queryFn: async () => {
      if (isSuperAdmin) {
        // Super admin sees ALL clubs
        const { data, error } = await supabase
          .from("clubs")
          .select("id, name, country_code, description, is_approved, email, whatsapp, website_url, discord_url, telegram_url, instagram_url")
          .order("name");
        if (error) throw error;
        return (data ?? []).map((club) => ({
          club_id: club.id,
          clubs: club,
          role: "super_admin" as const,
        }));
      } else {
        // Regular club admin
        const { data, error } = await supabase
          .from("club_admins")
          .select("*, clubs(id, name, country_code, description, is_approved, email, whatsapp, website_url, discord_url, telegram_url, instagram_url)")
          .eq("user_id", user!.id);
        if (error) throw error;
        return data;
      }
    },
    enabled: !!user?.id,
  });

  // Auto-select first club when data loads
  useEffect(() => {
    if (adminClubs?.length && !selectedClubId) {
      setSelectedClubId(adminClubs[0].club_id);
    }
  }, [adminClubs, selectedClubId]);

  // Current club data
  const currentAdmin = adminClubs?.find((a) => a.club_id === selectedClubId);
  const club = currentAdmin?.clubs;
  const firstClubId = selectedClubId;

  const { data: tournaments } = useQuery({
    queryKey: ["club-tournaments", firstClubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*, poker_rooms(name), clubs(id, name, country_code), leagues(id, name)")
        .eq("club_id", firstClubId!)
        .order("start_datetime", { ascending: false });
      if (error) throw error;
      return data as TournamentWithDetails[];
    },
    enabled: !!firstClubId,
  });

  const { data: leagues } = useQuery({
    queryKey: ["club-leagues-full", firstClubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_clubs")
        .select("leagues(*)")
        .eq("club_id", firstClubId!);
      if (error) throw error;
      return (data ?? []).map((d) => d.leagues).filter(Boolean) as League[];
    },
    enabled: !!firstClubId,
  });

  const leagueOptions = (leagues ?? []).map((l) => ({ id: l.id, name: l.name }));

  // ── Bulk delete helpers ──
  const scheduledTournaments = (tournaments ?? []).filter(
    (t) => t.status === "scheduled" && !t.results_uploaded
  );
  const toggleTournamentSelection = (id: string) => {
    setSelectedTournamentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const selectAllScheduled = () => setSelectedTournamentIds(scheduledTournaments.map((t) => t.id));
  const deselectAllTournaments = () => setSelectedTournamentIds([]);

  // ── Handlers ──
  const handleDeleteTournament = async (t: TournamentWithDetails) => {
  const warning = t.results_uploaded
    ? "⚠️ Esto revertirá ELO y puntos de liga. Esta acción no se puede deshacer."
    : "";

  if (!confirm(`¿Eliminar "${t.name}"?\n${warning}`)) return;

  setDeleting(t.id);

  try {
    await deleteTournamentSafe(t.id);
    refresh();
  } catch (err) {
    console.error(err);
    alert("Error al eliminar torneo");
  }

  setDeleting(null);
};

  const handleDeleteLeague = async (l: League) => {
    if (!confirm(`¿Eliminar liga "${l.name}"?`)) return;
    await supabase.from("leagues").delete().eq("id", l.id);
    refresh();
  };

  const handleSaveInfo = async () => {
    if (!firstClubId) return;
    setSavingInfo(true);
    await supabase.from("clubs").update({
      description: infoForm.description || null,
      email: infoForm.email || null,
      whatsapp: infoForm.whatsapp || null,
      website_url: infoForm.website_url || null,
      discord_url: infoForm.discord_url || null,
      telegram_url: infoForm.telegram_url || null,
      instagram_url: infoForm.instagram_url || null,
    }).eq("id", firstClubId);
    queryClient.invalidateQueries({ queryKey: ["my-admin-clubs"] });
    setSavingInfo(false);
    setEditingInfo(false);
  };

  const startEditingInfo = () => {
    setEditingInfo(true);
    setInfoForm({
      description: club?.description ?? "",
      email: club?.email ?? "",
      whatsapp: club?.whatsapp ?? "",
      website_url: club?.website_url ?? "",
      discord_url: club?.discord_url ?? "",
      telegram_url: club?.telegram_url ?? "",
      instagram_url: club?.instagram_url ?? "",
    });
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["club-tournaments"] });
    queryClient.invalidateQueries({ queryKey: ["club-leagues-full"] });
    queryClient.invalidateQueries({ queryKey: ["players"] });
    queryClient.invalidateQueries({ queryKey: ["tournament-templates"] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-from-templates"] });
  };

  // Reset state when switching clubs
  const handleClubChange = (clubId: string) => {
    setSelectedClubId(clubId);
    setSelectedTournamentIds([]);
    setEditTournament(undefined);
    setEditLeague(undefined);
    setUploadTournament(null);
    setEditResultsTournament(null);
    setEditingInfo(false);
  };

  if (isLoading) return <PageShell><div className="pt-20 min-h-screen flex items-center justify-center"><Spinner size="lg" /></div></PageShell>;
  if (!adminClubs?.length) return <PageShell><div className="pt-20 pb-16"><div className="max-w-[900px] mx-auto px-6"><EmptyState icon="🏛️" title="No eres admin de ningún club" /></div></div></PageShell>;

  const completedCount = tournaments?.filter((t) => t.status === "completed").length ?? 0;
  const upcomingCount = tournaments?.filter((t) => ["scheduled", "live", "late_registration"].includes(t.status)).length ?? 0;

  const TABS: { key: TabKey; label: string }[] = [
    { key: "templates", label: "Plantillas" },
    { key: "tournaments", label: `Torneos (${tournaments?.length ?? 0})` },
    { key: "players", label: "Jugadores" },
    { key: "leagues", label: `Ligas (${leagues?.length ?? 0})` },
    { key: "stats", label: "Estadísticas" },
    { key: "info", label: "Info del Club" },
  ];

  return (
    <PageShell>
      <SEOHead title="Admin Club" path="/admin/club" noIndex={true} />
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Panel de Administración
              {isSuperAdmin && <span className="ml-2 text-sk-gold">(Super Admin)</span>}
            </p>

            {/* Club selector — visible for super admin with multiple clubs, or regular admin with multiple */}
            {(adminClubs?.length ?? 0) > 1 ? (
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1">🎛️</h1>
                <div className="relative">
                  <select
                    value={selectedClubId ?? ""}
                    onChange={(e) => handleClubChange(e.target.value)}
                    className="appearance-none bg-sk-bg-2 border border-sk-border-2 rounded-lg px-4 py-2.5 pr-10 text-sk-xl font-extrabold text-sk-text-1 focus:outline-none focus:border-sk-accent cursor-pointer hover:border-sk-border-3 transition-colors"
                  >
                    {(adminClubs ?? []).map((a) => (
                      <option key={a.club_id} value={a.club_id}>
                        {a.clubs?.name ?? "Club"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-sk-text-3 pointer-events-none" />
                </div>
              </div>
            ) : (
              <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">
                🎛️ {club?.name ?? "Mi Club"}
              </h1>
            )}

            <div className="flex gap-2">
              <Badge variant={club?.is_approved ? "green" : "orange"}>
                {club?.is_approved ? "Aprobado" : "Pendiente"}
              </Badge>
              <Badge variant="accent">
                {isSuperAdmin ? "super_admin" : currentAdmin?.role}
              </Badge>
              {isSuperAdmin && (adminClubs?.length ?? 0) > 1 && (
                <Badge variant="muted">{adminClubs?.length} clubes</Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn("text-sk-sm font-medium px-4 py-2 rounded-sm whitespace-nowrap transition-all duration-100", activeTab === t.key ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs" : "text-sk-text-2 hover:text-sk-text-1")}>{t.label}</button>
            ))}
          </div>

          {/* ══════ TAB: Templates ══════ */}
          {activeTab === "templates" && firstClubId && (
            <TemplatesTab clubId={firstClubId} leagueOptions={leagueOptions} onTournamentsChanged={refresh} />
          )}

          {/* ══════ TAB: Stats ══════ */}
          {activeTab === "stats" && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Estadísticas</h2>
                <InfoTooltip title={ADMIN_HELP.stats.title} content={ADMIN_HELP.stats.content} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Torneos" value={String(tournaments?.length ?? 0)} accent="accent" />
                <StatCard label="Próximos" value={String(upcomingCount)} accent="green" />
                <StatCard label="Completados" value={String(completedCount)} />
                <StatCard label="Ligas" value={String(leagues?.length ?? 0)} accent="gold" />
              </div>
            </div>
          )}

          {/* ══════ TAB: Tournaments ══════ */}
          {activeTab === "tournaments" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sk-md font-bold text-sk-text-1">Torneos</h2>
                  <InfoTooltip title={ADMIN_HELP.tournaments.title} content={ADMIN_HELP.tournaments.content} />
                </div>
                <Button variant="accent" size="sm" onClick={() => setEditTournament(null)}><Plus size={14} /> Crear Torneo</Button>
              </div>

              {scheduledTournaments.length > 0 && (
                <div className="mb-4">
                  <BulkDeleteBar
                    selectedIds={selectedTournamentIds}
                    totalScheduled={scheduledTournaments.length}
                    onSelectAll={selectAllScheduled}
                    onDeselectAll={deselectAllTournaments}
                    onDeleted={() => { deselectAllTournaments(); refresh(); }}
                  />
                </div>
              )}

              {!(tournaments ?? []).length ? (
                <EmptyState icon="📅" title="Sin torneos" action={<Button variant="accent" size="sm" onClick={() => setEditTournament(null)}>Crear Torneo</Button>} />
              ) : (
                <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sk-sm">
                    <thead><tr>
                      {["", "Torneo", "Fecha", "Buy-in", "GTD", "Estado", "Resultados", ""].map((h, i) => (
                        <th key={i} className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(tournaments ?? []).map((t) => {
                        const isScheduled = t.status === "scheduled" && !t.results_uploaded;
                        const isSelected = selectedTournamentIds.includes(t.id);
                        return (
                          <tr key={t.id} className={`hover:bg-white/[0.02] ${isSelected ? "bg-sk-red-dim/30" : ""}`}>
                            <td className="py-3 px-3 border-b border-sk-border-2 w-8">
                              {isScheduled ? (
                                <button onClick={() => toggleTournamentSelection(t.id)} className="text-sk-text-3 hover:text-sk-text-1">
                                  {isSelected ? (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="3" fill="#22d3ee" stroke="#22d3ee" strokeWidth="1"/><path d="M4.5 8L7 10.5L11.5 5.5" stroke="#09090b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.4"/></svg>
                                  )}
                                </button>
                              ) : <span className="w-4 h-4 block" />}
                            </td>
                            <td className="py-3 px-4 border-b border-sk-border-2"><span className="font-semibold text-sk-text-1">{t.name}</span>{t.leagues && <span className="block text-[10px] text-sk-text-2">{t.leagues.name}</span>}</td>
                            <td className="py-3 px-4 border-b border-sk-border-2 font-mono text-sk-xs text-sk-text-2">{new Date(t.start_datetime).toLocaleDateString("es-CL")}</td>
                            <td className="py-3 px-4 border-b border-sk-border-2 font-mono text-sk-text-1">{formatCurrency(t.buy_in)}</td>
                            <td className="py-3 px-4 border-b border-sk-border-2 font-mono text-sk-gold font-bold">{t.guaranteed_prize ? formatCurrency(t.guaranteed_prize) : "—"}</td>
                            <td className="py-3 px-4 border-b border-sk-border-2"><Badge variant={t.status === "completed" ? "muted" : t.status === "live" ? "live" : "accent"}>{t.status}</Badge></td>
                            <td className="py-3 px-4 border-b border-sk-border-2">{t.results_uploaded ? <Button variant="secondary" size="xs" onClick={() => setEditResultsTournament(t)}>Ver / Editar</Button> : <Button variant="accent" size="xs" onClick={() => setUploadTournament(t)}>Subir</Button>}</td>
                            <td className="py-3 px-4 border-b border-sk-border-2">
                              <div className="flex gap-1">
                                <button onClick={() => setEditTournament(t as Tournament)} className="text-sk-text-2 hover:text-sk-accent p-1"><Pencil size={13} /></button>
                                <button onClick={() => handleDeleteTournament(t)} disabled={deleting === t.id} className="text-sk-text-2 hover:text-sk-red p-1"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB: Players ══════ */}
          {activeTab === "players" && firstClubId && (
            <ClubPlayersTab clubId={firstClubId} />
          )}

          {/* ══════ TAB: Leagues ══════ */}
          {activeTab === "leagues" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sk-md font-bold text-sk-text-1">Ligas</h2>
                  <InfoTooltip title={ADMIN_HELP.leagues.title} content={ADMIN_HELP.leagues.content} />
                </div>
                <Button variant="accent" size="sm" onClick={() => setEditLeague(null)}><Plus size={14} /> Crear Liga</Button>
              </div>
              {!(leagues ?? []).length ? (
                <EmptyState icon="🏆" title="Sin ligas" action={<Button variant="accent" size="sm" onClick={() => setEditLeague(null)}>Crear Liga</Button>} />
              ) : (
                <div className="space-y-3">
                  {(leagues ?? []).map((l) => (
                    <div key={l.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sk-text-1">{l.name}</p>
                        <p className="text-sk-xs text-sk-text-2">
                          {l.start_date && l.end_date ? `${l.start_date} — ${l.end_date}` : "Fechas por definir"} · <Badge variant={l.status === "active" ? "green" : l.status === "finished" ? "muted" : "accent"}>{l.status}</Badge>
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditLeague(l)} className="text-sk-text-2 hover:text-sk-accent p-1"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteLeague(l)} className="text-sk-text-2 hover:text-sk-red p-1"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB: Info ══════ */}
          {activeTab === "info" && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-sk-md font-bold text-sk-text-1">Información del Club</h3>
                  <InfoTooltip title={ADMIN_HELP.info.title} content={ADMIN_HELP.info.content} />
                </div>
                {!editingInfo && (
                  <Button variant="ghost" size="sm" onClick={startEditingInfo}>
                    <Pencil size={14} /> Editar
                  </Button>
                )}
              </div>

              {editingInfo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3 mb-1 block">Nombre {isSuperAdmin ? "" : "(no editable)"}</label>
                      <div className="bg-sk-bg-3 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-2">{club?.name}</div>
                    </div>
                    <div>
                      <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3 mb-1 block">País {isSuperAdmin ? "" : "(no editable)"}</label>
                      <div className="bg-sk-bg-3 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-2">{club?.country_code ?? "—"}</div>
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">Descripción</label>
                    <textarea value={infoForm.description} onChange={(e) => setInfoForm({ ...infoForm, description: e.target.value })} placeholder="Describe tu club..." className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent min-h-[80px] resize-y" />
                  </div>
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-accent mb-3">Datos de contacto</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">📧 Email</label>
                        <input type="email" value={infoForm.email} onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })} placeholder="contacto@miclub.com" className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent" />
                      </div>
                      <div>
                        <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">📱 WhatsApp</label>
                        <input type="tel" value={infoForm.whatsapp} onChange={(e) => setInfoForm({ ...infoForm, whatsapp: e.target.value })} placeholder="+56 9 1234 5678" className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-accent mb-3">Redes y enlaces</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">🌐 Sitio Web</label>
                        <input type="url" value={infoForm.website_url} onChange={(e) => setInfoForm({ ...infoForm, website_url: e.target.value })} placeholder="https://miclub.com" className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent" />
                      </div>
                      <div>
                        <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">💬 Discord</label>
                        <input type="url" value={infoForm.discord_url} onChange={(e) => setInfoForm({ ...infoForm, discord_url: e.target.value })} placeholder="https://discord.gg/..." className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent" />
                      </div>
                      <div>
                        <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">✈️ Telegram</label>
                        <input type="url" value={infoForm.telegram_url} onChange={(e) => setInfoForm({ ...infoForm, telegram_url: e.target.value })} placeholder="https://t.me/..." className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent" />
                      </div>
                      <div>
                        <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">📸 Instagram</label>
                        <input type="url" value={infoForm.instagram_url} onChange={(e) => setInfoForm({ ...infoForm, instagram_url: e.target.value })} placeholder="https://instagram.com/..." className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="accent" size="sm" onClick={handleSaveInfo} isLoading={savingInfo}><Save size={14} /> Guardar</Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingInfo(false)}>Cancelar</Button>
                  </div>
                  <p className="text-sk-xs text-sk-text-3">
                    {isSuperAdmin ? "Como super admin puedes editar todos los campos." : "Para cambiar el nombre o país del club, contacta al super admin."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-sk-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <p><span className="text-sk-text-3">Nombre:</span> <span className="text-sk-text-1 font-semibold">{club?.name}</span></p>
                    <p><span className="text-sk-text-3">País:</span> <span className="text-sk-text-1 font-semibold">{club?.country_code ?? "No definido"}</span></p>
                  </div>
                  <div>
                    <span className="text-sk-text-3">Descripción:</span>
                    <p className="text-sk-text-1 mt-1">{club?.description ?? "Sin descripción"}</p>
                  </div>
                  <div className="h-px bg-sk-border-2 my-2" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <p><span className="text-sk-text-3">📧 Email:</span> <span className="text-sk-text-1">{club?.email ?? "—"}</span></p>
                    <p><span className="text-sk-text-3">📱 WhatsApp:</span> <span className="text-sk-text-1">{club?.whatsapp ?? "—"}</span></p>
                    <p><span className="text-sk-text-3">🌐 Web:</span> {club?.website_url ? <a href={club.website_url} target="_blank" rel="noopener noreferrer" className="text-sk-accent hover:opacity-80">{club.website_url}</a> : <span className="text-sk-text-1">—</span>}</p>
                    <p><span className="text-sk-text-3">💬 Discord:</span> {club?.discord_url ? <a href={club.discord_url} target="_blank" rel="noopener noreferrer" className="text-sk-accent hover:opacity-80">Enlace</a> : <span className="text-sk-text-1">—</span>}</p>
                    <p><span className="text-sk-text-3">✈️ Telegram:</span> {club?.telegram_url ? <a href={club.telegram_url} target="_blank" rel="noopener noreferrer" className="text-sk-accent hover:opacity-80">Enlace</a> : <span className="text-sk-text-1">—</span>}</p>
                    <p><span className="text-sk-text-3">📸 Instagram:</span> {club?.instagram_url ? <a href={club.instagram_url} target="_blank" rel="noopener noreferrer" className="text-sk-accent hover:opacity-80">Enlace</a> : <span className="text-sk-text-1">—</span>}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editTournament !== undefined && <TournamentForm isOpen onClose={() => setEditTournament(undefined)} onSaved={refresh} clubId={firstClubId!} tournament={editTournament} leagueOptions={leagueOptions} />}
      {editLeague !== undefined && <LeagueForm isOpen onClose={() => setEditLeague(undefined)} onSaved={refresh} clubId={firstClubId!} league={editLeague} />}
      {uploadTournament && <ResultsUpload tournament={uploadTournament} isOpen={!!uploadTournament} onClose={() => setUploadTournament(null)} onComplete={refresh} />}
      {editResultsTournament && <ResultsEditor tournament={editResultsTournament} isOpen={!!editResultsTournament} onClose={() => setEditResultsTournament(null)} onComplete={refresh} />}
    </PageShell>
  );
}
