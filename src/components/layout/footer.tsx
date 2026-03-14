// src/components/layout/footer.tsx

const FOOTER_LINKS = [
  { label: "Ranking", href: "#ranking" },
  { label: "Calendario", href: "#calendar" },
  { label: "Clubes", href: "#clubs" },
  { label: "Ligas", href: "#leagues" },
  { label: "API", href: "#" },
  { label: "Términos", href: "#" },
  { label: "Privacidad", href: "#" },
];

const SOCIAL_LINKS = [
  { label: "Discord", href: "#" },
  { label: "Twitter/X", href: "#" },
  { label: "Telegram", href: "#" },
  { label: "GitHub", href: "#" },
];

export function Footer() {
  return (
    <footer className="py-8 border-t border-sk-border-1">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        {/* Top row */}
        <div className="flex justify-between items-center flex-wrap gap-4 max-sm:flex-col max-sm:text-center">
          <div>
            <div className="flex items-center gap-2 mb-2 max-sm:justify-center">
              <span className="text-lg">🦈</span>
              <span className="font-extrabold text-sk-text-1 text-sk-md tracking-tight">
                Sharkania
              </span>
            </div>
            <p className="text-sk-xs text-sk-text-2">
              © 2025 Sharkania. La plataforma global de poker competitivo.
            </p>
          </div>
          <div className="flex gap-5 flex-wrap max-sm:justify-center">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sk-xs text-sk-text-2 hover:text-sk-text-1 transition-colors duration-sk-fast"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-sk-border-1 my-4" />

        {/* Bottom row */}
        <div className="flex justify-between items-center flex-wrap gap-2 max-sm:flex-col max-sm:text-center">
          <p className="text-[11px] text-sk-text-2">
            Hecho con 🃏 para la comunidad global de poker
          </p>
          <div className="flex gap-3">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[11px] text-sk-text-2 hover:text-sk-text-1 transition-colors duration-sk-fast"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
