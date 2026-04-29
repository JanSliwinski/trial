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
import type { ScenarioQuantiles } from "@/lib/types";
import { TIME_LABELS } from "@/lib/utils";

interface Props {
  forecast:  number[];
  quantiles: ScenarioQuantiles;
}

export default function PriceChart({ forecast, quantiles }: Props) {
  const data = TIME_LABELS.map((label, i) => ({
    time:   label,
    median: +forecast[i].toFixed(2),
    p10:    +quantiles.p10[i].toFixed(2),
    p25:    +quantiles.p25[i].toFixed(2),
    p75:    +quantiles.p75[i].toFixed(2),
    p90:    +quantiles.p90[i].toFixed(2),
  }));

  const xTicks = TIME_LABELS.filter((_, i) => i % 4 === 0);

  return (
    <div>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="priceFanOuter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#38bdf8" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="priceFanInner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#38bdf8" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.06} />
          </linearGradient>
          <linearGradient id="priceMedianFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#38bdf8" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0}  />
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
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

          {/* Outer P10–P90 band */}
          <Area dataKey="p90" stroke="none" fill="url(#priceFanOuter)" legendType="none" name="p90" />
          <Area dataKey="p10" stroke="none" fill="var(--bg-deep)"      fillOpacity={1}  legendType="none" name="p10" />

          {/* Inner P25–P75 band */}
          <Area dataKey="p75" stroke="none" fill="url(#priceFanInner)" legendType="none" name="p75" />
          <Area dataKey="p25" stroke="none" fill="var(--bg-deep)"      fillOpacity={1}  legendType="none" name="p25" />

          {/* Median */}
          <Area
            dataKey="median"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#priceMedianFill)"
            dot={false}
            name="Median forecast"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-5 mt-2 ml-[58px]">
        <LegendItem color="#38bdf8" opacity={1}    label="Median" line />
        <LegendItem color="#38bdf8" opacity={0.45} label="P25–P75" />
        <LegendItem color="#38bdf8" opacity={0.2}  label="P10–P90" />
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
      {line
        ? <div className="w-6 h-0.5 rounded-full" style={{ background: color }} />
        : <div className="w-6 h-3 rounded-sm" style={{ background: color, opacity }} />
      }
      <span className="text-[10px] text-text-3">{label}</span>
    </div>
  );
}

function PriceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: {
      time: string;
      median: number;
      p10: number; p25: number; p75: number; p90: number;
    };
  }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-sm shadow-2xl shadow-black/60 min-w-[148px]">
      <div className="text-[10px] text-text-3 font-mono mb-2">{d.time}</div>
      <div className="font-mono font-bold text-[15px] text-primary mb-2">
        €{d.median.toFixed(2)}
        <span className="text-[10px] text-text-3 font-normal">/MWh</span>
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
