// src/components/admin/results-upload.tsx
import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import { calculateElo } from "../../lib/api/elo-engine";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/cn";
import { Plus, Trash2, Upload, FileText, ClipboardPaste } from "lucide-react";
import type { TournamentWithDetails } from "../../types";

interface ResultRow {
  position: number;
  nickname: string;
  playerId: string;
  prizeWon: number;
  bountiesWon: number;
  status: "pending" | "found" | "not_found" | "created";
}

interface ResultsUploadProps {
  tournament: TournamentWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Resolve a nickname to a player ID, or create a new player
async function resolvePlayer(
  nickname: string,
  roomId: string,
  countryCode: string | null
): Promise<{ id: string; status: "found" | "created" }> {
  // Try to find existing player by nickname (case insensitive)
  const { data: existing } = await supabase
    .from("players")
    .select("id, nickname")
    .ilike("nickname", nickname.trim())
    .limit(1);

  if (existing && existing.length > 0 && existing[0]) {
    return { id: existing[0].id, status: "found" };
  }

  // Create new player with default ELO 1200
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

function parsePastedData(text: string): Array<{ nickname: string; prize: number; bounties: number }> {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  const results: Array<{ nickname: string; prize: number; bounties: number }> = [];

  for (const line of lines) {
    // Support formats:
    // "nickname prize bounties"
    // "nickname\tprize\tbounties"
    // "nickname, prize, bounties"
    // "nickname prize"
    // "nickname"
    const parts = line.split(/[\t,;]+/).map((s) => s.trim()).filter(Boolean);

    if (parts.length === 0) continue;

    const nickname = parts[0] ?? "";
    const prize = parts[1] ? parseFloat(parts[1].replace(/[$,]/g, "")) || 0 : 0;
    const bounties = parts[2] ? parseFloat(parts[2].replace(/[$,]/g, "")) || 0 : 0;

    if (nickname) {
      results.push({ nickname, prize, bounties });
    }
  }

  return results;
}

function parseCSV(text: string): Array<{ nickname: string; prize: number; bounties: number }> {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Skip header if it looks like one
  const firstLine = lines[0]!.toLowerCase();
  const startIndex = (firstLine.includes("nick") || firstLine.includes("jugador") || firstLine.includes("player") || firstLine.includes("pos")) ? 1 : 0;

  const results: Array<{ nickname: string; prize: number; bounties: number }> = [];

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i]!.split(",").map((s) => s.trim().replace(/"/g, ""));
    // Try to find nickname (first text column), prize, bounties
    // Support: pos,nickname,prize,bounties OR nickname,prize,bounties OR nickname,prize
    
    let nickname = "";
    let prize = 0;
    let bounties = 0;

    if (parts.length >= 4) {
      // pos, nickname, prize, bounties
      nickname = parts[1] ?? "";
      prize = parseFloat(parts[2]?.replace(/[$,]/g, "") ?? "0") || 0;
      bounties = parseFloat(parts[3]?.replace(/[$,]/g, "") ?? "0") || 0;
    } else if (parts.length === 3) {
      // nickname, prize, bounties OR pos, nickname, prize
      if (isNaN(Number(parts[0]))) {
        nickname = parts[0] ?? "";
        prize = parseFloat(parts[1]?.replace(/[$,]/g, "") ?? "0") || 0;
        bounties = parseFloat(parts[2]?.replace(/[$,]/g, "") ?? "0") || 0;
      } else {
        nickname = parts[1] ?? "";
        prize = parseFloat(parts[2]?.replace(/[$,]/g, "") ?? "0") || 0;
      }
    } else if (parts.length === 2) {
      if (isNaN(Number(parts[0]))) {
        nickname = parts[0] ?? "";
        prize = parseFloat(parts[1]?.replace(/[$,]/g, "") ?? "0") || 0;
      } else {
        nickname = parts[1] ?? "";
      }
    } else if (parts.length === 1) {
      nickname = parts[0] ?? "";
    }

    if (nickname) {
      results.push({ nickname, prize, bounties });
    }
  }

  return results;
}

export function ResultsUpload({
  tournament,
  isOpen,
  onClose,
  onComplete,
}: ResultsUploadProps) {
  const [rows, setRows] = useState<ResultRow[]>([
    { position: 1, nickname: "", playerId: "", prizeWon: 0, bountiesWon: 0, status: "pending" },
    { position: 2, nickname: "", playerId: "", prizeWon: 0, bountiesWon: 0, status: "pending" },
    { position: 3, nickname: "", playerId: "", prizeWon: 0, bountiesWon: 0, status: "pending" },
  ]);
  const [mode, setMode] = useState<"manual" | "paste" | "csv">("manual");
  const [pasteText, setPasteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addRow = () => {
    setRows([
      ...rows,
      { position: rows.length + 1, nickname: "", playerId: "", prizeWon: 0, bountiesWon: 0, status: "pending" },
    ]);
  };

  const removeRow = (index: number) => {
    setRows(
      rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, position: i + 1 }))
    );
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

  const handlePasteImport = () => {
    const parsed = parsePastedData(pasteText);
    if (parsed.length === 0) {
      setMessage({ text: "No se encontraron datos válidos", type: "error" });
      return;
    }
    setRows(
      parsed.map((p, i) => ({
        position: i + 1,
        nickname: p.nickname,
        playerId: "",
        prizeWon: p.prize,
        bountiesWon: p.bounties,
        status: "pending" as const,
      }))
    );
    setMode("manual");
    setMessage({ text: `${parsed.length} jugadores importados. Haz click en "Resolver y Subir" para continuar.`, type: "info" });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setMessage({ text: "No se encontraron datos en el CSV", type: "error" });
        return;
      }
      setRows(
        parsed.map((p, i) => ({
          position: i + 1,
          nickname: p.nickname,
          playerId: "",
          prizeWon: p.prize,
          bountiesWon: p.bounties,
          status: "pending" as const,
        }))
      );
      setMode("manual");
      setMessage({ text: `${parsed.length} jugadores importados del CSV.`, type: "info" });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResolveAndUpload = async () => {
    // Validate nicknames
    const emptyNicknames = rows.filter((r) => !r.nickname.trim());
    if (emptyNicknames.length > 0) {
      setMessage({ text: "Todos los jugadores deben tener un nickname", type: "error" });
      return;
    }

    const duplicateNicknames = rows.filter(
      (r, i, arr) => arr.findIndex((a) => a.nickname.toLowerCase() === r.nickname.toLowerCase()) !== i
    );
    if (duplicateNicknames.length > 0) {
      setMessage({ text: "Hay nicknames duplicados", type: "error" });
      return;
    }

    setResolving(true);
    setMessage({ text: "Resolviendo jugadores...", type: "info" });

    try {
      // Resolve all players
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

      if (createdCount > 0) {
        setMessage({ text: `${createdCount} jugadores nuevos creados con ELO 1200. Subiendo resultados...`, type: "info" });
      } else {
        setMessage({ text: "Todos los jugadores encontrados. Subiendo resultados...", type: "info" });
      }

      // Check for duplicate player IDs
      const duplicateIds = resolvedRows.filter(
        (r, i, arr) => arr.findIndex((a) => a.playerId === r.playerId) !== i
      );
      if (duplicateIds.length > 0) {
        setMessage({ text: "Error: hay jugadores que resolvieron al mismo ID. Verifica los nicknames.", type: "error" });
        setResolving(false);
        return;
      }

      // Upload results
      setUploading(true);
      const resultInserts = resolvedRows.map((r) => ({
        tournament_id: tournament.id,
        player_id: r.playerId,
        position: r.position,
        prize_won: r.prizeWon,
        bounties_won: r.bountiesWon,
      }));

      const { error: insertError } = await supabase
        .from("tournament_results")
        .insert(resultInserts);

      if (insertError) {
        setMessage({ text: `Error subiendo resultados: ${insertError.message}`, type: "error" });
        return;
      }

      // Calculate ELO
      setMessage({ text: "Calculando ELO...", type: "info" });
      const eloResult = await calculateElo(tournament.id);

      if (eloResult.success) {
        setMessage({ text: `✅ ${eloResult.message}. ${createdCount > 0 ? `${createdCount} jugadores nuevos creados.` : ""}`, type: "success" });
        setTimeout(() => {
          onComplete();
          onClose();
        }, 2500);
      } else {
        setMessage({ text: `⚠️ Resultados subidos pero ELO falló: ${eloResult.message}`, type: "error" });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error inesperado";
      setMessage({ text: errorMsg, type: "error" });
    } finally {
      setResolving(false);
      setUploading(false);
    }
  };

  const MODES = [
    { key: "manual" as const, label: "Manual", icon: <Plus size={12} /> },
    { key: "paste" as const, label: "Pegar", icon: <ClipboardPaste size={12} /> },
    { key: "csv" as const, label: "CSV", icon: <FileText size={12} /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Subir Resultados: ${tournament.name}`} className="max-w-2xl">
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 text-sk-xs font-medium px-3 py-1.5 rounded-sm transition-all duration-100",
                mode === m.key
                  ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                  : "text-sk-text-2 hover:text-sk-text-1"
              )}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Paste mode */}
        {mode === "paste" && (
          <div className="space-y-3">
            <p className="text-sk-xs text-sk-text-2">
              Pega los resultados. Formato por línea: <code className="font-mono text-sk-accent bg-sk-bg-3 px-1 rounded-xs">nickname, premio, bounties</code>
<br />
Separados por coma o tab. El premio y bounties son opcionales.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`SharkMaster_BR 100 0\nRiverKing_AR 75 0\nAceHunter_MX 50 0\nTiltProof_CL\nNutsHolder_CO`}
              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-xs text-sk-text-1 font-mono placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent min-h-[150px] resize-y"
            />
            <Button variant="accent" size="sm" onClick={handlePasteImport}>
              Importar datos
            </Button>
          </div>
        )}

        {/* CSV mode */}
        {mode === "csv" && (
          <div className="space-y-3">
            <p className="text-sk-xs text-sk-text-2">
              Sube un archivo CSV con columnas: <code className="font-mono text-sk-accent bg-sk-bg-3 px-1 rounded-xs">nickname, premio, bounties</code>
              <br />
              También acepta: <code className="font-mono text-sk-accent bg-sk-bg-3 px-1 rounded-xs">posición, nickname, premio, bounties</code>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <FileText size={14} /> Seleccionar archivo CSV
            </Button>
          </div>
        )}

        {/* Manual mode / Results table */}
        {mode === "manual" && (
          <>
            <p className="text-sk-xs text-sk-text-2">
              Escribe el nickname exacto de cada jugador. Si no existe, se creará automáticamente con ELO 1200.
            </p>

            <div className="border border-sk-border-2 rounded-md">
              <table className="w-full text-sk-xs">
                <thead>
                  <tr>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-10">Pos</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left">Nickname</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-20">Premio</th>
                    <th className="bg-sk-bg-3 font-mono text-[10px] font-semibold uppercase text-sk-text-2 py-2 px-2 text-left w-20">Bounties</th>
                    <th className="bg-sk-bg-3 w-8 py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-sk-border-2">
                      <td className="py-2 px-2 font-mono font-bold text-sk-text-1">
                        {row.position}°
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={row.nickname}
                            onChange={(e) => updateRow(i, "nickname", e.target.value)}
                            placeholder="Nickname exacto..."
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
                          placeholder="0"
                          min={0}
                          className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-1.5 px-2 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={row.bountiesWon || ""}
                          onChange={(e) => updateRow(i, "bountiesWon", Number(e.target.value))}
                          placeholder="0"
                          min={0}
                          className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-1.5 px-2 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent"
                        />
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
          </>
        )}

        {/* Status indicators */}
        {mode === "manual" && rows.some((r) => r.status !== "pending") && (
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-sk-green">✓ Encontrado</span>
            <span className="flex items-center gap-1 text-sk-gold">NEW Creado (ELO 1200)</span>
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            className={cn(
              "rounded-md p-3 text-sk-sm",
              message.type === "success" && "bg-sk-green-dim border border-sk-green/20 text-sk-green",
              message.type === "error" && "bg-sk-red-dim border border-sk-red/20 text-sk-red",
              message.type === "info" && "bg-sk-accent-dim border border-sk-accent/20 text-sk-accent"
            )}
          >
            {message.text}
          </div>
        )}

        {/* Actions */}
        {mode === "manual" && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={handleResolveAndUpload}
              isLoading={resolving || uploading}
            >
              <Upload size={14} /> Resolver y Subir ELO
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
