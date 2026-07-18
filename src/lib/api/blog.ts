// src/lib/api/blog.ts
import { supabase } from "../supabase";

export interface BlogBlock {
  type: "p" | "h2" | "h3" | "callout" | "stat" | "list" | "image" | "box" | "button";
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
  if (input.published === true) {
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
const POSTHOG_HOST = "app.posthog.com"; 

export async function syncBlogViewsFromPostHog() {
  try {
    // 1. Obtenemos todos los artículos publicados
    const { data: posts, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, slug')
      .eq('status', 'published'); // Cambia 'status' por 'published' si usas un booleano

    if (fetchError || !posts) throw new Error("Error obteniendo posts: " + fetchError?.message);

    let updatedCount = 0;

    // 2. Consultamos a PostHog post por post
    for (const post of posts) {
      const pagePath = `/blog/${post.slug}`; 

      // Construimos la URL de la API de PostHog para buscar "Pageviews únicos"
      const posthogUrl = `https://${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/insights/trend/?events=[{"id":"$pageview","name":"$pageview","type":"events","math":"dau"}]&properties=[{"key":"$pathname","value":"${pagePath}","operator":"exact","type":"event"}]&date_from=all`;

      const response = await fetch(posthogUrl, {
        headers: {
          'Authorization': `Bearer ${POSTHOG_API_KEY}`
        }
      });

      if (!response.ok) {
        console.warn(`Error consultando PostHog para ${pagePath}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      let totalUniqueViews = 0;
      if (data.result && data.result.length > 0 && data.result[0].data) {
          totalUniqueViews = data.result[0].data.reduce((a: number, b: number) => a + b, 0);
      }

      // 3. Guardamos el número exacto en Supabase
      if (totalUniqueViews >= 0) {
          const { error: updateError } = await supabase
              .from('blog_posts')
              .update({ unique_views: totalUniqueViews })
              .eq('id', post.id);

          if (!updateError) {
              updatedCount++;
          }
      }
    }

    return { success: true, message: `✅ ¡Éxito! Se actualizaron las lecturas de ${updatedCount} artículos usando los datos de PostHog.` };

  } catch (error: any) {
    console.error("Error sincronizando visitas de PostHog:", error);
    return { success: false, message: error.message };
  }
}

