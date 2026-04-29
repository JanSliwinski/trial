"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

  const buyPoints = buildStepCurve(buySteps, "buy");
  const sellPoints = buildStepCurve(sellSteps, "sell");

  // Merge buy/sell onto shared qty axis
  const allQtys = Array.from(
    new Set([...buyPoints.map((p) => p.qty), ...sellPoints.map((p) => p.qty)])
  ).sort((a, b) => a - b);

  const merged: StepPoint[] = allQtys.map((qty) => ({
    qty: +qty.toFixed(4),
    buy: interp(buyPoints, qty, "buy"),
    sell: interp(sellPoints, qty, "sell"),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={merged} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
        <XAxis
          dataKey="qty"
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={{ stroke: "#1E2D4A" }}
          tickLine={false}
          tickFormatter={(v) => `${v}MWh`}
        />
        <YAxis
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `€${v}`}
          width={52}
        />
        <Tooltip content={<BidTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#94A3B8" }}
          formatter={(value) => <span style={{ color: "#94A3B8" }}>{value}</span>}
        />
        <Line
          dataKey="buy"
          stroke="#F59E0B"
          strokeWidth={2}
          dot={{ r: 3, fill: "#F59E0B" }}
          name="Buy (charge)"
          connectNulls
        />
        <Line
          dataKey="sell"
          stroke="#22C55E"
          strokeWidth={2}
          dot={{ r: 3, fill: "#22C55E" }}
          name="Sell (discharge)"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function buildStepCurve(
  steps: BidStep[],
  type: "buy" | "sell"
): { qty: number; price: number }[] {
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
  targetQty: number,
  type: "buy" | "sell"
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
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-muted mb-1">Qty: {payload[0].payload.qty.toFixed(4)} MWh</div>
      {payload.map((p) =>
        p.value !== null ? (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: €{p.value.toFixed(2)}/MWh
          </div>
        ) : null
      )}
    </div>
  );
}
