# HelleniFlex

> **Universal battery optimization for the Greek electricity market.**
> One framework, any asset, any day, any forecast.

![Optimal dispatch](docs/example_dispatch.png)

The Greek DAM moved to a **15-minute Market Time Unit** on 1 October 2025 and the first standalone batteries entered the market in **April 2026**. As renewable penetration rises, intraday price spreads widen and curtailment grows — creating a multi-billion-euro opportunity for storage to absorb cheap renewable energy and deliver it during scarcity hours.

**HelleniFlex** is a complete, production-ready optimization framework that decides when a battery should **charge, discharge, or stay idle** to maximize economic value while respecting every operational constraint. It works with **any asset specification** and runs on Day 1 of operation — no historical battery telemetry required.

---

## What it does

```
            ┌────────────────────────────────────────────────────────────┐
            │                                                            │
DAM prices ─┤              ┌──────────────────┐                          │
RES forecast├─────────────►│  Price forecast  │─────┐                    │
Load fcst   │              │  (Ridge / Naive  │     │                    │
Weather     │              │   / Oracle)      │     ▼                    │
TTF gas    ─┤              └──────────────────┘   ┌──────────────────┐   │
            │                                     │   MILP optimizer │   │
            │                                     │   (HiGHS / cvxpy)│   │
Asset specs ────────────────────────────────────► │                  │   │
            │                                     └────────┬─────────┘   │
            │                                              │             │
            │                                              ▼             │
            │                                     ┌──────────────────┐   │
            │                                     │   24h schedule   │   │
            │                                     │   + SoC + KPIs   │   │
            │                                     └──────────────────┘   │
            └────────────────────────────────────────────────────────────┘
```

Three pluggable modules, one clean abstraction:

| Module | Job | Implementation |
|---|---|---|
| `BatteryAsset` | Capture every spec the optimizer needs (power, capacity, η, SoC limits, cycle cap, degradation cost) | Validated dataclass + preset library |
| `BatteryOptimizer` | Solve the day-ahead dispatch problem | **MILP** in cvxpy → HiGHS solver, ~40 ms per day |
| `Backtester` | Roll the optimizer over history, settle at realised prices | Honest train/test separation by design |

Plus three forecasters — **Perfect Foresight** (oracle / upper bound), **Naive** (last-week baseline), and **Smart** (Ridge regression on lagged prices and calendar features) — that turn the deliverable into a story:

> **Smart forecaster captures 87% of perfect-foresight revenue. Even the naive baseline captures 80%. The optimizer is forecast-tolerant by design.**

---

## Why this design wins under data scarcity

The hackathon brief explicitly frames this as a **data-scarce problem** because Greek standalone batteries only began operating in test mode in April 2026 — there is no rich battery telemetry history to learn from. HelleniFlex solves this the right way:

1. **The optimizer is purely model-based.** Given asset specs and a price forecast, it computes the provably-optimal schedule from physics — zero historical battery data required. Works on Day 1.
2. **The forecaster needs only public market data.** DAM prices, day-ahead RES and load forecasts, weather — all available from HEnEx, IPTO, ENTSO-E and Open-Meteo. No proprietary telemetry.
3. **The asset abstraction is universal.** Swap in a 1 MW / 2 MWh asset, a 50 MW utility-scale block, or any specification in between — the same optimizer handles all of them.

This design also avoids the trap of reinforcement learning, which would need years of operational data Greece does not yet have.

---

## Quick start

```bash
git clone <this-repo>
cd helleniflex
pip install -r requirements.txt
python examples/quickstart.py
```

That's it. The quickstart generates 18 months of synthetic Greek DAM prices, optimizes a representative day, runs a 30-day backtest under three forecasters, and a battery-duration sensitivity sweep — in under a minute.

### Run on real data

```python
from helleniflex import (
    BatteryAsset, Backtester, SmartForecaster,
    fetch_entsoe_dam,
)

prices = fetch_entsoe_dam(
    start="2024-01-01", end="2025-12-31",
    api_token="<your_entsoe_token>", bidding_zone="GR",
)
battery = BatteryAsset(power_mw=10, capacity_mwh=20)  # 10 MW / 20 MWh asset
result = Backtester(battery, forecaster=SmartForecaster()).run(
    prices, start="2025-01-01", end="2025-12-31",
)
print(result.summary())
```

---

## The MILP formulation

For each timestep `t ∈ {0, ..., T−1}` (typically `T = 96` for a 15-min day):

**Decision variables**
- `p_c[t] ≥ 0` — charging power [MW]
- `p_d[t] ≥ 0` — discharging power [MW]
- `e[t+1] ∈ [E_min, E_max]` — stored energy [MWh]
- `z[t] ∈ {0, 1}` — 1 ⇒ charging, 0 ⇒ discharging

**Objective**

$$\max \quad \sum_t \lambda_t \cdot (p_d[t] - p_c[t]) \cdot \Delta t \;-\; c_\text{cyc} \cdot \sum_t (p_c[t] + p_d[t]) \cdot \Delta t$$

**Constraints**

- SoC dynamics: `e[t+1] = e[t] + η_c · p_c[t] · Δt − p_d[t] · Δt / η_d`
- Power gates: `p_c[t] ≤ P_max · z[t]`, `p_d[t] ≤ P_max · (1 − z[t])`
- Cyclic SoC: `e[T] = e[0]`
- Daily throughput: `Σ p_c[t] · Δt ≤ N_cyc · E_usable`

The binary `z[t]` matters: without it, simultaneous charge+discharge can be exploited as a revenue trick when prices are negative (the optimizer would burn energy through the round-trip loss to be paid for charging). With T ≤ 96 the MILP solves in milliseconds via [HiGHS](https://highs.dev).

---

## Demo dashboard

A live, interactive dashboard ships alongside the framework. Configure any battery asset with the sliders, pick a day, and watch the optimizer rebuild the schedule in real time.

[Launch the dashboard →](./dashboard) *(or open the React artifact in this repo)*

---

## Repository layout

```
helleniflex/
├── src/helleniflex/
│   ├── battery.py        # BatteryAsset dataclass + preset library
│   ├── optimizer.py      # MILP dispatch optimizer (cvxpy + HiGHS)
│   ├── forecaster.py     # Perfect / Naive / Smart forecasters
│   ├── backtester.py     # Daily-rolling backtester
│   └── data_loader.py    # Synthetic generator + HEnEx/ENTSO-E/Open-Meteo loaders
├── examples/quickstart.py
├── data/sample_dam_prices.csv
├── docs/example_dispatch.png
├── notebooks/demo.ipynb
└── tests/smoke_test.py
```

---

## Headline results (30-day backtest, 1 MW / 2 MWh asset)

| Forecaster | €/day | €/MWh/yr | % of Perfect Foresight |
|---|---:|---:|---:|
| Perfect Foresight (oracle) | 186 | 33,927 | 100% |
| **Smart (Ridge + calendar)** | **163** | **29,666** | **87.4%** |
| Naive (last-week) | 150 | 27,292 | 80.4% |

| Asset | €/day | €/MWh/yr |
|---|---:|---:|
| 1 MW / 1 MWh (1h duration) | 108 | 39,476 |
| 1 MW / 2 MWh (2h duration) | 186 | 33,927 |
| 1 MW / 4 MWh (4h duration) | 258 | 23,520 |

Shorter-duration batteries earn more **per MWh installed** because they cycle more aggressively against the same daily price spread; longer-duration batteries earn higher **absolute** revenue because they can capture multi-hour shoulders. This is exactly the trade-off real investors care about — and the framework lets you size the asset accordingly.

---

## Data sources

The framework ships with stubs and recipes for every source listed in the hackathon brief:

| Source | Used for | Loader |
|---|---|---|
| **HEnEx** | DAM market results & clearing prices | `fetch_henex_dam` (CSV recipe) |
| **IPTO (ADMIE)** | Day-ahead load + RES forecasts (exogenous features) | `fetch_ipto_load` (CSV recipe) |
| **ENTSO-E Transparency** | DAM prices + load + RES (one-stop API) | `fetch_entsoe_dam` (working) |
| **Open-Meteo** | Temperature, irradiance, wind speed | `fetch_openmeteo_weather` (working) |
| **TTF ICE / EEX EUA** | Gas + carbon as price drivers | document only — fold into `exog` |

For the hackathon submission, the `make_synthetic_greek_dam_prices` generator produces realistic 18-month price series offline so reviewers can run the full demo without API tokens.

---

## What we deliberately did **not** do

- ❌ **Reinforcement learning.** The data scarcity framing rules it out: there is no battery operational history to train on. RL would also be opaque to judges.
- ❌ **Intraday / ancillary markets.** The brief specifies DAM. We acknowledge multi-market arbitrage as the natural extension.
- ❌ **Fancy LSTM forecasts.** Ridge regression beats deep models on day-ahead price forecasting in published benchmarks, trains in milliseconds, and is fully interpretable.

---

## Roadmap

- Stochastic optimization with explicit price-forecast uncertainty bounds
- Co-optimization across DAM + Intraday + ancillary services (FCR, aFRR)
- Asset-aware degradation modelling (calendar + cycle aging, beyond throughput cost)
- Integration with HEnEx live API for real-time bid generation

---

## License

MIT.
