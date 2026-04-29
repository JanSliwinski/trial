"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TIME_LABELS } from "@/lib/utils";

interface Props {
  forecast: number[];
  scenarios: number[][];
}

interface TooltipPayload {
  payload: {
    time: string;
    median: number;
    p10: number;
    p90: number;
  };
}

export default function PriceChart({ forecast, scenarios }: Props) {
  const p10 = forecast.map((_, i) =>
    quantile(scenarios.map((s) => s[i]), 0.1)
  );
  const p90 = forecast.map((_, i) =>
    quantile(scenarios.map((s) => s[i]), 0.9)
  );

  const data = TIME_LABELS.map((label, i) => ({
    time: label,
    median: +forecast[i].toFixed(2),
    p10: +p10[i].toFixed(2),
    p90: +p90[i].toFixed(2),
    band: [+p10[i].toFixed(2), +p90[i].toFixed(2)],
  }));

  // Downsample x-axis ticks to hourly
  const xTicks = TIME_LABELS.filter((_, i) => i % 4 === 0);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
        <XAxis
          dataKey="time"
          ticks={xTicks}
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={{ stroke: "#1E2D4A" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `€${v}`}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

        {/* P10-P90 band */}
        <Area
          dataKey="p90"
          stroke="transparent"
          fill="#3B82F6"
          fillOpacity={0.08}
          legendType="none"
          name="p90"
        />
        <Area
          dataKey="p10"
          stroke="transparent"
          fill="#070B14"
          fillOpacity={1}
          legendType="none"
          name="p10"
        />

        {/* Median forecast line */}
        <Line
          dataKey="median"
          stroke="#3B82F6"
          strokeWidth={2.5}
          dot={false}
          name="Median forecast"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-muted mb-1 font-mono">{d.time}</div>
      <div className="text-primary font-semibold">€{d.median}/MWh</div>
      <div className="text-muted">
        P10–P90: €{d.p10}–€{d.p90}
      </div>
    </div>
  );
}

function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
