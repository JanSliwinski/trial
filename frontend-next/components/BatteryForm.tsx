"use client";

import { useState, useEffect } from "react";
import { Play, ChevronDown, Battery, Zap, Settings2, RotateCcw } from "lucide-react";
import { fetchBatteryPresets } from "@/lib/api";
import type { BatterySpecs, BatteryPreset } from "@/lib/types";

export interface BatteryFormValues {
  date: string;
  batterySpecs: BatterySpecs;
}

interface Props {
  onSubmit: (values: BatteryFormValues) => void;
  loading: boolean;
}

const DEFAULT: BatterySpecs = {
  capacity_mwh: 10.0,
  power_mw: 5.0,
  rte_pct: 88.0,
  soc_min_pct: 10.0,
  soc_max_pct: 90.0,
  deg_cost: 5.0,
  max_cycles: 2.0,
  initial_soc_pct: 50.0,
};

function BatteryPreview({ specs }: { specs: BatterySpecs }) {
  const { soc_min_pct, soc_max_pct, initial_soc_pct, capacity_mwh, power_mw } = specs;
  const cRate = power_mw / capacity_mwh;
  const usableEnergy = (capacity_mwh * (soc_max_pct - soc_min_pct)) / 100;

  return (
    <div className="p-3 rounded-xl border border-border bg-surface-2 space-y-3">
      {/* Battery bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-3">
            SoC Window
          </span>
          <span className="text-[10px] font-mono text-text-2">
            {usableEnergy.toFixed(1)} MWh usable
          </span>
        </div>
        <div className="relative h-5 rounded-lg overflow-hidden bg-surface-3 border border-border">
          {/* Usable range fill */}
          <div
            className="absolute top-0 bottom-0 rounded-md"
            style={{
              left: `${soc_min_pct}%`,
              width: `${soc_max_pct - soc_min_pct}%`,
              background: "linear-gradient(90deg, rgba(56,189,248,0.25), rgba(56,189,248,0.35))",
              borderLeft: "1px solid rgba(56,189,248,0.4)",
              borderRight: "1px solid rgba(56,189,248,0.4)",
            }}
          />
          {/* Initial SoC marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 rounded-full"
            style={{
              left: `${initial_soc_pct}%`,
              background: "#38bdf8",
              boxShadow: "0 0 6px rgba(56,189,248,0.8)",
            }}
          />
          {/* Min/max ticks */}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary/40"
            style={{ left: `${soc_min_pct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-primary/40"
            style={{ left: `${soc_max_pct}%` }}
          />
        </div>
        {/* Axis labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-text-3 font-mono">0%</span>
          <span className="text-[9px] text-primary font-mono font-medium">
            Init {initial_soc_pct}%
          </span>
          <span className="text-[9px] text-text-3 font-mono">100%</span>
        </div>
      </div>

      {/* Spec chips */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "C-rate", value: `${cRate.toFixed(2)}C`, color: "#fbbf24" },
          { label: "RTE", value: `${specs.rte_pct.toFixed(0)}%`, color: "#34d399" },
          { label: "Cycles", value: `${specs.max_cycles}×/d`, color: "#818cf8" },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center p-1.5 rounded-lg border border-border bg-surface">
            <div className="text-[13px] font-mono font-bold" style={{ color }}>{value}</div>
            <div className="text-[9px] text-text-3 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="w-3 h-3 text-text-3" strokeWidth={2} />
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">{label}</span>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[11px] font-medium text-text-2">{label}</label>
        {hint && <span className="text-[10px] text-text-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function BatteryForm({ onSubmit, loading }: Props) {
  const [date, setDate] = useState("2025-04-15");
  const [specs, setSpecs] = useState<BatterySpecs>(DEFAULT);
  const [presets, setPresets] = useState<BatteryPreset[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    fetchBatteryPresets()
      .then(setPresets)
      .catch(() => {});
  }, []);

  function set(key: keyof BatterySpecs, value: number) {
    setSpecs((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (specs.capacity_mwh <= 0) errs.push("Capacity must be > 0");
    if (specs.power_mw <= 0) errs.push("Power must be > 0");
    if (specs.rte_pct <= 50 || specs.rte_pct >= 100) errs.push("RTE must be 50–100%");
    if (specs.soc_min_pct >= specs.soc_max_pct) errs.push("SoC min must be < SoC max");
    if (
      specs.initial_soc_pct < specs.soc_min_pct ||
      specs.initial_soc_pct > specs.soc_max_pct
    )
      errs.push("Initial SoC must be within [SoC min, SoC max]");
    if (!date) errs.push("Select a delivery date");
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length === 0) onSubmit({ date, batterySpecs: specs });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Quick presets */}
      {presets.length > 0 && (
        <div>
          <SectionHeader icon={Zap} label="Quick Presets" />
          <div className="relative">
            <select
              className="pr-8 appearance-none"
              defaultValue=""
              onChange={(e) => {
                const p = presets.find((p) => p.name === e.target.value);
                if (p) setSpecs(p.specs);
              }}
            >
              <option value="" disabled>Select a preset…</option>
              {presets.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-3 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Delivery date */}
      <div>
        <SectionHeader icon={Settings2} label="Delivery Date" />
        <input
          type="date"
          value={date}
          min="2024-01-15"
          max="2025-12-30"
          onChange={(e) => setDate(e.target.value)}
        />
        <p className="text-[10px] text-text-3 mt-1.5 font-mono">
          Range: 2024-01-15 → 2025-12-30
        </p>
      </div>

      <div className="h-px bg-border" />

      {/* Battery specs */}
      <div>
        <SectionHeader icon={Battery} label="Battery Asset" />

        {/* Visual preview */}
        <div className="mb-3">
          <BatteryPreview specs={specs} />
        </div>

        <div className="space-y-2.5">
          {/* Capacity + Power side by side */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Capacity" hint="MWh">
              <input
                type="number" min={0.5} max={500} step="any"
                value={specs.capacity_mwh}
                onChange={(e) => set("capacity_mwh", Number(e.target.value))}
              />
            </Field>
            <Field label="Max Power" hint="MW">
              <input
                type="number" min={0.1} max={250} step="any"
                value={specs.power_mw}
                onChange={(e) => set("power_mw", Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Round-trip Efficiency" hint="%">
            <input
              type="number" min={51} max={99} step="any"
              value={specs.rte_pct}
              onChange={(e) => set("rte_pct", Number(e.target.value))}
            />
          </Field>

          {/* SoC bounds */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="SoC Min" hint="%">
              <input
                type="number" min={0} max={49} step={1}
                value={specs.soc_min_pct}
                onChange={(e) => set("soc_min_pct", Number(e.target.value))}
              />
            </Field>
            <Field label="SoC Max" hint="%">
              <input
                type="number" min={51} max={100} step={1}
                value={specs.soc_max_pct}
                onChange={(e) => set("soc_max_pct", Number(e.target.value))}
              />
            </Field>
          </div>

          {/* Initial SoC slider */}
          <Field label="Starting SoC" hint={`${specs.initial_soc_pct}%`}>
            <input
              type="range"
              min={specs.soc_min_pct}
              max={specs.soc_max_pct}
              step={1}
              value={specs.initial_soc_pct}
              onChange={(e) => set("initial_soc_pct", Number(e.target.value))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Degr. Cost" hint="€/MWh">
              <input
                type="number" min={0} max={50} step="any"
                value={specs.deg_cost}
                onChange={(e) => set("deg_cost", Number(e.target.value))}
              />
            </Field>
            <Field label="Max Cycles" hint="/day">
              <input
                type="number" min={0.5} max={10} step="any"
                value={specs.max_cycles}
                onChange={(e) => set("max_cycles", Number(e.target.value))}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => { setSpecs(DEFAULT); setErrors([]); }}
        className="flex items-center gap-1.5 text-[10px] text-text-3 hover:text-text-2 transition-colors"
      >
        <RotateCcw className="w-3 h-3" strokeWidth={2} />
        Reset to defaults
      </button>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red/30 bg-red/5 p-3 space-y-1">
          {errors.map((e) => (
            <p key={e} className="text-[11px] text-red">{e}</p>
          ))}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                   bg-primary text-[#020810] font-bold text-[13px]
                   hover:bg-primary/90 active:scale-[0.98] transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-[0_0_20px_rgba(56,189,248,0.3)]"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-[#020810]/30 border-t-[#020810] rounded-full animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Optimisation
          </>
        )}
      </button>
    </form>
  );
}
