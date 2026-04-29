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
  const maxSoc = Math.max(...soc);
  const xTicks = TIME_LABELS_97.filter((_, i) => i % 4 === 0);

  const data = TIME_LABELS_97.map((label, i) => ({
    time: label,
    soc: soc[i] !== undefined ? +soc[i].toFixed(4) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="socGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#FF6B35" stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
          tickFormatter={(v) => `${v.toFixed(1)}`}
          domain={[0, maxSoc * 1.1]}
          width={44}
        />
        <Tooltip content={<SoCTooltip />} />
        {/* Usable range shading — reference lines at min/max */}
        <ReferenceLine y={soc[0]} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        <Area
          dataKey="soc"
          stroke="#FF6B35"
          strokeWidth={2.5}
          fill="url(#socGradient)"
          dot={false}
          name="SoC"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
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
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-muted mb-1 font-mono">{d.time}</div>
      <div style={{ color: "#FF6B35" }} className="font-semibold">
        SoC: {d.soc?.toFixed(3)} MWh
      </div>
    </div>
  );
}
