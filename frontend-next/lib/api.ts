import type { BatterySpecs, OptimizeResult, BatteryPreset } from "./types";

// Python serverless functions are on the same domain — no base URL needed
const BASE = "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function runOptimize(date: string, batterySpecs: BatterySpecs): Promise<OptimizeResult> {
  return apiFetch<OptimizeResult>("/api/optimize", {
    method: "POST",
    body: JSON.stringify({ date, battery_specs: batterySpecs }),
  });
}

export function fetchBatteryPresets(): Promise<BatteryPreset[]> {
  return apiFetch<BatteryPreset[]>("/api/battery-presets");
}
