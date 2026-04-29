"""
pipeline_v.py — Vercel-compatible version of pipeline.py

Uses regular package imports (no importlib) so Vercel's file tracer
bundles _helleniflex/ automatically. Parquet data not available in the
Vercel bundle — falls back to synthetic Greek DAM prices.
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
DT = 0.25
T = 96


def load_prices() -> pd.Series:
    return make_synthetic_greek_dam_prices(start="2024-01-01", end="2025-12-31")


def _make_battery(specs: dict) -> BatteryAsset:
    eta = float(np.clip(specs["rte_pct"] / 100.0, 0.50, 0.9999))
    eta_ow = float(eta ** 0.5)
    soc_min = specs["soc_min_pct"] / 100.0
    soc_max = specs["soc_max_pct"] / 100.0
    initial = float(np.clip(specs["initial_soc_pct"] / 100.0, soc_min, soc_max))
    return BatteryAsset(
        power_mw=float(specs["power_mw"]),
        capacity_mwh=float(specs["capacity_mwh"]),
        eta_charge=eta_ow,
        eta_discharge=eta_ow,
        soc_min_pct=soc_min,
        soc_max_pct=soc_max,
        initial_soc_pct=initial,
        daily_cycle_limit=float(specs["max_cycles"]),
        cycle_cost_eur_per_mwh=float(specs["deg_cost"]),
    )


def _solve_lp(prices: np.ndarray, battery: BatteryAsset, initial_soc_mwh: float) -> dict | None:
    ec = battery.eta_charge
    ed = battery.eta_discharge
    deg = battery.cycle_cost_eur_per_mwh
    Pm = battery.power_mw
    smin = battery.soc_min_mwh
    smax = battery.soc_max_mwh
    e0 = float(initial_soc_mwh)
    n = 3 * T

    obj = np.zeros(n)
    obj[:T] = (prices + deg) * DT
    obj[T:2*T] = -(prices - deg) * DT

    Aeq = np.zeros((T, n))
    beq = np.zeros(T)
    for t in range(T):
        Aeq[t, t] = -ec * DT
        Aeq[t, T + t] = DT / ed
        Aeq[t, 2*T + t] = 1.0
        if t == 0:
            beq[t] = e0
        else:
            Aeq[t, 2*T + t - 1] = -1.0

    bounds = ([(0.0, Pm)] * T + [(0.0, Pm)] * T + [(smin, smax)] * T)
    tol = 0.10 * battery.capacity_mwh
    lo = max(smin, e0 - tol)
    hi = min(smax, e0 + tol)
    bounds[3 * T - 1] = (lo, hi)

    Aub = bub = None
    if battery.daily_cycle_limit is not None and battery.usable_capacity_mwh > 0:
        Aub = np.zeros((1, n))
        Aub[0, :T] = DT
        bub = np.array([battery.daily_cycle_limit * battery.usable_capacity_mwh])

    res = linprog(obj, A_ub=Aub, b_ub=bub, A_eq=Aeq, b_eq=beq, bounds=bounds, method="highs")
    if res.status != 0:
        return None

    charge = np.clip(res.x[:T], 0.0, Pm)
    discharge = np.clip(res.x[T:2*T], 0.0, Pm)
    soc = np.concatenate([[e0], np.clip(res.x[2*T:3*T], smin, smax)])

    floor = deg / ec + deg * ed
    raw_duals = getattr(res.eqlin, "marginals", None)
    if raw_duals is not None and len(raw_duals) == T:
        water_vals = np.maximum(-np.asarray(raw_duals, dtype=float), floor)
    else:
        water_vals = np.maximum((prices - deg) * (ec * ed), floor)

    profit = float(np.sum(prices * (discharge - charge)) * DT - deg * np.sum(charge + discharge) * DT)
    cycles = float(np.sum(charge) * DT / battery.usable_capacity_mwh) if battery.usable_capacity_mwh > 0 else 0.0

    return {"charge": charge, "discharge": discharge, "soc": soc, "water_vals": water_vals, "profit": profit, "cycles": cycles}


def _generate_scenarios(forecast: np.ndarray, history: pd.Series, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    if len(history) >= 2 * T:
        diffs = history.values[T:] - history.values[:-T]
        noise_std = float(np.clip(float(np.std(diffs)) * 0.5, 8.0, 40.0))
    else:
        noise_std = 15.0
    raw = rng.normal(0.0, noise_std, (N_SCENARIOS, T))
    alpha = 0.55
    for t in range(1, T):
        raw[:, t] = alpha * raw[:, t - 1] + (1.0 - alpha) * raw[:, t]
    return np.clip(forecast[None, :] + raw, -50.0, 400.0)


def _build_bid_curves(wv_surface: np.ndarray, soc_mid_idx: int, battery: BatteryAsset) -> dict:
    ec = battery.eta_charge
    ed = battery.eta_discharge
    Pm = battery.power_mw
    qty_full = Pm * DT
    K = wv_surface.shape[1]
    k = soc_mid_idx
    curves = {}
    for t in range(T):
        w_now = wv_surface[t, k]
        k_next = min(k + 1, K - 1)
        w_next = wv_surface[min(t + 1, T - 1), k_next]
        p_sell = max(w_now / ed, 0.0)
        p_buy = max(w_next * ec, 0.0)
        curves[t] = [
            {"action": "buy",  "price": round(p_buy * 1.05, 2), "quantity": round(qty_full * 0.5, 4)},
            {"action": "buy",  "price": round(p_buy,        2), "quantity": round(qty_full,       4)},
            {"action": "sell", "price": round(p_sell * 0.95, 2), "quantity": round(qty_full * 0.5, 4)},
            {"action": "sell", "price": round(p_sell,         2), "quantity": round(qty_full,       4)},
        ]
    return curves


def optimize(date: str, battery_specs: dict, progress_cb: Callable | None = None) -> dict:
    def _upd(pct, msg):
        if progress_cb:
            progress_cb(pct, msg)

    _upd(0.05, "Loading market data…")
    prices_all = load_prices()
    target = pd.Timestamp(date)
    day_end = target + pd.Timedelta(days=1)
    history = prices_all[prices_all.index < target]
    actual_slice = prices_all[(prices_all.index >= target) & (prices_all.index < day_end)]

    _upd(0.12, "Fitting price forecaster…")
    try:
        fc = SmartForecaster()
        fc.fit(history)
        forecast = fc.predict(target, history)
    except Exception:
        try:
            forecast = NaiveForecaster().predict(target, history)
        except Exception:
            last_day = history.iloc[-T:] if len(history) >= T else None
            forecast = last_day.values if last_day is not None else np.full(T, 100.0)

    forecast = np.asarray(forecast, dtype=float)
    if len(forecast) != T:
        forecast = np.resize(forecast, T)

    _upd(0.22, f"Sampling {N_SCENARIOS} Monte Carlo scenarios…")
    seed = int(target.timestamp()) % (2**31)
    scenarios = _generate_scenarios(forecast, history, seed=seed)

    _upd(0.32, f"Solving {N_SCENARIOS} scenario LPs…")
    battery = _make_battery(battery_specs)
    initial_soc = battery.initial_soc_mwh
    all_duals, all_profits = [], []

    for i, sc in enumerate(scenarios):
        r = _solve_lp(sc, battery, initial_soc)
        if r is not None:
            all_duals.append(r["water_vals"])
            all_profits.append(r["profit"])

    _upd(0.62, "Aggregating water value surface…")
    if all_duals:
        w_base = np.mean(all_duals, axis=0)
    else:
        floor = battery.cycle_cost_eur_per_mwh / battery.eta_charge + battery.cycle_cost_eur_per_mwh * battery.eta_discharge
        w_base = np.full(T, floor)

    K = N_SOC_LEVELS
    wv_surface = np.zeros((T, K))
    for k in range(K):
        soc_frac = k / (K - 1)
        multiplier = 1.0 + 0.35 * (1.0 - soc_frac)
        wv_surface[:, k] = w_base * multiplier

    soc_pct_lo = battery.soc_min_pct * 100.0
    soc_pct_hi = battery.soc_max_pct * 100.0
    soc_levels_pct = np.linspace(soc_pct_lo, soc_pct_hi, K)

    _upd(0.72, "Building HEnEx bid curves…")
    bid_curves = _build_bid_curves(wv_surface, K // 2, battery)

    _upd(0.82, "Computing optimal dispatch schedule…")
    main_r = _solve_lp(forecast, battery, initial_soc)
    if main_r is None:
        main_r = {"charge": np.zeros(T), "discharge": np.zeros(T), "soc": np.full(T + 1, initial_soc), "profit": 0.0, "cycles": 0.0}

    _upd(0.91, "Computing perfect-foresight benchmark…")
    capture_rate = None
    if len(actual_slice) >= T:
        pf_r = _solve_lp(actual_slice.values[:T], battery, initial_soc)
        if pf_r is not None and pf_r["profit"] > 1e-6:
            capture_rate = float(np.clip(main_r["profit"] / pf_r["profit"] * 100.0, -200.0, 200.0))

    _upd(1.0, "Done.")
    charge = main_r["charge"]
    discharge = main_r["discharge"]
    return {
        "forecast_prices": forecast,
        "scenario_prices": scenarios,
        "schedule": {"charge_mw": charge, "discharge_mw": discharge, "net_mw": discharge - charge},
        "soc_trajectory": main_r["soc"],
        "water_value_surface": wv_surface,
        "soc_levels_pct": soc_levels_pct,
        "bid_curves": bid_curves,
        "expected_revenue": main_r["profit"],
        "capture_rate": capture_rate,
        "cycles": main_r["cycles"],
    }
