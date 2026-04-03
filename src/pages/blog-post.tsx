// src/pages/blog-post.tsx
import { useArticleSchema, useBreadcrumbSchema } from "../components/seo/structured-data";
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Share2, ChevronRight, Lock } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { getBlogPost, formatBlogDate, type BlogPost, type BlogBlock } from "../lib/api/blog";
import { SEOHead } from "../components/seo/seo-head";
import { renderWithLinks, renderWithLinksAndGlossary } from "../lib/render-inline-links";
import { useGlossaryTerms } from "../hooks/use-glossary";
import type { GlossaryTerm } from "../lib/api/glossary";
import { WptBanner } from "../components/blog/wpt-banner";
import { TableOfContents, slugify } from "../components/blog/table-of-contents";
import { RelatedPosts } from "../components/blog/related-posts";
import { useAuthStore } from "../stores/auth-store";
import { claimBlogReward } from "../lib/api/players";

// ── OG Meta ───────────────────────────────────────────────
function setOGMeta(post: BlogPost) {
  const set = (property: string, content: string) => {
    let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
    el.setAttribute("content", content);
  };
  const setName = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
    el.setAttribute("content", content);
  };
  document.title = `${post.title} — Sharkania`;
  set("og:title", post.title);
  set("og:description", post.excerpt);
  set("og:type", "article");
  set("og:url", window.location.href);
  set("article:published_time", post.published_at ?? "");
  if (post.image_og) {
    const ogUrl = new URL(post.image_og, window.location.origin).href;
    set("og:image", ogUrl);
    set("og:image:width", "1200");
    set("og:image:height", "630");
    setName("twitter:card", "summary_large_image");
    setName("twitter:image", ogUrl);
  }
}

function resetOGMeta() { document.title = "Sharkania"; }

// ── Skeleton ──────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div className="animate-sk-pulse">
      <div className="w-full h-72 bg-sk-bg-3" />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="h-4 w-20 rounded bg-sk-bg-4 mb-8" />
        <div className="flex gap-3 mb-5">
          <div className="h-5 w-28 rounded-full bg-sk-bg-4" />
          <div className="h-5 w-20 rounded-full bg-sk-bg-4" />
        </div>
        <div className="h-10 w-full rounded bg-sk-bg-4 mb-2" />
        <div className="h-10 w-3/4 rounded bg-sk-bg-4 mb-6" />
        <div className="h-4 w-full rounded bg-sk-bg-4 mb-2" />
        <div className="h-4 w-5/6 rounded bg-sk-bg-4 mb-10" />
        <div className="space-y-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-4 rounded bg-sk-bg-4" style={{ width: `${90 - i * 5}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Block Renderer ────────────────────────────────────────
function BlockRenderer({ block, inlineImage, h2Index, postTitle, glossaryTerms, alreadyLinked }: { block: BlogBlock; inlineImage: string | null; h2Index: number; postTitle: string; glossaryTerms: GlossaryTerm[]; alreadyLinked: Set<string>; }) {
  if (block.type === "h2") {
    return (
      <>
        <h2 id={slugify(block.content ?? "")} className="text-sk-xl font-extrabold text-sk-text-1 tracking-tight mt-12 mb-4 first:mt-0 scroll-mt-20">
          {renderWithLinks(block.content ?? "")}
        </h2>
        {h2Index === 2 && inlineImage && (
          <div className="my-6 rounded-xl overflow-hidden border border-sk-border-2">
            <img 
              src={inlineImage} 
              alt={`Gráfico explicativo para: ${postTitle}`} 
              loading="lazy" 
              className="w-full h-auto" 
            />
          </div>
        )}
        {h2Index === 3 && <WptBanner slot="mid" />}
      </>
    );
  }
  if (block.type === "h3") return <h3 className="text-sk-md font-bold text-sk-text-1 mt-8 mb-3">{renderWithLinksAndGlossary(block.content ?? "", glossaryTerms, alreadyLinked)}</h3>;
  if (block.type === "callout") return <div className="my-8 rounded-lg border border-sk-accent/20 bg-sk-accent-dim px-6 py-5"><p className="text-sk-base text-sk-text-1 font-medium leading-relaxed">{renderWithLinksAndGlossary(block.content ?? "", glossaryTerms, alreadyLinked)}</p></div>;
  if (block.type === "stat") return <div className="my-8 rounded-xl border border-sk-border-2 bg-sk-bg-2 px-6 py-6 flex items-center gap-5"><span className="text-[2.5rem] font-extrabold text-sk-accent leading-none shrink-0">{block.value}</span><p className="text-sk-base text-sk-text-2 leading-snug">{renderWithLinksAndGlossary(block.content ?? "", glossaryTerms, alreadyLinked)}</p></div>;
  if (block.type === "list") return <ul className="my-5 space-y-2 pl-1">{(block.items ?? []).map((item, j) => (<li key={j} className="flex items-start gap-3 text-sk-base text-sk-text-2 leading-relaxed"><span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />{renderWithLinksAndGlossary(item, glossaryTerms, alreadyLinked)}</li>))}</ul>;
  return <p className="text-sk-base text-sk-text-2 leading-relaxed mb-5">{renderWithLinksAndGlossary(block.content ?? "", glossaryTerms, alreadyLinked)}</p>;
}

// ── Page ──────────────────────────────────────────────────
export default function BlogPostPage() {
  const { slug }    = useParams<{ slug: string }>();
  const navigate    = useNavigate();
  const [post, setPost]       = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const h2Count               = useRef(0);
  const { data: glossaryTerms } = useGlossaryTerms();
  const alreadyLinked = useRef(new Set<string>());

  // Gamificación y Minería
  const { user, isAuthenticated, refreshProfile } = useAuthStore();
  const REWARD_AMOUNT = 10;
  const XP_REWARD = 50;
  const [initialTime, setInitialTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useArticleSchema({
    title: post?.title ?? '',
    description: post?.excerpt ?? '',
    slug: post?.slug ?? '',
    publishedAt: post?.published_at ?? '',
    category: post?.category ?? '',
    imageUrl: post?.image_og ?? undefined,
  });

  useBreadcrumbSchema([
    { name: 'Inicio', url: 'https://sharkania.com' },
    { name: 'Blog', url: 'https://sharkania.com/blog' },
    { name: post?.title ?? 'Artículo', url: `https://sharkania.com/blog/${post?.slug ?? ''}` },
  ]);

  useEffect(() => {
    if (!slug) return;
    window.scrollTo(0, 0);
    getBlogPost(slug)
      .then((data) => {
        if (!data) { navigate("/blog", { replace: true }); }
        else { 
          setPost(data); 
          setOGMeta(data); 
          h2Count.current = 0;
          alreadyLinked.current = new Set(); 
          
          // Configurar temporizador (minutos a segundos)
          const timeInSeconds = (data.read_time || 3) * 60;
          setInitialTime(timeInSeconds);
          setTimeLeft(timeInSeconds);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => resetOGMeta();
  }, [slug, navigate]);

  // Lógica del Temporizador Anti-AFK
  useEffect(() => {
    if (!isAuthenticated || timeLeft <= 0 || claimed) return;

    const timer = setInterval(() => {
      // Solo descuenta si la pestaña está activa y visible
      if (document.visibilityState === "visible") {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isAuthenticated, timeLeft, claimed]);

  // Referencia para el panel de recompensas
  const rewardBoxRef = useRef<HTMLDivElement>(null);

 // Lógica de Scroll con Intersection Observer (MÁS FIABLE)
  useEffect(() => {
    // 1. Si la caja aún no existe en el DOM (ej. está cargando el post), abortamos
    if (!rewardBoxRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasScrolledToBottom(true);
        }
      },
      { threshold: 0.3 } 
    );

    observer.observe(rewardBoxRef.current);

    return () => observer.disconnect();
  }, [loading, post]); // 👈 LA CLAVE: Le decimos que se re-ejecute cuando loading o post cambien

  const handleClaimCoins = async () => {
    if (!user || timeLeft > 0 || !hasScrolledToBottom || claimed) return;
    
    setIsClaiming(true);
    try {
      await claimBlogReward(user.id, REWARD_AMOUNT, XP_REWARD);
      await refreshProfile(); // Actualiza el balance en la UI del navbar/store
      setClaimed(true);
    } catch (error) {
      console.error("Error reclamando recompensa", error);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleShare = async () => {
    try { await navigator.clipboard.writeText(window.location.href); }
    catch { /* silencioso */ }
  };

  return (
    <PageShell>
      {/* Breadcrumb */}
      <div className="border-b border-sk-border-1 bg-sk-bg-1/80 backdrop-blur-sm sticky top-14 z-40">
        <div className="max-w-3xl mx-auto px-6 py-2.5 flex items-center justify-between">
          <nav className="flex items-center gap-1.5 text-[11px] text-sk-text-4">
            <Link to="/" className="hover:text-sk-text-2 transition-colors">Inicio</Link>
            <ChevronRight size={10} />
            <Link to="/blog" className="hover:text-sk-text-2 transition-colors">Blog</Link>
            {post && (
              <>
                <ChevronRight size={10} />
                <span className="text-sk-text-3 truncate max-w-[200px]">{post.category}</span>
              </>
            )}
          </nav>
          
          <div className="flex items-center gap-3">
            {/* 🎯 RADAR DE MINERÍA FLOTANTE */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-sk-bg-0 border border-sk-border-2 rounded font-mono text-[10px] font-bold shadow-sm">
              <img 
                src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" 
                alt="SC" 
                className={`w-3.5 h-3.5 ${timeLeft <= 0 ? "drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" : "grayscale opacity-70"}`} 
              />
              <span className={timeLeft <= 0 ? "text-sk-green" : "text-sk-text-2"}>
                {timeLeft > 0 
                  ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` 
                  : "LISTO ⬇️"}
              </span>
            </div>

            <button onClick={handleShare} className="flex items-center gap-1.5 text-sk-sm text-sk-text-2 hover:text-sk-accent transition-colors">
              <Share2 size={13} /> Compartir
            </button>
          </div>
        </div>
      </div>

      {loading && <PostSkeleton />}

      {error && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="rounded-xl border border-sk-red/20 bg-sk-red-dim p-8 text-center">
            <p className="text-sk-sm text-sk-red mb-4">No se pudo cargar el artículo.</p>
            <Link to="/blog" className="text-sk-sm text-sk-accent hover:underline">Volver al blog</Link>
          </div>
        </div>
      )}

      {!loading && !error && post && (
        <>
          <SEOHead title={post.title} description={post.excerpt} path={`/blog/${post.slug}`} ogType="article" ogImage={post.image_og ?? undefined} />

          {post.image_hero && (
            <div className="w-full max-h-[480px] overflow-hidden bg-sk-bg-3">
              <img 
                src={post.image_hero} 
                alt={`Portada del artículo: ${post.title}`} 
                fetchPriority="high" 
                loading="eager" 
                className="w-full h-full object-cover" 
              />
            </div>
          )}

          <style>{`.blog-grid { max-width: 760px; margin: 0 auto; padding: 0 1.5rem; }`}</style>

          <div className="blog-grid">
            <div style={{ minWidth: 0 }}>
              <div className="py-12">
                <Link to="/blog" className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors mb-8">
                  <ArrowLeft size={14} /> Volver al Blog
                </Link>

                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-sk-accent-dim text-sk-accent text-[11px] font-semibold uppercase tracking-wider">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-sk-text-3">
                    <Clock size={11} /> {post.read_time} min de lectura
                  </span>
                  <span className="text-[11px] text-sk-text-4">{formatBlogDate(post.published_at)}</span>
                </div>

                <h1 className="text-sk-3xl font-extrabold text-sk-text-1 tracking-tight leading-tight mb-6">{post.title}</h1>
                
                {/* 📢 CARTEL DE BOUNTY (REGLAS DEL JUEGO) */}
                <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-sk-bg-2 border border-sk-border-2 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img 
                      src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" 
                      alt="Shark Coin" 
                      className="w-10 h-10 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" 
                    />
                    <div>
                      <h4 className="text-sm font-extrabold text-sk-text-1 tracking-wide uppercase">
                        Bounty de Estudio: <span className="text-sk-accent">{REWARD_AMOUNT} SC</span> <span className="text-sk-text-4 mx-1">+</span> <span className="text-purple-400">{XP_REWARD} XP</span>
                      </h4>
                      <p className="text-xs text-sk-text-3 mt-0.5">
                        Permanece en esta pestaña durante <strong className="text-sk-text-2">{post.read_time} minutos</strong> y llega al final del artículo para reclamar tu recompensa.
                      </p>
                    </div>
                  </div>
                  {!isAuthenticated && (
                    <Link 
                      to={`/login?redirect=/blog/${post.slug}`} 
                      className="shrink-0 w-full sm:w-auto text-center text-[11px] font-bold tracking-widest uppercase text-sk-bg-0 bg-sk-accent px-4 py-2 rounded-lg hover:scale-105 transition-transform"
                    >
                      Login para Minar
                    </Link>
                  )}
                </div>

                <p className="text-sk-lg text-sk-text-2 leading-relaxed border-l-2 border-sk-accent pl-5 mb-10">{post.excerpt}</p>
                <div className="h-px bg-sk-border-2 mb-10" />

                <TableOfContents blocks={post.body} />

                <div>
                  {post.body.map((block, i) => {
                    const h2Index = post.body.slice(0, i + 1).filter((b) => b.type === "h2").length;
                    return <BlockRenderer key={i} block={block} inlineImage={post.image_inline} h2Index={h2Index} postTitle={post.title} glossaryTerms={glossaryTerms ?? []} alreadyLinked={alreadyLinked.current} />;
                  })}
                </div>

                <WptBanner slot="final" className="mt-10" />

                {/* 🎯 MÓDULO DE MINERÍA SHARK COINS */}
                <div ref={rewardBoxRef} className="mt-12 p-8 bg-sk-bg-2 border border-sk-border-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-sk-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sk-accent to-transparent opacity-50"></div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <img 
                      src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" 
                      alt="Shark Coin" 
                      className="w-12 h-12 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" 
                    />
                    <h3 className="text-xl font-extrabold text-sk-text-1 tracking-tight">Recompensa de Estudio</h3>
                  </div>

                  {!isAuthenticated ? (
                    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                      <p className="text-sk-sm text-sk-text-2 mb-2">Inicia sesión para reclamar <strong className="text-sk-accent">{REWARD_AMOUNT} SC</strong> por tu tiempo de estudio.</p>
                      <Link to={`/login?redirect=/blog/${post.slug}`} className="w-full py-3 px-6 rounded-lg bg-sk-bg-3 border border-sk-border-2 font-bold text-sk-text-1 flex items-center justify-center gap-2 hover:bg-sk-bg-4 transition-all">
                        <Lock size={16} className="text-sk-accent" /> Iniciar Sesión para Minar
                      </Link>
                    </div>
                  ) : claimed ? (
                    <div className="text-sk-green font-bold text-lg flex flex-col items-center gap-3 bg-sk-green-dim/30 px-8 py-5 rounded-2xl border border-sk-green/20 w-full max-w-sm">
                      <div className="flex items-center gap-2 text-xl">
                        <span>✅</span> ¡Análisis Completado!
                      </div>
                      <div className="text-[13px] font-mono font-bold w-full flex items-center justify-between bg-sk-bg-0 px-4 py-3 rounded-xl border border-sk-border-2">
                        <span className="text-sk-accent">+{REWARD_AMOUNT} SHARK COINS</span>
                        <span className="text-purple-400">+{XP_REWARD} XP</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-5 w-full max-w-sm mt-2">
                      <div className="w-full bg-sk-bg-0 h-2.5 rounded-full overflow-hidden border border-sk-border-1 relative">
                        <div 
                          className="bg-sk-accent h-full transition-all duration-1000 ease-linear absolute left-0 top-0"
                          style={{ width: `${Math.max(0, 100 - (timeLeft / initialTime) * 100)}%` }}
                        />
                      </div>
                      
                      <div className="flex w-full justify-between text-[11px] font-mono font-semibold tracking-wide uppercase">
                        <span className={timeLeft <= 0 ? "text-sk-green" : "text-sk-text-3"}>
                          {timeLeft > 0 ? `ANÁLISIS: ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : "TIEMPO ✅"}
                        </span>
                        <span className={hasScrolledToBottom ? "text-sk-green" : "text-sk-red"}>
                          {hasScrolledToBottom ? "LECTURA ✅" : "SCROLL ⬇️"}
                        </span>
                      </div>

                      <button
                        onClick={handleClaimCoins}
                        disabled={timeLeft > 0 || !hasScrolledToBottom || isClaiming}
                        className={`w-full py-3.5 px-6 rounded-xl font-bold tracking-widest text-[13px] flex items-center justify-center gap-2 transition-all duration-300 ${
                          timeLeft <= 0 && hasScrolledToBottom
                            ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.3)] cursor-pointer"
                            : "bg-sk-bg-3 text-sk-text-4 cursor-not-allowed border border-sk-border-2"
                        }`}
                      >
                        {isClaiming ? "FIRMANDO TRANSACCIÓN..." : `RECLAMAR ${REWARD_AMOUNT} SHARK COINS`}
                      </button>
                    </div>
                  )}
                </div>

                <RelatedPosts currentSlug={post.slug} currentCategory={post.category} />

                {/* Share */}
                <div className="mt-10 pt-8 border-t border-sk-border-2">
                  <p className="text-sk-sm text-sk-text-3 mb-4">¿Te fue útil? Compártelo con tu comunidad.</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(post.title + " — " + window.location.href)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors">
                      WhatsApp
                    </a>
                    <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors">
                      <Share2 size={13} /> Copiar enlace
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}