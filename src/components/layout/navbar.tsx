import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Mail, Menu, Play, Search, Settings, User, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { useAuthStore } from "../../stores/auth-store";
import { GlobalSearch } from "../search/global-search";
import { SharkCoin } from "../ui/shark-coin";
import { CONTACT_EMAIL, NAVIGATION, isNavigationGroupActive, isNavigationLinkActive, pathMatches } from "./navigation";
import "./navbar.css";

const CONTROL = "inline-flex min-h-11 items-center gap-2 rounded-md text-sk-sm font-semibold text-sk-text-2 hover:bg-white/5 hover:text-sk-text-1";
const ACTIVE = "bg-white/[0.08] text-sk-text-1 underline decoration-sk-accent decoration-2 underline-offset-4";
const ACCOUNT_LINK = cn(CONTROL, "w-full px-3");
const DESKTOP = "(min-width: 1280px)";

type NavbarPanel = "mobile" | "search" | "account";

type NavigationSectionsProps = {
  pathname: string;
  mobile?: boolean;
  arena: boolean;
  onSelect?: () => void;
};

function NavigationSections({ pathname, mobile = false, arena, onSelect }: NavigationSectionsProps) {
  const id = useId();
  const groupRef = useRef<HTMLLIElement>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const openGroup = pinned ?? hovered;

  function close() {
    setPinned(null);
    setHovered(null);
  }

  useEffect(() => {
    if (!openGroup || mobile) return;
    function onPointerDown(event: PointerEvent) {
      if (!groupRef.current?.contains(event.target as Node)) close();
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openGroup, mobile]);

  const linkClass = cn(CONTROL, mobile ? "w-full justify-between px-3" : "whitespace-nowrap px-2 min-[1440px]:px-3");
  return (
    <ul className={mobile ? "space-y-1" : "hidden min-[1280px]:flex items-center gap-0.5"}>
      {NAVIGATION.map((item) => {
        if ("href" in item) {
          const active = isNavigationLinkActive(pathname, item);
          return (
            <li key={item.href}>
              <Link to={item.href} aria-current={active ? (pathname === item.href ? "page" : "location") : undefined} onClick={onSelect} className={cn(linkClass, active && ACTIVE)}>
                {item.label}
              </Link>
            </li>
          );
        }

        const open = openGroup === item.id;
        const groupId = `${id}-${item.id}`;
        const triggerId = `${groupId}-trigger`;
        function selectGroupLink() {
          if (mobile) {
            onSelect?.();
          } else {
            document.getElementById(triggerId)?.focus();
          }
          close();
        }

        function onGroupKeyDown(event: KeyboardEvent<HTMLLIElement>) {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            document.getElementById(triggerId)?.focus();
            close();
          }
        }

        const renderLink = (link: typeof item.links[number]) => {
          const active = isNavigationLinkActive(pathname, link);
          return (
            <li key={link.href}>
              <Link to={link.href} aria-current={active ? (pathname === link.href ? "page" : "location") : undefined} className={cn(ACCOUNT_LINK, active && ACTIVE)} onClick={selectGroupLink}>
                {link.label}
              </Link>
            </li>
          );
        };

        return (
          <li
            key={item.id}
            ref={open ? groupRef : undefined}
            className="relative"
            onKeyDown={onGroupKeyDown}
            onPointerEnter={(event) => {
              if (!mobile && event.pointerType === "mouse" && !event.currentTarget.parentElement?.contains(document.activeElement)) {
                setHovered(item.id);
              }
            }}
            onPointerLeave={() => setHovered(null)}
            onBlur={(event) => {
              if (!mobile && open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
            }}
          >
            <button
              id={triggerId}
              type="button"
              aria-expanded={open}
              aria-controls={groupId}
              className={cn(linkClass, isNavigationGroupActive(pathname, item) && ACTIVE)}
              onClick={(event) => {
                event.currentTarget.focus();
                setHovered(null);
                setPinned(pinned === item.id ? null : item.id);
              }}
            >
              {item.label}
              <ChevronDown size={15} aria-hidden="true" className={cn(open && "rotate-180")} />
            </button>
            <div
              id={groupId}
              hidden={!open}
              className={mobile ? "ml-3 border-l border-sk-border-2 pl-2" : "absolute left-0 top-full w-60 pt-1"}
            >
              <div className={cn(
                !mobile && "max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain rounded-lg border border-sk-border-2 bg-sk-bg-2 p-1 shadow-sk-xl",
                !mobile && arena && "arena-nav-dropdown",
              )}>
                <ul>
                  {item.links.map(renderLink)}
                  {item.support && (
                    <li>
                      <a href={CONTACT_EMAIL} className={ACCOUNT_LINK} onClick={selectGroupLink}>
                        <Mail size={16} aria-hidden="true" /> Contacto y soporte
                      </a>
                    </li>
                  )}
                </ul>
                {item.commercialLinks && (
                  <div className="mt-1 border-t border-sk-border-2 pt-2">
                    <p className="px-3 text-sk-xs font-semibold text-sk-text-2">Información comercial · 18+</p>
                    <ul>{item.commercialLinks.map(renderLink)}</ul>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Navbar({ variant = "standard" }: { variant?: "standard" | "arena" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [panel, setPanel] = useState<NavbarPanel | null>(null);
  const [routeKey, setRouteKey] = useState(location.key);
  const [breakpointChanges, setBreakpointChanges] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const searchRegion = useRef<HTMLDivElement>(null);
  const id = useId();
  const mobileId = `${id}-mobile`;
  const searchId = `${id}-search`;
  const accountId = `${id}-account`;
  const { isAuthenticated, profile, isLoading, logout } = useAuthStore();
  const arena = variant === "arena";
  const signedIn = !isLoading && isAuthenticated && profile;
  const isSuperAdmin = profile?.role === "super_admin";
  const isAdmin = isSuperAdmin || profile?.role === "club_admin";
  const balance = profile?.shark_coins_balance?.toLocaleString() || "0";

  if (location.key !== routeKey) {
    setRouteKey(location.key);
    setPanel(null);
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP);
    function onBreakpointChange() {
      const focusWasInNav = navRef.current?.contains(document.activeElement);
      setPanel(null);
      setBreakpointChanges((count) => count + 1);
      if (!focusWasInNav) return;

      if (desktop.matches) {
        navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
      } else {
        mobileButton.current?.focus();
      }
    }
    desktop.addEventListener("change", onBreakpointChange);
    return () => desktop.removeEventListener("change", onBreakpointChange);
  }, []);

  useEffect(() => {
    if (panel === "search") searchRegion.current?.querySelector("input")?.focus();
    if (!panel) return;
    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setPanel(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [panel]);

  function togglePanel(selected: NavbarPanel, trigger: HTMLButtonElement) {
    trigger.focus();
    setPanel(panel === selected ? null : selected);
  }

  function closePanel() {
    if (panel === "mobile") mobileButton.current?.focus();
    if (panel === "search") searchButton.current?.focus();
    if (panel === "account") accountButton.current?.focus();
    setPanel(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && panel) {
      event.stopPropagation();
      closePanel();
    }
  }

  const handleSignOut = async () => {
    closePanel();
    await logout();
    navigate("/");
  };

  const signInClass = cn(CONTROL, "justify-center whitespace-nowrap border border-sk-border-2 px-3 text-sk-text-1");
  const registerClass = "inline-flex min-h-11 items-center justify-center rounded-md bg-sk-accent px-3 text-sk-sm font-bold text-sk-bg-0 hover:bg-sk-accent-hover";

  return (
    <nav
      ref={navRef}
      aria-label="Navegación principal"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setPanel(null);
      }}
      style={{ background: scrolled ? "rgba(12,13,16,0.97)" : "rgba(12,13,16,0.85)" }}
      className={cn(
        "sharkania-navbar fixed inset-x-0 top-0 flex h-14 items-center justify-between gap-2 border-b border-sk-border-2 px-3 backdrop-blur-[16px] sm:px-6",
        panel === "mobile" || panel === "search" ? "z-[120]" : "z-[100]",
      )}
    >
      <Link to="/" onClick={closePanel} className="flex min-h-11 shrink-0 items-center gap-2 no-underline" aria-label={arena ? "Sharkania Arena - inicio" : "Sharkania - inicio"}>
        <svg width="26" height="26" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M7,36 L18,4 L38,24 L33,36 Z" fill="#22d3ee" />
        </svg>
        <span className="text-sk-md font-extrabold tracking-tight text-sk-text-1">Sharkania</span>
        {arena && <span className="arena-nav-badge">ARENA</span>}
      </Link>

      <NavigationSections key={location.key + breakpointChanges} pathname={location.pathname} arena={arena} />

      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <button
          ref={searchButton}
          type="button"
          className={cn(CONTROL, "w-11 justify-center px-0 min-[1280px]:hidden")}
          aria-label={panel === "search" ? "Cerrar búsqueda" : "Buscar"}
          aria-expanded={panel === "search"}
          aria-controls={searchId}
          onClick={(event) => togglePanel("search", event.currentTarget)}
        >
          {panel === "search" ? <X size={20} /> : <Search size={20} />}
        </button>

        <div
          id={searchId}
          ref={searchRegion}
          className={cn(
            "min-[1280px]:static min-[1280px]:block min-[1280px]:w-52 min-[1280px]:min-w-36 min-[1440px]:w-64 min-[1280px]:border-0 min-[1280px]:bg-transparent min-[1280px]:p-0",
            panel === "search" ? "absolute inset-x-0 top-full border-b border-sk-border-2 bg-sk-bg-1 p-3" : "hidden",
          )}
        >
          <GlobalSearch variant="full" placeholder="Buscar…" />
        </div>

        <Link
          to="/live"
          aria-label="Ver transmisiones de póker"
          onClick={closePanel}
          className="hidden min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 text-[11px] font-bold text-cyan-300 hover:bg-cyan-400/20 sm:inline-flex"
        >
          <Play size={14} aria-hidden="true" /> Transmisiones
        </Link>

        {signedIn ? (
          <>
            <Link to="/shop" aria-label={`Tienda · ${balance} SharkCoins`} title="Ver mi saldo en la tienda" className="hidden min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-sk-border-2 bg-sk-bg-2 px-3 text-sk-sm font-bold tabular-nums hover:border-sk-accent/50 min-[1280px]:flex">
              <SharkCoin size={16} /> <span className="max-w-20 truncate">{balance}</span>
            </Link>
            <div
              className="relative"
              onBlur={(event) => {
                if (panel === "account" && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setPanel(null);
              }}
            >
              <button
                ref={accountButton}
                type="button"
                aria-label="Menú de cuenta"
                aria-expanded={panel === "account"}
                aria-controls={accountId}
                onClick={(event) => togglePanel("account", event.currentTarget)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-sk-border-2 bg-sk-bg-4 text-sk-sm font-bold text-sk-accent hover:border-sk-accent"
              >
                {(profile.display_name ?? "U").charAt(0).toUpperCase()}
              </button>
              <div id={accountId} hidden={panel !== "account"} className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-sk-border-2 bg-sk-bg-2 p-1 shadow-sk-xl">
                <div className="border-b border-sk-border-2 px-3 py-2">
                  <p className="truncate text-sk-sm font-semibold">{profile.display_name ?? "Usuario"}</p>
                  <p className="text-sk-xs capitalize text-sk-text-2">{profile.role?.replace("_", " ")}</p>
                </div>
                <Link to="/dashboard" onClick={closePanel} className={ACCOUNT_LINK}><User size={16} /> Mi Panel</Link>
                <Link to="/shop" onClick={closePanel} className={ACCOUNT_LINK}><SharkCoin size={16} /> SharkCoins · {balance}</Link>
                {isAdmin && (
                  <Link to="/admin/club" onClick={closePanel} className={cn(ACCOUNT_LINK, pathMatches(location.pathname, "/admin/club") && ACTIVE)}>
                    <Settings size={16} /> {isSuperAdmin ? "Gestionar Clubes" : "Admin de mi Club"}
                  </Link>
                )}
                {isSuperAdmin && (
                  <Link to="/admin" onClick={closePanel} className={cn(ACCOUNT_LINK, location.pathname === "/admin" && ACTIVE)}>
                    <Settings size={16} /> Super Admin
                  </Link>
                )}
                <button type="button" onClick={handleSignOut} className={ACCOUNT_LINK}><LogOut size={16} /> Cerrar sesión</button>
              </div>
            </div>
          </>
        ) : !isLoading && (
          <div className="hidden shrink-0 items-center gap-2 min-[1280px]:flex">
            <Link to="/login" className={signInClass}>Iniciar sesión</Link>
            <Link to="/register" className={registerClass}>Registrarse</Link>
          </div>
        )}

        <button
          ref={mobileButton}
          type="button"
          onClick={(event) => togglePanel("mobile", event.currentTarget)}
          className={cn(CONTROL, "w-11 justify-center px-0 text-sk-text-1 min-[1280px]:hidden")}
          aria-label={panel === "mobile" ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={panel === "mobile"}
          aria-controls={mobileId}
        >
          {panel === "mobile" ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        id={mobileId}
        hidden={panel !== "mobile"}
        className={cn("sharkania-mobile-panel min-[1280px]:hidden", arena && "arena-mobile-menu")}
      >
        {panel === "mobile" && (
          <>
            <NavigationSections pathname={location.pathname} mobile arena={arena} onSelect={closePanel} />
            <div className="mt-3 space-y-2 border-t border-sk-border-2 pt-3">
              <Link to="/live" onClick={closePanel} className={cn(ACCOUNT_LINK, "sm:hidden")}>
                <Play size={16} /> Transmisiones
              </Link>
              {signedIn && (
                <Link to="/shop" onClick={closePanel} className={ACCOUNT_LINK}>
                  <SharkCoin size={18} /> Mis SharkCoins · {balance}
                </Link>
              )}
              {!isLoading && !signedIn && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link to="/login" onClick={closePanel} className={signInClass}>Iniciar sesión</Link>
                  <Link to="/register" onClick={closePanel} className={registerClass}>Registrarse</Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
