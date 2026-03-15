// src/lib/api/blog.ts
import { supabase } from "../supabase";

export interface BlogBlock {
  type: "p" | "h2" | "h3" | "callout" | "stat" | "list";
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
  published: boolean;
  published_at: string | null;
  created_at: string;
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
