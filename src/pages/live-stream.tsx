// Página de transmisión: únicamente el reproductor oficial de Twitch.
import { useEffect, useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { supabase } from "../lib/supabase";

// La URL se administra desde Super Admin (site_configs.live_stream_url).
// No aceptar orígenes distintos de Twitch ni valores arbitrarios dentro del iframe.
function getTwitchChannel(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;

    let channel: string | null = null;
    if (url.hostname === "player.twitch.tv") {
      channel = url.searchParams.get("channel");
    } else if (["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(url.hostname)) {
      channel = url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    return channel && /^[a-zA-Z0-9_]{1,25}$/.test(channel) ? channel : null;
  } catch {
    return null;
  }
}

export function LiveStreamPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchStream = async () => {
      const { data } = await supabase.from("site_configs")
        .select("value").eq("key", "live_stream_url").maybeSingle();
      if (mounted) {
        setVideoUrl(typeof data?.value === "string" ? data.value : "");
        setLoading(false);
      }
    };
    void fetchStream();

    const subscription = supabase.channel("stream_live_configs")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "site_configs",
        filter: "key=eq.live_stream_url",
      }, (payload) => {
        const changed = payload.new as { key?: string; value?: string } | null;
        if (mounted && changed?.key === "live_stream_url") {
          setVideoUrl(typeof changed.value === "string" ? changed.value : "");
        }
      }).subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(subscription);
    };
  }, []);

  const channel = getTwitchChannel(videoUrl);
  // Twitch exige que parent coincida con el dominio que muestra el iframe,
  // incluyendo las previews de Cloudflare Pages.
  const playerUrl = channel
    ? "https://player.twitch.tv/?" + new URLSearchParams({
        channel,
        parent: window.location.hostname,
        autoplay: "true",
      }).toString()
    : null;

  return (
    <PageShell showMarketing={false}>
      <SEOHead
        title="Sharkania en vivo — Twitch"
        description="Sigue la transmisión en directo de Sharkania a través del reproductor oficial de Twitch."
        path="/live"
      />
      <section className="min-h-[calc(100vh-96px)] bg-sk-bg-1 px-3 py-5 sm:px-6 sm:py-8" aria-label="Transmisión de Twitch">
        <h1 className="sr-only">Sharkania en vivo en Twitch</h1>
        <div className="mx-auto w-full max-w-[1500px]">
          {playerUrl ? (
            <div className="relative w-full aspect-video min-h-[300px] overflow-hidden rounded-xl border border-sk-border-2 bg-black shadow-2xl">
              <iframe
                src={playerUrl}
                title={"Transmisión de Twitch: " + channel}
                className="absolute inset-0 h-full w-full border-0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div role="status" className="flex min-h-[300px] items-center justify-center rounded-xl border border-sk-border-2 bg-black px-6 text-center text-sk-text-3">
              {loading ? "Cargando transmisión…" : "La transmisión de Twitch no está configurada en este momento."}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
