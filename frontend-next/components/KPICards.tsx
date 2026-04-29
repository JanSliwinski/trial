"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Repeat2, Target, ArrowUpRight } from "lucide-react";
import type { OptimizeResult } from "@/lib/types";

function useCounter(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    if (!isFinite(target)) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setVal(target);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return val;
}

const item = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

interface KPICardProps {
  label: string;
  rawValue: number;
  format: (v: number) => string;
  sub: string;
  Icon: React.ElementType;
  color: string;
  dimColor: string;
  glowClass: string;
  trend?: string;
}

function KPICard({ label, rawValue, format, sub, Icon, color, dimColor, glowClass, trend }: KPICardProps) {
  const animated = useCounter(rawValue);
  return (
    <motion.div variants={item}
      className={`card ${glowClass} relative overflow-hidden group
                  hover:border-opacity-70 transition-all duration-300`}>
      {/* Background glow blob */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-30"
        style={{ background: color }} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: dimColor }}>
            <Icon className="w-4 h-4" style={{ color }} strokeWidth={2} />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-[11px] font-medium"
              style={{ color }}>
              <ArrowUpRight className="w-3 h-3" />
              {trend}
            </div>
          )}
        </div>

        <div className="text-[28px] font-mono font-bold tabular-nums leading-none mb-1.5"
          style={{ color }}>
          {format(animated)}
        </div>

        <div className="text-[12px] font-semibold text-text mb-0.5">{label}</div>
        <div className="text-[11px] text-text-3">{sub}</div>
      </div>
    </motion.div>
  );
}

export default function KPICards({ result }: { result: OptimizeResult }) {
  const { expected_revenue, cycles, capture_rate } = result;

  return (
    <motion.div
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      initial="hidden"
      animate="show"
      className="grid grid-cols-3 gap-4"
    >
      <KPICard
        label="Expected Revenue"
        rawValue={expected_revenue}
        format={(v) => `€${Math.round(v).toLocaleString("en")}`}
        sub="Net revenue on median forecast"
        Icon={TrendingUp}
        color="#34d399"
        dimColor="rgba(52,211,153,0.12)"
        glowClass="glow-green"
        trend="Day-ahead"
      />
      <KPICard
        label="Cycles Today"
        rawValue={cycles}
        format={(v) => v.toFixed(2)}
        sub="Equivalent full charge cycles"
        Icon={Repeat2}
        color="#38bdf8"
        dimColor="rgba(56,189,248,0.12)"
        glowClass="glow-blue"
      />
      <KPICard
        label="Capture Rate"
        rawValue={capture_rate ?? 0}
        format={(v) => capture_rate !== null ? `${v.toFixed(1)}%` : "N/A"}
        sub="vs. perfect foresight oracle"
        Icon={Target}
        color="#fbbf24"
        dimColor="rgba(251,191,36,0.12)"
        glowClass="glow-amber"
        trend={capture_rate ? "vs oracle" : undefined}
      />
    </motion.div>
  );
}
