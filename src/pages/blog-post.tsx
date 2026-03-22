// src/pages/blog-post.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Share2, ChevronRight } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { getBlogPost, formatBlogDate, type BlogPost, type BlogBlock } from "../lib/api/blog";
import { SEOHead } from "../components/seo/seo-head";
import { renderWithLinks } from "../lib/render-inline-links";

// ── OG Meta helper ────────────────────────────────────────────────────────────
function setOGMeta(post: BlogPost) {
  const set = (property: string, content: string) => {
    let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", property);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };
  const setName = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
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

function resetOGMeta() {
  document.title = "Sharkania";
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
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
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 rounded bg-sk-bg-4" style={{ width: `${90 - i * 5}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Block Renderer ────────────────────────────────────────────────────────────
function BlockRenderer({ block, inlineImage, h2Index }: {
  block: BlogBlock;
  inlineImage: string | null;
  h2Index: number;
}) {
  if (block.type === "h2") {
    const injectAfter = h2Index === 2 && inlineImage;
    return (
      <>
        <h2 className="text-sk-xl font-extrabold text-sk-text-1 tracking-tight mt-12 mb-4 first:mt-0">
          {renderWithLinks(block.content ?? "")}
        </h2>
        {injectAfter && (
          <div className="my-6 rounded-xl overflow-hidden border border-sk-border-2">
            <img src={inlineImage!} alt="Ilustración del artículo" className="w-full h-auto" />
          </div>
        )}
      </>
    );
  }

  // ... resto igual (h3, callout, stat, list, p)

  if (block.type === "h3") {
    return (
      <h3 className="text-sk-md font-bold text-sk-text-1 mt-8 mb-3">
        {renderWithLinks(block.content ?? "")}
      </h3>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="my-8 rounded-lg border border-sk-accent/20 bg-sk-accent-dim px-6 py-5">
        <p className="text-sk-base text-sk-text-1 font-medium leading-relaxed">
          {renderWithLinks(block.content ?? "")}
        </p>
      </div>
    );
  }

  if (block.type === "stat") {
    return (
      <div className="my-8 rounded-xl border border-sk-border-2 bg-sk-bg-2 px-6 py-6 flex items-center gap-5">
        <span className="text-[2.5rem] font-extrabold text-sk-accent leading-none shrink-0">
          {block.value}
        </span>
        <p className="text-sk-base text-sk-text-2 leading-snug">{renderWithLinks(block.content ?? "")}</p>
      </div>
    );
  }

  if (block.type === "list") {
    return (
      <ul className="my-5 space-y-2 pl-1">
        {(block.items ?? []).map((item, j) => (
          <li key={j} className="flex items-start gap-3 text-sk-base text-sk-text-2 leading-relaxed">
            <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />
            {renderWithLinks(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="text-sk-base text-sk-text-2 leading-relaxed mb-5">
      {renderWithLinks(block.content ?? "")}
    </p>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const h2Count = useRef(0);

  useEffect(() => {
    if (!slug) return;
    window.scrollTo(0, 0);

    getBlogPost(slug)
      .then((data) => {
        if (!data) {
          navigate("/blog", { replace: true });
        } else {
          setPost(data);
          setOGMeta(data);
          h2Count.current = 0;
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    return () => resetOGMeta();
  }, [slug, navigate]);

  const handleShare = () => {
    if (navigator.share && post) {
      navigator.share({ title: post.title, text: post.excerpt, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <PageShell>
      {/* Breadcrumb bar */}
      <div className="border-b border-sk-border-2 bg-sk-bg-0 sticky top-14 z-10 mt-14">
        <div className="max-w-3xl mx-auto px-6 h-11 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sk-sm text-sk-text-2">
            <Link to="/blog" className="hover:text-sk-accent transition-colors font-medium">
              Blog
            </Link>
            <ChevronRight size={13} className="text-sk-text-4" />
            <span className="text-sk-text-3 truncate max-w-[260px]">
              {post?.title ?? "Artículo"}
            </span>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sk-sm text-sk-text-2 hover:text-sk-accent transition-colors"
          >
            <Share2 size={13} /> Compartir
          </button>
        </div>
      </div>

      {loading && <PostSkeleton />}

      {error && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="rounded-xl border border-sk-red/20 bg-sk-red-dim p-8 text-center">
            <p className="text-sk-sm text-sk-red mb-4">No se pudo cargar el artículo.</p>
            <Link to="/blog" className="text-sk-sm text-sk-accent hover:underline">
              Volver al blog
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && post && (
        <>
        <SEOHead
  title={post.title}
  description={post.excerpt}
  path={`/blog/${post.slug}`}
  ogType="article"
  ogImage={post.image_og ?? undefined}
/>
          {/* ── Hero Image ── */}
          {post.image_hero && (
            <div className="w-full max-h-[480px] overflow-hidden bg-sk-bg-3">
              <img
                src={post.image_hero}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="max-w-3xl mx-auto px-6 py-12">
            {/* Back */}
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors mb-8"
            >
              <ArrowLeft size={14} /> Volver al Blog
            </Link>

            {/* Meta */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-sk-accent-dim text-sk-accent text-[11px] font-semibold uppercase tracking-wider">
                {post.category}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-sk-text-3">
                <Clock size={11} /> {post.read_time} min de lectura
              </span>
              <span className="text-[11px] text-sk-text-4">
                {formatBlogDate(post.published_at)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-sk-3xl font-extrabold text-sk-text-1 tracking-tight leading-tight mb-6">
              {post.title}
            </h1>

            {/* Excerpt */}
            <p className="text-sk-lg text-sk-text-2 leading-relaxed border-l-2 border-sk-accent pl-5 mb-10">
              {post.excerpt}
            </p>

            <div className="h-px bg-sk-border-2 mb-10" />

            {/* Body */}
            <div>
              {post.body.map((block, i) => {
  const h2Index = post.body.slice(0, i + 1).filter(b => b.type === "h2").length;
  return (
    <BlockRenderer
      key={i}
      block={block}
      inlineImage={post.image_inline}
      h2Index={h2Index}
    />
  );
})}
            </div>

            {/* CTA */}
            <div className="mt-14 rounded-xl border border-sk-border-2 bg-sk-bg-2 p-8 text-center">
              <p className="text-sk-sm text-sk-accent font-semibold uppercase tracking-widest mb-3">
                ¿Administras un club?
              </p>
              <h3 className="text-sk-xl font-extrabold text-sk-text-1 mb-3 tracking-tight">
                Mira cómo se vería tu club en Sharkania
              </h3>
              <p className="text-sk-sm text-sk-text-2 mb-6 max-w-md mx-auto">
                Rankings ELO en tiempo real, calendario de torneos y estadísticas de jugadores.
                Gestiona tu Club con funciones básicas gratuitas y premium. Los primeros 10 Clubs registrados obtendrán las funciones premium gratis por 3 meses!
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sk-accent text-sk-bg-0 text-sk-sm font-bold hover:bg-sk-accent-hover transition-colors"
              >
                Registrar mi Club <ChevronRight size={14} />
              </Link>
            </div>

            {/* Share footer */}
            <div className="mt-10 pt-8 border-t border-sk-border-2">
              <p className="text-sk-sm text-sk-text-3 mb-4">
                ¿Te fue útil? Compártelo con tu comunidad.
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </a>

                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(post.title + " — " + window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </a>

                {/* X / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.265 5.638 5.9-5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  X
                </a>

                {/* Copiar enlace */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
                >
                  <Share2 size={13} /> Copiar enlace
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
