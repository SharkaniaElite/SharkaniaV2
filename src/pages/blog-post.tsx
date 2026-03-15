// src/pages/blog-post.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Share2, ChevronRight } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { getBlogPost, formatBlogDate, type BlogPost, type BlogBlock } from "../lib/api/blog";

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
function BlockRenderer({ block, inlineImage, h2Count }: {
  block: BlogBlock;
  inlineImage: string | null;
  h2Count: React.MutableRefObject<number>;
}) {
  if (block.type === "h2") {
    h2Count.current += 1;
    const injectAfter = h2Count.current === 2 && inlineImage;

    return (
      <>
        <h2 className="text-sk-xl font-extrabold text-sk-text-1 tracking-tight mt-12 mb-4 first:mt-0">
          {block.content}
        </h2>
        {injectAfter && (
          <div className="my-6 rounded-xl overflow-hidden border border-sk-border-2">
            <img
              src={inlineImage!}
              alt="Ilustración del artículo"
              className="w-full h-auto"
            />
          </div>
        )}
      </>
    );
  }

  if (block.type === "h3") {
    return (
      <h3 className="text-sk-md font-bold text-sk-text-1 mt-8 mb-3">
        {block.content}
      </h3>
    );
  }

  if (block.type === "callout") {
    return (
      <div className="my-8 rounded-lg border border-sk-accent/20 bg-sk-accent-dim px-6 py-5">
        <p className="text-sk-base text-sk-text-1 font-medium leading-relaxed">
          {block.content}
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
        <p className="text-sk-base text-sk-text-2 leading-snug">{block.content}</p>
      </div>
    );
  }

  if (block.type === "list") {
    return (
      <ul className="my-5 space-y-2 pl-1">
        {(block.items ?? []).map((item, j) => (
          <li key={j} className="flex items-start gap-3 text-sk-base text-sk-text-2 leading-relaxed">
            <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="text-sk-base text-sk-text-2 leading-relaxed mb-5">
      {block.content}
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
              {post.body.map((block, i) => (
                <BlockRenderer
                  key={i}
                  block={block}
                  inlineImage={post.image_inline}
                  h2Count={h2Count}
                />
              ))}
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
                La demo está disponible ahora.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sk-accent text-sk-bg-0 text-sk-sm font-bold hover:bg-sk-accent-hover transition-colors"
              >
                Ver demo gratuita <ChevronRight size={14} />
              </Link>
            </div>

            {/* Share footer */}
            <div className="mt-10 pt-8 border-t border-sk-border-2 flex items-center justify-between">
              <p className="text-sk-sm text-sk-text-3">
                ¿Te fue útil? Compártelo con tu comunidad.
              </p>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sk-border-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
              >
                <Share2 size={13} /> Compartir
              </button>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
