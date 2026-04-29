"use client";

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TIME_LABELS } from "@/lib/utils";

interface Props {
  charge: number[];
  discharge: number[];
}

export default function ScheduleChart({ charge, discharge }: Props) {
  const xTicks = TIME_LABELS.filter((_, i) => i % 4 === 0);

  const data = TIME_LABELS.map((label, i) => ({
    time: label,
    charge: +(-charge[i]).toFixed(4),
    discharge: +discharge[i].toFixed(4),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
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
          tickFormatter={(v) => `${v}MW`}
          width={52}
        />
        <Tooltip content={<ScheduleTooltip />} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
        <Bar dataKey="charge" fill="#F59E0B" fillOpacity={0.85} name="Charge (−MW)" maxBarSize={8} />
        <Bar dataKey="discharge" fill="#22C55E" fillOpacity={0.85} name="Discharge (+MW)" maxBarSize={8} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ScheduleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { time: string; charge: number; discharge: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-muted mb-1 font-mono">{d.time}</div>
      {d.charge !== 0 && <div className="text-amber">Charge: {Math.abs(d.charge).toFixed(3)} MW</div>}
      {d.discharge !== 0 && <div className="text-green">Discharge: {d.discharge.toFixed(3)} MW</div>}
    </div>
  );
}
