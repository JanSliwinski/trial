export interface BidStep {
  action: "buy" | "sell";
  price: number;
  quantity: number;
}

export interface Schedule {
  charge_mw: number[];
  discharge_mw: number[];
  net_mw: number[];
}

export interface OptimizeResult {
  forecast_prices: number[];
  scenario_prices: number[][];
  schedule: Schedule;
  soc_trajectory: number[];
  water_value_surface: number[][];
  soc_levels_pct: number[];
  bid_curves: Record<number, BidStep[]>;
  expected_revenue: number;
  capture_rate: number | null;
  cycles: number;
}

export interface BatterySpecs {
  capacity_mwh: number;
  power_mw: number;
  rte_pct: number;
  soc_min_pct: number;
  soc_max_pct: number;
  deg_cost: number;
  max_cycles: number;
  initial_soc_pct: number;
}

export interface BatteryPreset {
  name: string;
  specs: BatterySpecs;
}
