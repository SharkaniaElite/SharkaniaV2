// src/pages/replayer.tsx
// ══════════════════════════════════════════════════════════
// Sharkania Hand Replayer — Full Page
// Upload a hand history file or paste text → visual replay
// Only for authenticated users
// ══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { PokerTable } from "../components/replayer/poker-table";
import { ReplayControls } from "../components/replayer/replay-controls";
import { useAuthStore } from "../stores/auth-store";
import {
  Upload,
  FileText,
  Share2,
  Copy,
  Check,
  ChevronDown,
  Play,
  AlertCircle,
} from "lucide-react";
import type { HandHistory, ReplayState } from "../types/replayer";
import {
  initReplayState,
  stepForward,
  stepBackward,
  goToStep,
  encodeHandForURL,
  decodeHandFromURL,
  createDemoHand,
} from "../lib/replayer-engine";
import { parseHandHistory } from "../lib/hand-parsers";

export function ReplayerPage() {
  const { isAuthenticated } = useAuthStore();
  const [searchParams] = useSearchParams();

  // Hand state
  const [hands, setHands] = useState<HandHistory[]>([]);
  const [selectedHandIndex, setSelectedHandIndex] = useState(0);
  const [replayState, setReplayState] = useState<ReplayState | null>(null);
  const [detectedRoom, setDetectedRoom] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // UI state
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Playback
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check for shared hand in URL ──
  useEffect(() => {
    const encoded = searchParams.get("hand");
    if (encoded) {
      const hand = decodeHandFromURL(encoded);
      if (hand) {
        setHands([hand]);
        setSelectedHandIndex(0);
        setReplayState(initReplayState(hand));
        setDetectedRoom("Shared hand");
      }
    }
  }, [searchParams]);

  // ── File upload handler ──
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processText(text);
    };
    reader.readAsText(file);
  }, []);

  // ── Process text (from file or paste) ──
  const processText = useCallback((text: string) => {
    setParseErrors([]);
    const result = parseHandHistory(text);

    if (result.success && result.hands.length > 0) {
      setHands(result.hands);
      setSelectedHandIndex(0);
      setReplayState(initReplayState(result.hands[0]));
      setDetectedRoom(result.detectedRoom);
      setParseErrors([]);
    } else {
      setParseErrors(result.errors);
    }
  }, []);

  // ── Select a hand from multi-hand file ──
  const selectHand = useCallback((index: number) => {
    if (hands[index]) {
      setSelectedHandIndex(index);
      setReplayState(initReplayState(hands[index]));
      stopPlayback();
    }
  }, [hands]);

  // ── Load demo hand ──
  const loadDemo = useCallback(() => {
    const demo = createDemoHand();
    setHands([demo]);
    setSelectedHandIndex(0);
    setReplayState(initReplayState(demo));
    setDetectedRoom("Demo");
  }, []);

  // ── Playback controls ──
  const stopPlayback = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setReplayState((prev) => prev ? { ...prev, isPlaying: false } : null);
  }, []);

  const handleStepForward = useCallback(() => {
    setReplayState((prev) => {
      if (!prev || prev.isFinished) return prev;
      return stepForward(prev);
    });
  }, []);

  const handleStepBackward = useCallback(() => {
    setReplayState((prev) => {
      if (!prev) return null;
      return stepBackward(prev);
    });
  }, []);

  const handleGoToStep = useCallback((step: number) => {
    setReplayState((prev) => {
      if (!prev) return null;
      const newState = goToStep(prev.hand, step);
      return { ...newState, isPlaying: prev.isPlaying, playbackSpeed: prev.playbackSpeed };
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    setReplayState((prev) => {
      if (!prev) return null;

      if (prev.isPlaying) {
        stopPlayback();
        return { ...prev, isPlaying: false };
      }

      // If finished, reset first
      const startState = prev.isFinished ? initReplayState(prev.hand) : prev;

      // Start interval
      const intervalMs = 1000 / startState.playbackSpeed;
      playIntervalRef.current = setInterval(() => {
        setReplayState((current) => {
          if (!current || current.isFinished) {
            stopPlayback();
            return current ? { ...current, isPlaying: false } : null;
          }
          return stepForward(current);
        });
      }, intervalMs);

      return { ...startState, isPlaying: true };
    });
  }, [stopPlayback]);

  const handleSetSpeed = useCallback((speed: number) => {
    setReplayState((prev) => {
      if (!prev) return null;

      // If playing, restart interval with new speed
      if (prev.isPlaying && playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        const intervalMs = 1000 / speed;
        playIntervalRef.current = setInterval(() => {
          setReplayState((current) => {
            if (!current || current.isFinished) {
              stopPlayback();
              return current ? { ...current, isPlaying: false } : null;
            }
            return stepForward(current);
          });
        }, intervalMs);
      }

      return { ...prev, playbackSpeed: speed };
    });
  }, [stopPlayback]);

  const handleReset = useCallback(() => {
    stopPlayback();
    setReplayState((prev) => {
      if (!prev) return null;
      return initReplayState(prev.hand);
    });
  }, [stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

  // ── Share URL ──
  const handleShare = useCallback(() => {
    if (!replayState) return;
    const encoded = encodeHandForURL(replayState.hand);
    const url = `${window.location.origin}/tools/replayer?hand=${encoded}`;

    if (navigator.share) {
      navigator.share({ title: "Sharkania Hand Replay", url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [replayState]);

  // ── Drag & drop ──
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Auth gate ──
  if (!isAuthenticated) {
    return (
      <PageShell>
        <SEOHead
  title="Replayer de Manos — Sharkania"
  description="Revive cualquier mano de torneo paso a paso. Analiza decisiones, detecta errores y comparte la acción con tu coach."
  path="/tools/replayer"
  ogImage="/images/tools/og-tool-replayer.png"
/>
        <div className="pt-20 pb-16">
          <div className="max-w-xl mx-auto px-6 text-center py-20">
            <span className="text-4xl mb-4 block">🔒</span>
            <h1 className="text-sk-2xl font-extrabold text-sk-text-1 mb-3">Hand Replayer</h1>
            <p className="text-sk-sm text-sk-text-2 mb-6">
              El replayer está disponible solo para usuarios registrados.
              Crea tu cuenta gratis para acceder.
            </p>
            <Button variant="accent" size="lg" onClick={() => window.location.href = "/register"}>
              Crear cuenta gratis
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const hasHand = replayState !== null;

  return (
    <PageShell>
      <SEOHead
  title="Replayer de Manos — Sharkania"
  description="Revive cualquier mano de torneo paso a paso. Analiza decisiones, detecta errores y comparte la acción con tu coach."
  path="/tools/replayer"
  ogImage="/images/tools/og-tool-replayer.png"
/>

      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-sk-purple-dim flex items-center justify-center">
                <Play size={20} className="text-sk-purple" />
              </div>
              <div>
                <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">
                  Hand Replayer
                </h1>
                <p className="text-sk-xs text-sk-text-3">
                  Sube un archivo .txt o pega el historial de una mano
                </p>
              </div>
            </div>
          </div>

          {/* Input section — only show if no hand loaded */}
          {!hasHand && (
            <div className="space-y-4 mb-8">
              {/* Mode toggle */}
              <div className="flex gap-1 bg-sk-bg-3 rounded-lg p-0.5 border border-sk-border-1 w-fit">
                <button
                  onClick={() => setInputMode("upload")}
                  className={`text-sk-xs font-medium px-4 py-1.5 rounded transition-all ${
                    inputMode === "upload" ? "bg-sk-bg-1 text-sk-text-1 shadow-sk-xs" : "text-sk-text-3"
                  }`}
                >
                  <Upload size={12} className="inline mr-1.5" />
                  Subir archivo
                </button>
                <button
                  onClick={() => setInputMode("paste")}
                  className={`text-sk-xs font-medium px-4 py-1.5 rounded transition-all ${
                    inputMode === "paste" ? "bg-sk-bg-1 text-sk-text-1 shadow-sk-xs" : "text-sk-text-3"
                  }`}
                >
                  <FileText size={12} className="inline mr-1.5" />
                  Pegar texto
                </button>
              </div>

              {/* Upload mode */}
              {inputMode === "upload" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
                    dragOver
                      ? "border-sk-accent bg-sk-accent/5"
                      : "border-sk-border-2 hover:border-sk-border-3"
                  }`}
                >
                  <Upload size={32} className="mx-auto mb-3 text-sk-text-3" />
                  <p className="text-sk-sm text-sk-text-2 mb-1">
                    Arrastra un archivo .txt aquí
                  </p>
                  <p className="text-sk-xs text-sk-text-4 mb-4">
                    o haz click para seleccionar
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sk-accent text-sk-bg-0 text-sk-sm font-bold cursor-pointer hover:bg-sk-accent-hover transition-colors">
                    <Upload size={14} />
                    Seleccionar archivo
                    <input
                      type="file"
                      accept=".txt,.log"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-sk-text-4 mt-3">
                    Soporta: GGPoker, PokerStars, HomeGames PokerStars
                  </p>
                </div>
              )}

              {/* Paste mode */}
              {inputMode === "paste" && (
                <div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Pega aquí el historial de una mano...

Poker Hand #RC4259572857: Hold'em No Limit ($0.01/$0.02) - 2026/01/31
Table 'RushAndCash1118015' 6-max Seat #1 is the button
Seat 1: Player1 ($1.61 in chips)
..."
                    className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-lg py-3 px-4 text-sk-sm text-sk-text-1 font-mono placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent min-h-[200px] resize-y"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => processText(pasteText)}
                      disabled={!pasteText.trim()}
                    >
                      <Play size={14} /> Reproducir
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPasteText("")}>
                      Limpiar
                    </Button>
                  </div>
                </div>
              )}

              {/* Demo button */}
              <div className="text-center">
                <button
                  onClick={loadDemo}
                  className="text-sk-xs text-sk-text-3 hover:text-sk-accent transition-colors"
                >
                  o prueba con una mano de demostración →
                </button>
              </div>

              {/* Parse errors */}
              {parseErrors.length > 0 && (
                <div className="bg-sk-red-dim border border-sk-red/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} className="text-sk-red" />
                    <p className="text-sk-xs font-semibold text-sk-red">
                      Error al procesar el archivo
                    </p>
                  </div>
                  {parseErrors.map((err, i) => (
                    <p key={i} className="text-[11px] text-sk-text-3">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Replayer active */}
          {hasHand && replayState && (
            <div className="space-y-6">
              {/* Top bar: hand selector + actions */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {/* Hand selector (if multi-hand file) */}
                  {hands.length > 1 && (
                    <div className="relative">
                      <select
                        value={selectedHandIndex}
                        onChange={(e) => selectHand(Number(e.target.value))}
                        className="appearance-none bg-sk-bg-3 border border-sk-border-2 rounded-lg px-3 py-1.5 pr-8 text-sk-xs text-sk-text-1 font-mono focus:outline-none focus:border-sk-accent"
                      >
                        {hands.map((h, i) => (
                          <option key={i} value={i}>
                            Mano {i + 1} {h.handNumber ? `#${h.handNumber.slice(0, 12)}` : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-sk-text-3 pointer-events-none" />
                    </div>
                  )}

                  {/* Room badge */}
                  {detectedRoom && (
                    <span className="font-mono text-[10px] text-sk-text-3 bg-sk-bg-3 px-2 py-1 rounded border border-sk-border-1">
                      {detectedRoom}
                    </span>
                  )}

                  {/* Hand info */}
                  <span className="font-mono text-[10px] text-sk-text-4">
                    {replayState.hand.config.gameType} · {replayState.hand.config.smallBlind}/{replayState.hand.config.bigBlind} · {replayState.hand.players.length} jugadores
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Share */}
                  <Button variant="secondary" size="xs" onClick={handleShare}>
                    {copied ? <Check size={12} /> : <Share2 size={12} />}
                    {copied ? "Copiado" : "Compartir"}
                  </Button>

                  {/* New hand */}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      stopPlayback();
                      setHands([]);
                      setReplayState(null);
                      setDetectedRoom(null);
                      setPasteText("");
                    }}
                  >
                    Nueva mano
                  </Button>
                </div>
              </div>

              {/* Poker table */}
              <PokerTable state={replayState} />

              {/* Controls */}
              <ReplayControls
                state={replayState}
                onStepForward={handleStepForward}
                onStepBackward={handleStepBackward}
                onGoToStep={handleGoToStep}
                onTogglePlay={handleTogglePlay}
                onSetSpeed={handleSetSpeed}
                onReset={handleReset}
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
