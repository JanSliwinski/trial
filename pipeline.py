"""
pipeline.py — Single entry point for the HelleniFlex BESS optimiser.

Public API
----------
    result = optimize(date, battery_specs, progress_cb=None)

Returns a dict with keys:
    forecast_prices     np.ndarray (96,)     median price forecast
    scenario_prices     np.ndarray (N, 96)   all Monte Carlo price paths
    schedule            dict                 charge_mw, discharge_mw, net_mw (96,)
    soc_trajectory      np.ndarray (97,)     SoC at start of each interval + end
    water_value_surface np.ndarray (96, K)   w(t, SoC) in €/MWh
    soc_levels_pct      np.ndarray (K,)      SoC axis labels (%)
    bid_curves          dict[int, list]      HEnEx-style bid steps per interval
    expected_revenue    float                €  for the day (median forecast)
    capture_rate        float | None         % of perfect-foresight benchmark
    cycles              float                equivalent full cycles

Design notes
------------
* Imports helleniflex.battery / forecaster / data_loader directly via importlib
  so cvxpy (used only in helleniflex.optimizer) is never loaded.  The Streamlit
  app has no cvxpy dependency; all LPs are solved with scipy.optimize.linprog.
* N_SCENARIOS = 100 for demo (production = 200). A banner in app.py notes this.
* Progress callbacks are plain callables (float, str) → compatible with both
  st.progress and console logging.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
from scipy.optimize import linprog

# ---------------------------------------------------------------------------
# Load helleniflex sub-modules without triggering __init__.py (which imports
# cvxpy via optimizer.py).
# ---------------------------------------------------------------------------

_ROOT = Path(__file__).parent
_LIB = _ROOT / "helleniflex" / "src" / "helleniflex"


def _load(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = m   # must be registered before exec for @dataclass to work
    spec.loader.exec_module(m)
    return m


_bat_mod = _load(_LIB / "battery.py")
_fc_mod = _load(_LIB / "forecaster.py")
_dl_mod = _load(_LIB / "data_loader.py")

BatteryAsset = _bat_mod.BatteryAsset
SmartForecaster = _fc_mod.SmartForecaster
NaiveForecaster = _fc_mod.NaiveForecaster
make_synthetic_greek_dam_prices = _dl_mod.make_synthetic_greek_dam_prices

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_PATH = _ROOT / "data" / "prices.parquet"
N_SCENARIOS = 100
N_SOC_LEVELS = 10    # K in the framework doc
DT = 0.25            # hours per 15-min interval
T = 96               # intervals per day

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_prices() -> pd.Series:
    """Return historical 15-min price series. Parquet cache → synthetic fallback."""
    if DATA_PATH.exists():
        df = pd.read_parquet(DATA_PATH)
        s = df.iloc[:, 0]
        s.name = "dam_price_eur_mwh"
        return s
    return make_synthetic_greek_dam_prices(start="2024-01-01", end="2025-12-31")


# ---------------------------------------------------------------------------
# Battery construction
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Scenario LP solver (scipy — no cvxpy)
# ---------------------------------------------------------------------------


def _solve_lp(
    prices: np.ndarray,
    battery: BatteryAsset,
    initial_soc_mwh: float,
) -> dict | None:
    """Solve 96-interval LP. Returns schedule + water values (LP dual variables).

    Variable layout  (3 × T = 288 entries):
        x[0 : T]       charge[t]  ≥ 0   MW
        x[T : 2T]      discharge[t] ≥ 0 MW
        x[2T : 3T]     soc[t+1]         MWh  (SoC at END of interval t)

    Equality constraint t  (SoC dynamics):
        soc[t+1] - soc[t] - η_c·charge[t]·Δt + discharge[t]·Δt/η_d = 0
    with soc[0] = initial_soc_mwh (known scalar, not a variable).

    The dual variables on these constraints are the water values:
        λ[t] = ∂(−profit)/∂b_eq[t]
    so  water_value[t] = −λ[t]  (extra energy at t → higher profit → lower −profit).
    """
    ec = battery.eta_charge
    ed = battery.eta_discharge
    deg = battery.cycle_cost_eur_per_mwh
    Pm = battery.power_mw
    smin = battery.soc_min_mwh
    smax = battery.soc_max_mwh
    e0 = float(initial_soc_mwh)

    n = 3 * T

    # Objective: minimise −profit
    obj = np.zeros(n)
    obj[:T] = (prices + deg) * DT       # charge: increases cost
    obj[T:2*T] = -(prices - deg) * DT   # discharge: earns revenue

    # Equality: SoC dynamics
    # Row t: x[2T+t] - x[2T+t-1] - ec·Δt·x[t] + Δt/ed·x[T+t] = 0
    # For t=0: x[2T] - ec·Δt·x[0] + Δt/ed·x[T] = e0   (since soc[0]=e0 moves to RHS)
    Aeq = np.zeros((T, n))
    beq = np.zeros(T)
    for t in range(T):
        Aeq[t, t] = -ec * DT           # −η_c·Δt·charge[t]
        Aeq[t, T + t] = DT / ed        # +Δt/η_d·discharge[t]
        Aeq[t, 2*T + t] = 1.0          # +soc[t+1]
        if t == 0:
            beq[t] = e0
        else:
            Aeq[t, 2*T + t - 1] = -1.0  # −soc[t]

    # Variable bounds
    bounds = (
        [(0.0, Pm)] * T           # charge
        + [(0.0, Pm)] * T         # discharge
        + [(smin, smax)] * T      # soc values
    )
    # Soft terminal SoC: within ±10 % of capacity of initial
    tol = 0.10 * battery.capacity_mwh
    lo = max(smin, e0 - tol)
    hi = min(smax, e0 + tol)
    bounds[3 * T - 1] = (lo, hi)

    # Inequality: daily cycle / throughput cap
    Aub = bub = None
    if battery.daily_cycle_limit is not None and battery.usable_capacity_mwh > 0:
        Aub = np.zeros((1, n))
        Aub[0, :T] = DT
        bub = np.array([battery.daily_cycle_limit * battery.usable_capacity_mwh])

    res = linprog(obj, A_ub=Aub, b_ub=bub, A_eq=Aeq, b_eq=beq,
                  bounds=bounds, method="highs")
    if res.status != 0:
        return None

    charge = np.clip(res.x[:T], 0.0, Pm)
    discharge = np.clip(res.x[T:2*T], 0.0, Pm)
    soc = np.concatenate([[e0], np.clip(res.x[2*T:3*T], smin, smax)])

    # Water values from LP duals
    # λ[t] = ∂f_min/∂b_eq[t]; water_value = −λ[t] (extra free MWh → lower −profit)
    floor = deg / ec + deg * ed
    raw_duals = getattr(res.eqlin, "marginals", None)
    if raw_duals is not None and len(raw_duals) == T:
        water_vals = np.maximum(-np.asarray(raw_duals, dtype=float), floor)
    else:
        # Fallback: price-derived estimate
        water_vals = np.maximum((prices - deg) * (ec * ed), floor)

    profit = float(
        np.sum(prices * (discharge - charge)) * DT
        - deg * np.sum(charge + discharge) * DT
    )
    cycles = (
        float(np.sum(charge) * DT / battery.usable_capacity_mwh)
        if battery.usable_capacity_mwh > 0
        else 0.0
    )

    return {
        "charge": charge,
        "discharge": discharge,
        "soc": soc,
        "water_vals": water_vals,
        "profit": profit,
        "cycles": cycles,
    }


# ---------------------------------------------------------------------------
# Scenario generation
# ---------------------------------------------------------------------------


def _generate_scenarios(
    forecast: np.ndarray,
    history: pd.Series,
    seed: int = 0,
) -> np.ndarray:
    """N_SCENARIOS price paths = median forecast + temporally correlated noise."""
    rng = np.random.default_rng(seed)

    # Estimate noise level from historical day-to-day volatility
    if len(history) >= 2 * T:
        diffs = history.values[T:] - history.values[:-T]  # day-on-day changes
        noise_std = float(np.std(diffs)) * 0.5
        noise_std = float(np.clip(noise_std, 8.0, 40.0))
    else:
        noise_std = 15.0

    # Draw independent noise then apply AR(1) smoothing for temporal correlation
    raw = rng.normal(0.0, noise_std, (N_SCENARIOS, T))
    alpha = 0.55  # correlation between adjacent 15-min intervals
    for t in range(1, T):
        raw[:, t] = alpha * raw[:, t - 1] + (1.0 - alpha) * raw[:, t]

    scenarios = np.clip(forecast[None, :] + raw, -50.0, 400.0)
    return scenarios


# ---------------------------------------------------------------------------
# Bid curve construction
# ---------------------------------------------------------------------------


def _build_bid_curves(
    wv_surface: np.ndarray,
    soc_mid_idx: int,
    battery: BatteryAsset,
) -> dict:
    """Translate water value surface into HEnEx-formatted stepwise bid curves.

    Returns dict {interval_index: list_of_steps}.
    Each step: {'action': 'buy'|'sell', 'price': float, 'quantity': float (MWh)}
    """
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

        p_sell = w_now / ed           # min price to discharge profitably
        p_buy = w_next * ec           # max price to charge (value of stored MWh next period)
        p_sell = max(p_sell, 0.0)
        p_buy = max(p_buy, 0.0)

        curves[t] = [
            # Buy (charge) steps — execute when price ≤ threshold
            {"action": "buy",  "price": round(p_buy * 1.05, 2), "quantity": round(qty_full * 0.5, 4)},
            {"action": "buy",  "price": round(p_buy,        2), "quantity": round(qty_full,       4)},
            # Sell (discharge) steps — execute when price ≥ threshold
            {"action": "sell", "price": round(p_sell * 0.95, 2), "quantity": round(qty_full * 0.5, 4)},
            {"action": "sell", "price": round(p_sell,         2), "quantity": round(qty_full,       4)},
        ]
    return curves


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def optimize(
    date: str,
    battery_specs: dict,
    progress_cb: Callable[[float, str], None] | None = None,
) -> dict:
    """Run the full BESS day-ahead bidding pipeline.

    Parameters
    ----------
    date : str
        Target delivery date, e.g. "2025-04-15".
    battery_specs : dict
        Keys: capacity_mwh, power_mw, rte_pct, soc_min_pct, soc_max_pct,
              deg_cost, max_cycles, initial_soc_pct.
    progress_cb : callable(float, str), optional
        Receives (fraction_complete 0–1, status_message).

    Returns
    -------
    dict  — all keys documented at top of module.
    """

    def _upd(pct: float, msg: str) -> None:
        if progress_cb:
            progress_cb(pct, msg)

    # ── 1. Load data ──────────────────────────────────────────────────
    _upd(0.05, "Loading market data…")
    prices_all = load_prices()

    target = pd.Timestamp(date)
    day_end = target + pd.Timedelta(days=1)

    history = prices_all[prices_all.index < target]
    actual_slice = prices_all[
        (prices_all.index >= target) & (prices_all.index < day_end)
    ]

    # ── 2. Forecast ───────────────────────────────────────────────────
    _upd(0.12, "Fitting price forecaster…")
    forecast: np.ndarray
    try:
        fc = SmartForecaster()
        fc.fit(history)
        forecast = fc.predict(target, history)
    except Exception:
        try:
            fc2 = NaiveForecaster()
            forecast = fc2.predict(target, history)
        except Exception:
            # Ultimate fallback: last available day
            last_day = history.iloc[-T:] if len(history) >= T else None
            forecast = last_day.values if last_day is not None else np.full(T, 100.0)

    forecast = np.asarray(forecast, dtype=float)
    if len(forecast) != T:
        forecast = np.resize(forecast, T)

    # ── 3. Monte Carlo scenarios ──────────────────────────────────────
    _upd(0.22, f"Sampling {N_SCENARIOS} Monte Carlo scenarios…")
    seed = int(target.timestamp()) % (2**31)
    scenarios = _generate_scenarios(forecast, history, seed=seed)

    # ── 4. Scenario LPs → water values ───────────────────────────────
    _upd(0.32, f"Solving {N_SCENARIOS} scenario LPs…")
    battery = _make_battery(battery_specs)
    initial_soc = battery.initial_soc_mwh

    all_duals: list[np.ndarray] = []
    all_profits: list[float] = []

    for i, sc in enumerate(scenarios):
        r = _solve_lp(sc, battery, initial_soc)
        if r is not None:
            all_duals.append(r["water_vals"])
            all_profits.append(r["profit"])
        if i % 20 == 19:
            _upd(0.32 + 0.28 * (i + 1) / N_SCENARIOS,
                 f"Solved {i + 1}/{N_SCENARIOS} scenario LPs…")

    _upd(0.62, "Aggregating water value surface…")

    # Base water value = scenario-average dual (robust estimate)
    if all_duals:
        w_base = np.mean(all_duals, axis=0)   # (T,)
    else:
        floor = battery.cycle_cost_eur_per_mwh / battery.eta_charge + \
                battery.cycle_cost_eur_per_mwh * battery.eta_discharge
        w_base = np.full(T, floor)

    # Build (T × K) surface: w decreases as SoC rises (diminishing marginal value)
    K = N_SOC_LEVELS
    wv_surface = np.zeros((T, K))
    for k in range(K):
        soc_frac = k / (K - 1)                     # 0 = empty, 1 = full
        multiplier = 1.0 + 0.35 * (1.0 - soc_frac) # 1.35 at empty, 1.0 at full
        wv_surface[:, k] = w_base * multiplier

    soc_pct_lo = battery.soc_min_pct * 100.0
    soc_pct_hi = battery.soc_max_pct * 100.0
    soc_levels_pct = np.linspace(soc_pct_lo, soc_pct_hi, K)

    # ── 5. Bid curves ─────────────────────────────────────────────────
    _upd(0.72, "Building HEnEx bid curves…")
    soc_mid = K // 2
    bid_curves = _build_bid_curves(wv_surface, soc_mid, battery)

    # ── 6. Main schedule on median forecast ───────────────────────────
    _upd(0.82, "Computing optimal dispatch schedule…")
    main_r = _solve_lp(forecast, battery, initial_soc)
    if main_r is None:
        main_r = {
            "charge": np.zeros(T),
            "discharge": np.zeros(T),
            "soc": np.full(T + 1, initial_soc),
            "profit": 0.0,
            "cycles": 0.0,
        }

    # ── 7. Perfect-foresight benchmark ────────────────────────────────
    _upd(0.91, "Computing perfect-foresight benchmark…")
    capture_rate: float | None = None
    if len(actual_slice) >= T:
        pf_r = _solve_lp(actual_slice.values[:T], battery, initial_soc)
        if pf_r is not None and pf_r["profit"] > 1e-6:
            capture_rate = float(
                np.clip(main_r["profit"] / pf_r["profit"] * 100.0, -200.0, 200.0)
            )

    _upd(1.0, "Done.")

    charge = main_r["charge"]
    discharge = main_r["discharge"]

    return {
        "forecast_prices": forecast,
        "scenario_prices": scenarios,
        "schedule": {
            "charge_mw": charge,
            "discharge_mw": discharge,
            "net_mw": discharge - charge,
        },
        "soc_trajectory": main_r["soc"],
        "water_value_surface": wv_surface,
        "soc_levels_pct": soc_levels_pct,
        "bid_curves": bid_curves,
        "expected_revenue": main_r["profit"],
        "capture_rate": capture_rate,
        "cycles": main_r["cycles"],
    }
