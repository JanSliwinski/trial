export interface ScenarioQuantiles {
  p10: number[];
  p25: number[];
  p75: number[];
  p90: number[];
}

export interface Schedule {
  charge_mw:    number[];
  discharge_mw: number[];
  net_mw:       number[];
}

export interface OptimizeResult {
  forecast_prices:      number[];
  scenario_quantiles:   ScenarioQuantiles;
  schedule:             Schedule;
  soc_trajectory:       number[];
  soc_min_mwh:          number;
  soc_max_mwh:          number;
  water_value_surface:  number[][];
  soc_levels_pct:       number[];
  revenue_per_interval: number[];
  expected_revenue:     number;
  capture_rate:         number | null;
  cycles:               number;
}

export interface BatterySpecs {
  capacity_mwh:   number;
  power_mw:       number;
  rte_pct:        number;
  soc_min_pct:    number;
  soc_max_pct:    number;
  deg_cost:       number;
  max_cycles:     number;
  initial_soc_pct:number;
}

export interface BatteryPreset {
  name:  string;
  specs: BatterySpecs;
}
