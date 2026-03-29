import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { Navbar } from "../components/layout/navbar";
import { AdminAccessBanner } from "../components/layout/admin-access-banner";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { PokerTable } from "../components/replayer/poker-table";
import { ReplayControls } from "../components/replayer/replay-controls";
import { useAuthStore } from "../stores/auth-store";
import {
  Upload, FileText, Share2, Check,
  ChevronDown, Play, AlertCircle,
  Maximize2, Minimize2,
} from "lucide-react";
import type { HandHistory, ReplayState } from "../types/replayer";
import {
  initReplayState, stepForward, stepBackward, goToStep,
  decodeHandFromURL, createDemoHand, saveHandForShare, loadHandFromShare,
} from "../lib/replayer-engine";
import { parseHandHistory } from "../lib/hand-parsers";

import { useFeatureAccess } from "../hooks/use-shop";
import { FeaturePaywall } from "../components/shop/feature-paywall";
import { supabase } from "../lib/supabase";

function makeState(hand: HandHistory, speed = 1): ReplayState {
  return { ...initReplayState(hand), isPlaying: false, playbackSpeed: speed };
}

export function ReplayerPage() {
  const { isAuthenticated } = useAuthStore();
  const [searchParams]      = useSearchParams();
  const { id: sharedId }    = useParams<{ id?: string }>();
  const currentPath         = window.location.pathname;

  const [hands, setHands]                = useState<HandHistory[]>([]);
  const [selectedIdx, setSelectedIdx]    = useState(0);
  const [rs, setRS]                      = useState<ReplayState | null>(null);
  const [detectedRoom, setDetectedRoom]  = useState<string | null>(null);
  const [parseErrors, setParseErrors]    = useState<string[]>([]);
  const [inputMode, setInputMode]        = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText]        = useState("");
  const [copied, setCopied]              = useState(false);
  const [sharing, setSharing]            = useState(false);
  const [dragOver, setDragOver]          = useState(false);
  const [loadingShared, setLoadingShared]= useState(!!sharedId);
  const [isFS, setIsFS]                  = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fsRef       = useRef<HTMLDivElement>(null);
  const rsRef       = useRef<ReplayState | null>(null);
  rsRef.current = rs;

  const { user } = useAuthStore();
  const { data: access } = useFeatureAccess("tool_replayer");
  const hasFullAccess = access?.has_access ?? false;

  const [freeUsed, setFreeUsed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || hasFullAccess) return;
    const checkUsage = async () => {
      const { data } = await supabase
        .from('free_tool_usages')
        .select('last_used_date')
        .eq('user_id', user.id)
        .eq('tool_id', 'tool_replayer')
        .single();
      const today = new Date().toISOString().split("T")[0];
      if (data && data.last_used_date === today) setFreeUsed(true);
    };
    checkUsage();
  }, [isAuthenticated, user, hasFullAccess]);

  const needsPaywall = isAuthenticated && freeUsed && !hasFullAccess;

  const consumeFreeUse = useCallback(async (): Promise<boolean> => {
    if (hasFullAccess) return true;
    if (freeUsed) return false;
    if (!isAuthenticated || !user) { setFreeUsed(true); return true; }

    const { data: success } = await supabase.rpc('use_free_tool', {
      p_user_id: user.id,
      p_tool_id: 'tool_replayer'
    });
    if (success) { setFreeUsed(true); return true; }
    else { setFreeUsed(true); return false; }
  }, [hasFullAccess, freeUsed, isAuthenticated, user]);

  useEffect(() => {
    if (!sharedId) return;
    setLoadingShared(true);
    loadHandFromShare(sharedId)
      .then((hand) => {
        if (hand) { setHands([hand]); setSelectedIdx(0); setRS(makeState(hand)); setDetectedRoom("Mano compartida"); }
      })
      .finally(() => setLoadingShared(false));
  }, [sharedId]);

  useEffect(() => {
    if (sharedId) return;
    const encoded = searchParams.get("hand");
    if (!encoded) return;
    const hand = decodeHandFromURL(encoded);
    if (!hand) return;
    setHands([hand]); setSelectedIdx(0); setRS(makeState(hand)); setDetectedRoom("Mano compartida");
  }, [searchParams, sharedId]);

  const toggleFS = useCallback(() => {
    if (!fsRef.current) return;
    if (!document.fullscreenElement) fsRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const cb = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", cb);
    return () => document.removeEventListener("fullscreenchange", cb);
  }, []);

  useEffect(() => {
    const cb = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") toggleFS();
    };
    window.addEventListener("keydown", cb);
    return () => window.removeEventListener("keydown", cb);
  }, [toggleFS]);

  const processTextInternal = useCallback((text: string) => {
    setParseErrors([]);
    const result = parseHandHistory(text);
    const firstHand = result.hands[0];

    if (result.success && firstHand) {
      setHands(result.hands); setSelectedIdx(0);
      setRS(makeState(firstHand)); setDetectedRoom(result.detectedRoom);
    } else { 
      setParseErrors(result.errors); 
    }
  }, []);

  const processText = useCallback(async (text: string) => {
    const allowed = await consumeFreeUse();
    if (!allowed) return;
    processTextInternal(text);
  }, [processTextInternal, consumeFreeUse]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target?.result as string);
    reader.readAsText(file);
  }, [processText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => () => stopInterval(), [stopInterval]);

  const selectHand = useCallback((index: number) => {
    const hand = hands[index];
    if (!hand) return;
    stopInterval(); setSelectedIdx(index); setRS(makeState(hand));
  }, [hands, stopInterval]);

  const loadDemo = useCallback(async () => {
    const allowed = await consumeFreeUse();
    if (!allowed) return;
    stopInterval();
    const demo = createDemoHand();
    setHands([demo]); setSelectedIdx(0); setRS(makeState(demo)); setDetectedRoom("Demo");
  }, [stopInterval, consumeFreeUse]);

  const handleStepForward = useCallback(() => {
    stopInterval();
    setRS((p) => p && !p.isFinished ? { ...stepForward(p), isPlaying: false } : p);
  }, [stopInterval]);

  const handleStepBackward = useCallback(() => {
    stopInterval();
    setRS((p) => p ? { ...stepBackward(p), isPlaying: false } : null);
  }, [stopInterval]);

  const handleGoToStep = useCallback((step: number) => {
    stopInterval();
    setRS((p) => p ? { ...goToStep(p.hand, step), isPlaying: false, playbackSpeed: p.playbackSpeed } : null);
  }, [stopInterval]);

  const handleReset = useCallback(() => {
    stopInterval();
    setRS((p) => p ? makeState(p.hand, p.playbackSpeed) : null);
  }, [stopInterval]);

  const handleSetSpeed = useCallback((speed: number) => {
    setRS((p) => {
      if (!p) return null;
      if (p.isPlaying && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          setRS((cur) => {
            if (!cur || cur.isFinished) {
              clearInterval(intervalRef.current!); intervalRef.current = null;
              return cur ? { ...cur, isPlaying: false } : null;
            }
            return stepForward(cur);
          });
        }, 1000 / speed);
      }
      return { ...p, playbackSpeed: speed };
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    const current = rsRef.current;
    if (!current) return;
    if (current.isPlaying) {
      stopInterval();
      setRS((p) => p ? { ...p, isPlaying: false } : null);
    } else {
      const start = current.isFinished ? makeState(current.hand, current.playbackSpeed) : current;
      setRS({ ...start, isPlaying: true });
      intervalRef.current = setInterval(() => {
        setRS((cur) => {
          if (!cur) { clearInterval(intervalRef.current!); intervalRef.current = null; return null; }
          if (cur.isFinished) { clearInterval(intervalRef.current!); intervalRef.current = null; return { ...cur, isPlaying: false }; }
          return stepForward(cur);
        });
      }, 1000 / start.playbackSpeed);
    }
  }, [stopInterval]);

  const handleShare = useCallback(async () => {
    if (!rs) return;
    setSharing(true);
    try {
      const id = await saveHandForShare(rs.hand);
      const url = id
        ? `${window.location.origin}/tools/replayer/h/${id}`
        : `${window.location.origin}/tools/replayer?hand=${encodeURIComponent(btoa(JSON.stringify(rs.hand)))}`;
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch { /* silencioso */ } finally { setSharing(false); }
  }, [rs]);

  const hasHand = hands.length > 0 && rs !== null;

  return (
    <>
      <SEOHead title="Hand Replayer — Sharkania" description="Revive cada acción de tus manos de póker paso a paso." />

      {!isFS && (
        <Navbar />
      )}

      {!hasHand ? (
        /* 👇 Cambio de paddingTop de 88px a 56px ya que quitamos el banner Beta */
        <div style={{ paddingTop: "56px", minHeight: "100dvh", background: "#0c0d10" }}>
          <div className="max-w-2xl mx-auto w-full px-4 py-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-sk-purple/10 border border-sk-purple/20 flex items-center justify-center">
                <Play size={18} className="text-sk-purple" />
              </div>
              <div>
                <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">Hand Replayer</h1>
                <p className="text-sk-xs text-sk-text-3">Sube un archivo .txt o pega el historial de una mano</p>
              </div>
            </div>
            
            {loadingShared ? (
              <div className="flex items-center justify-center py-20 gap-3">
                <div className="w-5 h-5 border-2 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin" />
                <span className="text-sk-sm text-sk-text-3">Cargando mano...</span>
              </div>
            ) : !isAuthenticated ? (
              <div className="border border-sk-border-2 rounded-xl p-10 text-center bg-sk-bg-2">
                <span className="text-4xl block mb-4">🎯</span>
                <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">¿Quieres analizar tus propias manos?</h3>
                <p className="text-sk-sm text-sk-text-2 mb-6">Crea una cuenta gratis para subir archivos de manos y usar el replayer completo.</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button variant="accent" size="md" onClick={() => window.location.href = `/register?redirect=${encodeURIComponent(currentPath)}`}>Crear cuenta gratis</Button>
                  <Button variant="secondary" size="md" onClick={() => window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`}>Iniciar sesión</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 🔐 LOGICA DE BLOQUEO: 
                  Si ya usó el gratis y no tiene acceso full, mostramos SOLO el paywall.
                  Si tiene acceso (o le queda el gratis), mostramos las herramientas.
                */}
                {needsPaywall ? (
                  <FeaturePaywall
                    featureKey="tool_replayer"
                    title="Replayer Pro Ilimitado"
                    description="Ya usaste tu replay gratis de hoy. Desbloquea acceso completo con SharkCoins."
                  />
                ) : (
                  <>
                    <div className="flex gap-1 bg-sk-bg-3 rounded-lg p-0.5 border border-sk-border-1 w-fit">
                      {(["upload", "paste"] as const).map((mode) => (
                        <button key={mode} onClick={() => setInputMode(mode)}
                          className={`text-sk-xs font-medium px-4 py-1.5 rounded transition-all flex items-center gap-1.5 ${inputMode === mode ? "bg-sk-bg-1 text-sk-text-1 shadow-sk-xs" : "text-sk-text-3"}`}>
                          {mode === "upload" ? <Upload size={12} /> : <FileText size={12} />}
                          {mode === "upload" ? "Subir archivo" : "Pegar texto"}
                        </button>
                      ))}
                    </div>

                    {inputMode === "upload" && (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${dragOver ? "border-sk-accent bg-sk-accent/5" : "border-sk-border-2 hover:border-sk-border-3"}`}>
                        <Upload size={32} className="mx-auto mb-3 text-sk-text-3" />
                        <p className="text-sk-sm text-sk-text-2 mb-1">Arrastra un archivo .txt aquí</p>
                        <p className="text-sk-xs text-sk-text-4 mb-5">o haz click para seleccionar</p>
                        <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sk-accent text-sk-bg-0 text-sk-sm font-bold cursor-pointer hover:bg-sk-accent-hover transition-colors">
                          <Upload size={14} /> Seleccionar archivo
                          <input type="file" accept=".txt,.log" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
                        </label>
                        <p className="text-[10px] text-sk-text-4 mt-4">Soporta: GGPoker · PokerStars · HomeGames</p>
                      </div>
                    )}

                    {inputMode === "paste" && (
                      <div>
                        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                          placeholder="Pega aquí el historial de una mano..."
                          className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-lg py-3 px-4 text-sk-sm text-sk-text-1 font-mono placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent min-h-[200px] resize-y" />
                        <div className="flex gap-2 mt-2">
                          <Button variant="accent" size="sm" onClick={() => processText(pasteText)} disabled={!pasteText.trim()}><Play size={14} /> Analizar</Button>
                          <Button variant="ghost" size="sm" onClick={() => setPasteText("")}>Limpiar</Button>
                        </div>
                      </div>
                    )}

                    <div className="text-center pt-1">
                      <button onClick={loadDemo} className="text-sk-xs text-sk-text-3 hover:text-sk-accent transition-colors underline underline-offset-2">
                        o prueba con una mano de demostración →
                      </button>
                    </div>
                  </>
                )}

                {parseErrors.length > 0 && (
                  <div className="bg-sk-red/8 border border-sk-red/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={14} className="text-sk-red" />
                      <p className="text-sk-xs font-semibold text-sk-red">Error al procesar el archivo</p>
                    </div>
                    {parseErrors.map((err, i) => <p key={i} className="text-[11px] text-sk-text-3 font-mono">{err}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <AdminAccessBanner />
        </div>

      ) : (
        <div
          ref={fsRef}
          style={{
            position: isFS ? "fixed" : "relative",
            top: isFS ? 0 : undefined,
            left: isFS ? 0 : undefined,
            right: isFS ? 0 : undefined,
            bottom: isFS ? 0 : undefined,
            /* 👇 Ajustado de 88px a 56px */
            marginTop: isFS ? 0 : "56px",
            height: isFS ? "100dvh" : "calc(100dvh - 56px)",
            zIndex: isFS ? 9999 : undefined,
            background: "#09090b",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Metabar */}
          <div style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "10px", flexWrap: "wrap",
            padding: "6px 16px",
            background: "rgba(255,255,255,0.02)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {hands.length > 1 && (
                <div style={{ position: "relative" }}>
                  <select value={selectedIdx} onChange={(e) => selectHand(Number(e.target.value))}
                    className="appearance-none bg-sk-bg-3 border border-sk-border-2 rounded-lg px-3 py-1.5 pr-8 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent">
                    {hands.map((h, i) => (
                      <option key={i} value={i}>Mano {i + 1} {h.handNumber ? `#${h.handNumber.slice(0, 12)}` : ""}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-sk-text-3 pointer-events-none" />
                </div>
              )}
              {detectedRoom && (
                <span className="font-mono text-[10px] text-sk-text-3 bg-sk-bg-3 px-2.5 py-1 rounded border border-sk-border-1">
                  {detectedRoom}
                </span>
              )}
              <span className="font-mono text-[10px] text-sk-text-4">
                {rs.hand.config.gameType} · {rs.hand.config.smallBlind}/{rs.hand.config.bigBlind} · {rs.hand.players.length} jugadores
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Button variant="secondary" size="xs" onClick={handleShare} isLoading={sharing}>
                {copied ? <Check size={12} /> : <Share2 size={12} />}
                {copied ? "¡Copiado!" : "Compartir"}
              </Button>
              <Button variant="ghost" size="xs" onClick={() => {
                stopInterval(); setHands([]); setRS(null); setDetectedRoom(null); setPasteText("");
              }}>
                Nueva mano
              </Button>
              <button onClick={toggleFS}
                title={isFS ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "30px", height: "30px", borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: isFS ? "rgba(34,211,238,0.10)" : "rgba(255,255,255,0.04)",
                  color: isFS ? "#22d3ee" : "#71717a",
                  cursor: "pointer",
                }}>
                {isFS ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Área central */}
          <div style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "8px 16px 10px",
            overflow: "hidden",
          }}>

            <div style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                maxHeight: "100%",
                aspectRatio: "16 / 10",
                maxWidth: "100%",
                width: "auto",
              }}>
                <PokerTable state={rs} />
              </div>
            </div>

            <div style={{
              flexShrink: 0,
              width: "100%",
              maxWidth: "860px",
            }}>
              <ReplayControls
                state={rs}
                onStepForward={handleStepForward}
                onStepBackward={handleStepBackward}
                onGoToStep={handleGoToStep}
                onTogglePlay={handleTogglePlay}
                onSetSpeed={handleSetSpeed}
                onReset={handleReset}
              />
            </div>
          </div>

          <AdminAccessBanner />
        </div>
      )}
    </>
  );
}