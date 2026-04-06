import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import { calculateElo } from "../../lib/api/elo-engine";
import { applyLeaguePoints, prepareTournamentForReedit } from "../../lib/api/tournaments"; 
import { forceRecalculateStandings } from "../../lib/api/leagues";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/cn";
import {
  Plus,
  Trash2,
  Upload,
  FileText,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { TournamentWithDetails } from "../../types";
import { parseCSVSmart, type CSVValidationError } from "../../lib/csv-parser";

// ── Types ──

interface ResultRow {
  position: number;
  nickname: string;
  playerId: string;
  prizeWon: number;
  leaguePoints: number; 
  status: "pending" | "found" | "not_found" | "created";
}

interface ResultsUploadProps {
  tournament: TournamentWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// ── Resolve player ──

async function resolvePlayer(
  nickname: string,
  roomId: string,
  countryCode: string | null
): Promise<{ id: string; status: "found" | "created" }> {
  const { data: existing } = await supabase
    .from("players")
    .select("id, nickname")
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

// ── Component ──

export function ResultsUpload({
  tournament,
  isOpen,
  onClose,
  onComplete,
}: ResultsUploadProps) {
  const hasLeague = !!tournament.league_id;

  const [rows, setRows] = useState<ResultRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [csvErrors, setCsvErrors] = useState<CSVValidationError[]>([]);
  const [detectedCols, setDetectedCols] = useState<string[]>([]);
  const [imported, setImported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, position: i + 1 })));
  };

  const updateRow = (index: number, field: keyof ResultRow, value: string | number) => {
    const newRows = [...rows];
    const row = newRows[index];
    if (!row) return;
    newRows[index] = { ...row, [field]: value };
    if (field === "nickname") {
      newRows[index] = { ...newRows[index]!, playerId: "", status: "pending" };
    }
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, {
      position: rows.length + 1, nickname: "", playerId: "",
      prizeWon: 0, leaguePoints: 0, status: "pending",
    }]);
  };

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
      const { rows: parsed, errors, detectedHeaders } = parseCSVSmart(text);

      setDetectedCols(detectedHeaders);
      setCsvErrors(errors);

      const criticalErrors = errors.filter((e) => e.row === 0);
      if (criticalErrors.length > 0) {
        setMessage({ text: "El CSV tiene errores que deben corregirse antes de importar.", type: "error" });
        setImported(false);
        return;
      }

      if (parsed.length === 0) {
        setMessage({ text: "No se encontraron datos en el CSV", type: "error" });
        setImported(false);
        return;
      }

      setRows(
        parsed.map((p, i) => ({
          position: p.position ?? i + 1,
          nickname: p.nickname,
          playerId: "",
          prizeWon: p.prize,
          leaguePoints: p.points,
          status: "pending" as const,
        }))
      );
      setImported(true);

      const rowErrors = errors.filter((e) => e.row > 0);
      if (rowErrors.length > 0) {
        setMessage({ text: `${parsed.length} filas importadas con ${rowErrors.length} advertencia(s). Revisa los datos antes de subir.`, type: "error" });
      } else {
        setMessage({
          text: `✅ ${parsed.length} jugadores importados. Columnas detectadas: ${detectedHeaders.join(", ")}. Revisa y haz click en "Resolver y Subir ELO".`,
          type: "info",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReset = () => {
    setRows([]);
    setImported(false);
    setCsvErrors([]);
    setDetectedCols([]);
    setMessage(null);
  };

  const handleResolveAndUpload = async () => {
    const validationErrors: string[] = [];

    const emptyNicknames = rows.filter((r) => !r.nickname.trim());
    if (emptyNicknames.length > 0) {
      validationErrors.push(`${emptyNicknames.length} jugador(es) sin nickname (posiciones: ${emptyNicknames.map((r) => r.position).join(", ")})`);
    }

    const emptyPositions = rows.filter((r) => !r.position || r.position <= 0);
    if (emptyPositions.length > 0) {
      validationErrors.push(`${emptyPositions.length} jugador(es) sin posición válida`);
    }

    const duplicateNicknames = rows.filter(
      (r, i, arr) =>
        r.nickname.trim() &&
        arr.findIndex((a) => a.nickname.toLowerCase().trim() === r.nickname.toLowerCase().trim()) !== i
    );
    if (duplicateNicknames.length > 0) {
      validationErrors.push(`Nicknames duplicados: ${[...new Set(duplicateNicknames.map((r) => r.nickname))].join(", ")}`);
    }

    if (validationErrors.length > 0) {
      setMessage({ text: validationErrors.join("\n"), type: "error" });
      return;
    }

    setResolving(true);
    setMessage({ text: "Resolviendo jugadores...", type: "info" });

    try {
      const resolvedRows: ResultRow[] = [];
      let createdCount = 0;

      for (const row of rows) {
        const result = await resolvePlayer(
          row.nickname,
          tournament.room_id,
          tournament.clubs?.country_code ?? null
        );

        if (result.status === "created") createdCount++;

        resolvedRows.push({
          ...row,
          playerId: result.id,
          status: result.status,
        });
      }

      setRows(resolvedRows);

      const duplicateIds = resolvedRows.filter(
        (r, i, arr) => arr.findIndex((a) => a.playerId === r.playerId) !== i
      );

      if (duplicateIds.length > 0) {
        setMessage({
          text: "Error: hay jugadores que resolvieron al mismo ID. Verifica los nicknames.",
          type: "error",
        });
        setResolving(false);
        return;
      }

      setMessage({
        text:
          createdCount > 0
            ? `${createdCount} jugadores nuevos creados con ELO 1200. Subiendo resultados...`
            : "Todos los jugadores encontrados. Subiendo resultados...",
        type: "info",
      });

      setUploading(true);

      // 🔥 BLINDAJE: Si el torneo ya tenía resultados, hacemos Hard Reset antes de insertar
      if (tournament.results_uploaded) {
        setMessage({ text: "Reseteando impacto del torneo anterior para evitar duplicados...", type: "info" });
        await prepareTournamentForReedit(tournament.id);
        const { error: deleteErr } = await supabase
          .from("tournament_results")
          .delete()
          .eq("tournament_id", tournament.id);
        if (deleteErr) throw deleteErr;
      }

      const resultInserts = resolvedRows.map((r) => ({
        tournament_id: tournament.id,
        player_id: r.playerId,
        position: r.position,
        prize_won: r.prizeWon,
        bounties_won: 0,
        league_points_earned: r.leaguePoints,
      }));

      const { error: insertError } = await supabase
        .from("tournament_results")
        .insert(resultInserts);

      if (insertError) {
        setMessage({
          text: `Error subiendo resultados: ${insertError.message}`,
          type: "error",
        });
        return;
      }

      if (tournament.league_id) {
        setMessage({ text: "Aplicando puntos y calculando ranking de liga...", type: "info" });
        try {
          await applyLeaguePoints(tournament.id, tournament.league_id);
          
          // 🔥 NUEVO: Magia automática de recálculo (Mejores X fechas)
          await forceRecalculateStandings(tournament.league_id);
          
        } catch (err) {
          console.error("Error aplicando puntos o recalculando liga:", err);
          setMessage({ text: "Error al calcular el ranking de la liga, pero los resultados se subieron.", type: "error" });
        }
      }

      setMessage({ text: "Calculando ELO...", type: "info" });

      const eloResult = await calculateElo(tournament.id);

      if (eloResult.success) {
        setMessage({
          text: `✅ ${eloResult.message}. La tabla de liga fue actualizada automáticamente.${
            createdCount > 0 ? ` ${createdCount} jugadores nuevos creados.` : ""
          }`,
          type: "success",
        });

        setTimeout(() => {
          onComplete();
          onClose();
        }, 2500);
      } else {
        setMessage({
          text: `⚠️ Resultados subidos pero ELO falló: ${eloResult.message}`,
          type: "error",
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error inesperado";
      setMessage({ text: errorMsg, type: "error" });
    } finally {
      setResolving(false);
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Subir Resultados: ${tournament.name}`} className="max-w-2xl">
      <div className="space-y-4">
        {hasLeague && (
          <div className="flex items-center gap-2 px-3 py-2 bg-sk-purple-dim border border-sk-purple/20 rounded-md">
            <Badge variant="purple">Liga</Badge>
            <span className="text-sk-xs text-sk-purple">
              Este torneo pertenece a la liga <strong>{(tournament as any).leagues?.name ?? "—"}</strong>. Jugadores sin puntos registrados recibirán <strong>0 puntos</strong>.
            </span>
          </div>
        )}

        {!imported && (
          <div className="space-y-4">
            <div className="bg-sk-bg-3 border border-sk-border-2 rounded-md p-4 space-y-3">
              <h4 className="text-sk-sm font-semibold text-sk-text-1 flex items-center gap-2">
                <FileText size={14} className="text-sk-accent" />
                Formato del archivo CSV
              </h4>

              <div className="space-y-2 text-sk-xs text-sk-text-2">
                <p>El archivo debe tener encabezados en la primera fila. Se reconocen estos nombres (sin importar mayúsculas/minúsculas). Las columnas extra del archivo serán ignoradas.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="red" className="mt-0.5 shrink-0">Obligatorio</Badge>
                    <div>
                      <span className="font-mono text-sk-accent font-semibold">lugar</span>
                      <span className="text-sk-text-3 block text-[10px]">posición, pos, rank, #, puesto</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="red" className="mt-0.5 shrink-0">Obligatorio</Badge>
                    <div>
                      <span className="font-mono text-sk-accent font-semibold">nickname</span>
                      <span className="text-sk-text-3 block text-[10px]">jugador, nick, player, nombre</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="muted" className="mt-0.5 shrink-0">Opcional</Badge>
                    <div>
                      <span className="font-mono text-sk-accent font-semibold">premio</span>
                      <span className="text-sk-text-3 block text-[10px]">prize, winnings, payout — vacío = $0</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant={hasLeague ? "purple" : "muted"} className="mt-0.5 shrink-0">
                      {hasLeague ? "Opcional" : "Opcional"}
                    </Badge>
                    <div>
                      <span className="font-mono text-sk-accent font-semibold">puntos</span>
                      <span className="text-sk-text-3 block text-[10px]">
                        points, pts, score, puntaje
                        {hasLeague && <span className="text-sk-purple font-semibold"> — vacío = 0</span>}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-sk-bg-0 rounded-md font-mono text-[11px] text-sk-text-2 leading-relaxed border border-sk-border-2">
                  <span className="text-sk-text-4 text-[10px] block mb-1">Ejemplo:</span>
                  <span className="text-sk-text-3">lugar</span>,<span className="text-sk-text-3">nickname</span>,<span className="text-sk-text-3">premio</span>{hasLeague && <>,<span className="text-sk-purple">puntos</span></>}<br />
                  <span className="text-sk-text-1">1</span>,<span className="text-sk-accent">SharkMaster_BR</span>,<span className="text-sk-gold">150</span>{hasLeague && <>,<span className="text-sk-purple">100</span></>}<br />
                  <span className="text-sk-text-1">2</span>,<span className="text-sk-accent">RiverKing_AR</span>,<span className="text-sk-gold">90.50</span>{hasLeague && <>,<span className="text-sk-purple">75</span></>}<br />
                  <span className="text-sk-text-1">3</span>,<span className="text-sk-accent">AceHunter_MX</span>,<span className="text-sk-gold">0</span>{hasLeague && <>,<span className="text-sk-purple">0</span></>}
                </div>

                <p className="text-[10px] text-sk-text-3 mt-1">
                  💡 Si no hay columna "lugar", las posiciones se asignan por orden. Los números pueden usar coma o punto decimal indistintamente (ej. 1.500,50 o 1500.50). Las columnas no reconocidas son ignoradas.
                </p>
              </div>

              <Link           
                to="/tutorial-csv"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sk-xs text-sk-accent font-medium hover:opacity-80 transition-opacity mt-1"
              >
                <ExternalLink size={12} />
                Tutorial: Cómo crear el CSV de resultados
              </Link>
            </div>

            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            <Button variant="accent" size="md" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Seleccionar archivo CSV
            </Button>
          </div>
        )}

        {csvErrors.length > 0 && (
          <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sk-red text-sk-sm font-semibold">
              <AlertTriangle size={14} />
              {csvErrors.length} error(es) en el CSV
            </div>
            <ul className="space-y-1">
              {csvErrors.slice(0, 10).map((err, i) => (
                <li key={i} className="text-sk-xs text-sk-red/80 flex items-start gap-1.5">
                  <XCircle size={11} className="mt-0.5 shrink-0" />
                  {err.message}
                </li>
              ))}
              {csvErrors.length > 10 && (
                <li className="text-sk-xs text-sk-red/60">... y {csvErrors.length - 10} errores más</li>
              )}
            </ul>
          </div>
        )}

        {imported && rows.length > 0 && (
          <>
            {detectedCols.length > 0 && csvErrors.filter((e) => e.row === 0).length === 0 && (
              <div className="flex items-center gap-2 flex-wrap text-sk-xs text-sk-green">
                <CheckCircle2 size={12} />
                <span>Columnas detectadas:</span>
                {detectedCols.map((c) => (
                  <code key={c} className="font-mono bg-sk-green-dim px-1.5 py-0.5 rounded-xs text-[10px]">{c}</code>
                ))}
              </div>
            )}

            <p className="text-sk-xs text-sk-text-2">
              Revisa los datos importados. Puedes editar cualquier celda antes de subir. Si un nickname no existe, se creará automáticamente con ELO 1200.
            </p>

            <div className="border border-sk-border-2 rounded-md overflow-x-auto">
              <table className="w-full text-sk-xs">
                <thead>
                  <tr>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-10">Pos</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left">Nickname</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-24">Premio</th>
                    {hasLeague && (
                      <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-purple py-2 px-2 text-left w-20">
                        Puntos
                        <span className="ml-1 text-sk-text-4 normal-case font-normal">(vacío=0)</span>
                      </th>
                    )}
                    <th className="bg-sk-bg-3 w-8 py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-sk-border-2">
                      <td className="py-2 px-2 font-mono font-bold text-sk-text-1">{row.position}°</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={row.nickname}
                            onChange={(e) => updateRow(i, "nickname", e.target.value)}
                            placeholder="Nickname..."
                            className="flex-1 bg-sk-bg-0 border border-sk-border-2 rounded-md py-1.5 px-2.5 text-sk-xs text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent font-mono"
                          />
                          {row.status === "found" && <span className="text-sk-green text-[10px]">✓</span>}
                          {row.status === "created" && <span className="text-sk-gold text-[10px]">NEW</span>}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={row.prizeWon || ""}
                          onChange={(e) => updateRow(i, "prizeWon", Number(e.target.value))}
                          placeholder="0" min={0}
                          className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-1.5 px-2 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent"
                        />
                      </td>
                      {hasLeague && (
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={row.leaguePoints === 0 ? "0" : row.leaguePoints || ""}
                            onChange={(e) => updateRow(i, "leaguePoints", e.target.value === "" ? 0 : Number(e.target.value))}
                            placeholder="0" min={0}
                            className="w-full bg-sk-bg-0 border border-sk-purple/30 rounded-md py-1.5 px-2 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-purple"
                          />
                        </td>
                      )}
                      <td className="py-2 px-2">
                        <button onClick={() => removeRow(i)} className="text-sk-text-3 hover:text-sk-red transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={addRow}>
                <Plus size={14} /> Agregar jugador
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-sk-text-3">
                Cargar otro CSV
              </Button>
            </div>

            {rows.some((r) => r.status !== "pending") && (
              <div className="flex gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-sk-green">✓ Encontrado</span>
                <span className="flex items-center gap-1 text-sk-gold">NEW Creado (ELO 1200)</span>
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
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          {imported && rows.length > 0 && (
            <Button
              variant="accent"
              size="sm"
              onClick={handleResolveAndUpload}
              isLoading={resolving || uploading}
            >
              <Upload size={14} /> Resolver y Subir ELO
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}