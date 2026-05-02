// src/components/admin/results-editor.tsx
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import { Spinner } from "../ui/spinner";
import { FlagIcon } from "../ui/flag-icon";
import { calculateElo } from "../../lib/api/elo-engine";
import { getTournamentResults, prepareTournamentForReedit, applyLeaguePoints } from "../../lib/api/tournaments";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/cn";
import { AlertTriangle, Trash2, Plus, RotateCcw, Upload } from "lucide-react";
import type { TournamentWithDetails } from "../../types";
import { parseCSVSmart } from "../../lib/csv-parser";
import { forceRecalculateStandings } from "../../lib/api/leagues";

interface EditableRow {
  id: string;
  position: number;
  nickname: string;
  playerId: string;
  prizeWon: number;
  leaguePoints: number | null;
  eloChange: number | null;
  countryCode: string | null;
  ccpClub: string | null;     // 🔥 NUEVO
  buyInsCount: number;        // 🔥 NUEVO
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
  const fileRef = useRef<HTMLInputElement>(null);

  // Carga inicial de datos
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMessage(null);
    setHasChanges(false);

    getTournamentResults(tournament.id)
      .then((results) => {
        const mapped: EditableRow[] = results.map((r: any) => ({
          id: r.id,
          position: r.position,
          nickname: r.players?.nickname ?? "",
          playerId: r.player_id,
          prizeWon: Number(r.prize_won) || 0,
          leaguePoints: Number(r.league_points_earned ?? 0),
          eloChange: r.elo_change ? Number(r.elo_change) : null,
          countryCode: r.players?.country_code ?? null,
          ccpClub: r.ccp_club ?? null,           // 🔥 CARGAMOS DATO REAL
          buyInsCount: Number(r.buy_ins_count) || 1, // 🔥 CARGAMOS DATO REAL
          isNew: false,
          isDirty: false,
          originalNickname: r.players?.nickname ?? "",
          originalPrize: Number(r.prize_won) || 0,
          originalPoints: Number(r.league_points_earned) || 0,
        }));
        setRows(mapped.sort((a, b) => a.position - b.position));
        setLoading(false);
      })
      .catch((err) => {
        setMessage({ text: `Error cargando resultados: ${err.message}`, type: "error" });
        setLoading(false);
      });
  }, [isOpen, tournament.id]);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage({ text: "Solo se aceptan archivos .csv", type: "error" });
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, errors } = parseCSVSmart(text);

      if (errors.filter((err) => err.row === 0).length > 0) {
        setMessage({ text: "El CSV tiene errores críticos de formato.", type: "error" });
        return;
      }

      if (parsed.length === 0) {
        setMessage({ text: "No se encontraron datos en el CSV", type: "error" });
        return;
      }

      const newRows: EditableRow[] = parsed.map((p, i) => ({
        id: `csv-${Date.now()}-${i}`,
        position: p.position ?? i + 1,
        nickname: p.nickname,
        playerId: "",
        prizeWon: p.prize,
        leaguePoints: p.points,
        eloChange: null,
        countryCode: null,
        ccpClub: p.ccp_club ?? null,     // 🔥 MAPEAMOS EL NUEVO CSV
        buyInsCount: p.buy_ins_count,    // 🔥 MAPEAMOS EL NUEVO CSV
        isNew: true,
        isDirty: true,
        originalNickname: "",
        originalPrize: 0,
        originalPoints: 0,
      }));

      setRows(newRows.sort((a, b) => a.position - b.position));
      setHasChanges(true);
      setMessage({
        text: `✅ CSV cargado. Revisa los datos y haz click en "Guardar Cambios" para sobreescribir la base de datos.`,
        type: "info",
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const updateRow = (index: number, field: keyof EditableRow, value: string | number | null) => {
    const newRows = [...rows];
    const row = newRows[index];
    if (!row) return;

    // TypeScript seguro
    const updated = { ...row, [field]: value } as EditableRow;

    if (!row.isNew) {
      // Evaluamos "isDirty"
      updated.isDirty =
        updated.nickname !== row.originalNickname ||
        updated.prizeWon !== row.originalPrize ||
        updated.leaguePoints !== row.originalPoints ||
        field === "ccpClub" || // Si toca estos campos, asumimos que hubo cambio
        field === "buyInsCount";
    } else {
      updated.isDirty = true;
    }

    newRows[index] = updated;
    setRows(newRows);
    setHasChanges(newRows.some((r) => r.isDirty || r.isNew));
  };

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
      leaguePoints: null,
      eloChange: null,
      countryCode: null,
      ccpClub: null,
      buyInsCount: 1,
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

  // 🔥 EL CEREBRO DE LA OPERACIÓN (BORRÓN Y CUENTA NUEVA)
  const handleSave = async () => {
    const errors: string[] = [];

    // Validaciones básicas
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
      errors.push(`Nicknames duplicados detectados.`);
    }

    if (errors.length > 0) {
      setMessage({ text: errors.join("\n"), type: "error" });
      return;
    }

    setSaving(true);
    setMessage({ text: "Paso 1/5: Revirtiendo impacto del torneo...", type: "info" });

    try {
      // 1. Limpiar historial de ELO y Ligas previo (Fundamental para no duplicar ni generar fantasmas)
      if (tournament.results_uploaded) {
         await prepareTournamentForReedit(tournament.id);
      }

      setMessage({ text: "Paso 2/5: Borrando resultados obsoletos...", type: "info" });
      
      // 2. Borrar resultados de la tabla explícitamente (Borron y cuenta nueva)
      const { error: deleteErr } = await supabase
        .from("tournament_results")
        .delete()
        .eq("tournament_id", tournament.id);

      if (deleteErr) throw deleteErr;

      setMessage({ text: "Paso 3/5: Registrando nuevos jugadores e insertando resultados...", type: "info" });

      // 3. Resolver/crear jugadores e insertar el nuevo set de datos
      const insertData = await Promise.all(
        rows.map(async (row) => {
          let playerId = row.playerId;
          if (row.isNew || !playerId || row.nickname !== row.originalNickname) {
             const resolved = await resolvePlayer(row.nickname, tournament.room_id, row.countryCode || tournament.clubs?.country_code || null);
             playerId = resolved.id;
          }
          return {
            tournament_id: tournament.id,
            player_id: playerId,
            position: row.position,
            prize_won: row.prizeWon || 0,
            league_points_earned: row.leaguePoints || 0,
            ccp_club: row.ccpClub || null,       // 🔥 GUARDAMOS EN DB
            buy_ins_count: row.buyInsCount || 1, // 🔥 GUARDAMOS EN DB
            bounties_won: 0,
          };
        })
      );

      const { error: insertErr } = await supabase
        .from("tournament_results")
        .insert(insertData);

      if (insertErr) throw insertErr;

      // 4. Recalcular ELO desde cero
      setMessage({ text: "Paso 4/5: Recalculando sistema ELO...", type: "info" });
      const calcResult = await calculateElo(tournament.id);
      
      if (!calcResult.success) {
        throw new Error(calcResult.message);
      }

      // 5. Reaplicar puntos de liga (si corresponde)
      if (tournament.league_id) {
        setMessage({ text: "Paso 5/5: Actualizando posiciones de la Liga...", type: "info" });
        await applyLeaguePoints(tournament.id, tournament.league_id);
        await forceRecalculateStandings(tournament.league_id); 
      }

      setMessage({ text: `✅ Torneo editado y recalculado exitosamente.`, type: "success" });
      setHasChanges(false);

      // Refrescar el modal con los datos más recientes de Supabase
      const fresh = await getTournamentResults(tournament.id);
      const refreshed: EditableRow[] = fresh.map((r: any) => ({
        id: r.id,
        position: r.position,
        nickname: r.players?.nickname ?? "",
        playerId: r.player_id,
        prizeWon: Number(r.prize_won) || 0,
        leaguePoints: Number(r.league_points_earned ?? 0),
        eloChange: r.elo_change ? Number(r.elo_change) : null,
        countryCode: r.players?.country_code ?? null,
        ccpClub: r.ccp_club ?? null,
        buyInsCount: Number(r.buy_ins_count) || 1,
        isNew: false,
        isDirty: false,
        originalNickname: r.players?.nickname ?? "",
        originalPrize: Number(r.prize_won) || 0,
        originalPoints: Number(r.league_points_earned) || 0,
      }));
      setRows(refreshed.sort((a, b) => a.position - b.position));
      
      onComplete(); // Trigger refresh en la UI externa

    } catch (err: any) {
      const errorMsg = err?.message || err?.details || JSON.stringify(err);
      setMessage({ text: `Error: ${errorMsg}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const cleanName = (s: string) => s.replace(/^\[DEMO\]\s*/, "").trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editor de Resultados: ${cleanName(tournament.name)}`}
      className="!max-w-[1200px] !w-[95vw]" /* 🔥 Modal Expansivo */
    >
      <div className="space-y-4">
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
              <table className="w-full text-sk-xs min-w-[1000px]"> {/* 🔥 Ancho Mínimo */}
                <thead>
                  <tr>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-10">Pos</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left">Nickname</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-32">Club CCP</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-16">Buyins</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-24">Premio</th>
                    {hasLeague && (
                      <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-purple py-2 px-2 text-left w-20">
                        Puntos
                        <span className="ml-1 text-sk-text-4 normal-case font-normal">(vacío=0)</span>
                      </th>
                    )}
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-right w-16">ΔELO</th>
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
                      {/* 🔥 NUEVOS CAMPOS FINANCIEROS Y DE CLUB */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={row.ccpClub || ""}
                          onChange={(e) => updateRow(i, "ccpClub", e.target.value)}
                          placeholder="Club..."
                          className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-1.5 px-2.5 text-sk-xs text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={row.buyInsCount || ""}
                          onChange={(e) => updateRow(i, "buyInsCount", Number(e.target.value))}
                          placeholder="1" min={1}
                          className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-1.5 px-2 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent"
                        />
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

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={addRow}>
                <Plus size={14} /> Agregar jugador
              </Button>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="text-sk-accent hover:bg-sk-accent-dim/30">
                <Upload size={14} /> Reemplazar con CSV
              </Button>
            </div>

            {hasChanges && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-sk-accent-dim border border-sk-accent/20 rounded-md">
                <AlertTriangle size={14} className="text-sk-accent mt-0.5 shrink-0" />
                <div className="text-sk-xs text-sk-accent-text">
                  <strong>Atención:</strong> Guardar cambios reseteará completamente el impacto previo de este torneo y lo recalculará desde cero con los datos en pantalla para garantizar integridad en el ELO.
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
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
          {hasChanges && (
            <Button
              variant="accent"
              size="sm"
              onClick={handleSave}
              isLoading={saving}
            >
              <RotateCcw size={14} /> Guardar Cambios
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}