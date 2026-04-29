"""
_pipeline.py — Vercel-compatible optimisation pipeline

Underscore prefix: not exposed as an HTTP endpoint but bundled
alongside optimize.py by Vercel's file tracer.

Parquet data is outside the Vercel root, so we always use the
synthetic Greek DAM price generator.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
from scipy.optimize import linprog

from _helleniflex.battery import BatteryAsset
from _helleniflex.forecaster import SmartForecaster, NaiveForecaster
from _helleniflex.data_loader import make_synthetic_greek_dam_prices

N_SCENARIOS = 100
N_SOC_LEVELS = 10
DT = 0.25   # 15-min intervals → fraction of an hour
T  = 96     # intervals per day


def load_prices() -> pd.Series:
    return make_synthetic_greek_dam_prices(start="2024-01-01", end="2025-12-31")


def _make_battery(specs: dict) -> BatteryAsset:
    eta     = float(np.clip(specs["rte_pct"] / 100.0, 0.50, 0.9999))
    eta_ow  = float(eta ** 0.5)
    soc_min = specs["soc_min_pct"] / 100.0
    soc_max = specs["soc_max_pct"] / 100.0
    initial = float(np.clip(specs["initial_soc_pct"] / 100.0, soc_min, soc_max))
    return BatteryAsset(
        power_mw              = float(specs["power_mw"]),
        capacity_mwh          = float(specs["capacity_mwh"]),
        eta_charge            = eta_ow,
        eta_discharge         = eta_ow,
        soc_min_pct           = soc_min,
        soc_max_pct           = soc_max,
        initial_soc_pct       = initial,
        daily_cycle_limit     = float(specs["max_cycles"]),
        cycle_cost_eur_per_mwh= float(specs["deg_cost"]),
    )


def _solve_lp(prices: np.ndarray, battery: BatteryAsset,
              initial_soc_mwh: float) -> dict | None:
    """
    Solve the single-day battery dispatch LP.

    Decision variables (length 3T):
      x[0:T]      charge power   c_t  ∈ [0, P_max]
      x[T:2T]     discharge      d_t  ∈ [0, P_max]
      x[2T:3T]    SoC at end     e_t  ∈ [e_min, e_max]

    Objective: minimise  Σ_t [(λ_t + δ) c_t - (λ_t - δ) d_t] · DT
    which is equivalent to maximising net revenue minus degradation.

    Equality constraints encode the SoC dynamics:
      e_t = e_{t-1} + η_c·DT·c_t - DT/η_d·d_t   for t = 0,...,T-1
    with e_{-1} = initial_soc_mwh.

    Terminal constraint: e_{T-1} ∈ [e0 - tol, e0 + tol]
    prevents the solver from draining the battery to maximise end-of-day
    discharge at the cost of the next day.
    """
    ec  = battery.eta_charge
    ed  = battery.eta_discharge
    deg = battery.cycle_cost_eur_per_mwh
    Pm  = battery.power_mw
    smin = battery.soc_min_mwh
    smax = battery.soc_max_mwh
    e0   = float(initial_soc_mwh)

    n = 3 * T
    obj = np.zeros(n)
    obj[:T]    = (prices + deg) * DT    # charge cost (positive = bad for minimiser)
    obj[T:2*T] = -(prices - deg) * DT  # discharge revenue (negative = good)

    # SoC dynamics: one equality per interval
    Aeq  = np.zeros((T, n))
    beq  = np.zeros(T)
    for t in range(T):
        Aeq[t, t]        = -ec * DT        # charge adds energy
        Aeq[t, T + t]    =  DT / ed        # discharge removes energy
        Aeq[t, 2*T + t]  =  1.0            # e_t term
        if t == 0:
            beq[t] = e0                    # e_0 - ec*DT*c_0 + DT/ed*d_0 = e_{-1}
        else:
            Aeq[t, 2*T + t - 1] = -1.0    # -e_{t-1} term

    bounds = [(0.0, Pm)] * T + [(0.0, Pm)] * T + [(smin, smax)] * T

    # Soft terminal SoC constraint (±10% of capacity around initial)
    tol  = 0.10 * battery.capacity_mwh
    lo   = max(smin, e0 - tol)
    hi   = min(smax, e0 + tol)
    bounds[3 * T - 1] = (lo, hi)

    # Optional daily cycle cap
    Aub = bub = None
    if battery.daily_cycle_limit is not None and battery.usable_capacity_mwh > 0:
        Aub        = np.zeros((1, n))
        Aub[0, :T] = DT
        bub        = np.array([battery.daily_cycle_limit * battery.usable_capacity_mwh])

    res = linprog(obj, A_ub=Aub, b_ub=bub,
                  A_eq=Aeq, b_eq=beq,
                  bounds=bounds, method="highs")
    if res.status != 0:
        return None

    charge    = np.clip(res.x[:T],       0.0, Pm)
    discharge = np.clip(res.x[T:2*T],    0.0, Pm)
    soc       = np.concatenate([[e0],
                    np.clip(res.x[2*T:3*T], smin, smax)])

    # Water values from LP duals (shadow prices on SoC dynamics)
    floor = deg / ec + deg * ed
    raw_duals = getattr(res.eqlin, "marginals", None)
    if raw_duals is not None and len(raw_duals) == T:
        water_vals = np.maximum(-np.asarray(raw_duals, dtype=float), floor)
    else:
        water_vals = np.maximum((prices - deg) * (ec * ed), floor)

    profit = float(
        np.sum(prices * (discharge - charge)) * DT
        - deg * np.sum(charge + discharge) * DT
    )
    cycles = (
        float(np.sum(charge) * DT / battery.usable_capacity_mwh)
        if battery.usable_capacity_mwh > 0 else 0.0
    )

    return {
        "charge": charge, "discharge": discharge,
        "soc": soc, "water_vals": water_vals,
        "profit": profit, "cycles": cycles,
    }


def _generate_scenarios(forecast: np.ndarray, history: pd.Series,
                        seed: int = 0) -> np.ndarray:
    """
    Sample N_SCENARIOS correlated price paths around the forecast.

    Uses AR(1) noise scaled to observed day-ahead price volatility,
    clipped to the realistic Greek DAM range [-50, 400] €/MWh.
    """
    rng = np.random.default_rng(seed)
    if len(history) >= 2 * T:
        diffs      = history.values[T:] - history.values[:-T]
        noise_std  = float(np.clip(float(np.std(diffs)) * 0.5, 8.0, 40.0))
    else:
        noise_std = 15.0

    raw   = rng.normal(0.0, noise_std, (N_SCENARIOS, T))
    alpha = 0.55  # AR(1) persistence
    for t in range(1, T):
        raw[:, t] = alpha * raw[:, t - 1] + (1.0 - alpha) * raw[:, t]
    return np.clip(forecast[None, :] + raw, -50.0, 400.0)


def optimize(date: str, battery_specs: dict,
             progress_cb: Callable | None = None) -> dict:
    def _upd(pct: float, msg: str) -> None:
        if progress_cb:
            progress_cb(pct, msg)

    # ── 1. Market data ───────────────────────────────────────────────────
    _upd(0.05, "Loading market data…")
    prices_all   = load_prices()
    target       = pd.Timestamp(date)
    day_end      = target + pd.Timedelta(days=1)
    history      = prices_all[prices_all.index < target]
    actual_slice = prices_all[
        (prices_all.index >= target) & (prices_all.index < day_end)
    ]

    # ── 2. Price forecast ────────────────────────────────────────────────
    _upd(0.12, "Fitting price forecaster…")
    try:
        fc = SmartForecaster()
        fc.fit(history)
        forecast = fc.predict(target, history)
    except Exception:
        try:
            forecast = NaiveForecaster().predict(target, history)
        except Exception:
            last = history.iloc[-T:] if len(history) >= T else None
            forecast = last.values if last is not None else np.full(T, 100.0)

    forecast = np.asarray(forecast, dtype=float)
    if len(forecast) != T:
        forecast = np.resize(forecast, T)

    # ── 3. Monte Carlo scenarios ─────────────────────────────────────────
    _upd(0.22, f"Sampling {N_SCENARIOS} scenarios…")
    seed      = int(target.timestamp()) % (2 ** 31)
    scenarios = _generate_scenarios(forecast, history, seed=seed)

    # Pre-compute quantiles on the backend — avoids sending 9,600 numbers
    # to the client when only 4 × 96 = 384 are needed.
    scenario_quantiles = {
        "p10": np.percentile(scenarios, 10, axis=0),
        "p25": np.percentile(scenarios, 25, axis=0),
        "p75": np.percentile(scenarios, 75, axis=0),
        "p90": np.percentile(scenarios, 90, axis=0),
    }

    # ── 4. Scenario LP ensemble ──────────────────────────────────────────
    _upd(0.32, f"Solving {N_SCENARIOS} scenario LPs…")
    battery     = _make_battery(battery_specs)
    initial_soc = battery.initial_soc_mwh
    all_duals, all_profits = [], []

    for sc in scenarios:
        r = _solve_lp(sc, battery, initial_soc)
        if r is not None:
            all_duals.append(r["water_vals"])
            all_profits.append(r["profit"])

    # ── 5. Water value surface ───────────────────────────────────────────
    _upd(0.72, "Aggregating water value surface…")
    if all_duals:
        w_base = np.mean(all_duals, axis=0)
    else:
        floor  = (battery.cycle_cost_eur_per_mwh / battery.eta_charge
                  + battery.cycle_cost_eur_per_mwh * battery.eta_discharge)
        w_base = np.full(T, floor)

    K          = N_SOC_LEVELS
    wv_surface = np.zeros((T, K))
    for k in range(K):
        soc_frac        = k / (K - 1)
        multiplier      = 1.0 + 0.35 * (1.0 - soc_frac)  # higher at low SoC
        wv_surface[:, k] = w_base * multiplier

    soc_pct_lo    = battery.soc_min_pct * 100.0
    soc_pct_hi    = battery.soc_max_pct * 100.0
    soc_levels_pct = np.linspace(soc_pct_lo, soc_pct_hi, K)

    # ── 6. Optimal deterministic schedule ───────────────────────────────
    _upd(0.82, "Computing optimal dispatch schedule…")
    main_r = _solve_lp(forecast, battery, initial_soc)
    if main_r is None:
        main_r = {
            "charge":     np.zeros(T),
            "discharge":  np.zeros(T),
            "soc":        np.full(T + 1, initial_soc),
            "profit":     0.0,
            "cycles":     0.0,
        }

    charge    = main_r["charge"]
    discharge = main_r["discharge"]

    # Per-interval net revenue: sell revenue - buy cost - degradation
    revenue_per_interval = (
        (discharge - charge) * forecast * DT
        - battery.cycle_cost_eur_per_mwh * (discharge + charge) * DT
    )

    # ── 7. Perfect-foresight benchmark ──────────────────────────────────
    _upd(0.91, "Computing perfect-foresight benchmark…")
    capture_rate = None
    if len(actual_slice) >= T:
        pf_r = _solve_lp(actual_slice.values[:T], battery, initial_soc)
        if pf_r is not None and pf_r["profit"] > 1e-6:
            capture_rate = float(
                np.clip(main_r["profit"] / pf_r["profit"] * 100.0, -200.0, 200.0)
            )

    _upd(1.0, "Done.")
    return {
        "forecast_prices":      forecast,
        "scenario_quantiles":   scenario_quantiles,
        "schedule": {
            "charge_mw":    charge,
            "discharge_mw": discharge,
            "net_mw":       discharge - charge,
        },
        "soc_trajectory":       main_r["soc"],
        "soc_min_mwh":          float(battery.soc_min_mwh),
        "soc_max_mwh":          float(battery.soc_max_mwh),
        "water_value_surface":  wv_surface,
        "soc_levels_pct":       soc_levels_pct,
        "revenue_per_interval": revenue_per_interval,
        "expected_revenue":     main_r["profit"],
        "capture_rate":         capture_rate,
        "cycles":               main_r["cycles"],
    }
