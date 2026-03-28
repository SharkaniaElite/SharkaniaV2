// src/components/layout/navbar.tsx
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Menu, X, Search, LogOut, User, Shield, Settings, Coins, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { GlobalSearch } from "../search/global-search";
import { useAuthStore } from "../../stores/auth-store";
import { SharkCoin } from "../ui/shark-coin";

const NAV_LINKS = [
  { label: "Ranking", href: "/ranking" },
  { label: "Calendario", href: "/calendar" },
  { label: "Clubes", href: "/clubs" },
  { label: "Ligas", href: "/leagues" },
  { label: "Comparador", href: "/compare" },
  { label: "Herramientas", href: "/tools" },
  { label: "Tienda", href: "/shop" },
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
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  const { isAuthenticated, profile, isLoading, logout } = useAuthStore();

  const isSuperAdmin = profile?.role === "super_admin";
  const isClubAdmin = profile?.role === "club_admin";
  const isAdmin = isSuperAdmin || isClubAdmin;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ✅ NUEVA FORMA: Cierra los menús si la URL cambia
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setMobileOpen(false);
    setSearchOpen(false);
    setUserMenuOpen(false);
  }

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

          {/* ══════════════════════════════════════════════ */}
          {/* ADMIN BUTTON — visible directly in navbar     */}
          {/* ══════════════════════════════════════════════ */}
          {!isLoading && isAuthenticated && isAdmin && (
            <Link
              to="/admin/club"
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all duration-200",
                isActive("/admin")
                  ? "bg-sk-accent/20 text-sk-accent border border-sk-accent/30"
                  : "bg-sk-accent/10 text-sk-accent border border-sk-accent/15 hover:bg-sk-accent/20 hover:border-sk-accent/30"
              )}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "transition-transform duration-500",
                  isActive("/admin") ? "" : "group-hover:rotate-90"
                )}
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              {isSuperAdmin ? "Admin" : "Mi Club"}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sk-accent opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sk-accent" />
              </span>
            </Link>
          )}

          {/* ══════════════════════════════════════════════ */}
          {/* WALLET SECCIÓN (Escritorio)                    */}
          {/* ══════════════════════════════════════════════ */}
          {!isLoading && isAuthenticated && profile && (
            <div className="hidden sm:flex items-center gap-2 mr-1">
              {/* Saldo de monedas */}
              <Link to="/wallet" title="Ir a la billetera" className="flex items-center gap-1.5 bg-sk-bg-2 border border-sk-border-2 hover:border-sk-accent/50 hover:bg-white/[0.02] px-3 py-1.5 rounded-full transition-all cursor-pointer group">
                <SharkCoin size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-sk-sm font-bold text-sk-text-1">
                  {profile.shark_coins_balance?.toLocaleString() || 0}
                </span>
              </Link>
              
              {/* Botón rápido de recarga */}
              <Link to="/wallet">
                <Button variant="accent" size="sm" className="h-[30px] rounded-full px-3 flex items-center gap-1 shadow-md shadow-sk-accent/20">
                  <Plus size={14} />
                  <span className="text-[11px] font-bold">Recargar</span>
                </Button>
              </Link>
            </div>
          )}

          {/* Auth buttons / User menu */}
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
                      <p className="text-[11px] text-sk-text-2 capitalize">{profile.role?.replace("_", " ")}</p>
                    </div>
                    <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sk-sm text-sk-text-2 hover:text-sk-text-1 hover:bg-white/[0.03] transition-colors">
                      <User size={14} /> Mi Panel
                    </Link>
                    {isAdmin && (
                      <Link to="/admin/club" className="flex items-center gap-2 px-4 py-2.5 text-sk-sm text-sk-accent hover:bg-white/[0.03] transition-colors">
                        <Settings size={14} /> {isSuperAdmin ? "Gestionar Clubes" : "Admin de mi Club"}
                      </Link>
                    )}
                    {isSuperAdmin && (
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

          {/* Hamburger */}
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={MENU_BG} className="lg:hidden">
          
          {/* ══════════════════════════════════════════════ */}
          {/* WALLET SECCIÓN (Mobile Menu)                   */}
          {/* ══════════════════════════════════════════════ */}
          {isAuthenticated && profile && (
            <Link
              to="/wallet"
              className="flex items-center justify-between px-4 py-3 mb-2 rounded-lg bg-sk-bg-2 border border-sk-border-2 hover:border-sk-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sk-bg-3 flex items-center justify-center">
                  <SharkCoin size={20} />
                </div>
                <div>
                  <p className="text-sk-sm font-bold text-sk-text-1">Mis Shark Coins</p>
                  <p className="text-[10px] text-sk-text-3">Toca para recargar</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-sk-bg-3 px-3 py-1 rounded-full border border-sk-border-2">
                <span className="text-sk-md font-extrabold text-sk-text-1">
                  {profile.shark_coins_balance?.toLocaleString() || 0}
                </span>
              </div>
            </Link>
          )}

          {/* Admin button — prominent at the top of mobile menu */}
          {isAuthenticated && isAdmin && (
            <Link
              to="/admin/club"
              className="flex items-center gap-3 px-4 py-3.5 mb-2 rounded-lg bg-sk-accent/10 border border-sk-accent/20"
            >
              <div className="w-9 h-9 rounded-lg bg-sk-accent/20 flex items-center justify-center">
                <Settings size={18} className="text-sk-accent" />
              </div>
              <div>
                <p className="text-sk-sm font-bold text-sk-accent">
                  {isSuperAdmin ? "Gestionar Clubes" : "Admin de mi Club"}
                </p>
                <p className="text-[10px] text-sk-text-3">
                  Torneos, plantillas, resultados
                </p>
              </div>
              <span className="ml-auto relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sk-accent opacity-50" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sk-accent" />
              </span>
            </Link>
          )}

          {isSuperAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-sk-red/10 border border-sk-red/20"
            >
              <div className="w-9 h-9 rounded-lg bg-sk-red/20 flex items-center justify-center">
                <Shield size={18} className="text-sk-red" />
              </div>
              <div>
                <p className="text-sk-sm font-bold text-sk-red">Super Admin</p>
                <p className="text-[10px] text-sk-text-3">Solicitudes, salas, scoring</p>
              </div>
            </Link>
          )}

          {/* Nav links */}
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