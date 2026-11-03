import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { PlayerRow } from "./player-row";
import { PlayerAvatar } from "./player-avatar";
import { RankBadge } from "./rank-badge";
import { SkeletonTable } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import { calcItm, formatElo, formatNumber, formatPercent } from "../../lib/format";
import type { PlayerWithRoom } from "../../types";

interface RankingTableProps {
  players: PlayerWithRoom[];
  isLoading: boolean;
  startRank?: number;
}

const HEADERS = ["#", "Jugador", "ELO", "Torneos", "Cashes", "ITM%", "Wins"];

function RankingTableComponent({ players, isLoading, startRank = 1 }: RankingTableProps) {
  const rows = useMemo(() => players.map((player, i) => (
    <PlayerRow key={player.id} player={player} rank={startRank + i} />
  )), [players, startRank]);

  if (isLoading) return <SkeletonTable rows={10} />;
  if (players.length === 0) return (
    <EmptyState
      icon="🃏"
      title="No se encontraron jugadores"
      description="Intenta cambiar los filtros o buscar otro jugador."
    />
  );

  return (
    <div className="arena-ranking-results">
      <p className="arena-ranking-mobile-note md:hidden" aria-hidden="true">
        <span>CLASIFICACIÓN / JUGADORES</span>
        <span>{players.length} perfiles en esta página</span>
      </p>
      <div className="arena-ranking-cards md:hidden" aria-label="Clasificación de jugadores">
        {players.map((player, i) => {
          const rank = startRank + i;
          const itm = calcItm(player.total_cashes, player.total_tournaments);
          return (
            <article className="arena-ranking-mobile-card" key={player.id}>
              <div className="arena-ranking-card-top">
                <div className="arena-ranking-card-rank" aria-label={`Puesto ${rank}`}>
                  <RankBadge rank={rank} />
                </div>
                <Link to={`/ranking/${player.slug}`} className="arena-ranking-card-identity">
                  <PlayerAvatar
                    nickname={player.nickname}
                    avatarUrl={player.profiles?.avatar_url}
                    countryCode={player.profiles?.country_code ?? player.country_code}
                    size="large"
                  />
                  <span className="arena-ranking-card-person">
                    <strong>{player.nickname}</strong>
                    <small>{player.poker_rooms?.name || "Jugador registrado"}</small>
                  </span>
                </Link>
                <div className="arena-ranking-card-elo">
                  <span>ELO</span>
                  <strong>{formatElo(player.elo_rating)}</strong>
                </div>
              </div>
              <dl className="arena-ranking-card-metrics">
                <div><dt>Torneos</dt><dd>{formatNumber(player.total_tournaments)}</dd></div>
                <div><dt>Cashes</dt><dd>{formatNumber(player.total_cashes)}</dd></div>
                <div><dt>ITM</dt><dd>{formatPercent(itm)}</dd></div>
                <div><dt>Victorias</dt><dd>{formatNumber(player.total_wins)}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
      <div className="arena-ranking-desktop-table hidden md:block" role="region" aria-label="Ranking global ELO" tabIndex={0}>
        <table className="arena-ranking-table w-full border-collapse text-sk-sm">
          <thead>
            <tr>{HEADERS.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`font-mono text-[11px] font-semibold tracking-wide uppercase py-3 px-4 whitespace-nowrap ${i === 0 ? "w-[62px]" : ""} ${i >= 2 ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}</tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

export const RankingTable = memo(RankingTableComponent);
