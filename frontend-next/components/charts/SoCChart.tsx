"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TIME_LABELS_97 } from "@/lib/utils";

interface Props {
  soc: number[];
}

export default function SoCChart({ soc }: Props) {
  const validSoc = soc.filter((v) => v !== undefined && isFinite(v));
  const maxSoc = Math.max(...validSoc);
  const minSoc = Math.min(...validSoc);
  const xTicks = TIME_LABELS_97.filter((_, i) => i % 4 === 0);

  const data = TIME_LABELS_97.map((label, i) => ({
    time: label,
    soc: soc[i] !== undefined ? +soc[i].toFixed(4) : null,
  }));

  const domainMax = maxSoc * 1.12;
  const domainMin = Math.max(0, minSoc * 0.88);

  return (
    <div>
      {/* Min/max chips */}
      <div className="flex gap-3 mb-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange/10 border border-orange/20">
          <span className="text-[10px] font-mono text-orange">
            Peak {maxSoc.toFixed(2)} MWh
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border">
          <span className="text-[10px] font-mono text-text-2">
            Min {minSoc.toFixed(2)} MWh
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="socGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" stopOpacity={0.35} />
              <stop offset="60%" stopColor="#fb923c" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#fb923c" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="socStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#fbbf24" />
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
          <YAxis
            tick={{ fill: "#3d5a78", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v.toFixed(1)}`}
            domain={[domainMin, domainMax]}
            width={48}
          />
          <Tooltip content={<SoCTooltip />} />
          <ReferenceLine
            y={maxSoc}
            stroke="rgba(251,146,60,0.25)"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <Area
            dataKey="soc"
            stroke="url(#socStroke)"
            strokeWidth={2.5}
            fill="url(#socGrad)"
            dot={false}
            name="SoC"
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SoCTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { time: string; soc: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-sm shadow-2xl shadow-black/60">
      <div className="text-[10px] text-text-3 font-mono mb-2">{d.time}</div>
      <div className="font-mono font-bold text-[15px] mb-0.5" style={{ color: "#fb923c" }}>
        {d.soc?.toFixed(3)}
        <span className="text-[10px] font-normal text-text-3 ml-1">MWh</span>
      </div>
    </div>
  );
}
