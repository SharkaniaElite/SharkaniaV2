import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
  number: number;
  brand: string;
  logo: string;
  secondaryLogo?: string;
  kicker: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: "orange" | "cyan" | "violet" | "gold";
  detail?: ReactNode;
  footnote?: string;
  cover?: string;
};

export function ArenaFeaturedPromo({
  number, brand, logo, secondaryLogo, kicker, title, description,
  href, cta, tone, detail, footnote, cover,
}: Props) {
  return (
    <article className={`arena-featured-promo arena-featured-promo--${tone} relative flex flex-col overflow-hidden rounded-2xl border bg-[#0f1e2b]`}
      data-promo-order={number} aria-label={`Promoción ${number}: ${brand}`}>
      <div className="arena-featured-promo-art relative isolate min-h-[176px] overflow-hidden px-5 py-5 sm:min-h-[200px]">
        {cover && <img src={cover} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="lazy" decoding="async" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071421]/95 via-[#071421]/70 to-transparent" aria-hidden="true" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="arena-featured-promo-badge rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest">{kicker}</span>
            <span className="text-xs font-bold tabular-nums text-white/75">0{number}</span>
          </div>
          <div className="flex min-h-[82px] items-end gap-3">
            <img src={logo} alt={`Logo oficial de ${brand}`} loading="lazy" decoding="async"
              className="h-16 w-auto max-w-[65%] object-contain drop-shadow-[0_7px_16px_rgba(0,0,0,.6)] sm:h-20" />
            {secondaryLogo && <img src={secondaryLogo} alt="Logo Latin Allin Póker" loading="lazy" decoding="async"
              className="h-14 max-w-[34%] object-contain drop-shadow-[0_7px_16px_rgba(0,0,0,.6)] sm:h-16" />}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300">{brand}</p>
        <h3 className="mb-3 text-xl font-extrabold leading-snug tracking-tight text-white">{title}</h3>
        <p className="mb-4 text-sm leading-relaxed text-slate-300">{description}</p>
        {detail && <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">{detail}</div>}
        {footnote && <p className="mb-4 text-xs leading-relaxed text-slate-400">{footnote}</p>}
        <Link to={href} className="arena-featured-promo-cta mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
          {cta}<ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
