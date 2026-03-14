// src/pages/super-admin.tsx
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { StatCard } from "../components/ui/stat-card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { EntityForm, deleteEntity } from "../components/admin/entity-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { calculateElo, reverseElo } from "../lib/api/elo-engine";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { getFlag } from "../lib/countries";
import { Check, X as XIcon, Plus, Trash2, Pencil, RefreshCw } from "lucide-react";

type AdminTab = "overview" | "clubs" | "players" | "tournaments" | "requests" | "rooms" | "scoring";

export function SuperAdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [entityForm, setEntityForm] = useState<{ table: string; title: string; fields: Array<{ key: string; label: string; type: "text" | "number" | "select" | "textarea" | "checkbox"; required?: boolean; options?: Array<{ value: string; label: string }>; placeholder?: string }>; data: Record<string, unknown> | null } | null>(null);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries();

  // Queries
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [players, clubs, tournaments, leagues] = await Promise.all([
        supabase.from("players").select("*", { count: "exact", head: true }),
        supabase.from("clubs").select("*", { count: "exact", head: true }),
        supabase.from("tournaments").select("*", { count: "exact", head: true }),
        supabase.from("leagues").select("*", { count: "exact", head: true }),
      ]);
      return { players: players.count ?? 0, clubs: clubs.count ?? 0, tournaments: tournaments.count ?? 0, leagues: leagues.count ?? 0 };
    },
  });

  const { data: clubs } = useQuery({
    queryKey: ["admin-clubs"],
    queryFn: async () => { const { data } = await supabase.from("clubs").select("*").order("created_at", { ascending: false }); return data ?? []; },
    enabled: tab === "clubs" || tab === "overview",
  });

  const { data: players } = useQuery({
    queryKey: ["admin-players"],
    queryFn: async () => { const { data } = await supabase.from("players").select("*, poker_rooms(name)").order("elo_rating", { ascending: false }).limit(50); return data ?? []; },
    enabled: tab === "players",
  });

  const { data: tournaments } = useQuery({
    queryKey: ["admin-tournaments"],
    queryFn: async () => { const { data } = await supabase.from("tournaments").select("*, clubs(name)").order("start_datetime", { ascending: false }).limit(50); return data ?? []; },
    enabled: tab === "tournaments",
  });

  const { data: clubRequests } = useQuery({
    queryKey: ["admin-club-requests"],
    queryFn: async () => { const { data } = await supabase.from("club_registration_requests").select("*, profiles(display_name, email)").order("created_at", { ascending: false }); return data ?? []; },
    enabled: tab === "requests",
  });

  const { data: nicknameClaims } = useQuery({
    queryKey: ["admin-nickname-claims"],
    queryFn: async () => { const { data } = await supabase.from("nickname_claims").select("*, profiles(display_name), players(nickname)").order("created_at", { ascending: false }); return data ?? []; },
    enabled: tab === "requests",
  });

  const { data: rooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => { const { data } = await supabase.from("poker_rooms").select("*").order("name"); return data ?? []; },
    enabled: tab === "rooms",
  });

  const { data: scoringSystems } = useQuery({
    queryKey: ["admin-scoring"],
    queryFn: async () => { const { data } = await supabase.from("scoring_systems").select("*").order("name"); return data ?? []; },
    enabled: tab === "scoring",
  });

  // Actions
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

  const handleRecalcElo = async (tournamentId: string) => {
    setRecalculating(tournamentId);
    await reverseElo(tournamentId);
    await calculateElo(tournamentId);
    setRecalculating(null);
    refresh();
  };

  const handleDeleteEntity = async (table: string, id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    if (table === "tournaments") {
      await reverseElo(id);
    }
    await deleteEntity(table, id);
    refresh();
  };

  // Field definitions for entity forms
  const roomFields = [
    { key: "name", label: "Nombre", type: "text" as const, required: true },
    { key: "website_url", label: "Website", type: "text" as const, placeholder: "https://..." },
  ];

  const clubFields = [
    { key: "name", label: "Nombre", type: "text" as const, required: true },
    { key: "country_code", label: "País (2 letras)", type: "text" as const },
    { key: "description", label: "Descripción", type: "textarea" as const },
    { key: "is_approved", label: "Aprobado", type: "checkbox" as const },
  ];

  const scoringFields = [
    { key: "name", label: "Nombre", type: "text" as const, required: true },
    { key: "description", label: "Descripción", type: "textarea" as const },
    { key: "type", label: "Tipo", type: "select" as const, options: [{ value: "simple", label: "Simple" }, { value: "complex", label: "Complex" }] },
  ];

  const TABS: { key: AdminTab; label: string }[] = [
    { key: "overview", label: "General" },
    { key: "clubs", label: "Clubes" },
    { key: "players", label: "Jugadores" },
    { key: "tournaments", label: "Torneos" },
    { key: "requests", label: "Solicitudes" },
    { key: "rooms", label: "Salas" },
    { key: "scoring", label: "Scoring" },
  ];

  return (
    <PageShell>
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-red mb-3">Super Admin</p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1">⚡ Panel de Administración</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2 mb-6 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={cn("text-sk-sm font-medium px-4 py-2 rounded-sm whitespace-nowrap transition-all duration-100", tab === t.key ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs" : "text-sk-text-2 hover:text-sk-text-1")}>{t.label}</button>
            ))}
          </div>

          {/* Overview */}
          {tab === "overview" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Jugadores" value={formatNumber(stats?.players ?? 0)} accent="accent" />
              <StatCard label="Clubes" value={formatNumber(stats?.clubs ?? 0)} accent="green" />
              <StatCard label="Torneos" value={formatNumber(stats?.tournaments ?? 0)} accent="gold" />
              <StatCard label="Ligas" value={formatNumber(stats?.leagues ?? 0)} />
            </div>
          )}

          {/* Clubs */}
          {tab === "clubs" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Clubes ({clubs?.length})</h2>
                <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "clubs", title: "Club", fields: clubFields, data: null })}><Plus size={14} /> Crear</Button>
              </div>
              <AdminTable
                headers={["Club", "País", "Aprobado", ""]}
                rows={(clubs ?? []).map((c) => ({
                  id: c.id,
                  cells: [
                    <span className="font-semibold text-sk-text-1">{c.name}</span>,
                    <span>{getFlag(c.country_code)} {c.country_code}</span>,
                    <Badge variant={c.is_approved ? "green" : "orange"}>{c.is_approved ? "Sí" : "No"}</Badge>,
                  ],
                  onEdit: () => setEntityForm({ table: "clubs", title: "Club", fields: clubFields, data: c }),
                  onDelete: () => handleDeleteEntity("clubs", c.id, c.name),
                }))}
              />
            </div>
          )}

          {/* Players */}
          {tab === "players" && (
            <AdminTable
              headers={["Jugador", "Sala", "País", "ELO", "Torneos"]}
              rows={(players ?? []).map((p) => ({
                id: p.id,
                cells: [
                  <span className="font-semibold text-sk-text-1">{p.nickname}</span>,
                  <span className="text-sk-text-2">{p.poker_rooms?.name}</span>,
                  <span>{getFlag(p.country_code)}</span>,
                  <span className="font-mono font-bold text-sk-accent">{Math.round(p.elo_rating)}</span>,
                  <span className="font-mono text-sk-text-1">{p.total_tournaments}</span>,
                ],
                onDelete: () => handleDeleteEntity("players", p.id, p.nickname),
              }))}
            />
          )}

          {/* Tournaments */}
          {tab === "tournaments" && (
            <AdminTable
              headers={["Torneo", "Club", "Estado", "Resultados", "ELO"]}
              rows={(tournaments ?? []).map((t) => ({
                id: t.id,
                cells: [
                  <span className="font-semibold text-sk-text-1">{t.name}</span>,
                  <span className="text-sk-text-2">{t.clubs?.name}</span>,
                  <Badge variant={t.status === "completed" ? "muted" : t.status === "live" ? "live" : "accent"}>{t.status}</Badge>,
                  <Badge variant={t.results_uploaded ? "green" : "orange"}>{t.results_uploaded ? "Sí" : "No"}</Badge>,
                  t.results_uploaded ? (
                    <Button variant="ghost" size="xs" onClick={() => handleRecalcElo(t.id)} isLoading={recalculating === t.id}>
                      <RefreshCw size={12} /> Recalcular
                    </Button>
                  ) : <span className="text-sk-text-3">—</span>,
                ],
                onDelete: () => handleDeleteEntity("tournaments", t.id, t.name),
              }))}
            />
          )}

          {/* Requests */}
          {tab === "requests" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">Solicitudes de Club ({clubRequests?.length})</h2>
                {(clubRequests ?? []).length === 0 ? (
                  <p className="text-sk-text-2 text-sk-sm">Sin solicitudes</p>
                ) : (
                  <div className="space-y-2">
                    {(clubRequests ?? []).map((req) => (
                      <div key={req.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sk-text-1 font-semibold">{req.club_name}</p>
                          <p className="text-sk-xs text-sk-text-2 truncate">Por: {req.profiles?.display_name ?? req.profiles?.email} · {new Date(req.created_at).toLocaleDateString("es-CL")}</p>
                          {req.description && <p className="text-sk-xs text-sk-text-2 mt-1 line-clamp-1">{req.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={req.status === "pending" ? "orange" : req.status === "approved" ? "green" : "red"}>{req.status}</Badge>
                          {req.status === "pending" && (
                            <>
                              <Button variant="accent" size="xs" onClick={() => handleApproveClub(req)}><Check size={12} /></Button>
                              <Button variant="danger" size="xs" onClick={() => handleRejectRequest(req.id, "club_registration_requests")}><XIcon size={12} /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">Claims de Nickname ({nicknameClaims?.length})</h2>
                {(nicknameClaims ?? []).length === 0 ? (
                  <p className="text-sk-text-2 text-sk-sm">Sin claims</p>
                ) : (
                  <div className="space-y-2">
                    {(nicknameClaims ?? []).map((claim) => (
                      <div key={claim.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sk-text-1 font-semibold">{claim.players?.nickname}</p>
                          <p className="text-sk-xs text-sk-text-2">Por: {claim.profiles?.display_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={claim.status === "pending" ? "orange" : claim.status === "approved" ? "green" : "red"}>{claim.status}</Badge>
                          {claim.status === "pending" && (
                            <>
                              <Button variant="accent" size="xs" onClick={async () => { await supabase.from("nickname_claims").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", claim.id); refresh(); }}><Check size={12} /></Button>
                              <Button variant="danger" size="xs" onClick={() => handleRejectRequest(claim.id, "nickname_claims")}><XIcon size={12} /></Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rooms */}
          {tab === "rooms" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Salas ({rooms?.length})</h2>
                <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "poker_rooms", title: "Sala", fields: roomFields, data: null })}><Plus size={14} /> Crear</Button>
              </div>
              <AdminTable
                headers={["Sala", "Website", ""]}
                rows={(rooms ?? []).map((r) => ({
                  id: r.id,
                  cells: [
                    <span className="font-semibold text-sk-text-1">{r.name}</span>,
                    <span className="text-sk-text-2 text-sk-xs">{r.website_url ?? "—"}</span>,
                  ],
                  onEdit: () => setEntityForm({ table: "poker_rooms", title: "Sala", fields: roomFields, data: r }),
                  onDelete: () => handleDeleteEntity("poker_rooms", r.id, r.name),
                }))}
              />
            </div>
          )}

          {/* Scoring */}
          {tab === "scoring" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">Scoring Systems ({scoringSystems?.length})</h2>
                <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "scoring_systems", title: "Scoring System", fields: scoringFields, data: null })}><Plus size={14} /> Crear</Button>
              </div>
              <AdminTable
                headers={["Nombre", "Tipo", "Descripción", ""]}
                rows={(scoringSystems ?? []).map((s) => ({
                  id: s.id,
                  cells: [
                    <span className="font-semibold text-sk-text-1">{s.name}</span>,
                    <Badge variant="accent">{s.type}</Badge>,
                    <span className="text-sk-text-2 text-sk-xs line-clamp-1">{s.description ?? "—"}</span>,
                  ],
                  onEdit: () => setEntityForm({ table: "scoring_systems", title: "Scoring System", fields: scoringFields, data: s }),
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
            {headers.map((h) => (
              <th key={h} className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 text-left whitespace-nowrap">{h}</th>
            ))}
            <th className="bg-sk-bg-3 py-3 px-4 border-b border-sk-border-2 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
              {row.cells.map((cell, i) => (
                <td key={i} className="py-3 px-4 border-b border-sk-border-2">{cell}</td>
              ))}
              <td className="py-3 px-4 border-b border-sk-border-2">
                <div className="flex gap-1">
                  {row.onEdit && (
                    <button onClick={row.onEdit} className="text-sk-text-2 hover:text-sk-accent transition-colors p-1" title="Editar"><Pencil size={13} /></button>
                  )}
                  {row.onDelete && (
                    <button onClick={row.onDelete} className="text-sk-text-2 hover:text-sk-red transition-colors p-1" title="Eliminar"><Trash2 size={13} /></button>
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
