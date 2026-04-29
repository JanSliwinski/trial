"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { TIME_LABELS } from "@/lib/utils";

interface Props {
  revenue: number[];
  forecastPrices: number[];
}

export default function RevenueChart({ revenue, forecastPrices }: Props) {
  const xTicks = TIME_LABELS.filter((_, i) => i % 4 === 0);

  let cumulative = 0;
  const data = TIME_LABELS.map((label, i) => {
    cumulative += revenue[i] ?? 0;
    return {
      time:       label,
      interval:   +(revenue[i] ?? 0).toFixed(4),
      cumulative: +cumulative.toFixed(4),
      price:      +(forecastPrices[i] ?? 0).toFixed(2),
    };
  });

  const totalRevenue  = cumulative;
  const peakInterval  = data.reduce((best, d) => d.interval > best.interval ? d : best, data[0]);
  const positiveCount = data.filter((d) => d.interval > 0.0001).length;

  return (
    <div>
      {/* Summary row */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <Chip
          label="Net Revenue"
          value={`€${totalRevenue.toFixed(0)}`}
          color={totalRevenue >= 0 ? "#34d399" : "#f87171"}
        />
        <Chip
          label="Peak Interval"
          value={`${peakInterval.time} · €${peakInterval.interval.toFixed(2)}`}
          color="#38bdf8"
        />
        <Chip
          label="Active Intervals"
          value={`${positiveCount} / ${data.length}`}
          color="#fbbf24"
        />
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="cumRevGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#38bdf8" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0.9} />
            </linearGradient>
          </defs>
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
          {/* Left axis: per-interval revenue */}
          <YAxis
            yAxisId="interval"
            orientation="left"
            tick={{ fill: "#3d5a78", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${v.toFixed(1)}`}
            width={52}
          />
          {/* Right axis: cumulative revenue */}
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            tick={{ fill: "#38bdf8", fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.7 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${v.toFixed(0)}`}
            width={58}
          />
          <Tooltip content={<RevenueTooltip />} />
          <ReferenceLine yAxisId="interval" y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

          {/* Per-interval bars */}
          <Bar yAxisId="interval" dataKey="interval" name="Interval P&L" maxBarSize={7} radius={2}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.interval >= 0 ? "rgba(52,211,153,0.75)" : "rgba(248,113,113,0.75)"}
              />
            ))}
          </Bar>

          {/* Cumulative line */}
          <Line
            yAxisId="cumulative"
            dataKey="cumulative"
            stroke="url(#cumRevGrad)"
            strokeWidth={2}
            dot={false}
            name="Cumulative"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Axis legend */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald/75" />
            <span className="text-[10px] text-text-3">Profit interval</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red/75" />
            <span className="text-[10px] text-text-3">Loss interval</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 rounded" style={{ background: "linear-gradient(90deg,#38bdf8,#818cf8)" }} />
          <span className="text-[10px] text-text-3">Cumulative revenue →</span>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-2">
      <span className="text-[10px] text-text-3">{label}</span>
      <span className="text-[12px] font-mono font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: { time: string; interval: number; cumulative: number; price: number };
  }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isProfit = d.interval >= 0;
  return (
    <div className="card-sm shadow-2xl shadow-black/60 min-w-[160px]">
      <div className="text-[10px] text-text-3 font-mono mb-2">{d.time}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-6 text-[11px]">
          <span style={{ color: isProfit ? "#34d399" : "#f87171" }}>
            {isProfit ? "Revenue" : "Cost"}
          </span>
          <span className="font-mono text-text font-medium">
            €{d.interval.toFixed(3)}
          </span>
        </div>
        <div className="flex justify-between gap-6 text-[11px]">
          <span className="text-primary/80">Cumulative</span>
          <span className="font-mono text-primary font-medium">
            €{d.cumulative.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between gap-6 text-[11px]">
          <span className="text-text-3">Price</span>
          <span className="font-mono text-text-2">€{d.price}/MWh</span>
        </div>
      </div>
    </div>
  );
}
