// src/components/admin/club-players-tab.tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import { Spinner } from "../ui/spinner";
import { EmptyState } from "../ui/empty-state";
import { Chip } from "../ui/chip";
import { FlagIcon } from "../ui/flag-icon";
import { cn } from "../../lib/cn";
import { getCountryName } from "../../lib/countries";
import { Pencil, Save, Search, X } from "lucide-react";
import { Link } from "react-router-dom";

// ── Types ──

interface PlayerNickname {
  id: string;
  nickname: string;
  room_name: string;
  elo_rating: number;
}

interface ClubPlayer {
  /** Primary player ID (used for linking) */
  primaryId: string;
  /** All nicknames this person has in the club */
  nicknames: PlayerNickname[];
  /** Highest ELO among all nicknames */
  bestElo: number;
  /** Total tournaments across all nicknames */
  totalTournaments: number;
  /** Total cashes across all nicknames */
  totalCashes: number;
  /** Total wins across all nicknames */
  totalWins: number;
  /** Country code */
  countryCode: string | null;
  /** Is demo player */
  isDemo: boolean;
  /** Linked profile data (null if no account) */
  profileId: string | null;
  displayName: string | null;
  email: string | null;
  whatsapp: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

interface ClubPlayersTabProps {
  clubId: string;
}

const COUNTRIES = [
  "AR", "BO", "BR", "CL", "CO", "CR", "DO", "EC", "ES",
  "GT", "HN", "MX", "NI", "PA", "PE", "PR", "PY", "SV", "US", "UY", "VE",
];

// ── Component ──

export function ClubPlayersTab({ clubId }: ClubPlayersTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<ClubPlayer | null>(null);

  const { data: players, isLoading } = useQuery({
    queryKey: ["club-players", clubId],
    queryFn: async () => {
      // 1. Get all player IDs from this club's tournaments
      const { data: results, error: resErr } = await supabase
        .from("tournament_results")
        .select("player_id, tournaments!inner(club_id)")
        .eq("tournaments.club_id", clubId);

      if (resErr) throw resErr;
      if (!results?.length) return [];

      const uniquePlayerIds = [...new Set(results.map((r) => r.player_id))];

      // 2. Fetch all player data with profiles and rooms
      const allRaw: any[] = [];
      for (let i = 0; i < uniquePlayerIds.length; i += 100) {
        const batch = uniquePlayerIds.slice(i, i + 100);
        const { data, error } = await supabase
          .from("players")
          .select("id, nickname, room_id, country_code, elo_rating, total_tournaments, total_cashes, total_wins, is_demo, profile_id, poker_rooms(name), profiles(display_name, email, whatsapp, avatar_url, is_verified)")
          .in("id", batch);
        if (error) throw error;
        if (data) allRaw.push(...data);
      }

      // 3. Fetch aliases to group players by person
      const { data: aliases } = await supabase
        .from("player_aliases")
        .select("primary_player_id, alias_player_id")
        .in("primary_player_id", uniquePlayerIds)
        .or(`alias_player_id.in.(${uniquePlayerIds.join(",")})`);

      // 4. Build a union-find to group players by person
      const parent: Record<string, string> = {};
      const find = (id: string): string => {
        if (!parent[id]) parent[id] = id;
        if (parent[id] !== id) parent[id] = find(parent[id]!);
        return parent[id]!;
      };
      const union = (a: string, b: string) => {
        parent[find(a)] = find(b);
      };

      // Group by profile_id first
      const profileGroups: Record<string, string[]> = {};
      for (const p of allRaw) {
        if (p.profile_id) {
          if (!profileGroups[p.profile_id]) profileGroups[p.profile_id] = [];
          profileGroups[p.profile_id]!.push(p.id);
        }
      }
      for (const group of Object.values(profileGroups)) {
        for (let i = 1; i < group.length; i++) {
          union(group[0]!, group[i]!);
        }
      }

      // Group by aliases
      for (const a of aliases ?? []) {
        union(a.primary_player_id, a.alias_player_id);
      }

      // 5. Build grouped players
      const groups: Record<string, any[]> = {};
      for (const p of allRaw) {
        const root = find(p.id);
        if (!groups[root]) groups[root] = [];
        groups[root]!.push(p);
      }

      // 6. Convert to ClubPlayer[]
      const clubPlayers: ClubPlayer[] = Object.values(groups).map((group) => {
        const nicknames: PlayerNickname[] = group.map((p: any) => ({
          id: p.id,
          nickname: p.nickname.replace(/^\[DEMO\]\s*/, ""),
          room_name: p.poker_rooms?.name ?? "—",
          elo_rating: Number(p.elo_rating),
        }));

        // Use the player with profile or the highest ELO as primary
        const withProfile = group.find((p: any) => p.profile_id);
        const primary = withProfile ?? group.reduce((best: any, p: any) =>
          Number(p.elo_rating) > Number(best.elo_rating) ? p : best, group[0]);

        const prof = primary.profiles;

        return {
          primaryId: primary.id,
          nicknames: nicknames.sort((a, b) => b.elo_rating - a.elo_rating),
          bestElo: Number(primary.elo_rating),
          totalTournaments: group.reduce((s: number, p: any) => s + (p.total_tournaments ?? 0), 0),
          totalCashes: group.reduce((s: number, p: any) => s + (p.total_cashes ?? 0), 0),
          totalWins: group.reduce((s: number, p: any) => s + (p.total_wins ?? 0), 0),
          countryCode: primary.country_code,
          isDemo: primary.is_demo,
          profileId: primary.profile_id,
          displayName: prof?.display_name ?? null,
          email: prof?.email ?? null,
          whatsapp: prof?.whatsapp ?? null,
          avatarUrl: prof?.avatar_url ?? null,
          isVerified: prof?.is_verified ?? false,
        };
      });

      return clubPlayers.sort((a, b) => b.bestElo - a.bestElo);
    },
    enabled: !!clubId,
  });

  const filtered = (players ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.nicknames.some((n) => n.nickname.toLowerCase().includes(q)) ||
      (p.displayName ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h2 className="text-sk-md font-bold text-sk-text-1">
          Jugadores ({players?.length ?? 0})
        </h2>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador..."
            className="w-full bg-sk-bg-2 border border-sk-border-2 rounded-md py-2 pl-9 pr-3 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-sk-text-4 hover:text-sk-text-1">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : !filtered.length ? (
        <EmptyState
          icon="👥"
          title={search ? "Sin resultados" : "Sin jugadores"}
          description={search ? `No se encontraron jugadores con "${search}".` : "Aún no hay jugadores que hayan participado en torneos de este club."}
        />
      ) : (
        <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
          <table className="w-full border-collapse text-sk-sm">
            <thead>
              <tr>
                {["Jugador", "Nicknames / Salas", "ELO", "Torneos", "Contacto", ""].map((h, i) => (
                  <th
                    key={h || `col-${i}`}
                    className={cn(
                      "bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap text-left",
                      (i === 2 || i === 3) && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const itm = p.totalTournaments > 0
                  ? ((p.totalCashes / p.totalTournaments) * 100).toFixed(1)
                  : "0.0";
                const hasContact = p.email || p.whatsapp;
                const mainNick = p.nicknames[0]!;

                return (
                  <tr key={p.primaryId} className="hover:bg-white/[0.015] transition-colors">
                    {/* Player identity */}
                    <td className="py-3 px-4 border-b border-sk-border-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-text-3 shrink-0 overflow-hidden">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            mainNick.nickname.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {p.displayName ? (
                              <span className="font-semibold text-sk-text-1 truncate">{p.displayName}</span>
                            ) : (
                              <span className="font-semibold text-sk-text-1 truncate">{mainNick.nickname}</span>
                            )}
                            {p.countryCode && <FlagIcon countryCode={p.countryCode} />}
                            {p.isDemo && (
                              <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-sk-gold-dim text-sk-gold uppercase">Demo</span>
                            )}
                            {p.isVerified && (
                              <span className="text-sk-green text-[10px]" title="Verificado">✓</span>
                            )}
                          </div>
                          {p.displayName && (
                            <span className="text-[10px] text-sk-text-3 block">{mainNick.nickname}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Nicknames / Rooms */}
                    <td className="py-3 px-4 border-b border-sk-border-2">
                      <div className="flex flex-wrap gap-1.5">
                        {p.nicknames.map((n) => (
                          <Link key={n.id} to={`/ranking/${n.id}`} className="group">
                            <Chip className="group-hover:border-sk-accent/40 transition-colors">
                              <span className="font-mono text-[10px]">{n.nickname}</span>
                              <span className="text-sk-text-4 text-[9px]">·</span>
                              <span className="text-sk-text-3 text-[9px]">{n.room_name}</span>
                            </Chip>
                          </Link>
                        ))}
                      </div>
                    </td>

                    {/* ELO (best) */}
                    <td className="py-3 px-4 border-b border-sk-border-2 text-right font-mono font-bold text-sk-accent">
                      {Math.round(p.bestElo).toLocaleString("es")}
                    </td>

                    {/* Tournaments */}
                    <td className="py-3 px-4 border-b border-sk-border-2 text-right text-sk-text-1">
                      {p.totalTournaments}
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-4 border-b border-sk-border-2">
                      {hasContact ? (
                        <div className="text-[10px] text-sk-text-3 space-y-0.5">
                          {p.email && <div className="truncate max-w-[160px]">📧 {p.email}</div>}
                          {p.whatsapp && <div>📱 {p.whatsapp}</div>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-sk-text-4">Sin datos</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 border-b border-sk-border-2">
                      <button
                        onClick={() => setEditingPlayer(p)}
                        className="text-sk-text-2 hover:text-sk-accent p-1 transition-colors"
                        title="Editar datos personales"
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingPlayer && (
        <PlayerEditModal
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSaved={() => {
            setEditingPlayer(null);
            queryClient.invalidateQueries({ queryKey: ["club-players", clubId] });
          }}
        />
      )}
    </div>
  );
}

// ── Player Edit Modal ──

function PlayerEditModal({ player, onClose, onSaved }: { player: ClubPlayer; onClose: () => void; onSaved: () => void }) {
  const mainNick = player.nicknames[0]!;

  const [countryCode, setCountryCode] = useState(player.countryCode ?? "");
  const [email, setEmail] = useState(player.email ?? "");
  const [whatsapp, setWhatsapp] = useState(player.whatsapp ?? "");
  const [displayName, setDisplayName] = useState(player.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Update country on all player records for this person
      for (const nick of player.nicknames) {
        const { error: playerErr } = await supabase
          .from("players")
          .update({ country_code: countryCode || null })
          .eq("id", nick.id);
        if (playerErr) throw playerErr;
      }

      // If player has a linked profile, update profile fields
      if (player.profileId) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            display_name: displayName.trim() || null,
            email: email.trim() || null,
            whatsapp: whatsapp.trim() || null,
            country_code: countryCode || null,
          })
          .eq("id", player.profileId);
        if (profileErr) throw profileErr;
      }

      setSuccess(true);
      setTimeout(() => onSaved(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Editar Datos del Jugador" className="max-w-md">
      <div className="space-y-4">

        {/* Player identity (read-only) */}
        <div className="bg-sk-bg-3 border border-sk-border-2 rounded-md p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-sk-bg-4 border-2 border-sk-accent flex items-center justify-center text-sk-lg font-extrabold text-sk-accent overflow-hidden shrink-0">
              {player.avatarUrl ? (
                <img src={player.avatarUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                mainNick.nickname.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="font-mono font-bold text-sk-accent">
                {Math.round(player.bestElo).toLocaleString("es")} ELO
              </div>
              <div className="text-[11px] text-sk-text-3 font-mono">
                {player.totalTournaments} torneos · {player.totalWins} victorias
              </div>
            </div>
          </div>

          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-sk-text-3 mb-2">
            Nicknames (no editables)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {player.nicknames.map((n) => (
              <Chip key={n.id}>
                <span className="font-mono text-[10px] text-sk-text-1">{n.nickname}</span>
                <span className="text-sk-text-4 text-[9px]">·</span>
                <span className="text-sk-text-3 text-[9px]">{n.room_name}</span>
              </Chip>
            ))}
          </div>
        </div>

        {/* Editable fields */}
        <div>
          <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
            Nombre real
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nombre completo del jugador"
            disabled={!player.profileId}
            className={cn(
              "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent",
              !player.profileId && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>

        <div>
          <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
            País
          </label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
          >
            <option value="">Sin definir</option>
            {COUNTRIES.map((cc) => (
              <option key={cc} value={cc}>{getCountryName(cc)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            disabled={!player.profileId}
            className={cn(
              "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent",
              !player.profileId && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>

        <div>
          <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
            WhatsApp
          </label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+56 9 1234 5678"
            disabled={!player.profileId}
            className={cn(
              "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent",
              !player.profileId && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>

        {!player.profileId && (
          <p className="text-[10px] text-sk-text-4 bg-sk-bg-3 rounded-md p-2.5">
            💡 Este jugador no tiene cuenta vinculada en Sharkania. Solo se puede editar el país. Para editar nombre, email y WhatsApp, el jugador debe crear una cuenta y vincular su nickname.
          </p>
        )}

        {error && (
          <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">{error}</div>
        )}
        {success && (
          <div className="bg-sk-green-dim border border-sk-green/20 rounded-md p-3 text-sk-sm text-sk-green">
            ✅ Datos actualizados correctamente
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>
            <Save size={14} /> Guardar cambios
          </Button>
        </div>
      </div>
    </Modal>
  );
}
