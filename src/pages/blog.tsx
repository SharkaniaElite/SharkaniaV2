import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowRight, BookOpen, Pickaxe, Search, ChevronLeft, ChevronRight, Lock, Sparkles, Zap } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { getBlogPosts, formatBlogDate, type BlogPost } from "../lib/api/blog";
import { SEOHead } from "../components/seo/seo-head";
import { useAuthStore } from "../stores/auth-store";
import { useSharkCoinsBalance } from "../hooks/use-shop";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { cn } from "../lib/cn";

const ITEMS_PER_PAGE = 9;

function BlogSkeleton() {
  return (
    <div className="animate-sk-pulse space-y-6">
      <div className="rounded-2xl border border-sk-border-2 bg-sk-bg-2 overflow-hidden h-[400px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-sk-border-2 bg-sk-bg-2 h-[300px]" />
        ))}
      </div>
    </div>
  );
}

export default function BlogPage() {
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Filtro y Paginación
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [currentPage, setCurrentPage] = useState(1);

  const { user, isAuthenticated } = useAuthStore();
  const { data: balance } = useSharkCoinsBalance();

  useEffect(() => {
    getBlogPosts()
      .then(setPosts)
      .catch(() => setError("No se pudieron cargar los artículos."))
      .finally(() => setLoading(false));
  }, []);

  // Extraer categorías dinámicamente
  const categories = useMemo(() => {
    const cats = new Set(posts.map((p) => p.category).filter(Boolean));
    return ["Todas", ...Array.from(cats)];
  }, [posts]);

  // 🧠 MOTOR DE BÚSQUEDA INTELIGENTE
  const filteredPosts = useMemo(() => {
    // 1. Filtro base por categoría (CORREGIDO: const en lugar de let)
    const base = posts.filter((post) => selectedCategory === "Todas" || post.category === selectedCategory);

    // 2. Lógica de Puntuación (Scoring) para el buscador
    const query = search.trim().toLowerCase();
    if (!query) return base; // Si no hay búsqueda, retorna normal

    const terms = query.split(/\s+/); // Separamos por palabras

    const scoredPosts = base.map(post => {
      const textToSearch = `${post.title} ${post.excerpt}`.toLowerCase();
      let score = 0;

      // Premio mayor: Coincidencia exacta de la frase
      if (textToSearch.includes(query)) {
        score += 100;
      }

      // Premio menor: Suma puntos por cada término individual que coincida
      terms.forEach(term => {
        if (textToSearch.includes(term)) {
          score += 10;
        }
      });

      return { post, score };
    });

    // 3. Filtramos los que tienen 0 puntos y ordenamos del más relevante al menos
    return scoredPosts
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.post);
      
  }, [posts, selectedCategory, search]);

  // Paginación y Destacado
  const isDefaultView = search === "" && selectedCategory === "Todas" && currentPage === 1;
  const featured = isDefaultView ? filteredPosts[0] : null;
  
  const remainingPosts = isDefaultView ? filteredPosts.slice(1) : filteredPosts;
  
  const totalPages = Math.ceil(remainingPosts.length / ITEMS_PER_PAGE);
  const paginatedPosts = remainingPosts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // NOTA: El useEffect de paginación fue eliminado para evitar "cascading renders".
  // La página ahora se resetea directamente en los eventos onChange y onClick abajo.

  return (
    <PageShell>
      <SEOHead
        title="Biblioteca de Inteligencia — Blog"
        description="Estrategia de poker, análisis de datos, mental game y más. Estudia y mina Shark Coins con nuestros artículos técnicos."
        path="/blog"
      />

      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">

          {/* ══ HERO SECTION ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-accent/30 to-transparent" />

            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-accent/20 transition-colors duration-500" />
                <img
                  src={`/mascot/shark-${mascotId}.webp`}
                  alt="Sharkania Quartermaster"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <BookOpen className="text-sk-accent" size={16} />
                <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-accent">
                  BIBLIOTECA · ARCHIVOS DESCLASIFICADOS
                </p>
                <Sparkles className="text-sk-accent animate-pulse" size={16} />
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-4 leading-none">
                Estrategia & Análisis
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                Contenido técnico basado en datos reales de clubes privados. <strong className="text-sk-text-1">GTO, ICM, ELO</strong> y el meta-juego que nadie más está midiendo.
              </p>
            </div>

            {/* Saldo de Monedas */}
            {user && (
              <div className="shrink-0 bg-sk-bg-0/50 backdrop-blur-md border border-sk-border-2 rounded-xl p-5 text-center min-w-[160px] relative z-10 group-hover:border-sk-accent/40 transition-colors">
                <p className="text-[10px] font-mono text-sk-text-3 font-bold uppercase tracking-widest mb-3">
                  Tu Reserva
                </p>
                <div className="flex items-center justify-center gap-2 text-sk-3xl font-black text-sk-accent tracking-tighter leading-none mb-1">
                  {balance ?? 0}
                  <img
                    src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif"
                    alt="SC"
                    className="w-7 h-7 drop-shadow-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ══ BANNER DE MINERÍA (PoW) ══ */}
          <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-6 mb-10 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-sk-accent opacity-70 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.8)] transition-all" />
            
            <div className="flex items-center gap-5 z-10 w-full lg:w-auto">
              <div className="w-14 h-14 rounded-xl bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                <Pickaxe size={24} className="text-sk-accent" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sk-md font-extrabold text-sk-text-1 tracking-tight">Proof of Work: Estudia y Gana</h3>
                <p className="text-xs text-sk-text-3 leading-relaxed max-w-md">
                  Lee artículos hasta el final para minar <strong className="text-sk-accent">Shark Coins</strong> y ganar <strong className="text-purple-400">XP</strong>. Tu tiempo de análisis desbloquea el acceso a La Bóveda.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 z-10 shrink-0 w-full lg:w-auto">
              {isAuthenticated ? (
                <div className="flex items-center bg-sk-bg-0 rounded-lg border border-sk-border-2 w-full lg:w-auto">
                  <div className="flex flex-col items-center px-4 py-2.5 border-r border-sk-border-2">
                    <span className="text-[10px] text-sk-text-4 font-bold uppercase tracking-widest">Recompensa</span>
                    <span className="text-sk-sm font-mono font-bold text-sk-accent flex items-center gap-1">+10 SC</span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-2.5">
                    <span className="text-[10px] text-sk-text-4 font-bold uppercase tracking-widest">Estatus</span>
                    <span className="text-sk-sm font-mono font-bold text-purple-400 flex items-center gap-1">+50 XP</span>
                  </div>
                </div>
              ) : (
                <Link to="/register" className="w-full lg:w-auto">
                  <Button variant="accent" size="md" className="w-full shadow-[0_0_15px_rgba(34,211,238,0.15)] gap-2">
                    <Lock size={16} /> Crear cuenta para minar
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* ══ CONTROLES: BÚSQUEDA Y FILTROS ══ */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setCurrentPage(1); // CORREGIDO: Reset inline (react-hooks/set-state-in-effect)
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-widest transition-all",
                    selectedCategory === cat
                      ? "bg-sk-bg-3 text-sk-text-1 border border-sk-border-3 shadow-sm"
                      : "bg-sk-bg-0 border border-sk-border-2 text-sk-text-3 hover:text-sk-text-2 hover:bg-sk-bg-1"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-[300px] relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-4 group-focus-within:text-sk-accent transition-colors" />
              <Input
                placeholder="Busca frases o palabras clave..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1); // CORREGIDO: Reset inline (react-hooks/set-state-in-effect)
                }}
                className="pl-9 focus:border-sk-accent/50"
              />
            </div>
          </div>

          {/* ══ GRILLA DE ARTÍCULOS ══ */}
          {loading && <BlogSkeleton />}

          {error && (
            <div className="rounded-xl border border-sk-red/20 bg-sk-red-dim p-8 text-center">
              <p className="text-sk-sm text-sk-red">{error}</p>
            </div>
          )}

          {!loading && !error && filteredPosts.length === 0 && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-12 text-center">
              <Search className="mx-auto mb-4 text-sk-text-4 opacity-50" size={40} />
              <p className="text-sk-lg font-bold text-sk-text-1 mb-2">No encontramos coincidencias</p>
              <p className="text-sk-sm text-sk-text-3">Intenta buscar usando otras palabras o reduce tu frase de búsqueda.</p>
            </div>
          )}

          {!loading && !error && filteredPosts.length > 0 && (
            <>
              {/* ══ ARTÍCULO DESTACADO (Solo en default view) ══ */}
              {featured && (
                <Link
                  to={`/blog/${featured.slug}`}
                  // CORREGIDO: Eliminamos 'block' de las clases de Tailwind (cssConflict)
                  className="group flex mb-10 rounded-2xl border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/40 hover:shadow-[0_10px_40px_rgba(34,211,238,0.08)] transition-all duration-300 overflow-hidden flex-col md:flex-row"
                >
                  <div className="w-full md:w-[55%] lg:w-[60%] min-h-[250px] md:min-h-[400px] relative overflow-hidden bg-sk-bg-3">
                    {featured.image_thumbnail ? (
                      <img
                        src={featured.image_thumbnail}
                        alt={featured.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-sk-bg-3 to-sk-bg-4 flex items-center justify-center">
                        <span className="text-sk-text-4 text-sk-sm">Sharkania</span>
                      </div>
                    )}
                    <div className="hidden md:block absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-sk-bg-2" />
                  </div>

                  <div className="w-full md:w-[45%] lg:w-[40%] p-8 md:p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sk-accent/10 border border-sk-accent/20 text-sk-accent text-[10px] font-bold uppercase tracking-widest">
                        <Sparkles size={10} /> Destacado
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-sk-bg-4 text-sk-text-3 text-[10px] font-bold uppercase tracking-widest">
                        {featured.category}
                      </span>
                    </div>
                    <h2 className="text-sk-2xl lg:text-sk-3xl font-black text-sk-text-1 tracking-tight mb-4 group-hover:text-sk-accent transition-colors duration-300 leading-tight">
                      {featured.title}
                    </h2>
                    <p className="text-sk-sm lg:text-sk-base text-sk-text-2 leading-relaxed mb-6 line-clamp-3">
                      {featured.excerpt}
                    </p>
                    
                    <div className="flex flex-col gap-4 mt-auto">
                      {/* Reward Badges */}
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-sk-accent bg-sk-accent/10 border border-sk-accent/20 px-2.5 py-1 rounded-md">
                          <img src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" alt="SC" className="w-3.5 h-3.5" />
                          +10 SC
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2.5 py-1 rounded-md">
                          <Zap size={12} /> +50 XP
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-[11px] font-mono text-sk-text-3">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} /> {featured.read_time} min
                          </span>
                          <span>{formatBlogDate(featured.published_at)}</span>
                        </div>
                        <span className="flex items-center gap-1.5 text-sk-sm font-bold text-sk-accent group-hover:translate-x-1 transition-transform duration-300">
                          Leer <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* ══ GRILLA GENERAL ══ */}
              {paginatedPosts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedPosts.map((post) => (
                    <Link
                      key={post.slug}
                      to={`/blog/${post.slug}`}
                      className="group flex flex-col rounded-xl border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/40 hover:shadow-[0_4px_20px_rgba(34,211,238,0.05)] transition-all duration-300 overflow-hidden"
                    >
                      {post.image_thumbnail ? (
                        <div className="w-full h-48 overflow-hidden bg-sk-bg-3 relative">
                          <img
                            src={post.image_thumbnail}
                            alt={post.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                          />
                          <div className="absolute top-3 right-3 bg-sk-bg-0/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-bold text-sk-text-2 uppercase tracking-widest border border-sk-border-2">
                            {post.category}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-sk-bg-3 to-sk-bg-4 relative">
                           <div className="absolute top-3 right-3 bg-sk-bg-0/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-bold text-sk-text-2 uppercase tracking-widest border border-sk-border-2">
                            {post.category}
                          </div>
                        </div>
                      )}
                      
                      <div className="p-6 flex flex-col flex-1">
                        <h3 className="text-sk-lg font-bold text-sk-text-1 tracking-tight mb-3 group-hover:text-sk-accent transition-colors duration-300 leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-6 line-clamp-3 flex-1">
                          {post.excerpt}
                        </p>
                        
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-sk-border-2/50">
                          {/* Reward Badges (Small) */}
                          <div className="flex gap-2">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-sk-accent bg-sk-accent/10 border border-sk-accent/20 px-2 py-0.5 rounded">
                              <img src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" alt="SC" className="w-3 h-3" />
                              +10
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded">
                              <Zap size={10} /> +50
                            </span>
                          </div>

                          <span className="flex items-center gap-1 text-sk-xs font-bold text-sk-text-2 group-hover:text-sk-accent transition-colors">
                            Leer <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* ══ CONTROLES DE PAGINACIÓN ══ */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-12 pt-6 border-t border-sk-border-2">
                  <p className="text-sk-xs text-sk-text-3 font-mono">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-1.5"
                    >
                      <ChevronLeft size={14} /> Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="gap-1.5"
                    >
                      Siguiente <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </PageShell>
  );
}