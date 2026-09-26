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

// 🔥 CREDENCIALES DE POSTHOG (Blindadas contra comillas, seguras para producción)
const POSTHOG_API_KEY = String(import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY || "").replace(/['"]/g, '').trim(); 
const POSTHOG_PROJECT_ID = String(import.meta.env.VITE_POSTHOG_PROJECT_ID || "").replace(/\D/g, ''); 
const POSTHOG_HOST = String(import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "us.posthog.com").replace(/['"]/g, '').replace('https://', '').replace('http://', '').trim();

export async function syncBlogViewsFromPostHog() {
  try {
    // 1. Obtenemos todos los artículos publicados
    const { data: posts, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, slug')
      .eq('published', true); 

    if (fetchError || !posts) throw new Error("Error obteniendo posts: " + fetchError?.message);

    let updatedCount = 0;
    let lastError = "";

    // 2. Consultamos a PostHog post por post usando HogQL (El motor más moderno y seguro)
    for (const post of posts) {
      const pagePath = `/${post.slug}`; 
      
      // Usamos el endpoint de consultas directas (POST) para evitar errores 404 de URL
      const posthogUrl = `https://${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;

      const response = await fetch(posthogUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POSTHOG_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            // Cuenta usuarios únicos que hayan visitado la ruta de este artículo
            query: `SELECT count(distinct person_id) FROM events WHERE event = '$pageview' AND properties.$pathname LIKE '%${pagePath}%'`
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Si hay error, lo guardamos con todos los detalles de conexión
        lastError = `HTTP ${response.status} | ID: ${POSTHOG_PROJECT_ID} | Host: ${POSTHOG_HOST} | Detalle: ${errorText.substring(0, 100)}`;
        console.warn(`PostHog Error en ${pagePath}:`, lastError);
        continue; 
      }

      const data = await response.json();
      
      // En HogQL, la respuesta viene dentro de un array de resultados
      let totalUniqueViews = 0;
      if (data.results && data.results.length > 0) {
          totalUniqueViews = Number(data.results[0][0]) || 0;
      }

      // 3. Guardamos el número exacto en Supabase
      const { error: updateError } = await supabase
          .from('blog_posts')
          .update({ unique_views: totalUniqueViews })
          .eq('id', post.id);

      if (updateError) {
          lastError = `Supabase Error: ${updateError.message}`;
          console.error(lastError);
      } else {
          updatedCount++;
      }
    }

    if (updatedCount === 0 && lastError) {
      return { success: false, message: `❌ Error de conexión: ${lastError}` };
    }

    return { success: true, message: `✅ ¡Éxito! Se actualizaron las lecturas de ${updatedCount} artículos (Visitantes Únicos reales).` };

  } catch (error) {
    const err = error as any; 
    console.error("Error crítico sincronizando visitas de PostHog:", err);
    return { success: false, message: `❌ Error del sistema: ${err.message}` };
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

