import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { getAllSharkVideos, sharkTvQueryKey } from "../../lib/api/shark-tv";
import { validateEpisode, type SharkEpisode } from "../../lib/shark-tv";
import { supabase } from "../../lib/supabase";

const fields = [
  { name: "title", label: "Título", required: true },
  { name: "series", label: "Serie" },
  { name: "video_url", label: "URL oficial del reproductor de Rumble", required: true },
  { name: "public_url", label: "Página pública de Rumble" },
  { name: "thumbnail_url", label: "URL HTTPS de la miniatura" },
  { name: "duration", label: "Duración (min:seg)" },
  { name: "instructor_name", label: "Presentador" },
  { name: "level", label: "Nivel" },
  { name: "tags", label: "Temas separados por coma" },
  { name: "hero_position", label: "Posición del jugador" },
  { name: "hero_cards", label: "Cartas del jugador (As,Kd)" },
  { name: "board", label: "Cartas comunitarias (9d,Kh,2c)" },
] as const;

const fieldClass = "block w-full rounded border border-sk-border-2 bg-sk-bg-0 p-2 text-sk-text-1 focus:border-sk-accent focus:outline-none";
const csv = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map(part => part.trim()).filter(Boolean);

export function SharkTvAdmin() {
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: sharkTvQueryKey, queryFn: getAllSharkVideos });
  const [editing, setEditing] = useState<SharkEpisode | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const context = editing?.table_context;
  const defaults = {
    ...editing,
    ...context,
    tags: Array.isArray(editing?.tags) ? editing.tags.join(", ") : "",
    hero_cards: Array.isArray(context?.hero_cards) ? context.hero_cards.join(", ") : "",
    board: Array.isArray(context?.board) ? context.board.join(", ") : "",
  };

  async function save(build: () => unknown, existing?: SharkEpisode) {
    setBusy(true);
    setFeedback("");
    try {
      const payload = validateEpisode(build(), existing);
      const table = supabase.from("shark_tv_videos");
      const write = existing ? table.update(payload).eq("id", existing.id) : table.insert(payload);
      const { data, error } = await write.select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("No se pudo guardar el episodio. Revisa que el registro exista y tengas permiso para editarlo.");
      setEditing(null);
      setRevision(previous => previous + 1);
      setFeedback(existing ? "Episodio actualizado." : "Episodio publicado.");
      await client.invalidateQueries({ queryKey: sharkTvQueryKey });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo guardar el episodio.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    void save(() => ({
      title: text("title"),
      video_url: text("video_url"),
      thumbnail_url: text("thumbnail_url"),
      duration: text("duration"),
      level: text("level"),
      instructor_name: text("instructor_name"),
      tags: csv(data.get("tags")),
      table_context: {
        ...context,
        series: text("series"),
        description: text("description"),
        public_url: text("public_url"),
        featured: data.has("featured"),
        hero_position: text("hero_position"),
        hero_cards: csv(data.get("hero_cards")),
        board: csv(data.get("board")),
        analysis_verdict: text("analysis_verdict"),
      },
    }), editing ?? undefined);
  }

  return (
    <section className="space-y-4" aria-labelledby="shark-tv-admin-title">
      <div>
        <h2 id="shark-tv-admin-title" className="font-bold text-sk-text-1">Gestión de episodios de SharkTV</h2>
        <p className="text-sk-sm text-sk-text-2">En Rumble, abre Compartir → Insertar y copia solo la URL del atributo src. La página pública se guarda por separado.</p>
      </div>
      {catalog.isPending && <p role="status">Cargando episodios…</p>}
      {catalog.isError && <Button variant="secondary" onClick={() => void catalog.refetch()}>Reintentar carga de episodios</Button>}
      {catalog.data?.length === 0 && <p className="text-sk-text-2">Todavía no hay episodios en el catálogo administrable.</p>}
      {!!catalog.data?.length && (
        <label className="block text-sk-sm text-sk-text-2">
          Episodio para editar
          <select className={fieldClass} value={editing?.id ?? ""} disabled={busy} onChange={event => {
            setEditing(catalog.data.find(episode => episode.id === event.target.value) ?? null);
            setFeedback("");
          }}>
            <option value="">Crear episodio</option>
            {catalog.data.map(episode => <option key={episode.id} value={episode.id}>{episode.title}</option>)}
          </select>
        </label>
      )}
      {feedback && <p role="status" className="text-sk-text-1">{feedback}</p>}
      <form key={editing?.id ?? revision} onSubmit={submit} className="space-y-4 rounded-xl border border-sk-border-2 bg-sk-bg-2 p-4">
        <h3 className="font-bold text-sk-text-1">{editing ? "Editar episodio" : "Nuevo episodio"}</h3>
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
          {fields.map(field => {
            const value = defaults[field.name];
            return (
              <label key={field.name} className="text-sk-sm text-sk-text-2">
                {field.label}
                <input className={fieldClass} name={field.name} required={"required" in field}
                  defaultValue={typeof value === "string" ? value : ""} />
              </label>
            );
          })}
          <label className="text-sk-sm text-sk-text-2 sm:col-span-2">
            Descripción
            <textarea className={fieldClass} name="description" defaultValue={context?.description} />
          </label>
          <label className="text-sk-sm text-sk-text-2 sm:col-span-2">
            Análisis de la decisión
            <textarea className={fieldClass} name="analysis_verdict" defaultValue={context?.analysis_verdict} />
          </label>
          <label className="flex items-center gap-2 text-sk-sm text-sk-text-2">
            <input type="checkbox" name="featured" defaultChecked={context?.featured} /> Destacar en SharkTV
          </label>
        </fieldset>
        <Button type="submit" variant="accent" isLoading={busy}>{editing ? "Guardar cambios" : "Publicar episodio"}</Button>
      </form>
      <details className="rounded-xl border border-sk-border-2 p-4">
        <summary className="cursor-pointer font-semibold text-sk-text-1">Importar episodio desde JSON</summary>
        <form key={revision} className="mt-3 space-y-3" onSubmit={event => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          void save(() => JSON.parse(String(values.get("episode") ?? "")));
        }}>
          <label className="block text-sk-sm text-sk-text-2">
            JSON del episodio
            <textarea name="episode" className={fieldClass} rows={8} required spellCheck={false} disabled={busy} />
          </label>
          <Button type="submit" variant="secondary" isLoading={busy}>Publicar JSON</Button>
        </form>
      </details>
    </section>
  );
}
