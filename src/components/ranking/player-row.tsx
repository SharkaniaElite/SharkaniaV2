import { memo } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { PlayerAvatar } from "./player-avatar";
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
  const itm = calcItm(player.total_cashes, player.total_tournaments);

  return (
    <tr
      className={cn(
        "arena-ranking-row group transition-colors duration-150 hover:bg-white/[0.03]",
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
          to={`/ranking/${player.slug}`}
          className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
        >
          <PlayerAvatar nickname={player.nickname} avatarUrl={player.profiles?.avatar_url} countryCode={player.profiles?.country_code ?? player.country_code} />

          {/* Nombre */}
          <span className="arena-ranking-nickname font-semibold text-sk-text-1 transition-colors group-hover:text-white">
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

// Shallow props comparison avoids stale rows when a name, avatar or room changes.
export const PlayerRow = memo(PlayerRowComponent);
