import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { EloHistory } from "../../types";
import { format } from "date-fns";

interface EloChartProps {
  history: EloHistory[];
  isLoading: boolean;
}

export function EloChart({ history, isLoading }: EloChartProps) {
  if (isLoading) {
    return <div className="h-[300px] bg-sk-bg-2 border border-sk-border-2 rounded-lg animate-pulse" aria-label="Cargando historial ELO" />;
  }

  if (history.length === 0) {
    return (
      <div className="h-[230px] bg-sk-bg-2 border border-sk-border-2 rounded-lg flex items-center justify-center" role="status">
        <p className="text-sk-text-3 text-sk-sm">Sin historial de ELO disponible aún</p>
      </div>
    );
  }

  const orderedHistory = [...history].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const chartData = orderedHistory.map((h) => ({
    date: format(new Date(h.recorded_at), "dd/MM"),
    elo: Math.round(h.elo_after),
    change: Math.round(h.elo_change),
  }));
  const firstElo = chartData[0]?.elo ?? 0;
  const latestElo = chartData[chartData.length - 1]?.elo ?? 0;
  const delta = latestElo - firstElo;

  return (
    <section className="arena-elo-chart bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4" aria-label="Evolución histórica del ELO">
      <div className="arena-elo-chart-top">
        <div>
          <p className="arena-elo-chart-kicker">RENDIMIENTO / HISTORIAL</p>
          <h3>Evolución de ELO</h3>
        </div>
        <div className="arena-elo-chart-summary">
          <span>{chartData.length} registros</span>
          <strong className={delta >= 0 ? "arena-elo-positive" : "arena-elo-negative"} title="Cambio desde el primer registro del gráfico">
            {delta > 0 ? "+" : ""}{delta.toLocaleString("es-CL")} ELO
          </strong>
        </div>
      </div>
      <div className="arena-elo-chart-canvas" role="img" aria-label={`Gráfico ELO: comienza en ${firstElo} y termina en ${latestElo}, cambio de ${delta} puntos entre ${chartData.length} registros`}>
        <ResponsiveContainer width="100%" height={266}>
          <LineChart data={chartData} margin={{ left: -15, right: 12, top: 10, bottom: 2 }}>
            <CartesianGrid strokeDasharray="4 6" stroke="rgba(103,178,196,0.13)" vertical={false} />
            <XAxis
              dataKey="date"
              minTickGap={24}
              tick={{ fill: "#8eabbb", fontSize: 11, fontFamily: "monospace" }}
              axisLine={{ stroke: "rgba(128,183,202,.2)" }}
              tickLine={false}
            />
            <YAxis
              domain={["dataMin - 20", "dataMax + 20"]}
              tick={{ fill: "#8eabbb", fontSize: 11, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ stroke: "rgba(55,214,236,.3)", strokeDasharray: "4 4" }}
              contentStyle={{ background: "#0b1925", border: "1px solid rgba(80,193,213,.35)", borderRadius: "10px", fontSize: "12px", color: "#f6fcff" }}
              labelStyle={{ color: "#b3d2df" }}
              formatter={(value) => [String(value ?? ""), "Puntos ELO"]}
            />
            <Line
              type="monotone"
              dataKey="elo"
              stroke="#39d9ed"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 5, fill: "#39d9ed", stroke: "#0a1721", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-sk-text-3 mt-2 px-2">
        Evolución según los registros disponibles en Sharkania; no representa una predicción de resultados.
      </p>
    </section>
  );
}
