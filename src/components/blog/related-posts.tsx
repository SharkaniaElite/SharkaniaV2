// src/components/blog/related-posts.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";
import { getBlogPosts, formatBlogDate, type BlogPost } from "../../lib/api/blog";

interface RelatedPostsProps {
  currentSlug: string;
  currentCategory: string;
}

export function RelatedPosts({ currentSlug, currentCategory }: RelatedPostsProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlogPosts()
      .then((all) => {
        // Filtrar el artículo actual
        const others = all.filter((p) => p.slug !== currentSlug);

        // Priorizar misma categoría, luego los más recientes
        const sameCategory = others.filter((p) => p.category === currentCategory);
        const different = others.filter((p) => p.category !== currentCategory);

        // Tomar hasta 3: primero misma categoría, luego otros
        const related = [...sameCategory, ...different].slice(0, 3);
        setPosts(related);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentSlug, currentCategory]);

  if (loading || posts.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-sk-border-2">
      <div className="flex items-center gap-2 mb-6">
        <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-sk-accent">
          Sigue leyendo
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group block rounded-xl border border-sk-border-2 bg-sk-bg-2 hover:border-sk-border-3 hover:bg-sk-bg-3 transition-all duration-200 overflow-hidden"
          >
            {post.image_thumbnail ? (
              <div className="w-full h-28 overflow-hidden bg-sk-bg-3">
                <img
                  src={post.image_thumbnail}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-full h-28 bg-gradient-to-br from-sk-bg-3 to-sk-bg-4" />
            )}
            <div className="p-4">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] text-sk-text-3 text-[10px] font-medium mb-2">
                {post.category}
              </span>
              <h4 className="text-sk-sm font-bold text-sk-text-1 tracking-tight mb-2 group-hover:text-sk-accent transition-colors duration-150 leading-snug line-clamp-2">
                {post.title}
              </h4>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] text-sk-text-4">
                  <Clock size={10} />
                  {post.read_time} min
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-sk-accent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Leer <ArrowRight size={11} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
