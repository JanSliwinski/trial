"use client";

import { useState, useEffect } from "react";
import { Play, ChevronDown } from "lucide-react";
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
    if (specs.initial_soc_pct < specs.soc_min_pct || specs.initial_soc_pct > specs.soc_max_pct)
      errs.push("Initial SoC must be within [SoC min, SoC max]");
    if (!date) errs.push("Select a delivery date");
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length === 0) {
      onSubmit({ date, batterySpecs: specs });
    }
  }

  function applyPreset(preset: BatteryPreset) {
    setSpecs(preset.specs);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Presets */}
      {presets.length > 0 && (
        <div>
          <label className="block text-xs text-muted mb-2 font-medium uppercase tracking-wider">
            Quick Presets
          </label>
          <div className="relative">
            <select
              className="pr-8 appearance-none"
              defaultValue=""
              onChange={(e) => {
                const p = presets.find((p) => p.name === e.target.value);
                if (p) applyPreset(p);
              }}
            >
              <option value="" disabled>Select a preset…</option>
              {presets.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          </div>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wider">
          Delivery Date
        </label>
        <input
          type="date"
          value={date}
          min="2024-01-15"
          max="2025-12-30"
          onChange={(e) => setDate(e.target.value)}
        />
        <p className="text-xs text-muted mt-1">2024-01-15 → 2025-12-30</p>
      </div>

      <hr className="border-border" />

      <div>
        <label className="block text-xs text-muted mb-3 font-medium uppercase tracking-wider">
          Battery Specifications
        </label>
        <div className="space-y-3">
          <Field label="Capacity (MWh)">
            <input
              type="number" min={0.5} max={500} step="any"
              value={specs.capacity_mwh}
              onChange={(e) => set("capacity_mwh", Number(e.target.value))}
            />
          </Field>
          <Field label="Max Power (MW)">
            <input
              type="number" min={0.1} max={250} step="any"
              value={specs.power_mw}
              onChange={(e) => set("power_mw", Number(e.target.value))}
            />
          </Field>
          <Field label="Round-trip Efficiency (%)">
            <input
              type="number" min={51} max={99} step="any"
              value={specs.rte_pct}
              onChange={(e) => set("rte_pct", Number(e.target.value))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="SoC Min (%)">
              <input
                type="number" min={0} max={49} step={1}
                value={specs.soc_min_pct}
                onChange={(e) => set("soc_min_pct", Number(e.target.value))}
              />
            </Field>
            <Field label="SoC Max (%)">
              <input
                type="number" min={51} max={100} step={1}
                value={specs.soc_max_pct}
                onChange={(e) => set("soc_max_pct", Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label="Degradation Cost (€/MWh)">
            <input
              type="number" min={0} max={50} step="any"
              value={specs.deg_cost}
              onChange={(e) => set("deg_cost", Number(e.target.value))}
            />
          </Field>
          <Field label="Max Cycles / Day">
            <input
              type="number" min={0.5} max={10} step="any"
              value={specs.max_cycles}
              onChange={(e) => set("max_cycles", Number(e.target.value))}
            />
          </Field>
          <Field label="Starting SoC (%)">
            <input
              type="number" min={0} max={100} step={1}
              value={specs.initial_soc_pct}
              onChange={(e) => set("initial_soc_pct", Number(e.target.value))}
            />
          </Field>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-950/30 border border-red-500/30 p-3 space-y-1">
          {errors.map((e) => (
            <p key={e} className="text-xs text-red-400">{e}</p>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-blue"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" />
            Run Optimisation
          </>
        )}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}
