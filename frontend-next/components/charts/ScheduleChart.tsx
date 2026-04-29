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

  const totalCharge = charge.reduce((s, v) => s + v, 0);
  const totalDischarge = discharge.reduce((s, v) => s + v, 0);

  return (
    <div>
      {/* Summary chips */}
      <div className="flex gap-3 mb-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber/10 border border-amber/20">
          <div className="w-1.5 h-1.5 rounded-full bg-amber" />
          <span className="text-[10px] font-mono text-amber">
            Charge {totalCharge.toFixed(2)} MWh
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald/10 border border-emerald/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald" />
          <span className="text-[10px] font-mono text-emerald">
            Discharge {totalDischarge.toFixed(2)} MWh
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="chargeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="dischargeGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
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
            tickFormatter={(v) => `${v}MW`}
            width={50}
          />
          <Tooltip content={<ScheduleTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          <Bar dataKey="charge" fill="url(#chargeGrad)" name="Charge" maxBarSize={6} radius={[2, 2, 0, 0]} />
          <Bar dataKey="discharge" fill="url(#dischargeGrad)" name="Discharge" maxBarSize={6} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
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
  const hasCharge = Math.abs(d.charge) > 0.0001;
  const hasDisch = Math.abs(d.discharge) > 0.0001;
  if (!hasCharge && !hasDisch) return null;
  return (
    <div className="card-sm shadow-2xl shadow-black/60 min-w-[130px]">
      <div className="text-[10px] text-text-3 font-mono mb-2">{d.time}</div>
      {hasCharge && (
        <div className="flex justify-between gap-4 text-[11px]">
          <span className="text-amber">Charging</span>
          <span className="font-mono font-medium text-text">{Math.abs(d.charge).toFixed(3)} MW</span>
        </div>
      )}
      {hasDisch && (
        <div className="flex justify-between gap-4 text-[11px]">
          <span className="text-emerald">Discharging</span>
          <span className="font-mono font-medium text-text">{d.discharge.toFixed(3)} MW</span>
        </div>
      )}
    </div>
  );
}
