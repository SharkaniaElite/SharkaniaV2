// src/components/admin/entity-form.tsx
import { useState } from "react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { supabase } from "../../lib/supabase";

interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "checkbox" | "image";
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
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [sharkyAlert, setSharkyAlert] = useState(false);

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (key: string, file: File) => {
    if (file.size > 1024 * 1024) {
      setSharkyAlert(true);
      return;
    }
    setSharkyAlert(false);
    setUploadingImage(key);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `entity-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('img_clubs')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('img_clubs').getPublicUrl(fileName);
      update(key, data.publicUrl);
    } catch (err: any) {
      setError("Error al subir imagen: " + err.message);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = async () => {
    for (const f of fields) {
      if (f.required && !form[f.key]) {
        setError(`${f.label} es obligatorio`);
        return;
      }
    }

    setSaving(true);
    setError("");

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
            
            {f.type === "image" ? (
              <div className="bg-sk-bg-3 border border-sk-border-2 rounded-lg p-3">
                {/* 👇 Corrección de TypeScript: Boolean() y String() */}
                {Boolean(form[f.key]) && (
                  <div className="h-20 w-full mb-3 rounded border border-sk-border-2 bg-cover bg-center" style={{ backgroundImage: `url('${String(form[f.key])}')` }} />
                )}
                <input 
                  type="file" accept="image/png, image/jpeg, image/webp" 
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(f.key, e.target.files[0])}
                  disabled={uploadingImage === f.key}
                  className="text-sk-xs text-sk-text-2 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-sk-accent/10 file:text-sk-accent hover:file:bg-sk-accent/20 cursor-pointer disabled:opacity-50"
                />
                {sharkyAlert && (
                  <div className="flex items-start gap-3 bg-sk-bg-2 border border-sk-accent/30 p-3 rounded-lg mt-3 animate-in fade-in">
                    <img src="/mascot/shark-1.webp" alt="Sharky" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.2)]" />
                    <div>
                      <p className="text-sk-sm font-bold text-sk-text-1 mb-0.5">¡Cuidado con el peso! 🦈</p>
                      <p className="text-[10px] text-sk-text-2 leading-relaxed">Tu imagen supera el límite de <strong>1MB</strong>. Usa <a href="https://squoosh.app/" target="_blank" rel="noreferrer" className="text-sk-accent hover:underline font-bold">squoosh.app</a> para comprimirla.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : f.type === "select" ? (
              <select value={String(form[f.key] ?? "")} onChange={(e) => update(f.key, e.target.value)} className={inputClass}>
                <option value="">Seleccionar</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea value={String(form[f.key] ?? "")} onChange={(e) => update(f.key, e.target.value)} className={`${inputClass} min-h-[80px] resize-y`} placeholder={f.placeholder} />
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => update(f.key, e.target.checked)} className="w-4 h-4 rounded accent-sk-accent" />
                <span className="text-sk-sm text-sk-text-1">Sí</span>
              </label>
            ) : (
              <input type={f.type} value={String(form[f.key] ?? "")} onChange={(e) => update(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} className={inputClass} placeholder={f.placeholder} />
            )}
          </div>
        ))}

        {error && <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">{error}</div>}

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

// 👇 Corrección de ESLint: Le decimos al linter que ignore la regla en esta línea específica
// eslint-disable-next-line react-refresh/only-export-components
export async function deleteEntity(table: string, id: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  return !error;
}