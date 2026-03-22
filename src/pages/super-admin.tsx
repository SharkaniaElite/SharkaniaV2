// src/pages/super-admin.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { StatCard } from "../components/ui/stat-card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import { EntityForm, deleteEntity } from "../components/admin/entity-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { FlagIcon } from "../components/ui/flag-icon";
import {
  Check,
  X as XIcon,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  Settings,
  Users,
  Trophy,
  Building2,
  AlertCircle,
} from "lucide-react";
import { SEOHead } from "../components/seo/seo-head";

type AdminTab = "overview" | "requests" | "rooms" | "scoring";

export function SuperAdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [entityForm, setEntityForm] = useState<{
    table: string;
    title: string;
    fields: Array<{
      key: string;
      label: string;
      type: "text" | "number" | "select" | "textarea" | "checkbox";
      required?: boolean;
      options?: Array<{ value: string; label: string }>;
      placeholder?: string;
    }>;
    data: Record<string, unknown> | null;
  } | null>(null);
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries();

  // ── Queries ──

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [players, clubs, tournaments, leagues, pendingClubs, pendingClaims] = await Promise.all([
        supabase.from("players").select("*", { count: "exact", head: true }),
        supabase.from("clubs").select("*", { count: "exact", head: true }),
        supabase.from("tournaments").select("*", { count: "exact", head: true }),
        supabase.from("leagues").select("*", { count: "exact", head: true }),
        supabase.from("club_registration_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("nickname_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        players: players.count ?? 0,
        clubs: clubs.count ?? 0,
        tournaments: tournaments.count ?? 0,
        leagues: leagues.count ?? 0,
        pendingClubs: pendingClubs.count ?? 0,
        pendingClaims: pendingClaims.count ?? 0,
      };
    },
  });

  const { data: allClubs } = useQuery({
    queryKey: ["admin-all-clubs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clubs")
        .select("id, name, country_code, is_approved, is_demo, created_by")
        .order("name");
      return data ?? [];
    },
    enabled: tab === "overview",
  });

  const { data: clubRequests } = useQuery({
    queryKey: ["admin-club-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("club_registration_requests")
        .select("*, profiles(display_name, email, whatsapp, country_code)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: tab === "requests",
  });

  const { data: nicknameClaims } = useQuery({
    queryKey: ["admin-nickname-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nickname_claims")
        .select("*, profiles:user_id (display_name, email, whatsapp), players:player_id (nickname)")
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  // ── Actions ──

  const handleApproveClub = async (req: {
    id: string;
    user_id: string;
    club_name: string;
    country_code?: string;
    description?: string;
  }) => {
    const { data: club } = await supabase
      .from("clubs")
      .insert({
        name: req.club_name,
        country_code: req.country_code,
        description: req.description,
        is_approved: true,
        created_by: req.user_id,
      })
      .select()
      .single();
    if (!club) return;
    await supabase.from("club_admins").insert({ club_id: club.id, user_id: req.user_id, role: "owner" });
    await supabase.from("profiles").update({ role: "club_admin" }).eq("id", req.user_id);
    await supabase
      .from("club_registration_requests")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", req.id);
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

  // ── Field definitions ──

  const roomFields = [
    { key: "name", label: "Nombre", type: "text" as const, required: true },
    { key: "website_url", label: "Website", type: "text" as const, placeholder: "https://..." },
  ];

  const scoringFields = [
    { key: "name", label: "Nombre", type: "text" as const, required: true },
    { key: "description", label: "Descripción", type: "textarea" as const },
    {
      key: "type",
      label: "Tipo",
      type: "select" as const,
      options: [
        { value: "simple", label: "Simple" },
        { value: "complex", label: "Complex" },
      ],
    },
  ];

  const pendingTotal = (stats?.pendingClubs ?? 0) + (stats?.pendingClaims ?? 0);

  const TABS: { key: AdminTab; label: string; badge?: number }[] = [
    { key: "overview", label: "General" },
    { key: "requests", label: "Solicitudes", badge: pendingTotal > 0 ? pendingTotal : undefined },
    { key: "rooms", label: "Salas" },
    { key: "scoring", label: "Scoring" },
  ];

  return (
    <PageShell>
      <SEOHead title="Super Admin" path="/admin" noIndex={true} />
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-red mb-3">
              Super Admin
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1">
              ⚡ Panel de Administración
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "text-sk-sm font-medium px-4 py-2 rounded-sm whitespace-nowrap transition-all duration-100 relative",
                  tab === t.key
                    ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                    : "text-sk-text-2 hover:text-sk-text-1"
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

          {/* ══════════════════════════════════════════════════ */}
          {/* TAB: Overview                                     */}
          {/* ══════════════════════════════════════════════════ */}
          {tab === "overview" && (
            <div className="space-y-8">
              {/* Global stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jugadores" value={formatNumber(stats?.players ?? 0)} accent="accent" />
                <StatCard label="Clubes" value={formatNumber(stats?.clubs ?? 0)} accent="green" />
                <StatCard label="Torneos" value={formatNumber(stats?.tournaments ?? 0)} accent="gold" />
                <StatCard label="Ligas" value={formatNumber(stats?.leagues ?? 0)} />
              </div>

              {/* Pending alerts */}
              {pendingTotal > 0 && (
                <div className="bg-sk-gold-dim border border-sk-gold/20 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle size={18} className="text-sk-gold shrink-0" />
                  <div className="flex-1">
                    <p className="text-sk-sm font-semibold text-sk-gold">
                      {pendingTotal} solicitud(es) pendiente(s)
                    </p>
                    <p className="text-sk-xs text-sk-text-3">
                      {stats?.pendingClubs ? `${stats.pendingClubs} club(es)` : ""}
                      {stats?.pendingClubs && stats?.pendingClaims ? " · " : ""}
                      {stats?.pendingClaims ? `${stats.pendingClaims} nickname claim(s)` : ""}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setTab("requests")}>
                    Ver solicitudes
                  </Button>
                </div>
              )}

              {/* Clubs quick list with "Gestionar" button */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sk-md font-bold text-sk-text-1">
                    Clubes ({allClubs?.length ?? 0})
                  </h2>
                </div>

                <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sk-sm">
                    <thead>
                      <tr>
                        {["Club", "País", "Estado", ""].map((h, i) => (
                          <th
                            key={i}
                            className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(allClubs ?? []).map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 border-b border-sk-border-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sk-text-1">{c.name}</span>
                              {c.is_demo && (
                                <Badge variant="muted">Demo</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 border-b border-sk-border-2">
                            <span className="inline-flex items-center gap-1.5">
                              <FlagIcon countryCode={c.country_code} /> {c.country_code ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 px-4 border-b border-sk-border-2">
                            <Badge variant={c.is_approved ? "green" : "orange"}>
                              {c.is_approved ? "Aprobado" : "Pendiente"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 border-b border-sk-border-2">
                            <Link
                              to="/admin/club"
                              className="inline-flex items-center gap-1.5 text-sk-xs font-semibold text-sk-accent hover:underline"
                            >
                              <Settings size={12} /> Gestionar
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-sk-text-4 mt-2">
                  Para gestionar un club (torneos, plantillas, resultados, ligas, jugadores), usa el{" "}
                  <Link to="/admin/club" className="text-sk-accent hover:underline">
                    Panel de Club Admin
                  </Link>{" "}
                  — ahí puedes seleccionar cualquier club desde el dropdown.
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* TAB: Requests                                     */}
          {/* ══════════════════════════════════════════════════ */}
          {tab === "requests" && (
            <div className="space-y-8">
              {/* Club registration requests */}
              <div>
                <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
                  Solicitudes de Club ({clubRequests?.length || 0})
                </h2>
                {(clubRequests ?? []).length === 0 ? (
                  <EmptyState icon="📋" title="Sin solicitudes de club" />
                ) : (
                  <div className="space-y-3">
                    {clubRequests?.map((req) => (
                      <div key={req.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sk-md font-bold text-sk-text-1">{req.club_name}</p>
                            <p className="text-sk-xs text-sk-text-3">
                              Solicitante: {req.profiles?.display_name}
                              {req.profiles?.email && (
                                <span className="ml-2 text-sk-text-4">({req.profiles.email})</span>
                              )}
                            </p>
                            {req.profiles?.whatsapp && (
                              <a
                                href={`https://wa.me/${req.profiles.whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sk-xs text-sk-green hover:underline"
                              >
                                WhatsApp: +{req.profiles.whatsapp}
                              </a>
                            )}
                            {req.description && (
                              <p className="text-sk-xs text-sk-text-2 mt-1">{req.description}</p>
                            )}
                            {req.country_code && (
                              <span className="inline-flex items-center gap-1 mt-1 text-sk-xs text-sk-text-3">
                                <FlagIcon countryCode={req.country_code} /> {req.country_code}
                              </span>
                            )}
                          </div>
                          <Badge variant={req.status === "pending" ? "orange" : req.status === "approved" ? "green" : "muted"}>
                            {req.status}
                          </Badge>
                        </div>
                        {req.status === "pending" && (
                          <div className="flex gap-2 pt-3 border-t border-sk-border-2">
                            <Button variant="accent" size="sm" onClick={() => handleApproveClub(req)}>
                              <Check size={13} /> Aprobar Club
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRejectRequest(req.id, "club_registration_requests")}
                            >
                              <XIcon size={13} /> Rechazar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nickname claims */}
              <div>
                <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
                  Claims de Nickname ({nicknameClaims?.length || 0})
                </h2>
                {(nicknameClaims ?? []).length === 0 ? (
                  <EmptyState icon="🏷️" title="Sin claims pendientes" />
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {nicknameClaims?.map((claim) => (
                      <div key={claim.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-5">
                        <div className="flex flex-col md:flex-row gap-5">
                          {/* Screenshot */}
                          <div className="shrink-0">
                            <p className="text-[10px] font-mono uppercase text-sk-text-3 mb-2">
                              Prueba (Screenshot)
                            </p>
                            <a
                              href={claim.screenshot_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block group relative w-32 h-32 md:w-40 md:h-40 bg-sk-bg-3 border border-sk-border-2 rounded-md overflow-hidden"
                            >
                              {claim.screenshot_url ? (
                                <>
                                  <img
                                    src={claim.screenshot_url}
                                    alt="Validación"
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">Ver en grande</span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-center h-full text-sk-text-3 italic text-xs">
                                  Sin imagen
                                </div>
                              )}
                            </a>
                          </div>

                          {/* Data */}
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sk-lg font-bold text-sk-text-1">
                                  {claim.players?.nickname}
                                </h3>
                                <Badge
                                  variant={
                                    claim.status === "pending"
                                      ? "orange"
                                      : claim.status === "approved"
                                      ? "green"
                                      : "muted"
                                  }
                                >
                                  {claim.status}
                                </Badge>
                              </div>

                              <div className="space-y-1.5">
                                <p className="text-sk-sm text-sk-text-2">
                                  <span className="text-sk-text-3 font-mono text-[10px] uppercase">
                                    Usuario:
                                  </span>{" "}
                                  {claim.profiles?.display_name}
                                </p>
                                <p className="text-sk-sm text-sk-text-2">
                                  <span className="text-sk-text-3 font-mono text-[10px] uppercase">
                                    Email:
                                  </span>{" "}
                                  {claim.profiles?.email}
                                </p>
                                <p className="text-sk-sm text-sk-text-2 flex items-center gap-2">
                                  <span className="text-sk-text-3 font-mono text-[10px] uppercase">
                                    WhatsApp:
                                  </span>
                                  {claim.profiles?.whatsapp ? (
                                    <a
                                      href={`https://wa.me/${claim.profiles.whatsapp.replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sk-green hover:underline"
                                    >
                                      +{claim.profiles.whatsapp}
                                    </a>
                                  ) : (
                                    <span className="text-sk-text-3 italic">No registrado</span>
                                  )}
                                </p>
                                <p className="text-xs text-sk-text-3 pt-1">
                                  ID: <span className="font-mono">{claim.id.split("-")[0]}</span>
                                </p>
                              </div>
                            </div>

                            {claim.status === "pending" && (
                              <div className="flex gap-2 mt-4">
                                <Button
                                  variant="accent"
                                  className="flex-1"
                                  onClick={async () => {
                                    const { error: linkError } = await supabase
                                      .from("players")
                                      .update({ profile_id: claim.user_id })
                                      .eq("id", claim.player_id);
                                    if (linkError) return alert("Error vinculando: " + linkError.message);
                                    await supabase
                                      .from("nickname_claims")
                                      .update({
                                        status: "approved",
                                        resolved_at: new Date().toISOString(),
                                      })
                                      .eq("id", claim.id);
                                    refresh();
                                  }}
                                >
                                  <Check size={14} /> Aprobar y Vincular
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => handleRejectRequest(claim.id, "nickname_claims")}
                                >
                                  <XIcon size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* TAB: Rooms                                        */}
          {/* ══════════════════════════════════════════════════ */}
          {tab === "rooms" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Salas ({rooms?.length})</h2>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() =>
                    setEntityForm({
                      table: "poker_rooms",
                      title: "Sala",
                      fields: roomFields,
                      data: null,
                    })
                  }
                >
                  <Plus size={14} /> Crear
                </Button>
              </div>
              <AdminTable
                headers={["Sala", "Website"]}
                rows={(rooms ?? []).map((r) => ({
                  id: r.id,
                  cells: [
                    <span className="font-semibold text-sk-text-1">{r.name}</span>,
                    r.website_url ? (
                      <a
                        href={r.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sk-accent text-sk-xs hover:underline inline-flex items-center gap-1"
                      >
                        {r.website_url} <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-sk-text-3 text-sk-xs">—</span>
                    ),
                  ],
                  onEdit: () =>
                    setEntityForm({
                      table: "poker_rooms",
                      title: "Sala",
                      fields: roomFields,
                      data: r,
                    }),
                  onDelete: () => handleDeleteEntity("poker_rooms", r.id, r.name),
                }))}
              />
            </div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* TAB: Scoring                                      */}
          {/* ══════════════════════════════════════════════════ */}
          {tab === "scoring" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">
                  Scoring Systems ({scoringSystems?.length})
                </h2>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() =>
                    setEntityForm({
                      table: "scoring_systems",
                      title: "Scoring System",
                      fields: scoringFields,
                      data: null,
                    })
                  }
                >
                  <Plus size={14} /> Crear
                </Button>
              </div>
              <AdminTable
                headers={["Nombre", "Tipo", "Descripción"]}
                rows={(scoringSystems ?? []).map((s) => ({
                  id: s.id,
                  cells: [
                    <span className="font-semibold text-sk-text-1">{s.name}</span>,
                    <Badge variant="accent">{s.type}</Badge>,
                    <span className="text-sk-text-2 text-sk-xs line-clamp-1">
                      {s.description ?? "—"}
                    </span>,
                  ],
                  onEdit: () =>
                    setEntityForm({
                      table: "scoring_systems",
                      title: "Scoring System",
                      fields: scoringFields,
                      data: s,
                    }),
                  onDelete: () => handleDeleteEntity("scoring_systems", s.id, s.name),
                }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Entity Form Modal */}
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

// ── Reusable Admin Table ──

function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<{
    id: string;
    cells: React.ReactNode[];
    onEdit?: () => void;
    onDelete?: () => void;
  }>;
}) {
  return (
    <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
      <table className="w-full border-collapse text-sk-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left whitespace-nowrap"
              >
                {h}
              </th>
            ))}
            <th className="bg-sk-bg-3 py-3 px-4 border-b border-sk-border-2 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
              {row.cells.map((cell, i) => (
                <td key={i} className="py-3 px-4 border-b border-sk-border-2">
                  {cell}
                </td>
              ))}
              <td className="py-3 px-4 border-b border-sk-border-2">
                <div className="flex gap-1">
                  {row.onEdit && (
                    <button
                      onClick={row.onEdit}
                      className="text-sk-text-2 hover:text-sk-accent transition-colors p-1"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {row.onDelete && (
                    <button
                      onClick={row.onDelete}
                      className="text-sk-text-2 hover:text-sk-red transition-colors p-1"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
