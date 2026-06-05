// src/pages/noticias.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Megaphone, CalendarDays, ChevronRight, Newspaper, Flame, FileText } from "lucide-react";
import { getBlogPosts, formatBlogDate } from "../lib/api/blog";
import { cn } from "../lib/cn";

// Definimos las promociones estáticas FUERA del componente
const staticPromos = [
  {
    id: "static-promo-1",
    title: "Paquete de Bienvenida $1,000 USD en Ignition",
    excerpt: "Duplica tu primer depósito, llévate 4 entradas a Freerolls de $1,200 garantizados y 50 giros gratis de Casino.",
    image_thumbnail: "/bg/ignition-promo.webp",
    category: "Promociones",
    published_at: "2026-06-03T12:00:00Z", // Ajustado para que la noticia de la Liga (5 de junio) gane limpiamente
    slug: "ignition-bonus",
    isStaticPromo: true,
    link: "/promociones/ignition-bonus"
  },
  {
    id: "static-promo-2",
    title: "El Camino del Tiburón: Freeroll Diario",
    excerpt: "Juega gratis todos los días a las 17:00 hrs en LatinAllinPoker y clasifica a nuestros torneos principales.",
    image_thumbnail: "/bg/freeroll-diario.webp",
    category: "Promociones",
    published_at: "2026-06-01T12:00:00Z", 
    slug: "freeroll-diario",
    isStaticPromo: true,
    link: "/promociones/freeroll-diario"
  }
];

export function NoticiasPage() {
  const [posts, setPosts] = useState<any[]>([]); // Usamos any[] para permitir mezclar DB + Estáticos
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("Todas");

  useEffect(() => {
    getBlogPosts()
      .then((data) => {
        const combined = [...staticPromos, ...data];
        
        // 🧠 Motor de Ordenamiento Cronológico Estricto
        combined.sort((a, b) => {
          // Extraemos las fechas y las pasamos a milisegundos de forma segura
          const timeA = a.published_at ? new Date(a.published_at).getTime() : 0;
          const timeB = b.published_at ? new Date(b.published_at).getTime() : 0;
          
          return timeB - timeA; // De más reciente a más antiguo
        });
        
        setPosts(combined);
      })
      .finally(() => setLoading(false));
  }, []);

  // Obtenemos categorías únicas dinámicamente
  const categories = ["Todas", "Noticias", "Blog", "Promociones"];

  const filteredPosts = posts.filter(post => {
    if (activeCategory === "Todas") return true;
    if (activeCategory === "Noticias") return post.category.toLowerCase() === "noticias";
    if (activeCategory === "Promociones") return post.category.toLowerCase() === "promociones";
    if (activeCategory === "Blog") {
      // Todo lo que NO sea noticia ni promoción, cae en la cubeta de "Blog" 
      // (esto agrupa tus artículos actuales de GTO, Mental Game, etc.)
      return post.category.toLowerCase() !== "noticias" && post.category.toLowerCase() !== "promociones";
    }
    return true;
  });

  const featuredPost = filteredPosts[0];
  const regularPosts = filteredPosts.slice(1);

  return (
    <PageShell>
      <SEOHead 
        title="Noticias y Promociones de Póker | Sharkania" 
        description="Mantente al día con la actualidad del circuito, descubre nuevas promociones, bonos exclusivos y mejora tu juego con nuestros artículos de estrategia." 
        path="/noticias"
      />

      <div className="min-h-screen bg-sk-bg-0 pt-24 pb-20">
        
        {/* ══ HEADER DE LA SECCIÓN ══ */}
        <section className="relative px-6 mb-12">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-sk-accent/10 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="max-w-[1200px] mx-auto relative z-10 text-center">
            <div className="inline-flex items-center gap-2 bg-sk-bg-3 border border-sk-border-2 px-4 py-1.5 rounded-full text-sk-text-2 font-mono text-xs uppercase tracking-widest font-bold mb-6">
              <Megaphone size={14} className="text-sk-accent" />
              Actualidad y Novedades
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6 uppercase">
              Noticias y <span className="text-transparent bg-clip-text bg-gradient-to-r from-sk-accent to-blue-500">Más</span>
            </h1>
            <p className="text-lg text-sk-text-3 max-w-2xl mx-auto">
              Todo lo que necesitas saber para estar un paso adelante en las mesas. Novedades de la liga, beneficios exclusivos y contenido táctico.
            </p>
          </div>
        </section>

        {/* ══ FILTROS DE CATEGORÍAS ══ */}
        <section className="max-w-[1200px] mx-auto px-6 mb-12">
          <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 border",
                  activeCategory === category
                    ? "bg-sk-accent text-black border-sk-accent shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                    : "bg-sk-bg-2 text-sk-text-3 border-sk-border-2 hover:border-sk-accent/50 hover:text-sk-text-1"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        {/* ══ CONTENIDO DE NOTICIAS ══ */}
        <section className="max-w-[1200px] mx-auto px-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className={cn(
                  "animate-sk-pulse bg-sk-bg-2 border border-sk-border-2 rounded-2xl h-80",
                  i === 1 ? "md:col-span-3 h-[400px]" : ""
                )} />
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-sk-bg-2 border border-sk-border-2 rounded-2xl">
              <Newspaper className="mx-auto text-sk-text-4 mb-4" size={48} />
              <h3 className="text-xl font-bold text-sk-text-1 mb-2">No hay noticias en esta categoría</h3>
              <p className="text-sk-text-3">Vuelve más tarde para más actualizaciones.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* NOTICIA DESTACADA (Ocupa todo el ancho arriba) */}
              {featuredPost && (
                <Link 
                  to={featuredPost.isStaticPromo ? featuredPost.link : `/noticias/${featuredPost.slug}`} 
                  className="group md:col-span-3 flex flex-col md:flex-row bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-sk-accent/50 shadow-sk-md hover:shadow-[0_0_30px_rgba(34,211,238,0.1)] transition-all duration-500"
                >
                  <div className="md:w-2/3 h-64 md:h-[450px] relative overflow-hidden bg-sk-bg-3">
                    {featuredPost.image_thumbnail && (
                      <img 
                        src={featuredPost.image_thumbnail} 
                        alt={featuredPost.title} 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-sk-bg-2 via-transparent to-transparent opacity-90" />
                  </div>
                  
                  <div className="md:w-1/3 p-8 md:p-12 flex flex-col justify-center relative z-10 bg-sk-bg-2">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded flex items-center gap-1.5",
                        featuredPost.category.toLowerCase() === 'promociones' ? "bg-orange-500 text-white" : 
                        featuredPost.category.toLowerCase() === 'noticias' ? "bg-sk-accent text-black" : "bg-sk-purple text-white"
                      )}>
                        {featuredPost.category.toLowerCase() === 'promociones' && <Flame size={12} />}
                        {featuredPost.category.toLowerCase() !== 'promociones' && featuredPost.category.toLowerCase() !== 'noticias' && <FileText size={12} />}
                        {featuredPost.category}
                      </span>
                      <span className="text-xs font-mono text-sk-text-3 flex items-center gap-1.5">
                        <CalendarDays size={12} /> {formatBlogDate(featuredPost.published_at)}
                      </span>
                    </div>
                    
                    <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-4 group-hover:text-sk-accent transition-colors">
                      {featuredPost.title}
                    </h2>
                    
                    {featuredPost.excerpt && (
                      <p className="text-sk-text-3 leading-relaxed mb-8 line-clamp-3">
                        {featuredPost.excerpt}
                      </p>
                    )}
                    
                    <div className="mt-auto">
                      <span className="inline-flex items-center gap-2 text-sk-sm font-bold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                        Leer artículo completo <ChevronRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              )}

              {/* GRILLA DE NOTICIAS REGULARES */}
              {regularPosts.map((post) => (
                <Link 
                  key={post.id} 
                  to={post.isStaticPromo ? post.link : `/noticias/${post.slug}`} 
                  className="group flex flex-col bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-sk-accent/50 transition-all duration-300 shadow-sk-md hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                >
                  <div className="h-52 overflow-hidden relative border-b border-sk-border-2 bg-sk-bg-3">
                    <div className={cn(
                      "absolute top-4 left-4 z-10 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-lg",
                      post.category.toLowerCase() === 'promociones' ? "bg-orange-500 text-white" : 
                      post.category.toLowerCase() === 'noticias' ? "bg-sk-accent text-black" : "bg-sk-purple text-white"
                    )}>
                      {post.category}
                    </div>
                    {post.image_thumbnail && (
                      <img 
                        src={post.image_thumbnail} 
                        alt={post.title} 
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                      />
                    )}
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <div className="text-[10px] font-mono text-sk-text-4 mb-3 flex items-center gap-1.5">
                      <CalendarDays size={12} /> {formatBlogDate(post.published_at)}
                    </div>
                    
                    <h3 className="text-lg font-bold text-sk-text-1 mb-3 group-hover:text-sk-accent transition-colors line-clamp-2 leading-snug">
                      {post.title}
                    </h3>
                    
                    {post.excerpt && (
                      <p className="text-sk-sm text-sk-text-3 mb-6 line-clamp-2 flex-1">
                        {post.excerpt}
                      </p>
                    )}
                    
                    <div className="border-t border-sk-border-2 pt-4 mt-auto">
                      <span className="text-[11px] font-bold text-sk-text-2 uppercase tracking-wider flex items-center justify-between group-hover:text-sk-accent transition-colors">
                        Leer más <ChevronRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </div>
    </PageShell>
  );
}