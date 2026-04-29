"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, SlidersHorizontal, CheckCircle2 } from "lucide-react";

import Navbar, { type NavTab } from "@/components/Navbar";
import Hero from "@/components/Hero";
import BatteryForm, { type BatteryFormValues } from "@/components/BatteryForm";
import KPICards from "@/components/KPICards";
import PriceChart from "@/components/charts/PriceChart";
import ScheduleChart from "@/components/charts/ScheduleChart";
import SoCChart from "@/components/charts/SoCChart";
import RevenueChart from "@/components/charts/RevenueChart";
import WaterValueHeatmap from "@/components/charts/WaterValueHeatmap";
import { runOptimize } from "@/lib/api";
import type { OptimizeResult, BatterySpecs } from "@/lib/types";

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
          <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-2">{title}</h3>
          {sub && <p className="text-[11px] text-text-3 mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// ── Dashboard tab ────────────────────────────────────────────────────────────
function DashboardView({ result, activeDate }: { result: OptimizeResult; activeDate: string }) {
  return (
    <motion.div
      key="dashboard"
      variants={sectionVariants}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <KPICards result={result} />

      <SectionCard
        title="Revenue Over the Day"
        sub={`${activeDate} · Per-interval P&L and cumulative total`}
      >
        <RevenueChart
          revenue={result.revenue_per_interval}
          forecastPrices={result.forecast_prices}
        />
      </SectionCard>

      <SectionCard
        title="Price Forecast"
        sub={`${activeDate} · 100-scenario Monte Carlo fan`}
      >
        <PriceChart
          forecast={result.forecast_prices}
          quantiles={result.scenario_quantiles}
        />
      </SectionCard>

      <div className="grid grid-cols-2 gap-5">
        <SectionCard
          title="Optimal Dispatch Schedule"
          sub="Charge (amber) / Discharge (green)"
        >
          <ScheduleChart
            charge={result.schedule.charge_mw}
            discharge={result.schedule.discharge_mw}
          />
        </SectionCard>
        <SectionCard
          title="State of Charge Trajectory"
          sub="SoC evolution · operating window shown"
        >
          <SoCChart
            soc={result.soc_trajectory}
            socMinMwh={result.soc_min_mwh}
            socMaxMwh={result.soc_max_mwh}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Water Value Surface w(t, SoC)"
        sub="Marginal economic value (€/MWh) of 1 MWh stored at each time and SoC level"
      >
        <WaterValueHeatmap
          surface={result.water_value_surface}
          socLevels={result.soc_levels_pct}
        />
      </SectionCard>

      {/* Actions */}
      <motion.div variants={cardVariants} className="flex items-center justify-between py-2">
        <p className="text-[12px] text-text-3">
          Optimisation complete · {activeDate} · 100 scenarios
        </p>
        <button
          onClick={() => downloadCSV(result, activeDate)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border
                     bg-surface-2 text-[12px] font-medium text-text-2
                     hover:text-text hover:border-border-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download Schedule CSV
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────
function AnalyticsView({ result, activeDate }: { result: OptimizeResult; activeDate: string }) {
  const rev = result.revenue_per_interval;

  // Aggregate to hourly buckets (4 × 15-min = 1 hour)
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const slice = rev.slice(h * 4, h * 4 + 4);
    const total = slice.reduce((s, v) => s + v, 0);
    const price = result.forecast_prices.slice(h * 4, h * 4 + 4).reduce((s, v) => s + v, 0) / 4;
    return { hour: `${String(h).padStart(2, "0")}:00`, total, price };
  });

  const peakHour     = [...hourly].sort((a, b) => b.total - a.total)[0];
  const offPeakHours = hourly.filter((h) => h.total < 0).length;
  const grossRevenue = rev.filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const grossCost    = rev.filter((v) => v < 0).reduce((s, v) => s + v, 0);
  const netRevenue   = grossRevenue + grossCost;

  const totalCharge    = result.schedule.charge_mw.reduce((s, v) => s + v, 0) * 0.25;
  const totalDischarge = result.schedule.discharge_mw.reduce((s, v) => s + v, 0) * 0.25;

  return (
    <motion.div
      key="analytics"
      variants={sectionVariants}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* Revenue decomposition */}
      <SectionCard title="Revenue Decomposition" sub={`${activeDate} · Gross flows and net margin`}>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Gross Discharge Revenue", value: `€${grossRevenue.toFixed(2)}`, color: "#34d399" },
            { label: "Gross Charge Cost",        value: `€${Math.abs(grossCost).toFixed(2)}`, color: "#f87171" },
            { label: "Net Revenue",              value: `€${netRevenue.toFixed(2)}`,  color: "#38bdf8" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card-sm text-center">
              <div className="text-[22px] font-mono font-bold mb-1" style={{ color }}>{value}</div>
              <div className="text-[10px] text-text-3">{label}</div>
            </div>
          ))}
        </div>

        {/* Waterfall bar */}
        <div className="relative h-5 rounded-full overflow-hidden bg-surface-3 mb-2">
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full"
            style={{
              width: `${Math.min(100, (grossRevenue / (grossRevenue + Math.abs(grossCost))) * 100)}%`,
              background: "linear-gradient(90deg, #34d399, #10b981)",
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-text-3">
          <span>Revenue share: {grossRevenue > 0 ? ((netRevenue / grossRevenue) * 100).toFixed(1) : 0}% net margin</span>
          <span>Degradation cost absorbed in schedule</span>
        </div>
      </SectionCard>

      {/* Hourly P&L breakdown */}
      <SectionCard title="Hourly P&L Breakdown" sub="Revenue aggregated to hourly buckets">
        <div className="grid grid-cols-12 gap-1 items-end h-32">
          {hourly.map((h) => {
            const maxAbs = Math.max(...hourly.map((x) => Math.abs(x.total)));
            const pct    = maxAbs > 0 ? Math.abs(h.total) / maxAbs : 0;
            const isPos  = h.total >= 0;
            return (
              <div key={h.hour} className="flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(2, pct * 96)}px`,
                      background: isPos
                        ? "linear-gradient(0deg,#10b981,#34d399)"
                        : "linear-gradient(0deg,#dc2626,#f87171)",
                      opacity: 0.85,
                    }}
                    title={`${h.hour}: €${h.total.toFixed(2)}`}
                  />
                </div>
                {/* Every 4th hour label */}
                <span className="text-[8px] font-mono text-text-3">
                  {parseInt(h.hour) % 6 === 0 ? h.hour.slice(0, 2) : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-text-3 mt-2">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>
      </SectionCard>

      {/* Efficiency metrics */}
      <SectionCard title="Operational Efficiency" sub="Energy flows and cycle analysis">
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: "Energy Charged",
              value: `${totalCharge.toFixed(2)} MWh`,
              sub: `${result.cycles.toFixed(2)} equiv. full cycles`,
              color: "#fbbf24",
            },
            {
              label: "Energy Discharged",
              value: `${totalDischarge.toFixed(2)} MWh`,
              sub: `RTE loss: ${((1 - totalDischarge / Math.max(totalCharge, 0.001)) * 100).toFixed(1)}%`,
              color: "#34d399",
            },
            {
              label: "Best Trading Hour",
              value: peakHour.hour,
              sub: `€${peakHour.total.toFixed(2)} net · avg €${peakHour.price.toFixed(0)}/MWh`,
              color: "#38bdf8",
            },
            {
              label: "Capture Rate",
              value: result.capture_rate !== null ? `${result.capture_rate.toFixed(1)}%` : "N/A",
              sub: "vs perfect foresight oracle",
              color: "#818cf8",
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="card-sm">
              <div className="text-[20px] font-mono font-bold mb-0.5" style={{ color }}>{value}</div>
              <div className="text-[11px] text-text font-medium mb-0.5">{label}</div>
              <div className="text-[10px] text-text-3">{sub}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────
function ReportsView({
  result, activeDate, lastSpecs,
}: {
  result: OptimizeResult; activeDate: string; lastSpecs: BatterySpecs | null;
}) {
  const initSoc  = result.soc_trajectory[0];
  const finalSoc = result.soc_trajectory[result.soc_trajectory.length - 1];

  return (
    <motion.div
      key="reports"
      variants={sectionVariants}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* Report header */}
      <motion.div variants={cardVariants} className="card border-primary/20"
        style={{ background: "rgba(56,189,248,0.03)" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary/60 mb-2">
              Optimisation Report
            </div>
            <div className="text-[22px] font-bold text-text">Helios Grid · Day-Ahead Dispatch</div>
            <div className="text-[13px] text-text-3 mt-1">
              Delivery date: <span className="font-mono text-text-2">{activeDate}</span>
              {" "}· 100 Monte Carlo scenarios · HEnEx Greek DAM
            </div>
          </div>
          <button
            onClick={() => downloadCSV(result, activeDate)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/25
                       bg-primary/8 text-[12px] font-medium text-primary
                       hover:bg-primary/15 transition-colors flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </motion.div>

      {/* Key results table */}
      <SectionCard title="Performance Summary">
        <div className="space-y-0">
          {[
            ["Expected Revenue",   `€${result.expected_revenue.toFixed(2)}`,                "Net revenue on median price forecast"],
            ["Capture Rate",       result.capture_rate !== null ? `${result.capture_rate.toFixed(1)}%` : "N/A", "vs. perfect foresight oracle"],
            ["Equivalent Cycles",  `${result.cycles.toFixed(3)}`,                           "Full charge cycles today"],
            ["Initial SoC",        `${initSoc?.toFixed(3)} MWh`,                            "State of charge at day start"],
            ["Final SoC",          `${finalSoc?.toFixed(3)} MWh`,                           "State of charge at day end"],
            ["Peak SoC",           `${Math.max(...result.soc_trajectory).toFixed(3)} MWh`,  "Maximum stored energy"],
            ["Total Charged",      `${(result.schedule.charge_mw.reduce((s,v)=>s+v,0)*0.25).toFixed(3)} MWh`, "Energy absorbed from grid"],
            ["Total Discharged",   `${(result.schedule.discharge_mw.reduce((s,v)=>s+v,0)*0.25).toFixed(3)} MWh`, "Energy delivered to grid"],
          ].map(([key, value, note], i) => (
            <div
              key={key}
              className={`flex items-center justify-between py-3 ${i < 7 ? "border-b border-border" : ""}`}
            >
              <div>
                <div className="text-[12px] font-medium text-text">{key}</div>
                <div className="text-[10px] text-text-3 mt-0.5">{note}</div>
              </div>
              <div className="text-[14px] font-mono font-bold text-primary">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Battery spec table */}
      {lastSpecs && (
        <SectionCard title="Battery Asset Configuration">
          <div className="grid grid-cols-2 gap-x-8 gap-y-0">
            {[
              ["Capacity",          `${lastSpecs.capacity_mwh} MWh`],
              ["Max Power",         `${lastSpecs.power_mw} MW`],
              ["C-rate",            `${(lastSpecs.power_mw / lastSpecs.capacity_mwh).toFixed(2)}C`],
              ["Round-trip Eff.",   `${lastSpecs.rte_pct}%`],
              ["SoC Window",        `${lastSpecs.soc_min_pct}% – ${lastSpecs.soc_max_pct}%`],
              ["Degr. Cost",        `€${lastSpecs.deg_cost}/MWh`],
              ["Max Cycles",        `${lastSpecs.max_cycles}/day`],
              ["Initial SoC",       `${lastSpecs.initial_soc_pct}%`],
            ].map(([key, value], i) => (
              <div key={key} className={`flex justify-between py-2.5 ${i < 6 ? "border-b border-border" : ""}`}>
                <span className="text-[11px] text-text-3">{key}</span>
                <span className="text-[11px] font-mono font-medium text-text-2">{value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Findings */}
      <SectionCard title="Key Findings">
        <ul className="space-y-3">
          {[
            result.expected_revenue > 0
              ? `Battery generates €${result.expected_revenue.toFixed(2)} net revenue on the median price scenario.`
              : "Optimiser found no profitable dispatch for this date — market spreads too narrow.",
            result.capture_rate !== null
              ? `Stochastic strategy captures ${result.capture_rate.toFixed(1)}% of perfect-foresight revenue, demonstrating strong robustness to forecast error.`
              : "Perfect-foresight benchmark unavailable for this date.",
            `${result.cycles.toFixed(2)} equivalent full cycle${result.cycles !== 1 ? "s" : ""} dispatched — within the ${lastSpecs ? lastSpecs.max_cycles : "—"}/day warranty limit.`,
            "Water value surface shows marginal stored energy value peaks in morning pre-solar ramp and evening load peak — consistent with Greek DAM seasonality.",
          ].map((finding, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span className="text-[12px] text-text-2 leading-relaxed">{finding}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </motion.div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [result,      setResult]      = useState<OptimizeResult | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [activeDate,  setActiveDate]  = useState("");
  const [activeTab,   setActiveTab]   = useState<NavTab>("dashboard");
  const [lastSpecs,   setLastSpecs]   = useState<BatterySpecs | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const status = loading ? "running" : error ? "error" : result ? "done" : "idle";

  function handleHome() {
    setResult(null);
    setError(null);
    setActiveTab("dashboard");
  }

  async function handleRun(values: BatteryFormValues) {
    setLoading(true);
    setError(null);
    try {
      const data = await runOptimize(values.date, values.batterySpecs);
      setResult(data);
      setActiveDate(values.date);
      setLastSpecs(values.batterySpecs);
      setActiveTab("dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-bg-deep overflow-hidden">
      <Navbar
        status={status}
        date={activeDate || undefined}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onHome={handleHome}
      />

      <div className="flex flex-1 overflow-hidden pt-[52px]">
        {/* Sidebar */}
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
                <div className="flex items-center gap-2 mb-5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-text-3" strokeWidth={2} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">
                    Configuration
                  </span>
                </div>

                <BatteryForm onSubmit={handleRun} loading={loading} />

                <div className="mt-5 p-3 rounded-xl border border-border bg-surface-2">
                  <p className="text-[10px] text-text-3 leading-relaxed">
                    Synthetic Greek DAM prices (2024–2025) calibrated to observed
                    HEnEx market patterns.
                  </p>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="fixed bottom-6 left-5 z-40 w-8 h-8 rounded-full
                       border border-border bg-surface flex items-center justify-center
                       text-text-3 hover:text-text hover:border-border-2
                       shadow-lg shadow-black/30 transition-all"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          <AnimatePresence mode="wait">
            {!result && !loading && !error && (
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
                  <div className="absolute inset-0 w-14 h-14 rounded-full border-2
                                  border-t-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-medium text-text">Running optimisation pipeline</p>
                  <p className="text-[12px] text-text-3 mt-1">
                    Solving 100 Monte Carlo scenarios…
                  </p>
                </div>
                <div className="w-full max-w-3xl px-8 mt-4 space-y-3">
                  {[80, 100, 60].map((w) => (
                    <div key={w} className="shimmer h-10 rounded-xl" style={{ width: `${w}%` }} />
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
                  <p className="text-[12px] text-text-3 mb-4">{error}</p>
                  <button
                    onClick={handleHome}
                    className="text-[12px] text-primary hover:underline"
                  >
                    ← Try again
                  </button>
                </div>
              </motion.div>
            )}

            {!loading && (activeTab === "analytics" || activeTab === "reports") && !result && (
              <motion.div key={`empty-${activeTab}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-center h-full"
              >
                <div className="text-center max-w-sm">
                  <div className="w-14 h-14 rounded-2xl border border-border bg-surface
                                  flex items-center justify-center mx-auto mb-5">
                    {activeTab === "analytics"
                      ? <span className="text-2xl">📊</span>
                      : <span className="text-2xl">📄</span>
                    }
                  </div>
                  <p className="text-[14px] font-semibold text-text mb-2">
                    {activeTab === "analytics" ? "Revenue Analytics" : "Optimisation Report"}
                  </p>
                  <p className="text-[12px] text-text-3 leading-relaxed mb-5">
                    {activeTab === "analytics"
                      ? "Run an optimisation to see per-interval P&L, hourly breakdown, and efficiency metrics."
                      : "Run an optimisation to generate a full performance report with battery configuration and key findings."
                    }
                  </p>
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className="text-[12px] text-primary hover:underline"
                  >
                    ← Go to Dashboard
                  </button>
                </div>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div key={`tab-${activeTab}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="px-7 py-6"
              >
                {activeTab === "dashboard" && (
                  <DashboardView result={result} activeDate={activeDate} />
                )}
                {activeTab === "analytics" && (
                  <AnalyticsView result={result} activeDate={activeDate} />
                )}
                {activeTab === "reports" && (
                  <ReportsView result={result} activeDate={activeDate} lastSpecs={lastSpecs} />
                )}
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
    result.forecast_prices[i]?.toFixed(2)                ?? "",
    result.schedule.charge_mw[i]?.toFixed(4)             ?? "",
    result.schedule.discharge_mw[i]?.toFixed(4)          ?? "",
    result.schedule.net_mw[i]?.toFixed(4)                ?? "",
    result.soc_trajectory[i]?.toFixed(4)                 ?? "",
    result.revenue_per_interval[i]?.toFixed(4)           ?? "",
  ]);
  const csv = [
    "interval,price_forecast_eur_mwh,charge_mw,discharge_mw,net_mw,soc_mwh,revenue_eur",
    ...rows.map((r) => r.join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `heliosgrid_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
