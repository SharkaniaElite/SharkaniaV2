// src/components/players/elo-chart.tsx
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
    return (
      <div className="h-[300px] bg-sk-bg-2 border border-sk-border-2 rounded-lg animate-pulse" />
    );
  }

  if (history.length === 0) {
    return (
      <div className="h-[300px] bg-sk-bg-2 border border-sk-border-2 rounded-lg flex items-center justify-center">
        <p className="text-sk-text-3 text-sk-sm">
          Sin historial de ELO disponible aún
        </p>
      </div>
    );
  }

  const chartData = history.map((h) => ({
    date: format(new Date(h.recorded_at), "dd/MM"),
    elo: Math.round(h.elo_after),
    change: Math.round(h.elo_change),
  }));

  return (
    <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4">
      <h3 className="text-sk-sm font-bold text-sk-text-1 mb-4">
        📈 Evolución de ELO
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin - 20", "dataMax + 20"]}
            tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "#18191c",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "JetBrains Mono",
              color: "#fafafa",
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value: number) => [`${value}`, "ELO"]}
          />
          <Line
            type="monotone"
            dataKey="elo"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: "#22d3ee",
              stroke: "#0c0d10",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
