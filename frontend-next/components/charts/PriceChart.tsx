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

function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export default function PriceChart({ forecast, scenarios }: Props) {
  const p10 = forecast.map((_, i) => quantile(scenarios.map((s) => s[i]), 0.1));
  const p25 = forecast.map((_, i) => quantile(scenarios.map((s) => s[i]), 0.25));
  const p75 = forecast.map((_, i) => quantile(scenarios.map((s) => s[i]), 0.75));
  const p90 = forecast.map((_, i) => quantile(scenarios.map((s) => s[i]), 0.9));

  const data = TIME_LABELS.map((label, i) => ({
    time: label,
    median: +forecast[i].toFixed(2),
    p10: +p10[i].toFixed(2),
    p25: +p25[i].toFixed(2),
    p75: +p75[i].toFixed(2),
    p90: +p90[i].toFixed(2),
  }));

  const xTicks = TIME_LABELS.filter((_, i) => i % 4 === 0);

  return (
    <div style={{ position: "relative" }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="priceFanOuter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="priceFanInner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.06} />
          </linearGradient>
          <linearGradient id="priceMedian" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0} />
          </linearGradient>
        </defs>
      </svg>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(24,47,74,0.5)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            ticks={xTicks}
            tick={{ fill: "#3d5a78", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "rgba(24,47,74,0.6)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#3d5a78", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${v}`}
            width={54}
          />
          <Tooltip content={<PriceTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

          {/* Outer P10–P90 band */}
          <Area dataKey="p90" stroke="none" fill="url(#priceFanOuter)" legendType="none" name="p90" />
          <Area dataKey="p10" stroke="none" fill="var(--bg-deep)" fillOpacity={1} legendType="none" name="p10" />

          {/* Inner P25–P75 band */}
          <Area dataKey="p75" stroke="none" fill="url(#priceFanInner)" legendType="none" name="p75" />
          <Area dataKey="p25" stroke="none" fill="var(--bg-deep)" fillOpacity={1} legendType="none" name="p25" />

          {/* Median line with area fill */}
          <Area
            dataKey="median"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#priceMedian)"
            dot={false}
            name="Median forecast"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 ml-[58px]">
        <LegendItem color="#38bdf8" opacity={1} label="Median" line />
        <LegendItem color="#38bdf8" opacity={0.45} label="P25–P75" />
        <LegendItem color="#38bdf8" opacity={0.2} label="P10–P90" />
      </div>
    </div>
  );
}

function LegendItem({
  color, opacity, label, line,
}: {
  color: string; opacity: number; label: string; line?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {line ? (
        <div className="w-6 h-0.5 rounded-full" style={{ background: color }} />
      ) : (
        <div
          className="w-6 h-3 rounded-sm"
          style={{ background: color, opacity }}
        />
      )}
      <span className="text-[10px] text-text-3">{label}</span>
    </div>
  );
}

function PriceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { time: string; median: number; p10: number; p25: number; p75: number; p90: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-sm shadow-2xl shadow-black/60 min-w-[140px]">
      <div className="text-[10px] text-text-3 font-mono mb-2">{d.time}</div>
      <div className="font-mono font-bold text-[15px] text-primary mb-2">
        €{d.median.toFixed(2)}<span className="text-[10px] text-text-3 font-normal">/MWh</span>
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4 text-[10px]">
          <span className="text-text-3">P25–P75</span>
          <span className="font-mono text-text-2">€{d.p25}–€{d.p75}</span>
        </div>
        <div className="flex justify-between gap-4 text-[10px]">
          <span className="text-text-3">P10–P90</span>
          <span className="font-mono text-text-2">€{d.p10}–€{d.p90}</span>
        </div>
      </div>
    </div>
  );
}
