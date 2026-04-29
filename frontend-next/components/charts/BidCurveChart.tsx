"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { BidStep } from "@/lib/types";

interface Props {
  steps: BidStep[];
}

interface StepPoint {
  qty: number;
  buy: number | null;
  sell: number | null;
}

export default function BidCurveChart({ steps }: Props) {
  const buySteps = steps
    .filter((s) => s.action === "buy")
    .sort((a, b) => b.price - a.price);
  const sellSteps = steps
    .filter((s) => s.action === "sell")
    .sort((a, b) => a.price - b.price);

  const buyPoints = buildStepCurve(buySteps);
  const sellPoints = buildStepCurve(sellSteps);

  const allQtys = Array.from(
    new Set([...buyPoints.map((p) => p.qty), ...sellPoints.map((p) => p.qty)])
  ).sort((a, b) => a - b);

  const merged: StepPoint[] = allQtys.map((qty) => ({
    qty: +qty.toFixed(4),
    buy: interp(buyPoints, qty),
    sell: interp(sellPoints, qty),
  }));

  const hasBuy = buyPoints.length > 0;
  const hasSell = sellPoints.length > 0;
  const allPrices = [...buyPoints, ...sellPoints].map((p) => p.price);
  const priceMin = allPrices.length ? Math.min(...allPrices) : 0;
  const priceMax = allPrices.length ? Math.max(...allPrices) : 100;

  if (!hasBuy && !hasSell) {
    return (
      <div className="flex items-center justify-center h-40 text-[12px] text-text-3">
        No bid steps for this interval — battery idle
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-3">
        {hasBuy && (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-amber rounded" />
            <span className="text-[10px] text-text-3">Buy (charge)</span>
          </div>
        )}
        {hasSell && (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-emerald rounded" />
            <span className="text-[10px] text-text-3">Sell (discharge)</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={merged} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(24,47,74,0.5)"
            vertical={false}
          />
          <XAxis
            dataKey="qty"
            tick={{ fill: "#3d5a78", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "rgba(24,47,74,0.6)" }}
            tickLine={false}
            tickFormatter={(v) => `${v}MWh`}
          />
          <YAxis
            tick={{ fill: "#3d5a78", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${v}`}
            width={54}
            domain={[
              Math.floor(priceMin * 0.92),
              Math.ceil(priceMax * 1.08),
            ]}
          />
          <Tooltip content={<BidTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          {hasBuy && (
            <Line
              dataKey="buy"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#fbbf24", strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "#fbbf24" }}
              name="Buy (charge)"
              connectNulls
              type="stepAfter"
            />
          )}
          {hasSell && (
            <Line
              dataKey="sell"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#34d399", strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "#34d399" }}
              name="Sell (discharge)"
              connectNulls
              type="stepAfter"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildStepCurve(steps: BidStep[]): { qty: number; price: number }[] {
  if (!steps.length) return [];
  const points: { qty: number; price: number }[] = [{ qty: 0, price: steps[0].price }];
  let cum = 0;
  for (const s of steps) {
    points.push({ qty: cum, price: s.price });
    cum += s.quantity;
    points.push({ qty: cum, price: s.price });
  }
  return points;
}

function interp(
  curve: { qty: number; price: number }[],
  targetQty: number
): number | null {
  if (!curve.length) return null;
  const exact = curve.find((p) => Math.abs(p.qty - targetQty) < 1e-6);
  if (exact) return exact.price;
  const before = curve.filter((p) => p.qty <= targetQty);
  if (!before.length) return null;
  return before[before.length - 1].price;
}

function BidTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: StepPoint; value: number; name: string; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  const qty = payload[0].payload.qty;
  const entries = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!entries.length) return null;
  return (
    <div className="card-sm shadow-2xl shadow-black/60 min-w-[140px]">
      <div className="text-[10px] text-text-3 font-mono mb-2">
        Qty: {qty.toFixed(4)} MWh
      </div>
      {entries.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 text-[11px]">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-text">€{p.value.toFixed(2)}/MWh</span>
        </div>
      ))}
    </div>
  );
}
