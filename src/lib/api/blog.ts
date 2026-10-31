// src/lib/api/blog.ts
import { supabase } from "../supabase";

export interface BlogBlock {
  type: "p" | "h2" | "h3" | "callout" | "stat" | "list" | "image" | "box" | "button" | "video";
  content?: string;
  value?: string;
  items?: string[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  read_time: number;
  body: BlogBlock[];
  // Imágenes — todas opcionales para no romper artículos sin imágenes
  image_og: string | null;        // 1200×630 — preview en redes sociales
  image_hero: string | null;      // 1200×600 — portada del artículo
  image_thumbnail: string | null; // 600×340  — miniatura en /blog
  image_inline: string | null;    // 800×400  — imagen dentro del artículo
  custom_banner_mid_src: string | null;   // 🔥 Banner Intermedio Exclusivo
  custom_banner_mid_href: string | null;  // 🔥 Link Intermedio Exclusivo
  custom_banner_final_src: string | null; // 🔥 Banner Final Exclusivo
  custom_banner_final_href: string | null;// 🔥 Link Final Exclusivo
  published: boolean;
  published_at: string | null;
  created_at: string;
  unique_views: number;
}

export function formatBlogDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, category, read_time, image_thumbnail, image_og, published_at, created_at")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BlogPost[];
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as BlogPost;
}

export interface CreateBlogPostInput {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  read_time: number;
  body: BlogBlock[];
  image_og?: string | null;
  image_hero?: string | null;
  image_thumbnail?: string | null;
  image_inline?: string | null;
  custom_banner_mid_src?: string | null;   // 🔥
  custom_banner_mid_href?: string | null;  // 🔥
  custom_banner_final_src?: string | null; // 🔥
  custom_banner_final_href?: string | null;// 🔥
  published?: boolean;
  published_at?: string | null; // 🔥 NUEVO CAMPO ACEPTADO
}

export async function createBlogPost(input: CreateBlogPostInput): Promise<BlogPost> {
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      ...input,
      published_at: input.published ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BlogPost;
}

export async function updateBlogPost(
  id: string,
  input: Partial<CreateBlogPostInput>
): Promise<BlogPost> {
  const updates: Record<string, unknown> = { ...input };
  
  // Si lo marcan publicado, pero NO enviaron una fecha específica en el input, ponemos la fecha actual.
  // De lo contrario, respetamos la que venga en updates.published_at
  if (input.published === true && !input.published_at) {
    updates.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as BlogPost;
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}

// La clave personal de PostHog nunca debe estar en el bundle Vite.
// La consulta se realiza en Cloudflare Pages Functions con autorización del servidor.
export async function syncBlogViewsFromPostHog(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      return { success: false, message: "Debes iniciar sesión para sincronizar visitas." };
    }
    const response = await fetch("/api/sync-blog-views", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return { success: false, message: `El servidor devolvió HTTP ${response.status} sin JSON. No se confirmó la sincronización.` };
    }
    const result = await response.json() as { success?: boolean; message?: string };
    return {
      success: response.ok && result.success === true,
      message: result.message || `Sincronización no completada (HTTP ${response.status}).`,
    };
  } catch (err) {
    console.error("Error contacting blog sync endpoint", err instanceof Error ? err.name : "unknown");
    return { success: false, message: "No se pudo completar la conexión con el servidor de sincronización." };
  }
}

// 🔥 FUNCIÓN PARA DUPLICAR UN ARTÍCULO EXISTENTE
export async function duplicateBlogPost(id: string): Promise<BlogPost> {
  // 1. Obtenemos el post original completo
  const { data: original, error: fetchError } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !original) throw new Error("Error al obtener el post original: " + fetchError?.message);

  // 2. Extraemos los campos que NO queremos clonar (como el ID o fechas de creación)
  const { id: _oldId, created_at: _createdAt, updated_at: _updatedAt, ...postData } = original;
  
  // 3. Armamos el nuevo post modificado
  const newPost = {
    ...postData,
    title: `${original.title} (Copia)`,
    slug: `${original.slug}-copia-${Date.now()}`, // Le agregamos un timestamp para que la URL sea única sí o sí
    published: false, // Lo dejamos como borrador por seguridad
    published_at: null,
    unique_views: 0 // Reseteamos las vistas a cero
  };

  // 4. Lo guardamos en la base de datos
  const { data: copy, error: insertError } = await supabase
    .from("blog_posts")
    .insert(newPost)
    .select()
    .single();

  if (insertError) throw new Error("Error al duplicar el post: " + insertError.message);
  
  return copy as BlogPost;
}