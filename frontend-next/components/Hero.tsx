"use client";

import { motion } from "framer-motion";
import {
  Database, TrendingUp, GitBranch, Cpu, Layers, Zap,
  ArrowRight, CheckCircle2,
} from "lucide-react";

const PIPELINE = [
  { n: 1, name: "Market Data",     desc: "15-min Greek DAM price history",      color: "#38bdf8", Icon: Database   },
  { n: 2, name: "Price Forecast",  desc: "Ridge regression + calendar features", color: "#818cf8", Icon: TrendingUp },
  { n: 3, name: "Monte Carlo",     desc: "100 correlated price scenarios",       color: "#a78bfa", Icon: GitBranch  },
  { n: 4, name: "LP Optimise",     desc: "scipy HiGHS solver × 100 scenarios",  color: "#f472b6", Icon: Cpu        },
  { n: 5, name: "Water Values",    desc: "Dual-variable w(t, SoC) surface",     color: "#34d399", Icon: Layers     },
  { n: 6, name: "HEnEx Bids",      desc: "Stepwise price–quantity bid curves",   color: "#fbbf24", Icon: Zap        },
];

const STATS = [
  { value: "87%",   label: "Capture Rate",    sub: "vs. perfect foresight"   },
  { value: "100",   label: "MC Scenarios",    sub: "per optimisation run"    },
  { value: "<5 s",  label: "Solution Time",   sub: "full 6-layer pipeline"   },
  { value: "96",    label: "Intervals/Day",   sub: "15-min HEnEx resolution" },
];

const FEATURES = [
  "HEnEx-formatted bid curves, ready to submit",
  "Works Day 1 — no historical battery data needed",
  "Transparent physics-based LP, not a black-box ML model",
  "Forecast-tolerant: 87% revenue vs. perfect foresight",
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
};

export default function Hero() {
  return (
    <div className="relative w-full min-h-full overflow-y-auto">
      {/* Background */}
      <div className="absolute inset-0 bg-dots opacity-[0.35] pointer-events-none" />
      <div className="absolute inset-0 hero-glow pointer-events-none" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-5xl mx-auto px-8 pt-14 pb-20"
      >
        {/* Badge */}
        <motion.div variants={fadeUp} className="flex items-center gap-2 mb-8">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full
                           border border-primary/25 bg-primary/8 text-primary text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Greek Electricity Market · HEnEx Day-Ahead · 2026
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 variants={fadeUp}
          className="text-[46px] md:text-[58px] font-bold leading-[1.05] tracking-tight text-text mb-5">
          AI-Powered Battery<br />
          <span className="gradient-text">Storage Optimisation</span>
        </motion.h1>

        <motion.p variants={fadeUp}
          className="text-[17px] text-text-2 leading-relaxed mb-10 max-w-2xl">
          HelleniFlex gives battery operators a decisive competitive edge in the Greek Day-Ahead
          Market — generating optimal HEnEx bid strategies through stochastic water-value
          optimisation in under five seconds.
        </motion.p>

        {/* Stats row */}
        <motion.div variants={fadeUp}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
          {STATS.map((s) => (
            <div key={s.label}
              className="card-sm text-center hover:border-border-2 transition-colors">
              <div className="text-[28px] font-mono font-bold text-primary tabular-nums leading-none mb-2">
                {s.value}
              </div>
              <div className="text-[12px] font-semibold text-text mb-0.5">{s.label}</div>
              <div className="text-[11px] text-text-3">{s.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Pipeline */}
        <motion.div variants={fadeUp} className="mb-14">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-3 mb-5">
            Optimisation Pipeline
          </div>
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-5 right-5 h-px"
              style={{ background: "linear-gradient(90deg, #38bdf8, #818cf8, #a78bfa, #f472b6, #34d399, #fbbf24)" }}
            />
            <div className="relative grid grid-cols-6 gap-2">
              {PIPELINE.map(({ n, name, desc, color, Icon }) => (
                <div key={n} className="flex flex-col items-center gap-3 pt-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center
                                border-2 relative z-10 transition-transform hover:scale-110"
                    style={{ borderColor: color, background: `${color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-semibold text-text mb-0.5">{name}</div>
                    <div className="text-[10px] text-text-3 leading-snug">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Two columns: features + value prop */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="card">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-3 mb-4">
              Why HelleniFlex
            </div>
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald flex-shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="text-[13px] text-text-2 leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card border-primary/20"
            style={{ background: "rgba(56,189,248,0.04)" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary/70 mb-4">
              Market Context
            </div>
            <div className="space-y-4">
              {[
                ["Greece 2030 target",  "80% renewable energy"],
                ["Grid challenge",      "Solar intermittency peaks 10 GW+"],
                ["BESS opportunity",    "€150–400/MWh daily spreads"],
                ["Our edge",            "Policy-based bidding beats fixed schedules"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-start gap-4">
                  <span className="text-[12px] text-text-3">{k}</span>
                  <span className="text-[12px] font-medium text-text text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTA prompt */}
        <motion.div variants={fadeUp}
          className="flex items-center gap-4 p-4 rounded-2xl
                     border border-primary/20 bg-primary/5">
          <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25
                          flex items-center justify-center flex-shrink-0">
            <ArrowRight className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-text">
              Configure your battery in the sidebar, select a delivery date, and click{" "}
              <span className="text-primary">Run Optimisation</span>.
            </p>
            <p className="text-[11px] text-text-3 mt-0.5">
              Date range: 2024-01-15 → 2025-12-30 · Synthetic Greek DAM prices · 100 scenarios
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
