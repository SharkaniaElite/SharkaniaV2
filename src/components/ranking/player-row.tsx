// src/components/ranking/player-row.tsx
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { getFlag } from "../../lib/countries";
import { formatElo, formatNumber, formatPercent, calcItm } from "../../lib/format";
import { RankBadge } from "./rank-badge";
import type { PlayerWithRoom } from "../../types";

interface PlayerRowProps {
  player: PlayerWithRoom;
  rank: number;
}

export function PlayerRow({ player, rank }: PlayerRowProps) {
  const itm = calcItm(player.total_cashes, player.total_tournaments);

  return (
    <tr
      className={cn(
        "transition-colors duration-100 hover:bg-white/[0.03]",
        rank === 1 && "bg-[rgba(251,191,36,0.08)] border-l-2 border-l-sk-gold",
        rank === 2 && "bg-[rgba(203,213,225,0.05)] border-l-2 border-l-sk-silver",
        rank === 3 && "bg-[rgba(217,119,6,0.06)] border-l-2 border-l-sk-bronze"
      )}
    >
      <td className="py-3 px-4 border-b border-sk-border-2">
        <RankBadge rank={rank} />
      </td>
      <td className="py-3 px-4 border-b border-sk-border-2">
        <Link
          to={`/ranking/${player.id}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-text-2 shrink-0">
            {player.nickname.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm leading-none">{getFlag(player.country_code)}</span>
          <span className="font-semibold text-sk-text-1">{player.nickname}</span>
          <span className="text-[10px] text-sk-text-3 hidden lg:inline">
            {player.poker_rooms?.name}
          </span>
        </Link>
      </td>
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono font-bold text-sk-accent tracking-tight">
          {formatElo(player.elo_rating)}
        </span>
      </td>
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono text-sk-sm font-semibold text-sk-text-1">
          {formatNumber(player.total_tournaments)}
        </span>
      </td>
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono text-sk-sm font-semibold text-sk-text-1">
          {formatNumber(player.total_cashes)}
        </span>
      </td>
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
      <td className="py-3 px-4 border-b border-sk-border-2 text-right">
        <span className="font-mono text-sk-sm font-semibold text-sk-text-1">
          {player.total_wins}
        </span>
      </td>
    </tr>
  );
}
