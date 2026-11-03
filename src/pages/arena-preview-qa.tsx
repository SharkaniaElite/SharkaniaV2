import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, LockKeyhole, Maximize2, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { StatCard } from "../components/ui/stat-card";
import { PokerTable } from "../components/replayer/poker-table";
import { ReplayControls } from "../components/replayer/replay-controls";
import { createDemoHand, goToStep, initReplayState, stepBackward, stepForward } from "../lib/replayer-engine";
import type { ReplayState } from "../types/replayer";
import { isArenaPreviewHost } from "../lib/arena-preview";
import "../styles/arena-player-experience.css";
import "../styles/arena-preview-qa.css";

function PreviewHand() {
  const [state, setState] = useState<ReplayState>(() => initReplayState(createDemoHand()));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.isPlaying) return;
    const id = window.setInterval(() => {
      setState(previous => {
        if (previous.isFinished) return { ...previous, isPlaying: false };
        const next = stepForward(previous);
        return { ...next, playbackSpeed: previous.playbackSpeed, isPlaying: !next.isFinished };
      });
    }, 1000 / state.playbackSpeed);
    return () => window.clearInterval(id);
  }, [state.isPlaying, state.playbackSpeed]);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const pause = (next: ReplayState): ReplayState => ({ ...next, isPlaying: false });
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void fullRef.current?.requestFullscreen().catch(() => {});
    }
  };

  return (
    <section aria-label="Prueba local del Replayer">
      <div className="arena-qa-intro">
        <span className="arena-player-kicker">REPLAYER / EJEMPLO SINTÉTICO</span>
        <h2>Una mano realista, sin usar ninguna cuenta.</h2>
        <p>Prueba avanzar, retroceder, reproducir, ajustar la velocidad y abrir pantalla completa. Esta mano de ejemplo se calcula en tu navegador y no se guarda en Supabase.</p>
      </div>
      <div ref={fullRef} className="arena-qa-replay-stage">
        <div className="arena-qa-replay-head">
          <span>SHARKANIA ARENA · REPLAYER DEMO</span>
          <button type="button" onClick={toggleFullscreen} aria-pressed={isFullscreen} aria-label={isFullscreen ? "Salir de pantalla completa" : "Ver mesa en pantalla completa"}>
            <Maximize2 size={15} aria-hidden="true" /> {isFullscreen ? "Salir" : "Pantalla completa"}
          </button>
        </div>
        <div className="arena-qa-replay-table"><div className="arena-qa-replay-table-inner"><PokerTable state={state}/></div></div>
        <div className="arena-qa-controls">
          <ReplayControls
            state={state}
            onStepForward={() => setState(old => pause(stepForward(old)))}
            onStepBackward={() => setState(old => pause(stepBackward(old)))}
            onGoToStep={step => setState(old => ({ ...goToStep(old.hand, step), playbackSpeed: old.playbackSpeed, isPlaying: false }))}
            onTogglePlay={() => setState(old => old.isFinished ? { ...initReplayState(old.hand), playbackSpeed: old.playbackSpeed, isPlaying: true } : { ...old, isPlaying: !old.isPlaying })}
            onSetSpeed={speed => setState(old => ({ ...old, playbackSpeed: speed }))}
            onReset={() => setState(old => ({ ...initReplayState(old.hand), playbackSpeed: old.playbackSpeed }))}
          />
        </div>
      </div>
    </section>
  );
}

function PreviewPlayer() {
  const [editing, setEditing] = useState(false);
  const [demoName, setDemoName] = useState("Jugador de prueba");
  const [notice, setNotice] = useState("");

  return (
    <section className="arena-player-workspace arena-qa-dashboard" aria-label="Demostración visual del panel del jugador">
      <header className="arena-player-hero">
        <div className="arena-player-hero-main">
          <span className="arena-player-kicker">SHARKANIA ARENA / CUENTA DEMO</span>
          <h2 className="arena-qa-panel-h2">TU PANEL DE <em>PÓKER.</em></h2>
          <p>Bienvenido, <strong>{demoName}</strong>. Así se organiza la cuenta de un jugador, sus nicknames, misiones y estadísticas registradas.</p>
          <div className="arena-player-hero-actions">
            <Link to="/ranking"><Trophy size={15} /> Ranking ELO <ArrowUpRight size={14}/></Link>
            <Link to="/calendar"><CalendarDays size={15}/> Torneos de póker <ArrowUpRight size={14}/></Link>
          </div>
        </div>
        <div className="arena-player-hero-bottom"><span>VISTA ILUSTRATIVA · SIN DATOS REALES</span><strong>2 nicknames de ejemplo</strong></div>
      </header>
      <nav className="arena-player-quicklinks" aria-label="Secciones del panel de demostración">
        <a href="#qa-perfil">Mi perfil</a><a href="#qa-liga">Liga Ignition</a><a href="#qa-nicks">Nicknames</a><a href="#qa-stats">Estadísticas</a>
      </nav>
      <div id="qa-perfil" className="arena-player-panel arena-player-anchor p-5 sm:p-6 mb-5">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="arena-qa-avatar" aria-hidden="true">{demoName.charAt(0).toUpperCase()}</div>
            <div><h3 className="text-lg font-bold text-sk-text-1">Mi perfil</h3><p className="text-xs text-sk-text-3">Cuenta de demostración · 250 Shark Coins ficticias</p></div>
          </div>
          <button className="arena-qa-action" onClick={() => { setEditing(!editing); setNotice(""); }}>{editing ? "Cancelar" : "Editar perfil demo"}</button>
        </div>
        {editing ? (
          <div className="arena-qa-demo-form">
            <label htmlFor="qa-demo-name">Nombre visible de ejemplo</label>
            <input id="qa-demo-name" type="text" maxLength={48} value={demoName} onChange={e => setDemoName(e.target.value)}/>
            <button className="arena-qa-action" onClick={() => { setEditing(false); setNotice("Nombre cambiado solo en esta pantalla de demostración."); }}>Guardar en el navegador</button>
          </div>
        ) : (
          <div className="arena-qa-demo-grid">
            <div><small>NOMBRE</small><strong>{demoName}</strong></div>
            <div><small>PAÍS</small><strong>Chile (ejemplo)</strong></div>
            <div><small>ESTADO</small><strong>Solo demostración</strong></div>
            <div><small>ROL</small><strong>Jugador de ejemplo</strong></div>
          </div>
        )}
        {notice && <p role="status" className="arena-qa-notice">{notice}</p>}
      </div>
      <div id="qa-liga" className="arena-player-panel arena-player-anchor p-5 sm:p-6 mb-5">
        <span className="arena-player-kicker">LIGA / IGNITION POKER</span>
        <h3 className="text-lg font-bold text-sk-text-1 mt-2 mb-2">Vinculación con Ignition</h3>
        <p className="text-sm text-sk-text-2">Aquí se consulta el estado de vinculación a Ignition y se envían solicitudes. En esta demostración no se realizan registros ni modificaciones.</p>
        <span className="arena-qa-mini-status">Ejemplo: solicitud pendiente</span>
      </div>
      <div id="qa-nicks" className="arena-player-panel arena-player-anchor p-5 sm:p-6 mb-5">
        <h3 className="text-lg font-bold text-sk-text-1 mb-4">Mis nicknames vinculados</h3>
        <div className="arena-qa-nick"><strong>Jugador_Demo_1</strong><span>ELO 1.520 · ejemplo</span></div>
        <div className="arena-qa-nick"><strong>Jugador_Demo_2</strong><span>ELO 1.445 · ejemplo</span></div>
      </div>
      <div id="qa-stats" className="arena-player-anchor">
        <span className="arena-player-kicker">CUENTA / INDICADORES DEMO</span>
        <div className="arena-qa-stats-grid">
          <StatCard label="Shark Coins" value="250" accent="accent" icon="🦈"/>
          <StatCard label="Nivel" value="7" accent="cyan"/>
          <StatCard label="XP" value="1.250" accent="gold"/>
          <StatCard label="Nicknames" value="2"/>
        </div>
      </div>
      <p className="arena-qa-disclaimer">Los nicknames, ELO, XP y saldos de este ejemplo son inventados. No representan ninguna cuenta ni permiten probar las escrituras reales.</p>
    </section>
  );
}

export function ArenaPreviewQaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "replayer" ? "replayer" : "panel";

  // A production deployment can ship this component without exposing a test-only entry point.
  if (!isArenaPreviewHost()) return <Navigate to="/" replace/>;

  return (
    <PageShell variant="arena">
      <SEOHead title="Demostración privada de Sharkania Arena" path="/__arena-qa" description="Simulación visual de la experiencia de usuario con datos ficticios." noIndex/>
      <div className="arena-qa-page">
        <div className="arena-qa-container">
          <div className="arena-qa-guard">
            <div className="arena-qa-guard-icon"><ShieldCheck size={22} aria-hidden="true"/></div>
            <div>
              <span>AMBIENTE PREVIEW · DATOS FICTICIOS</span>
              <h1>Prueba el diseño sin tocar producción.</h1>
              <p>Este espacio simula pantallas privadas para revisar el diseño y probar los controles locales. No inicia sesión, no cambia cuentas ni envía datos a Supabase.</p>
            </div>
          </div>
          <div className="arena-qa-switch" role="group" aria-label="Seleccionar demostración">
            <button aria-pressed={view === "panel"} onClick={() => setSearchParams({ view: "panel" })}><UserRound size={17}/> Panel del jugador</button>
            <button aria-pressed={view === "replayer"} onClick={() => setSearchParams({ view: "replayer" })}><ChevronRight size={17}/> Replayer de póker</button>
          </div>
          {view === "panel" ? <PreviewPlayer/> : <PreviewHand/>}
          <div className="arena-qa-footer">
            <LockKeyhole size={18} aria-hidden="true"/>
            <p>La autenticación y las operaciones reales seguirán bloqueadas en Preview hasta disponer de un backend de pruebas aislado y Turnstile configurado para él.</p>
            <Link to="/login"><ArrowLeft size={14}/> Volver al acceso</Link>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
