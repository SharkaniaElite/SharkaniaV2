import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { FlagIcon } from "../ui/flag-icon";
import {
  formatElo,
  formatNumber,
  formatPercent,
  calcItm,
} from "../../lib/format";
import { RankBadge } from "./rank-badge";
import type { PlayerWithRoom } from "../../types";

interface PlayerRowProps {
  player: PlayerWithRoom;
  rank: number;
}

function PlayerRowComponent({ player, rank }: PlayerRowProps) {
  // 🔥 Memoizar cálculo (evita recomputo innecesario)
  const itm = useMemo(() => {
    return calcItm(player.total_cashes, player.total_tournaments);
  }, [player.total_cashes, player.total_tournaments]);

  // 🔥 Avatar estable (evita recalcular string en cada render)
  const avatar = useMemo(() => {
    return (
      player.profiles?.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        player.nickname
      )}&background=111827&color=fff`
    );
  }, [player.profiles?.avatar_url, player.nickname]);

  return (
    <tr
      className={cn(
        "group transition-colors duration-150 hover:bg-white/[0.03]",
        rank === 1 && "bg-[rgba(251,191,36,0.08)] border-l-2 border-l-sk-gold",
        rank === 2 && "bg-[rgba(203,213,225,0.05)] border-l-2 border-l-sk-silver",
        rank === 3 && "bg-[rgba(217,119,6,0.06)] border-l-2 border-l-sk-bronze"
      )}
    >
      {/* Rank */}
      <td className="py-3 px-4 border-b border-sk-border-2">
        <RankBadge rank={rank} />
      </td>

      {/* Player */}
      <td className="py-3 px-4 border-b border-sk-border-2">
        <Link
          to={`/ranking/${player.id}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          {/* Avatar */}
          <div className="relative w-7 h-7 shrink-0">
            <div className="w-7 h-7 rounded-full bg-sk-bg-4 border border-sk-border-2 overflow-hidden">
              <img
                src={avatar}
                alt={player.nickname}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Flag */}
            <div className="absolute -bottom-1 -right-1 shadow-sm">
              <FlagIcon countryCode={player.country_code} size={11} />
            </div>
          </div>

          {/* Nombre */}
          <span className="font-semibold text-sk-text-1 transition-colors group-hover:text-white">
            {player.nickname}
          </span>

          {/* Sala */}
          {player.poker_rooms?.name && (
            <span className="text-[10px] text-sk-text-3 hidden lg:inline">
              {player.poker_rooms.name}
            </span>
          )}
        </Link>
      </td>

      {/* ELO */}
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono font-bold text-sk-accent tracking-tight">
          {formatElo(player.elo_rating)}
        </span>
      </td>

      {/* Torneos */}
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono text-sk-sm font-semibold text-sk-text-1">
          {formatNumber(player.total_tournaments)}
        </span>
      </td>

      {/* Cobros */}
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono text-sk-sm font-semibold text-sk-text-1">
          {formatNumber(player.total_cashes)}
        </span>
      </td>

      {/* ITM */}
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span
          className={cn(
            "font-mono text-sk-sm font-semibold",
            itm >= 20 ? "text-sk-green" : "text-sk-text-2"
          )}
        >
          {formatPercent(itm)}
        </span>
      </td>

      {/* Wins */}
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono text-sk-sm font-semibold text-sk-text-1">
          {player.total_wins}
        </span>
      </td>
    </tr>
  );
}

// 🔥 Comparador custom (nivel PRO)
export const PlayerRow = memo(
  PlayerRowComponent,
  (prev, next) => {
    return (
      prev.rank === next.rank &&
      prev.player.id === next.player.id &&
      prev.player.elo_rating === next.player.elo_rating &&
      prev.player.total_tournaments === next.player.total_tournaments &&
      prev.player.total_cashes === next.player.total_cashes &&
      prev.player.total_wins === next.player.total_wins
    );
  }
);