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


// 🔥 CREDENCIALES DE POSTHOG
const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY; 
const POSTHOG_PROJECT_ID = import.meta.env.VITE_POSTHOG_PROJECT_ID;
// Hacemos que tome el host real de tus variables (por si tu cuenta es EU o US)
const POSTHOG_HOST = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "app.posthog.com").replace('https://', '').replace('http://', '');

export async function syncBlogViewsFromPostHog() {
  try {
    // Validación de seguridad inicial
    if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
      return { success: false, message: "❌ Faltan credenciales de PostHog en tu archivo .env local o en Vercel/Cloudflare (VITE_POSTHOG_PERSONAL_API_KEY o VITE_POSTHOG_PROJECT_ID)." };
    }

    // 1. Obtenemos todos los artículos publicados
    const { data: posts, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, slug')
      .eq('published', true); 

    if (fetchError || !posts) throw new Error("Error obteniendo posts: " + fetchError?.message);

    let updatedCount = 0;
    let lastError = "";

    // 2. Consultamos a PostHog post por post
    for (const post of posts) {
      // 🔥 REPARACIÓN: Buscamos directamente el SLUG único para que atrape /blog, /noticias, etc.
      const pagePath = `/${post.slug}`; 

      const eventsStr = '[{"id":"$pageview","name":"$pageview","type":"events","math":"dau"}]';
      const propertiesStr = `[{"key":"$pathname","value":"${pagePath}","operator":"icontains","type":"event"}]`;
      
      const posthogUrl = `https://${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/insights/trend/?events=${encodeURIComponent(eventsStr)}&properties=${encodeURIComponent(propertiesStr)}&date_from=all`;

      const response = await fetch(posthogUrl, {
        headers: {
          'Authorization': `Bearer ${POSTHOG_API_KEY}`
        }
      });

      // 🔥 MANEJO DE ERROR REAL: Ya no fallará en silencio
      if (!response.ok) {
        const errorText = await response.text();
        lastError = `HTTP ${response.status}: ${errorText.substring(0, 80)}`;
        console.warn(`PostHog Error en ${pagePath}:`, lastError);
        continue; // Salta al siguiente pero guarda el error
      }

      const data = await response.json();
      
      let totalUniqueViews = 0;
      if (data.result && data.result.length > 0 && data.result[0].data) {
          totalUniqueViews = data.result[0].data.reduce((a: number, b: number) => a + b, 0);
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

    // Si terminó procesando 0 pero hubo errores, te lo mostramos
    if (updatedCount === 0 && lastError) {
      return { success: false, message: `❌ La API de PostHog rechazó la conexión. Verifica tu Personal API Key. Error: ${lastError}` };
    }

    return { success: true, message: `✅ ¡Éxito! Se actualizaron las lecturas de ${updatedCount} artículos usando los datos exactos de PostHog.` };

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

