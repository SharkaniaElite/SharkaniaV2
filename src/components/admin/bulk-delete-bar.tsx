// src/components/admin/bulk-delete-bar.tsx
import { useState } from "react";
import { Button } from "../ui/button";
import { Trash2, X, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface BulkDeleteBarProps {
  selectedIds: string[];
  totalScheduled: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleted: () => void;
}

export function BulkDeleteBar({
  selectedIds,
  totalScheduled,
  onSelectAll,
  onDeselectAll,
  onDeleted,
}: BulkDeleteBarProps) {
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const msg = `¿Eliminar ${selectedIds.length} torneo(s) programado(s)?\n\nSolo se eliminarán los que están en estado "scheduled" y sin resultados. Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;

    setDeleting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc("bulk_delete_scheduled_tournaments", {
        p_tournament_ids: selectedIds,
      });

      if (error) throw error;
      setResult({ count: data as number });
      onDeselectAll();
      onDeleted();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar torneos");
    } finally {
      setDeleting(false);
    }
  };

  if (!totalScheduled) return null;

  const allSelected = selectedIds.length === totalScheduled && totalScheduled > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-3 bg-sk-bg-3 border border-sk-border-2 rounded-lg px-4 py-2.5">
        {/* Select all / deselect */}
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-1.5 text-sk-xs text-sk-text-2 hover:text-sk-text-1 transition-colors"
        >
          {allSelected ? <CheckSquare size={14} className="text-sk-accent" /> : <Square size={14} />}
          {allSelected ? "Deseleccionar todo" : `Seleccionar todos (${totalScheduled})`}
        </button>

        <div className="h-4 w-px bg-sk-border-2" />

        {/* Count */}
        <span className="text-sk-xs text-sk-text-3">
          {selectedIds.length > 0 ? (
            <span className="font-mono font-bold text-sk-text-1">{selectedIds.length}</span>
          ) : (
            "0"
          )}
          {" "}seleccionado(s)
        </span>

        <div className="flex-1" />

        {/* Delete button */}
        <Button
          variant="danger"
          size="xs"
          onClick={handleBulkDelete}
          isLoading={deleting}
          disabled={!selectedIds.length}
        >
          <Trash2 size={13} /> Eliminar seleccionados
        </Button>
      </div>

      {/* Result message */}
      {result && (
        <div className="flex items-center gap-2 bg-sk-green-dim border border-sk-green/20 rounded-md px-3 py-2">
          <AlertTriangle size={13} className="text-sk-green" />
          <span className="text-sk-xs text-sk-green">
            {result.count} torneo(s) eliminado(s) correctamente.
          </span>
          <button onClick={() => setResult(null)} className="ml-auto text-sk-green/60 hover:text-sk-green">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
