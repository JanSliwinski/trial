"use client";

import { TrendingUp, Repeat2, Target } from "lucide-react";
import type { OptimizeResult } from "@/lib/types";

interface Props {
  result: OptimizeResult;
}

export default function KPICards({ result }: Props) {
  const { expected_revenue, cycles, capture_rate } = result;

  return (
    <div className="grid grid-cols-3 gap-4 animate-fade-in">
      <KPICard
        icon={<TrendingUp className="w-4 h-4 text-green" />}
        label="Expected Revenue"
        value={`€${expected_revenue.toLocaleString("en", { maximumFractionDigits: 0 })}`}
        sub="Net revenue on median forecast"
        color="text-green"
        glow="shadow-green-500/10"
      />
      <KPICard
        icon={<Repeat2 className="w-4 h-4 text-primary" />}
        label="Cycles Today"
        value={cycles.toFixed(2)}
        sub="Equivalent full charge cycles"
        color="text-primary"
        glow="shadow-blue-500/10"
      />
      <KPICard
        icon={<Target className="w-4 h-4 text-amber" />}
        label="Capture Rate"
        value={capture_rate !== null ? `${capture_rate.toFixed(1)}%` : "N/A"}
        sub="vs. perfect foresight"
        color="text-amber"
        glow="shadow-amber-500/10"
      />
    </div>
  );
}

function KPICard({
  icon, label, value, sub, color, glow,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  glow: string;
}) {
  return (
    <div className={`card shadow-lg ${glow}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-md bg-surface2 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs text-muted font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-semibold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  );
}
