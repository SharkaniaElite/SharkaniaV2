// src/pages/blog.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowRight, TrendingUp, Pickaxe } from "lucide-react"; // 👈 Añadimos Pickaxe
import { PageShell } from "../components/layout/page-shell";
import { getBlogPosts, formatBlogDate, type BlogPost } from "../lib/api/blog";
import { SEOHead } from "../components/seo/seo-head";

function BlogSkeleton() {
  return (
    <div className="animate-sk-pulse space-y-4">
      <div className="rounded-xl border border-sk-border-2 bg-sk-bg-2 overflow-hidden">
        <div className="h-48 bg-sk-bg-4 w-full" />
        <div className="p-8">
          <div className="h-4 w-24 rounded bg-sk-bg-4 mb-5" />
          <div className="h-8 w-3/4 rounded bg-sk-bg-4 mb-3" />
          <div className="h-4 w-full rounded bg-sk-bg-4 mb-2" />
          <div className="h-4 w-2/3 rounded bg-sk-bg-4 mb-6" />
          <div className="h-4 w-32 rounded bg-sk-bg-4" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-sk-border-2 bg-sk-bg-2 overflow-hidden">
            <div className="h-32 bg-sk-bg-4 w-full" />
            <div className="p-6">
              <div className="h-3 w-20 rounded bg-sk-bg-4 mb-4" />
              <div className="h-5 w-full rounded bg-sk-bg-4 mb-2" />
              <div className="h-4 w-3/4 rounded bg-sk-bg-4 mb-5" />
              <div className="h-3 w-16 rounded bg-sk-bg-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBlogPosts()
      .then(setPosts)
      .catch(() => setError("No se pudieron cargar los artículos."))
      .finally(() => setLoading(false));
  }, []);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <PageShell>
    <SEOHead
  title="Blog"
  description="Estrategia de poker, análisis de datos, mental game y más. Artículos para jugadores competitivos y dueños de clubes."
  path="/blog"
/>
      {/* Header — pt-14 compensa el navbar fixed */}
      <div className="border-b border-sk-border-2 bg-sk-bg-0 pt-14">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-sk-accent" />
            <span className="text-sk-sm font-medium text-sk-accent uppercase tracking-widest">
              Blog
            </span>
          </div>
          <h1 className="text-sk-3xl font-extrabold text-sk-text-1 tracking-tight mb-3">
            Estrategia & Análisis
          </h1>
          <p className="text-sk-base text-sk-text-2 max-w-xl mb-8">
            Contenido técnico basado en datos reales del ecosistema de clubes privados.
            GTO, ICM, ELO y el meta-juego que nadie más está midiendo.
          </p>

          {/* ⚒️ BANNER EXPLICATIVO DE MINERÍA */}
          <div className="p-5 rounded-2xl bg-sk-bg-2 border border-sk-border-2 shadow-sk-lg flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-sk-accent opacity-50 group-hover:h-full transition-all" />
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-sk-bg-3 border border-sk-border-1 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <Pickaxe size={28} className="text-sk-accent" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sk-md font-extrabold text-sk-text-1 tracking-tight">Proof of Work: Estudia y Gana</h3>
                <p className="text-xs text-sk-text-3 leading-relaxed max-w-md">
                  Lee artículos hasta el final para minar <strong className="text-sk-accent">Shark Coins</strong> y ganar <strong className="text-purple-400">XP</strong>. Tu tiempo de análisis desbloquea recompensas automáticas.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 ml-auto shrink-0 bg-sk-bg-0 px-4 py-3 rounded-xl border border-sk-border-2">
               <div className="flex flex-col items-center px-3 border-r border-sk-border-2">
                 <span className="text-[10px] text-sk-text-4 font-bold uppercase tracking-widest">Recompensa</span>
                 <span className="text-sk-sm font-mono font-bold text-sk-accent">+10 SC</span>
               </div>
               <div className="flex flex-col items-center px-3">
                 <span className="text-[10px] text-sk-text-4 font-bold uppercase tracking-widest">Estatus</span>
                 <span className="text-sk-sm font-mono font-bold text-purple-400">+50 XP</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {loading && <BlogSkeleton />}

        {error && (
          <div className="rounded-xl border border-sk-red/20 bg-sk-red-dim p-8 text-center">
            <p className="text-sk-sm text-sk-red">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Featured post */}
            {featured && (
              <Link
                to={`/blog/${featured.slug}`}
                className="group block mb-10 rounded-xl border border-sk-border-2 bg-sk-bg-2 hover:border-sk-border-3 hover:bg-sk-bg-3 transition-all duration-200 overflow-hidden"
              >
                {/* Thumbnail imagen */}
                {featured.image_thumbnail ? (
                  <div className="w-full h-56 overflow-hidden bg-sk-bg-3">
                    <img
                      src={featured.image_thumbnail}
                      alt={featured.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                ) : (
                  <div className="w-full h-56 bg-gradient-to-br from-sk-bg-3 to-sk-bg-4 flex items-center justify-center">
                    <span className="text-sk-text-4 text-sk-sm">Sharkania</span>
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sk-accent-dim text-sk-accent text-[11px] font-semibold uppercase tracking-wider">
                      ✦ Destacado
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] text-sk-text-3 text-[11px] font-medium">
                      {featured.category}
                    </span>
                  </div>
                  <h2 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight mb-3 group-hover:text-sk-accent transition-colors duration-150 leading-snug">
                    {featured.title}
                  </h2>
                  <p className="text-sk-base text-sk-text-2 leading-relaxed mb-6 max-w-2xl">
                    {featured.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[11px] text-sk-text-3">
                      <span className="flex items-center gap-1.5">
                        <Clock size={11} />
                        {featured.read_time} min de lectura
                      </span>
                      <span>{formatBlogDate(featured.published_at)}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-sk-sm font-semibold text-sk-accent group-hover:gap-2.5 transition-all duration-150">
                      Leer artículo <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of posts */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rest.map((post) => (
                  <Link
                    key={post.slug}
                    to={`/blog/${post.slug}`}
                    className="group block rounded-xl border border-sk-border-2 bg-sk-bg-2 hover:border-sk-border-3 hover:bg-sk-bg-3 transition-all duration-200 overflow-hidden"
                  >
                    {post.image_thumbnail ? (
                      <div className="w-full h-36 overflow-hidden bg-sk-bg-3">
                        <img
                          src={post.image_thumbnail}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-36 bg-gradient-to-br from-sk-bg-3 to-sk-bg-4" />
                    )}
                    <div className="p-6">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] text-sk-text-3 text-[11px] font-medium mb-4">
                        {post.category}
                      </span>
                      <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight mb-2 group-hover:text-sk-accent transition-colors duration-150 leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-5 line-clamp-2">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] text-sk-text-4">
                          <Clock size={11} />
                          {post.read_time} min
                        </span>
                        <span className="flex items-center gap-1 text-sk-sm font-semibold text-sk-accent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          Leer <ArrowRight size={13} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {posts.length === 0 && (
              <div className="rounded-xl border border-dashed border-sk-border-2 p-10 text-center">
                <p className="text-sk-text-3 text-sk-sm">Más artículos próximamente.</p>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
