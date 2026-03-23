// src/components/admin/results-editor.tsx
import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import { Spinner } from "../ui/spinner";
import { FlagIcon } from "../ui/flag-icon";
import { calculateElo, reverseElo } from "../../lib/api/elo-engine";
import { getTournamentResults } from "../../lib/api/tournaments";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/cn";
import { Save, AlertTriangle, Trash2, Plus, RotateCcw } from "lucide-react";
import type { TournamentWithDetails } from "../../types";

interface EditableRow {
  id: string;
  position: number;
  nickname: string;
  playerId: string;
  prizeWon: number;
  // null = celda vacía (el usuario no ingresó nada), number = valor explícito (incluyendo 0)
  leaguePoints: number | null;
  eloChange: number | null;
  countryCode: string | null;
  isNew: boolean;
  isDirty: boolean;
  originalNickname: string;
  originalPrize: number;
  originalPoints: number;
}

interface ResultsEditorProps {
  tournament: TournamentWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

async function resolvePlayer(
  nickname: string,
  roomId: string,
  countryCode: string | null
): Promise<{ id: string; status: "found" | "created" }> {
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .ilike("nickname", nickname.trim())
    .limit(1);

  if (existing && existing.length > 0 && existing[0]) {
    return { id: existing[0].id, status: "found" };
  }

  const { data: created, error } = await supabase
    .from("players")
    .insert({
      nickname: nickname.trim(),
      room_id: roomId,
      country_code: countryCode,
      elo_rating: 1200,
      elo_peak: 1200,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Error creando jugador "${nickname}": ${error.message}`);
  return { id: created.id, status: "created" };
}

export function ResultsEditor({
  tournament,
  isOpen,
  onClose,
  onComplete,
}: ResultsEditorProps) {
  const hasLeague = !!tournament.league_id;
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMessage(null);
    setHasChanges(false);

    getTournamentResults(tournament.id).then((results) => {
      const mapped: EditableRow[] = results.map((r: any) => ({
        id: r.id,
        position: r.position,
        nickname: r.players?.nickname ?? "",
        playerId: r.player_id,
        prizeWon: Number(r.prize_won) || 0,
        // Registros existentes en BD siempre tienen número (puede ser 0)
        leaguePoints: Number(r.league_points_earned) ?? 0,
        eloChange: r.elo_change ? Number(r.elo_change) : null,
        countryCode: r.players?.country_code ?? null,
        isNew: false,
        isDirty: false,
        originalNickname: r.players?.nickname ?? "",
        originalPrize: Number(r.prize_won) || 0,
        originalPoints: Number(r.league_points_earned) || 0,
      }));
      setRows(mapped.sort((a, b) => a.position - b.position));
      setLoading(false);
    }).catch((err) => {
      setMessage({ text: `Error cargando resultados: ${err.message}`, type: "error" });
      setLoading(false);
    });
  }, [isOpen, tournament.id]);

  const updateRow = (index: number, field: string, value: string | number | null) => {
    const newRows = [...rows];
    const row = newRows[index];
    if (!row) return;

    const updated = { ...row, [field]: value };

    if (!row.isNew) {
      updated.isDirty =
        updated.nickname !== row.originalNickname ||
        updated.prizeWon !== row.originalPrize ||
        updated.leaguePoints !== row.originalPoints;
    } else {
      updated.isDirty = true;
    }

    newRows[index] = updated;
    setRows(newRows);
    setHasChanges(newRows.some((r) => r.isDirty || r.isNew));
  };

  // Maneja el cambio del input de puntos de liga:
  // - Si el campo queda vacío → null (para mostrar placeholder)
  // - Si tiene valor → number (0 es válido)
  const updateLeaguePoints = (index: number, raw: string) => {
    if (raw === "") {
      updateRow(index, "leaguePoints", null);
    } else {
      updateRow(index, "leaguePoints", Number(raw));
    }
  };

  const addRow = () => {
    const newPos = rows.length + 1;
    setRows([...rows, {
      id: `new-${Date.now()}`,
      position: newPos,
      nickname: "",
      playerId: "",
      prizeWon: 0,
      leaguePoints: null, // vacío por defecto — el usuario debe ingresar o dejar en blanco (= 0)
      eloChange: null,
      countryCode: null,
      isNew: true,
      isDirty: true,
      originalNickname: "",
      originalPrize: 0,
      originalPoints: 0,
    }]);
    setHasChanges(true);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, position: i + 1 }));
    setRows(newRows);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const errors: string[] = [];

    const emptyNicks = rows.filter((r) => !r.nickname.trim());
    if (emptyNicks.length > 0) {
      errors.push(`${emptyNicks.length} jugador(es) sin nickname`);
    }

    const dupeNicks = rows.filter(
      (r, i, arr) =>
        r.nickname.trim() &&
        arr.findIndex((a) => a.nickname.toLowerCase().trim() === r.nickname.toLowerCase().trim()) !== i
    );
    if (dupeNicks.length > 0) {
      errors.push(`Nicknames duplicados: ${[...new Set(dupeNicks.map((r) => r.nickname))].join(", ")}`);
    }

    // ── CAMBIO CLAVE ──
    // Ya NO validamos que leaguePoints === 0 como error.
    // Solo validamos que no sea null (celda realmente vacía).
    // Si es null al guardar, lo tratamos como 0 automáticamente.
    // No hay error — simplemente se normaliza.

    if (errors.length > 0) {
      setMessage({ text: errors.join("\n"), type: "error" });
      return;
    }

    // Normalizar: null → 0 antes de guardar
    const normalizedRows = rows.map((r) => ({
      ...r,
      leaguePoints: r.leaguePoints ?? 0,
    }));

    setSaving(true);
    setMessage({ text: "Paso 1/4: Revirtiendo ELO anterior...", type: "info" });

    try {
      const reverseResult = await reverseElo(tournament.id);
      if (!reverseResult.success) {
        setMessage({ text: `Error revirtiendo ELO: ${reverseResult.message}`, type: "error" });
        setSaving(false);
        return;
      }

      setMessage({ text: "Paso 2/4: Eliminando resultados anteriores...", type: "info" });
      const { error: deleteErr } = await supabase
        .from("tournament_results")
        .delete()
        .eq("tournament_id", tournament.id);

      if (deleteErr) {
        setMessage({ text: `Error eliminando resultados: ${deleteErr.message}`, type: "error" });
        setSaving(false);
        return;
      }

      setMessage({ text: "Paso 3/4: Resolviendo jugadores e insertando resultados...", type: "info" });

      const insertData = await Promise.all(
        normalizedRows.map(async (row) => {
          let playerId = row.playerId;
          if (row.isNew || !playerId) {
            const resolved = await resolvePlayer(row.nickname, tournament.room_id, row.countryCode);
            playerId = resolved.id;
          }
          return {
            tournament_id: tournament.id,
            player_id: playerId,
            position: row.position,
            prize_won: row.prizeWon,
            league_points_earned: row.leaguePoints,
            bounties_won: 0,
          };
        })
      );

      const { error: insertErr } = await supabase
        .from("tournament_results")
        .insert(insertData);

      if (insertErr) {
        setMessage({ text: `Error insertando resultados: ${insertErr.message}`, type: "error" });
        setSaving(false);
        return;
      }

      setMessage({ text: "Paso 4/4: Calculando nuevo ELO...", type: "info" });
      const calcResult = await calculateElo(tournament.id);
      if (!calcResult.success) {
        setMessage({ text: `Error calculando ELO: ${calcResult.message}`, type: "error" });
        setSaving(false);
        return;
      }

      setMessage({ text: `✅ Resultados guardados. ELO recalculado para ${calcResult.playersUpdated ?? normalizedRows.length} jugadores.`, type: "success" });
      setHasChanges(false);

      // Recargar rows con ELO actualizado
      const fresh = await getTournamentResults(tournament.id);
      const refreshed: EditableRow[] = fresh.map((r: any) => ({
        id: r.id,
        position: r.position,
        nickname: r.players?.nickname ?? "",
        playerId: r.player_id,
        prizeWon: Number(r.prize_won) || 0,
        leaguePoints: Number(r.league_points_earned) ?? 0,
        eloChange: r.elo_change ? Number(r.elo_change) : null,
        countryCode: r.players?.country_code ?? null,
        isNew: false,
        isDirty: false,
        originalNickname: r.players?.nickname ?? "",
        originalPrize: Number(r.prize_won) || 0,
        originalPoints: Number(r.league_points_earned) || 0,
      }));
      setRows(refreshed.sort((a, b) => a.position - b.position));
      onComplete();
    } catch (err) {
      setMessage({ text: `Error: ${err instanceof Error ? err.message : "Error inesperado"}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const cleanName = (s: string) => s.replace(/^\[DEMO\]\s*/, "").trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Resultados: ${cleanName(tournament.name)}`}
      className="max-w-3xl"
    >
      <div className="space-y-4">

        {/* Tournament info */}
        <div className="flex items-center gap-2 flex-wrap text-sk-xs text-sk-text-3">
          <Badge variant={tournament.status === "completed" ? "muted" : "accent"}>
            {tournament.status}
          </Badge>
          {hasLeague && (
            <Badge variant="purple">Liga: {(tournament as any).leagues?.name ?? "—"}</Badge>
          )}
          <span className="font-mono">{rows.length} jugadores</span>
          {hasChanges && (
            <Badge variant="orange">Cambios sin guardar</Badge>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <>
            <div className="border border-sk-border-2 rounded-md overflow-x-auto">
              <table className="w-full text-sk-xs">
                <thead>
                  <tr>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-12">Pos</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left">Nickname</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-24">Premio</th>
                    {hasLeague && (
                      <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-purple py-2 px-2 text-left w-20">
                        Puntos
                        <span className="ml-1 text-sk-text-4 normal-case font-normal">(vacío=0)</span>
                      </th>
                    )}
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-right w-20">ΔELO</th>
                    <th className="bg-sk-bg-3 w-8 py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-sk-border-2",
                        row.isDirty && "bg-sk-accent-dim/30",
                        row.isNew && "bg-sk-gold-dim/20",
                      )}
                    >
                      <td className="py-2 px-2 font-mono font-bold text-sk-text-1">
                        {row.position}°
                      </td>

                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          {row.countryCode && !row.isNew && (
                            <FlagIcon countryCode={row.countryCode} />
                          )}
                          <input
                            type="text"
                            value={row.nickname}
                            onChange={(e) => updateRow(i, "nickname", e.target.value)}
                            placeholder="Nickname..."
                            className={cn(
                              "flex-1 bg-sk-bg-0 border rounded-md py-1.5 px-2.5 text-sk-xs text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent font-mono",
                              row.isDirty && row.nickname !== row.originalNickname
                                ? "border-sk-orange/40"
                                : "border-sk-border-2"
                            )}
                          />
                          {row.isNew && (
                            <span className="text-sk-gold text-[9px] font-bold">NUEVO</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={row.prizeWon || ""}
                          onChange={(e) => updateRow(i, "prizeWon", Number(e.target.value))}
                          placeholder="0"
                          min={0}
                          className={cn(
                            "w-full bg-sk-bg-0 border rounded-md py-1.5 px-2 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent",
                            row.isDirty && row.prizeWon !== row.originalPrize
                              ? "border-sk-orange/40"
                              : "border-sk-border-2"
                          )}
                        />
                      </td>

                      {hasLeague && (
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            // null muestra vacío, 0 muestra "0"
                            value={row.leaguePoints === null ? "" : row.leaguePoints}
                            onChange={(e) => updateLeaguePoints(i, e.target.value)}
                            placeholder="0"
                            min={0}
                            className={cn(
                              "w-full bg-sk-bg-0 border rounded-md py-1.5 px-2 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-purple",
                              row.isDirty && row.leaguePoints !== row.originalPoints
                                ? "border-sk-purple/50"
                                : "border-sk-purple/20"
                            )}
                          />
                        </td>
                      )}

                      <td className="py-2 px-2 text-right">
                        {row.eloChange !== null && !row.isDirty ? (
                          <span className={cn(
                            "font-mono text-[10px] font-semibold py-0.5 px-1.5 rounded-xs",
                            row.eloChange >= 0 ? "text-sk-green bg-sk-green-dim" : "text-sk-red bg-sk-red-dim",
                          )}>
                            {row.eloChange >= 0 ? "+" : ""}{row.eloChange.toFixed(2)}
                          </span>
                        ) : row.isDirty ? (
                          <span className="text-sk-text-4 text-[10px] font-mono">recalcular</span>
                        ) : (
                          <span className="text-sk-text-4">—</span>
                        )}
                      </td>

                      <td className="py-2 px-2">
                        {rows.length > 2 && (
                          <button
                            onClick={() => removeRow(i)}
                            className="text-sk-text-3 hover:text-sk-red transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button variant="ghost" size="sm" onClick={addRow}>
              <Plus size={14} /> Agregar jugador
            </Button>

            {hasChanges && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-sk-orange-dim border border-sk-orange/20 rounded-md">
                <AlertTriangle size={14} className="text-sk-orange mt-0.5 shrink-0" />
                <div className="text-sk-xs text-sk-orange">
                  <strong>Al guardar se recalculará el ELO:</strong> se revertirá el ELO de todos los jugadores de este torneo, se aplicarán los nuevos resultados y se recalculará el ELO completo. Este proceso puede tardar unos segundos.
                </div>
              </div>
            )}
          </>
        )}

        {message && (
          <div className={cn(
            "rounded-md p-3 text-sk-sm whitespace-pre-line",
            message.type === "success" && "bg-sk-green-dim border border-sk-green/20 text-sk-green",
            message.type === "error" && "bg-sk-red-dim border border-sk-red/20 text-sk-red",
            message.type === "info" && "bg-sk-accent-dim border border-sk-accent/20 text-sk-accent",
          )}>
            {message.text}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          {hasChanges && (
            <Button
              variant="accent"
              size="sm"
              onClick={handleSave}
              isLoading={saving}
            >
              <RotateCcw size={14} /> Guardar y Recalcular ELO
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}