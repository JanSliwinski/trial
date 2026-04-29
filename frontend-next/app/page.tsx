"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, SlidersHorizontal } from "lucide-react";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import BatteryForm, { type BatteryFormValues } from "@/components/BatteryForm";
import KPICards from "@/components/KPICards";
import PriceChart from "@/components/charts/PriceChart";
import ScheduleChart from "@/components/charts/ScheduleChart";
import SoCChart from "@/components/charts/SoCChart";
import BidCurveChart from "@/components/charts/BidCurveChart";
import WaterValueHeatmap from "@/components/charts/WaterValueHeatmap";
import { runOptimize } from "@/lib/api";
import type { OptimizeResult } from "@/lib/types";

const sectionVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

function SectionCard({
  title, sub, children, className = "",
}: {
  title: string; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <motion.div variants={cardVariants}
      className={`card hover:border-border-2 transition-colors duration-300 ${className}`}>
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-2">
            {title}
          </h3>
          {sub && <p className="text-[11px] text-text-3 mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export default function Home() {
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState("");
  const [bidInterval, setBidInterval] = useState(48);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const status = loading ? "running" : error ? "error" : result ? "done" : "idle";

  async function handleRun(values: BatteryFormValues) {
    setLoading(true);
    setError(null);
    try {
      const data = await runOptimize(values.date, values.batterySpecs);
      setResult(data);
      setActiveDate(values.date);
      setBidInterval(48);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const timeLabel = (i: number) =>
    `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-screen bg-bg-deep overflow-hidden">
      <Navbar status={status} date={activeDate || undefined} />

      <div className="flex flex-1 overflow-hidden pt-[52px]">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 292, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex-shrink-0 overflow-hidden border-r border-border"
              style={{ background: "var(--surface)" }}
            >
              <div className="w-[292px] h-full overflow-y-auto px-5 py-5">
                {/* Sidebar header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-text-3" strokeWidth={2} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">
                      Configuration
                    </span>
                  </div>
                </div>

                <BatteryForm onSubmit={handleRun} loading={loading} />

                {/* Footer note */}
                <div className="mt-5 p-3 rounded-xl border border-border bg-surface-2">
                  <p className="text-[10px] text-text-3 leading-relaxed">
                    Optimisation uses synthetic Greek DAM prices (2024–2025) calibrated to
                    observed HEnEx market patterns.
                  </p>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {/* Toggle sidebar button */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="fixed bottom-6 left-5 z-40 w-8 h-8 rounded-full
                       border border-border bg-surface flex items-center justify-center
                       text-text-3 hover:text-text hover:border-border-2 transition-all
                       shadow-lg shadow-black/30"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div key="hero"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <Hero />
              </motion.div>
            )}

            {loading && (
              <motion.div key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full gap-5"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-border" />
                  <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-t-primary
                                  animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-medium text-text">Running optimisation pipeline</p>
                  <p className="text-[12px] text-text-3 mt-1">
                    Solving 100 Monte Carlo scenarios…
                  </p>
                </div>
                {/* Skeleton shimmer placeholders */}
                <div className="w-full max-w-3xl px-8 mt-4 space-y-3">
                  {[80, 100, 60].map((w) => (
                    <div key={w}
                      className={`shimmer h-10 rounded-xl`}
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center h-full"
              >
                <div className="card border-red/30 bg-red/5 max-w-md text-center p-8">
                  <div className="text-3xl mb-3">⚠</div>
                  <p className="text-[14px] font-medium text-red mb-1">Pipeline Error</p>
                  <p className="text-[12px] text-text-3">{error}</p>
                </div>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div key="dashboard"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="px-7 py-6"
              >
                <motion.div variants={sectionVariants} initial="hidden" animate="show"
                  className="space-y-5">

                  {/* KPIs */}
                  <KPICards result={result} />

                  {/* Price forecast — full width */}
                  <SectionCard
                    title="Price Forecast"
                    sub={`${activeDate} · 100-scenario Monte Carlo fan`}
                  >
                    <PriceChart
                      forecast={result.forecast_prices}
                      scenarios={result.scenario_prices}
                    />
                  </SectionCard>

                  {/* Schedule + SoC */}
                  <div className="grid grid-cols-2 gap-5">
                    <SectionCard title="Optimal Dispatch Schedule"
                      sub="Charge (amber) / Discharge (green)">
                      <ScheduleChart
                        charge={result.schedule.charge_mw}
                        discharge={result.schedule.discharge_mw}
                      />
                    </SectionCard>
                    <SectionCard title="State of Charge Trajectory"
                      sub="SoC evolution over 96 intervals">
                      <SoCChart soc={result.soc_trajectory} />
                    </SectionCard>
                  </div>

                  {/* Bid curves */}
                  <SectionCard
                    title="HEnEx Bid Curves"
                    sub={`Interval ${timeLabel(bidInterval)} · Stepwise price–quantity bids`}
                  >
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-text-3">Select interval</span>
                        <span className="font-mono text-[13px] text-primary font-medium">
                          {timeLabel(bidInterval)}
                        </span>
                      </div>
                      <input type="range" min={0} max={95} value={bidInterval}
                        onChange={(e) => setBidInterval(Number(e.target.value))} />
                      <div className="flex justify-between text-[10px] text-text-3 mt-1 font-mono">
                        <span>00:00</span><span>06:00</span>
                        <span>12:00</span><span>18:00</span><span>23:45</span>
                      </div>
                    </div>
                    <BidCurveChart steps={result.bid_curves[bidInterval] ?? []} />
                  </SectionCard>

                  {/* Water value heatmap */}
                  <SectionCard
                    title="Water Value Surface w(t, SoC)"
                    sub="Marginal economic value (€/MWh) of 1 MWh stored at each time and SoC level"
                  >
                    <WaterValueHeatmap
                      surface={result.water_value_surface}
                      socLevels={result.soc_levels_pct}
                    />
                  </SectionCard>

                  {/* Actions row */}
                  <motion.div variants={cardVariants}
                    className="flex items-center justify-between py-2">
                    <p className="text-[12px] text-text-3">
                      Optimisation complete · {activeDate} · 100 scenarios
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => downloadCSV(result, activeDate)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg
                                   border border-border bg-surface-2 text-[12px] font-medium
                                   text-text-2 hover:text-text hover:border-border-2
                                   transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Schedule CSV
                      </button>
                      <button
                        onClick={() => setResult(null)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg
                                   border border-primary/25 bg-primary/8 text-[12px] font-medium
                                   text-primary hover:bg-primary/15 transition-colors"
                      >
                        New Run
                      </button>
                    </div>
                  </motion.div>

                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function downloadCSV(result: OptimizeResult, date: string) {
  const labels = Array.from({ length: 96 }, (_, i) => {
    const h = String(Math.floor(i / 4)).padStart(2, "0");
    const m = String((i % 4) * 15).padStart(2, "0");
    return `${h}:${m}`;
  });
  const rows = labels.map((t, i) => [
    t,
    result.forecast_prices[i]?.toFixed(2) ?? "",
    result.schedule.charge_mw[i]?.toFixed(4) ?? "",
    result.schedule.discharge_mw[i]?.toFixed(4) ?? "",
    result.schedule.net_mw[i]?.toFixed(4) ?? "",
    result.soc_trajectory[i]?.toFixed(4) ?? "",
  ]);
  const csv = [
    "interval,price_forecast_eur_mwh,charge_mw,discharge_mw,net_mw,soc_mwh",
    ...rows.map((r) => r.join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `helleniflex_${date}.csv`; a.click();
  URL.revokeObjectURL(url);
}
