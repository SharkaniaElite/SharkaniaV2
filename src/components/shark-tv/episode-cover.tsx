import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { getEpisodeThumbnail, type SharkEpisode } from "../../lib/shark-tv";

export function EpisodeCover({ episode, priority = false }: { episode: SharkEpisode; priority?: boolean }) {
  const [failedThumbnail, setFailedThumbnail] = useState<string>();
  const thumbnail = getEpisodeThumbnail(episode.thumbnail_url);
  return (
    <div className="shark-tv-cover">
      {thumbnail && thumbnail !== failedThumbnail ? (
        <img src={thumbnail} alt="" width={640} height={360} loading={priority ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailedThumbnail(thumbnail)} />
      ) : (
        <div className="shark-tv-cover-art" aria-hidden="true">
          <Clapperboard size={30} strokeWidth={1.4} />
          <span>{episode.table_context?.series || "SharkTV"}</span>
        </div>
      )}
      {episode.duration && <span className="shark-tv-duration"><span className="sr-only">Duración: </span>{episode.duration}</span>}
    </div>
  );
}
