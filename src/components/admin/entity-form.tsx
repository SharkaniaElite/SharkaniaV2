// src/components/admin/entity-form.tsx
import { useState } from "react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { supabase } from "../../lib/supabase";

interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

interface EntityFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  table: string;
  fields: Field[];
  initialData?: Record<string, unknown> | null;
  title: string;
}

export function EntityForm({
  isOpen,
  onClose,
  onSaved,
  table,
  fields,
  initialData,
  title,
}: EntityFormProps) {
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    if (initialData) return { ...initialData };
    const defaults: Record<string, unknown> = {};
    for (const f of fields) {
      defaults[f.key] = f.type === "checkbox" ? false : f.type === "number" ? 0 : "";
    }
    return defaults;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    // Validate required
    for (const f of fields) {
      if (f.required && !form[f.key]) {
        setError(`${f.label} es obligatorio`);
        return;
      }
    }

    setSaving(true);
    setError("");

    // Build payload (only fields defined)
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const val = form[f.key];
      if (f.type === "number") {
        payload[f.key] = Number(val) || 0;
      } else if (f.type === "checkbox") {
        payload[f.key] = Boolean(val);
      } else {
        payload[f.key] = val || null;
      }
    }

    try {
      if (isEdit) {
        const { error: err } = await supabase.from(table).update(payload).eq("id", form.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from(table).insert(payload);
        if (err) throw err;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent";
  const labelClass = "font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${isEdit ? "Editar" : "Crear"} ${title}`}>
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className={labelClass}>
              {f.label} {f.required && "*"}
            </label>
            {f.type === "select" ? (
              <select
                value={String(form[f.key] ?? "")}
                onChange={(e) => update(f.key, e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccionar</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                value={String(form[f.key] ?? "")}
                onChange={(e) => update(f.key, e.target.value)}
                className={`${inputClass} min-h-[80px] resize-y`}
                placeholder={f.placeholder}
              />
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form[f.key])}
                  onChange={(e) => update(f.key, e.target.checked)}
                  className="w-4 h-4 rounded accent-sk-accent"
                />
                <span className="text-sk-sm text-sk-text-1">Sí</span>
              </label>
            ) : (
              <input
                type={f.type}
                value={String(form[f.key] ?? "")}
                onChange={(e) => update(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                className={inputClass}
                placeholder={f.placeholder}
              />
            )}
          </div>
        ))}

        {error && (
          <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Helper to delete any entity
export async function deleteEntity(table: string, id: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  return !error;
}
