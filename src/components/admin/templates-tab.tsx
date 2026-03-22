// src/components/admin/templates-tab.tsx
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { EmptyState } from "../ui/empty-state";
import { BulkDeleteBar } from "./bulk-delete-bar";
import { TemplateForm } from "./template-form";
import { InfoTooltip } from "../ui/info-tooltip";
import { ADMIN_HELP } from "../../lib/admin-help-texts";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Upload,
  Copy,
  Zap,
  ToggleLeft,
  ToggleRight,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import {
  type TournamentTemplate,
  type CSVCalendarRow,
  getTemplatesByClub,
  deleteTemplate,
  toggleTemplateActive,
  createTournamentFromTemplate,
  generateCalendar,
  importCalendarFromCSV,
  DAY_LABELS,
} from "../../lib/api/tournament-templates";
import { formatCurrency } from "../../lib/format";

interface TemplatesTabProps {
  clubId: string;
  leagueOptions: { id: string; name: string }[];
  onTournamentsChanged: () => void;
}

export function TemplatesTab({ clubId, leagueOptions, onTournamentsChanged }: TemplatesTabProps) {
  const queryClient = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<TournamentTemplate | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Quick clone state
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneDate, setCloneDate] = useState("");
  const [cloneTime, setCloneTime] = useState("");
  const [cloneLoading, setCloneLoading] = useState(false);

  // Generate calendar state
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ count: number } | null>(null);

  // CSV import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk delete state for generated tournaments
  const [selectedGeneratedIds, setSelectedGeneratedIds] = useState<string[]>([]);

  // ── Queries ──

  const { data: templates, isLoading } = useQuery({
    queryKey: ["tournament-templates", clubId],
    queryFn: () => getTemplatesByClub(clubId),
    enabled: !!clubId,
  });

  const { data: scheduledFromTemplates } = useQuery({
    queryKey: ["scheduled-from-templates", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, start_datetime, template_id, buy_in, status, results_uploaded")
        .eq("club_id", clubId)
        .eq("status", "scheduled")
        .eq("results_uploaded", false)
        .not("template_id", "is", null)
        .order("start_datetime", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clubId,
  });

  // ── Helpers ──

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tournament-templates", clubId] });
    queryClient.invalidateQueries({ queryKey: ["scheduled-from-templates", clubId] });
    onTournamentsChanged();
  };

  const selectAllGenerated = () => {
    setSelectedGeneratedIds((scheduledFromTemplates ?? []).map((t) => t.id));
  };

  const deselectAllGenerated = () => {
    setSelectedGeneratedIds([]);
  };

  const toggleGeneratedSelection = (id: string) => {
    setSelectedGeneratedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ── Delete template ──
  const handleDelete = async (t: TournamentTemplate) => {
    if (!confirm(`¿Eliminar plantilla "${t.name}"? Los torneos creados desde ella NO se eliminan.`)) return;
    setDeleting(t.id);
    try {
      await deleteTemplate(t.id);
      refresh();
    } finally {
      setDeleting(null);
    }
  };

  // ── Toggle active ──
  const handleToggle = async (t: TournamentTemplate) => {
    await toggleTemplateActive(t.id, !t.is_active);
    refresh();
  };

  // ── Quick clone ──
  const handleClone = async (templateId: string) => {
    if (!cloneDate) return;
    setCloneLoading(true);
    try {
      const template = templates?.find((t) => t.id === templateId);
      const time = cloneTime || template?.default_hour?.slice(0, 5) || "22:00";
      const dt = new Date(`${cloneDate}T${time}:00`);
      await createTournamentFromTemplate(templateId, dt.toISOString());
      setCloningId(null);
      setCloneDate("");
      setCloneTime("");
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear torneo");
    } finally {
      setCloneLoading(false);
    }
  };

  // ── Generate calendar ──
  const handleGenerateCalendar = async () => {
    const recurrentCount = templates?.filter((t) => t.is_active && t.recurrence_days?.length).length ?? 0;
    if (!recurrentCount) {
      alert("No tienes plantillas activas con días de repetición configurados.");
      return;
    }
    if (!confirm(`Se generarán torneos de los próximos 30 días basándose en ${recurrentCount} plantilla(s) recurrente(s). ¿Continuar?`)) return;

    setGenerating(true);
    setGenerateResult(null);
    try {
      const count = await generateCalendar(clubId, 30);
      setGenerateResult({ count });
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al generar calendario");
    } finally {
      setGenerating(false);
    }
  };

  // ── CSV import ──
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !templates) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

      if (lines.length < 2) {
        setImportResult({ created: 0, errors: ["El archivo está vacío o solo tiene encabezado."] });
        return;
      }

      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
      const templateIdx = header.findIndex((h) => h.includes("plantilla") || h.includes("template"));
      const dateIdx = header.findIndex((h) => h.includes("fecha") || h.includes("date"));
      const timeIdx = header.findIndex((h) => h.includes("hora") || h.includes("time"));
      const nameIdx = header.findIndex((h) => h.includes("nombre") || h.includes("name_override"));
      const buyinIdx = header.findIndex((h) => h.includes("buyin") || h.includes("buy_in"));
      const gtdIdx = header.findIndex((h) => h.includes("garantizado") || h.includes("guaranteed") || h.includes("gtd"));

      if (templateIdx === -1 || dateIdx === -1) {
        setImportResult({ created: 0, errors: ["El CSV debe tener columnas 'plantilla' y 'fecha' (mínimo)."] });
        return;
      }

      const rows: CSVCalendarRow[] = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return {
          template_name: cols[templateIdx] ?? "",
          date: cols[dateIdx] ?? "",
          time: timeIdx >= 0 ? cols[timeIdx] : undefined,
          name_override: nameIdx >= 0 ? cols[nameIdx] : undefined,
          buy_in_override: buyinIdx >= 0 ? cols[buyinIdx] : undefined,
          guaranteed_override: gtdIdx >= 0 ? cols[gtdIdx] : undefined,
        };
      }).filter((r) => r.template_name && r.date);

      const result = await importCalendarFromCSV(clubId, rows, templates);
      setImportResult(result);
      if (result.created > 0) refresh();
    } catch (err) {
      setImportResult({ created: 0, errors: [err instanceof Error ? err.message : "Error al procesar CSV"] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div>
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sk-md font-bold text-sk-text-1">Plantillas de Torneo</h2>
          <InfoTooltip title={ADMIN_HELP.templates.title} content={ADMIN_HELP.templates.content} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" size="sm" onClick={() => setEditTemplate(null)}>
            <Plus size={14} /> Nueva Plantilla
          </Button>
        </div>
      </div>

      {/* Action bar: Generate + CSV */}
      {(templates?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="primary" size="sm" onClick={handleGenerateCalendar} isLoading={generating}>
            <Zap size={14} /> Generar Calendario (30 días)
          </Button>
          <InfoTooltip title={ADMIN_HELP.generateCalendar.title} content={ADMIN_HELP.generateCalendar.content} size="sm" />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} isLoading={importing}>
            <Upload size={14} /> Importar CSV
          </Button>
          <InfoTooltip title={ADMIN_HELP.importCSV.title} content={ADMIN_HELP.importCSV.content} size="sm" />
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSVImport} className="hidden" />
        </div>
      )}

      {/* Generate result */}
      {generateResult && (
        <div className="bg-sk-green-dim border border-sk-green/20 rounded-lg p-3 mb-4 flex items-center gap-2">
          <CheckCircle size={14} className="text-sk-green shrink-0" />
          <p className="text-sk-xs text-sk-green">
            {generateResult.count > 0
              ? `${generateResult.count} torneo(s) creado(s) para los próximos 30 días.`
              : "No se crearon torneos nuevos — ya existen todos para este período."}
          </p>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className={`border rounded-lg p-3 mb-4 ${importResult.errors.length ? "bg-sk-gold-dim border-sk-gold/20" : "bg-sk-green-dim border-sk-green/20"}`}>
          <div className="flex items-center gap-2 mb-1">
            {importResult.errors.length ? <AlertTriangle size={14} className="text-sk-gold" /> : <CheckCircle size={14} className="text-sk-green" />}
            <p className="text-sk-xs font-semibold" style={{ color: importResult.errors.length ? "#fbbf24" : "#34d399" }}>
              {importResult.created} torneo(s) creado(s){importResult.errors.length ? `, ${importResult.errors.length} error(es)` : ""}
            </p>
          </div>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {importResult.errors.map((err, i) => (
                <li key={i} className="text-[11px] text-sk-text-3">{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* BULK DELETE: Torneos programados desde plantillas     */}
      {/* ══════════════════════════════════════════════════════ */}
      {(scheduledFromTemplates?.length ?? 0) > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
            Torneos programados desde plantillas ({scheduledFromTemplates?.length})
          </p>
          <InfoTooltip title={ADMIN_HELP.bulkDelete.title} content={ADMIN_HELP.bulkDelete.content} size="sm" />
        </div>

          <BulkDeleteBar
            selectedIds={selectedGeneratedIds}
            totalScheduled={scheduledFromTemplates?.length ?? 0}
            onSelectAll={selectAllGenerated}
            onDeselectAll={deselectAllGenerated}
            onDeleted={() => {
              deselectAllGenerated();
              refresh();
            }}
          />

          {/* Lista de torneos generados con checkboxes */}
          <div className="mt-2 border border-sk-border-1 rounded-lg bg-sk-bg-2 max-h-48 overflow-y-auto">
            {(scheduledFromTemplates ?? []).map((t) => {
              const isSelected = selectedGeneratedIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleGeneratedSelection(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.02] border-b border-sk-border-1 last:border-b-0 ${
                    isSelected ? "bg-sk-red-dim/30" : ""
                  }`}
                >
                  <span className="text-sk-text-3 shrink-0">
                    {isSelected ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <rect x="1" y="1" width="14" height="14" rx="3" fill="#22d3ee" stroke="#22d3ee" strokeWidth="1"/>
                        <path d="M4.5 8L7 10.5L11.5 5.5" stroke="#09090b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
                      </svg>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-sk-text-2 w-20 shrink-0">
                    {new Date(t.start_datetime).toLocaleDateString("es-CL")}
                  </span>
                  <span className="text-sk-xs text-sk-text-1 truncate">{t.name}</span>
                  <span className="font-mono text-[11px] text-sk-gold ml-auto shrink-0">
                    ${Number(t.buy_in).toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* TEMPLATES LIST                                        */}
      {/* ══════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="animate-sk-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-sk-bg-3 rounded-lg" />
          ))}
        </div>
      ) : !(templates ?? []).length ? (
        <EmptyState
          icon="📋"
          title="Sin plantillas"
          description="Crea una plantilla para cada tipo de torneo de tu club. Después podrás generar calendarios con un solo click."
          action={<Button variant="accent" size="sm" onClick={() => setEditTemplate(null)}>Crear Plantilla</Button>}
        />
      ) : (
        <div className="space-y-2">
          {(templates ?? []).map((t) => (
            <div
              key={t.id}
              className={`bg-sk-bg-2 border rounded-lg p-4 transition-colors ${
                t.is_active ? "border-sk-border-2" : "border-sk-border-1 opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sk-sm font-bold text-sk-text-1">{t.name}</h3>
                    <Badge variant={t.is_active ? "green" : "muted"}>
                      {t.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    {t.buy_in > 0 && (
                      <span className="font-mono text-[11px] font-bold text-sk-gold">
                        {formatCurrency(t.buy_in)} {t.currency}
                      </span>
                    )}
                    {t.buy_in === 0 && <Badge variant="accent">Freeroll</Badge>}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-sk-text-3 flex-wrap">
                    <span>{t.poker_rooms?.name ?? "Sala"}</span>
                    <span>{t.game_type} · {t.tournament_type}</span>
                    <span className="font-mono">{t.default_hour.slice(0, 5)} ({t.default_timezone.split("/").pop()?.replace("_", " ")})</span>
                    {t.guaranteed_prize && (
                      <span className="font-mono text-sk-gold">GTD {formatCurrency(t.guaranteed_prize)}</span>
                    )}
                    {t.leagues && <span className="text-sk-accent">{t.leagues.name}</span>}
                  </div>

                  {/* Recurrence days */}
                  {t.recurrence_days && t.recurrence_days.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <Calendar size={11} className="text-sk-text-4" />
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                          <span
                            key={day}
                            className={`w-6 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
                              t.recurrence_days?.includes(day)
                                ? "bg-sk-accent/15 text-sk-accent"
                                : "bg-sk-bg-3 text-sk-text-4"
                            }`}
                          >
                            {DAY_LABELS[day]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick clone row */}
                  {cloningId === t.id && (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-sk-bg-3 rounded-md border border-sk-border-1">
                      <input
                        type="date"
                        value={cloneDate}
                        min={todayStr}
                        onChange={(e) => setCloneDate(e.target.value)}
                        className="bg-sk-bg-0 border border-sk-border-2 rounded px-2 py-1 text-sk-xs text-sk-text-1 focus:outline-none focus:border-sk-accent"
                      />
                      <input
                        type="time"
                        value={cloneTime}
                        onChange={(e) => setCloneTime(e.target.value)}
                        placeholder={t.default_hour.slice(0, 5)}
                        className="bg-sk-bg-0 border border-sk-border-2 rounded px-2 py-1 text-sk-xs text-sk-text-1 focus:outline-none focus:border-sk-accent w-24"
                      />
                      <Button variant="accent" size="xs" onClick={() => handleClone(t.id)} isLoading={cloneLoading}>
                        Crear
                      </Button>
                      <button
                        onClick={() => { setCloningId(null); setCloneDate(""); setCloneTime(""); }}
                        className="text-sk-text-3 hover:text-sk-text-1 text-sk-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setCloningId(cloningId === t.id ? null : t.id)} title="Crear torneo desde esta plantilla" className="text-sk-text-2 hover:text-sk-accent p-1.5 rounded hover:bg-white/[0.04] transition-colors">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => handleToggle(t)} title={t.is_active ? "Desactivar" : "Activar"} className="text-sk-text-2 hover:text-sk-accent p-1.5 rounded hover:bg-white/[0.04] transition-colors">
                    {t.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => setEditTemplate(t)} title="Editar" className="text-sk-text-2 hover:text-sk-accent p-1.5 rounded hover:bg-white/[0.04] transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(t)} disabled={deleting === t.id} title="Eliminar" className="text-sk-text-2 hover:text-sk-red p-1.5 rounded hover:bg-white/[0.04] transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CSV format help */}
      {(templates?.length ?? 0) > 0 && (
        <div className="mt-6 bg-sk-bg-2 border border-sk-border-1 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet size={14} className="text-sk-text-3" />
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
              Formato CSV para importar calendario
            </p>
          </div>
          <pre className="text-[11px] text-sk-text-2 font-mono bg-sk-bg-0 rounded p-3 overflow-x-auto leading-relaxed">
{`plantilla,fecha,hora,nombre,buyin,garantizado
${templates?.[0]?.name ?? "Freeroll Nocturno"},2026-04-01,22:00,,
${templates?.[0]?.name ?? "Freeroll Nocturno"},2026-04-03,22:00,Especial Viernes,
${templates?.[1]?.name ?? "$5.50 Freezeout"},2026-04-02,21:00,,5.50,100`}
          </pre>
          <p className="text-[10px] text-sk-text-4 mt-2">
            Solo "plantilla" y "fecha" son obligatorios. Los demás campos son opcionales (usa los valores de la plantilla por defecto).
          </p>
        </div>
      )}

      {/* Template form modal */}
      {editTemplate !== undefined && (
        <TemplateForm
          isOpen
          onClose={() => setEditTemplate(undefined)}
          onSaved={refresh}
          clubId={clubId}
          template={editTemplate}
          leagueOptions={leagueOptions}
        />
      )}
    </div>
  );
}
