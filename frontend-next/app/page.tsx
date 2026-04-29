"use client";

import { useState } from "react";
import { Zap, Activity, RefreshCw } from "lucide-react";
import BatteryForm, { type BatteryFormValues } from "@/components/BatteryForm";
import KPICards from "@/components/KPICards";
import LandingInfo from "@/components/LandingInfo";
import PriceChart from "@/components/charts/PriceChart";
import ScheduleChart from "@/components/charts/ScheduleChart";
import SoCChart from "@/components/charts/SoCChart";
import BidCurveChart from "@/components/charts/BidCurveChart";
import WaterValueHeatmap from "@/components/charts/WaterValueHeatmap";
import { runOptimize } from "@/lib/api";
import type { OptimizeResult } from "@/lib/types";

export default function Home() {
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string>("");
  const [bidInterval, setBidInterval] = useState(48); // default 12:00

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 overflow-y-auto border-r border-border bg-surface flex flex-col">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-text text-sm tracking-wide">HelleniFlex</div>
              <div className="text-xs text-muted">BESS Day-Ahead Optimizer</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 px-5 py-5">
          <BatteryForm onSubmit={handleRun} loading={loading} />
        </div>

        {/* Status indicator */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Activity className="w-3 h-3" />
            <span>Greek DAM (HEnEx) · 100 MC scenarios</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 px-8 py-4 border-b border-border bg-bg/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-text">
                {activeDate ? `Optimization · ${activeDate}` : "Battery Dispatch Optimizer"}
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Stochastic water-value framework · Greek Electricity Market
              </p>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Running 100 Monte Carlo scenarios…
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {error && (
            <div className="card border-red-500/30 bg-red-950/20 text-red-400 text-sm">
              Pipeline error: {error}
            </div>
          )}

          {result ? (
            <>
              <KPICards result={result} />

              <div className="grid grid-cols-1 gap-6">
                <div className="card animate-slide-up">
                  <h3 className="text-sm font-medium text-subtle mb-4">
                    Price Forecast · {activeDate}
                    <span className="ml-2 text-xs text-muted font-normal">100-scenario fan</span>
                  </h3>
                  <PriceChart
                    forecast={result.forecast_prices}
                    scenarios={result.scenario_prices}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card animate-slide-up">
                    <h3 className="text-sm font-medium text-subtle mb-4">
                      Optimal Charge / Discharge Schedule
                    </h3>
                    <ScheduleChart
                      charge={result.schedule.charge_mw}
                      discharge={result.schedule.discharge_mw}
                    />
                  </div>
                  <div className="card animate-slide-up">
                    <h3 className="text-sm font-medium text-subtle mb-4">
                      State of Charge Trajectory
                    </h3>
                    <SoCChart soc={result.soc_trajectory} />
                  </div>
                </div>

                <div className="card animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-subtle">
                      Bid Curve Preview
                      <span className="ml-2 text-xs text-muted font-normal font-mono">
                        {String(Math.floor(bidInterval / 4)).padStart(2, "0")}:
                        {String((bidInterval % 4) * 15).padStart(2, "0")}
                      </span>
                    </h3>
                  </div>
                  <div className="mb-4">
                    <input
                      type="range"
                      min={0}
                      max={95}
                      value={bidInterval}
                      onChange={(e) => setBidInterval(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted mt-1">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>23:45</span>
                    </div>
                  </div>
                  <BidCurveChart steps={result.bid_curves[bidInterval] ?? []} />
                </div>

                <div className="card animate-slide-up">
                  <h3 className="text-sm font-medium text-subtle mb-1">
                    Water Value Surface <span className="font-mono text-xs">w(t, SoC)</span>
                  </h3>
                  <p className="text-xs text-muted mb-4">
                    Marginal economic value (€/MWh) of one additional MWh stored at each time and SoC level
                  </p>
                  <WaterValueHeatmap
                    surface={result.water_value_surface}
                    socLevels={result.soc_levels_pct}
                  />
                </div>

                {/* CSV Download */}
                <div className="flex justify-end">
                  <button
                    onClick={() => downloadCSV(result, activeDate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface2 border border-border text-sm text-subtle hover:text-text hover:border-primary/50 transition-colors"
                  >
                    ↓ Download Schedule CSV
                  </button>
                </div>
              </div>
            </>
          ) : (
            !loading && <LandingInfo />
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm text-muted">Running optimization pipeline…</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function downloadCSV(result: OptimizeResult, date: string) {
  const TIME_LABELS = Array.from({ length: 96 }, (_, i) => {
    const h = Math.floor(i / 4).toString().padStart(2, "0");
    const m = ((i % 4) * 15).toString().padStart(2, "0");
    return `${h}:${m}`;
  });
  const rows = TIME_LABELS.map((label, i) => [
    label,
    result.forecast_prices[i].toFixed(2),
    result.schedule.charge_mw[i].toFixed(4),
    result.schedule.discharge_mw[i].toFixed(4),
    result.schedule.net_mw[i].toFixed(4),
    result.soc_trajectory[i].toFixed(4),
  ]);
  const header = "interval,price_forecast_eur_mwh,charge_mw,discharge_mw,net_mw,soc_mwh";
  const csv = [header, ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `helleniflex_schedule_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
