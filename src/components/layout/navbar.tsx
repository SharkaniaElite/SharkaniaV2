// src/components/layout/navbar.tsx
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Menu, X, Search, LogOut, User, Shield, Settings } from "lucide-react";
import { Button } from "../ui/button";
import { GlobalSearch } from "../search/global-search";
import { useAuthStore } from "../../stores/auth-store";

const NAV_LINKS = [
  { label: "Ranking", href: "/ranking" },
  { label: "Calendario", href: "/calendar" },
  { label: "Clubes", href: "/clubs" },
  { label: "Ligas", href: "/leagues" },
  { label: "Comparador", href: "/compare" },
  { label: "Herramientas", href: "/tools" },
  { label: "Blog", href: "/blog" },
];

const MENU_BG: React.CSSProperties = {
  background: "rgb(12, 13, 16)",
  position: "fixed",
  top: "56px",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 200,
  display: "flex",
  flexDirection: "column",
  padding: "2rem",
  gap: "4px",
  borderTop: "1px solid rgba(255,255,255,0.09)",
  overflowY: "auto",
};

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, profile, isLoading, logout } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Bloquea scroll del body cuando el menú está abierto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (href: string) => location.pathname.startsWith(href);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <>
      <nav
        style={{
          background: scrolled ? "rgba(12,13,16,0.97)" : "rgba(12,13,16,0.85)",
          backdropFilter: "blur(16px)",
        }}
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] h-14 flex items-center justify-between",
          "border-b border-sk-border-2 transition-all duration-200",
          "px-3 sm:px-6"
        )}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline shrink-0 min-w-0">
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7,36 L18,4 L38,24 L33,36 Z" fill="#22d3ee"/>
          </svg>
          <span className="text-sk-md font-extrabold text-sk-text-1 tracking-tight">
            Sharkania
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "text-sk-sm font-medium px-3 py-1.5 rounded-sm transition-colors duration-100",
                isActive(link.href)
                  ? "text-sk-text-1 bg-white/[0.06]"
                  : "text-sk-text-2 hover:text-sk-text-1 hover:bg-white/[0.04]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search desktop */}
          <div className="hidden md:block">
            <GlobalSearch variant="full" />
          </div>

          {/* Search mobile */}
          <button
            style={{ color: "#a1a1aa" }}
            className="md:hidden w-9 h-9 flex items-center justify-center"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Buscar"
          >
            <Search size={18} />
          </button>

          {/* Auth buttons */}
          {!isLoading && (
            isAuthenticated && profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-8 h-8 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-accent hover:border-sk-accent transition-colors"
                >
                  {(profile.display_name ?? "U").charAt(0).toUpperCase()}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-sk-bg-2 border border-sk-border-2 rounded-lg shadow-sk-xl overflow-hidden z-[50]">
                    <div className="px-4 py-3 border-b border-sk-border-2">
                      <p className="text-sk-sm font-semibold text-sk-text-1 truncate">
                        {profile.display_name ?? "Usuario"}
                      </p>
                      <p className="text-[11px] text-sk-text-2 capitalize">{profile.role}</p>
                    </div>
                    <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:bg-white/[0.03] transition-colors">
                      <User size={14} /> Mi Panel
                    </Link>
                    {(profile.role === "club_admin" || profile.role === "super_admin") && (
                      <Link to="/admin/club" className="flex items-center gap-2 px-4 py-2.5 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:bg-white/[0.03] transition-colors">
                        <Settings size={14} /> Admin Club
                      </Link>
                    )}
                    {profile.role === "super_admin" && (
                      <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sk-sm text-sk-red hover:bg-white/[0.03] transition-colors">
                        <Shield size={14} /> Super Admin
                      </Link>
                    )}
                    <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:bg-white/[0.03] transition-colors border-t border-sk-border-2">
                      <LogOut size={14} /> Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="hidden lg:inline-flex">
                  <Button variant="secondary" size="sm">Iniciar Sesión</Button>
                </Link>
                <Link to="/register" className="hidden md:inline-flex">
                  <Button variant="accent" size="sm">Registrarse</Button>
                </Link>
              </>
            )
          )}

          {/* Hamburger — siempre visible en mobile, fuera del flujo de auth */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            style={{
              color: "#fafafa",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: "pointer",
              background: "transparent",
              border: "none",
              padding: 0,
            }}
            className="lg:hidden"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile search */}
      {searchOpen && (
        <div
          style={{ background: "rgb(12,13,16)", position: "fixed", top: "56px", left: 0, right: 0, zIndex: 201, padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.09)" }}
          className="md:hidden"
        >
          <GlobalSearch variant="full" />
        </div>
      )}

      {/* Mobile menu — renderizado fuera del <nav> para evitar overflow */}
      {mobileOpen && (
        <div style={MENU_BG} className="lg:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              style={{ color: isActive(link.href) ? "#fafafa" : "#a1a1aa" }}
              className="text-sk-md font-medium px-4 py-3 rounded-sm w-full transition-colors duration-100 hover:text-sk-text-1"
            >
              {link.label}
            </Link>
          ))}

          <div className="mt-4 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="secondary" size="lg" className="w-full">Mi Panel</Button>
                </Link>
                <Button variant="ghost" size="lg" className="w-full" onClick={handleSignOut}>
                  Cerrar Sesión
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="secondary" size="lg" className="w-full">Iniciar Sesión</Button>
                </Link>
                <Link to="/register">
                  <Button variant="accent" size="lg" className="w-full">Registrarse</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
