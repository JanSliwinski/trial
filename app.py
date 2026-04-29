"""
app.py — HelleniFlex BESS Day-Ahead Bidding Optimizer
Streamlit UI only. All model logic lives in pipeline.py.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

import pipeline

# ── Page config ───────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="HelleniFlex — BESS Optimizer",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Time labels ───────────────────────────────────────────────────────────────

_TIME_LABELS = [
    f"{h:02d}:{m:02d}" for h in range(24) for m in (0, 15, 30, 45)
]
_TIME_LABELS_97 = _TIME_LABELS + ["24:00"]

# ── Sidebar ───────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("## ⚡ HelleniFlex")
    st.caption("BESS Day-Ahead Bidding · Greek DAM (HEnEx)")
    st.divider()

    st.subheader("Target Delivery Date")
    target_date = st.date_input(
        "Delivery date",
        value=date(2025, 4, 15),
        min_value=date(2024, 1, 15),   # need ≥14 days history
        max_value=date(2025, 12, 30),
        label_visibility="collapsed",
    )

    st.subheader("Battery Specifications")

    capacity_mwh = st.number_input(
        "Nameplate capacity (MWh)", min_value=0.5, max_value=500.0,
        value=10.0, step=0.5,
    )
    power_mw = st.number_input(
        "Max charge / discharge power (MW)", min_value=0.1, max_value=250.0,
        value=5.0, step=0.5,
    )
    rte_pct = st.number_input(
        "Round-trip efficiency (%)", min_value=50.0, max_value=99.0,
        value=88.0, step=0.5,
    )

    col_soc1, col_soc2 = st.columns(2)
    with col_soc1:
        soc_min_pct = st.number_input(
            "SoC min (%)", min_value=0.0, max_value=49.0,
            value=10.0, step=1.0,
        )
    with col_soc2:
        soc_max_pct = st.number_input(
            "SoC max (%)", min_value=51.0, max_value=100.0,
            value=90.0, step=1.0,
        )

    deg_cost = st.number_input(
        "Degradation cost (EUR/MWh throughput)", min_value=0.0, max_value=50.0,
        value=5.0, step=0.5,
    )
    max_cycles = st.number_input(
        "Max cycles per day", min_value=0.5, max_value=10.0,
        value=2.0, step=0.5,
    )
    initial_soc_pct = st.number_input(
        "Starting SoC (%)", min_value=0.0, max_value=100.0,
        value=50.0, step=1.0,
    )

    st.divider()
    run_btn = st.button("🚀 Run optimisation", type="primary", use_container_width=True)

# ── Main panel header ─────────────────────────────────────────────────────────

st.markdown("# HelleniFlex — BESS Day-Ahead Bidding")
st.caption(
    "Stochastic water-value framework for the Greek Electricity Market  ·  "
    "Demo mode: 100 scenarios  ·  Production: 200"
)

# ── Input validation ──────────────────────────────────────────────────────────

def _validate() -> list[str]:
    errors = []
    if capacity_mwh <= 0:
        errors.append("Nameplate capacity must be positive.")
    if power_mw <= 0:
        errors.append("Max power must be positive.")
    if not (50 < rte_pct < 100):
        errors.append("Round-trip efficiency must be between 50% and 99%.")
    if soc_min_pct >= soc_max_pct:
        errors.append("SoC min must be strictly less than SoC max.")
    if not (soc_min_pct <= initial_soc_pct <= soc_max_pct):
        errors.append("Starting SoC must be within [SoC min, SoC max].")
    if deg_cost < 0:
        errors.append("Degradation cost cannot be negative.")
    if max_cycles <= 0:
        errors.append("Max cycles per day must be positive.")
    return errors


# ── Run pipeline ──────────────────────────────────────────────────────────────

if run_btn:
    errs = _validate()
    if errs:
        for e in errs:
            st.error(e)
        st.stop()

    specs = {
        "capacity_mwh": float(capacity_mwh),
        "power_mw": float(power_mw),
        "rte_pct": float(rte_pct),
        "soc_min_pct": float(soc_min_pct),
        "soc_max_pct": float(soc_max_pct),
        "deg_cost": float(deg_cost),
        "max_cycles": float(max_cycles),
        "initial_soc_pct": float(initial_soc_pct),
    }

    cache_key = f"result_{target_date}_{tuple(sorted(specs.items()))}"

    if cache_key not in st.session_state:
        progress_bar = st.progress(0.0)
        status_msg = st.empty()

        def _cb(pct: float, msg: str) -> None:
            progress_bar.progress(float(pct))
            status_msg.caption(msg)

        try:
            with st.spinner("Running 100 Monte Carlo scenarios…"):
                result = pipeline.optimize(str(target_date), specs, progress_cb=_cb)
            st.session_state[cache_key] = result
            st.session_state["_latest_result"] = result
            st.session_state["_latest_date"] = str(target_date)
        except Exception as exc:
            st.error(f"Pipeline error: {exc}")
            st.stop()
        finally:
            progress_bar.empty()
            status_msg.empty()
    else:
        result = st.session_state[cache_key]
        st.session_state["_latest_result"] = result
        st.session_state["_latest_date"] = str(target_date)
        st.toast("Loaded from cache — change inputs to re-run.", icon="✅")

# Show most recent result (persists through sidebar interactions)
_latest = st.session_state.get("_latest_result")
_latest_date = st.session_state.get("_latest_date", "")

if _latest is not None:
    result: dict = _latest

    # ── 1. Headline KPI row ───────────────────────────────────────────────────

    st.divider()
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric(
            "Expected Revenue",
            f"€{result['expected_revenue']:,.0f}",
            help="Net revenue from optimal dispatch on the median forecast, minus degradation cost.",
        )
    with col2:
        st.metric(
            "Charge / Discharge Cycles",
            f"{result['cycles']:.2f}",
            help="Equivalent full cycles (total charge throughput ÷ usable capacity).",
        )
    with col3:
        cr = result["capture_rate"]
        st.metric(
            "Capture Rate vs Perfect Foresight",
            f"{cr:.1f}%" if cr is not None else "N/A",
            help=(
                "Revenue on the median forecast ÷ revenue achievable with perfect knowledge "
                "of today's actual prices.  N/A when actual prices are unavailable."
            ),
        )

    # ── 2. Forecast price chart ───────────────────────────────────────────────

    st.divider()
    forecast = result["forecast_prices"]
    scenarios = result["scenario_prices"]
    p10 = np.percentile(scenarios, 10, axis=0)
    p90 = np.percentile(scenarios, 90, axis=0)

    fig_price = go.Figure()
    fig_price.add_trace(go.Scatter(
        x=_TIME_LABELS, y=p90,
        mode="lines", line={"color": "rgba(30,136,229,0)", "width": 0},
        showlegend=False, hoverinfo="skip",
    ))
    fig_price.add_trace(go.Scatter(
        x=_TIME_LABELS, y=p10,
        mode="lines", line={"color": "rgba(30,136,229,0)", "width": 0},
        fill="tonexty", fillcolor="rgba(30,136,229,0.18)",
        name="P10–P90 band",
    ))
    fig_price.add_trace(go.Scatter(
        x=_TIME_LABELS, y=forecast,
        mode="lines", line={"color": "#1E88E5", "width": 2.5},
        name="Median forecast",
    ))
    fig_price.add_hline(y=0, line_color="rgba(255,255,255,0.25)", line_width=1)
    fig_price.update_layout(
        title=f"Price Forecast · {_latest_date}  (100-scenario fan)",
        xaxis_title="Time of day",
        yaxis_title="Price (€/MWh)",
        height=340,
        template="plotly_dark",
        legend={"orientation": "h", "y": 1.12},
        margin={"t": 60, "b": 40},
    )
    st.plotly_chart(fig_price, use_container_width=True)

    # ── 3. Optimal schedule ───────────────────────────────────────────────────

    charge = result["schedule"]["charge_mw"]
    discharge = result["schedule"]["discharge_mw"]

    fig_sched = go.Figure()
    fig_sched.add_trace(go.Bar(
        x=_TIME_LABELS, y=-charge,
        name="Charge (−MW)", marker_color="#F4B942", opacity=0.9,
    ))
    fig_sched.add_trace(go.Bar(
        x=_TIME_LABELS, y=discharge,
        name="Discharge (+MW)", marker_color="#7ED321", opacity=0.9,
    ))
    fig_sched.add_hline(y=0, line_color="rgba(255,255,255,0.4)", line_width=1)
    fig_sched.update_layout(
        title="Optimal Charge / Discharge Schedule",
        xaxis_title="Time of day",
        yaxis_title="Power (MW)",
        barmode="overlay",
        height=300,
        template="plotly_dark",
        legend={"orientation": "h", "y": 1.12},
        margin={"t": 60, "b": 40},
    )
    st.plotly_chart(fig_sched, use_container_width=True)

    # ── 4. SoC trajectory ────────────────────────────────────────────────────

    soc_mwh = result["soc_trajectory"]
    soc_pct_arr = soc_mwh / capacity_mwh * 100.0

    fig_soc = go.Figure()
    fig_soc.add_hrect(
        y0=soc_min_pct, y1=soc_max_pct,
        fillcolor="rgba(30,136,229,0.10)", line_width=0,
        annotation_text="Usable range",
        annotation_position="bottom right",
        annotation_font_color="#aaa",
    )
    fig_soc.add_trace(go.Scatter(
        x=_TIME_LABELS_97, y=soc_pct_arr,
        mode="lines", line={"color": "#FF6B35", "width": 2.5},
        fill="tozeroy", fillcolor="rgba(255,107,53,0.12)",
        name="SoC",
    ))
    fig_soc.update_layout(
        title="State of Charge Trajectory",
        xaxis_title="Time of day",
        yaxis_title="SoC (%)",
        yaxis={"range": [0, 105]},
        height=270,
        template="plotly_dark",
        showlegend=False,
        margin={"t": 50, "b": 40},
    )
    st.plotly_chart(fig_soc, use_container_width=True)

    # ── 5. Bid curve preview ─────────────────────────────────────────────────

    st.divider()
    st.subheader("Bid Curve Preview")
    selected_label = st.select_slider(
        "Select 15-minute interval",
        options=_TIME_LABELS,
        value="12:00",
        label_visibility="collapsed",
    )
    t_idx = _TIME_LABELS.index(selected_label)
    bc = result["bid_curves"][t_idx]

    buy_steps = sorted(
        [s for s in bc if s["action"] == "buy"],
        key=lambda s: -s["price"],
    )
    sell_steps = sorted(
        [s for s in bc if s["action"] == "sell"],
        key=lambda s: s["price"],
    )

    def _step_curve(steps: list, ascending: bool) -> tuple[list, list]:
        """Build (x_qty, y_price) for a stepwise HEnEx curve."""
        prices_out, qtys_out = [0.0], [steps[0]["price"] if steps else 0.0]
        cum = 0.0
        for s in steps:
            qtys_out.append(cum)
            prices_out.append(s["price"])
            cum += s["quantity"]
            qtys_out.append(cum)
            prices_out.append(s["price"])
        return qtys_out, prices_out

    buy_x, buy_y = _step_curve(buy_steps, ascending=False)
    sell_x, sell_y = _step_curve(sell_steps, ascending=True)

    fig_bid = go.Figure()
    fig_bid.add_trace(go.Scatter(
        x=buy_x, y=buy_y,
        mode="lines+markers",
        line={"color": "#F4B942", "width": 2, "shape": "hv"},
        marker={"size": 7},
        name="Buy (charge)",
    ))
    fig_bid.add_trace(go.Scatter(
        x=sell_x, y=sell_y,
        mode="lines+markers",
        line={"color": "#7ED321", "width": 2, "shape": "hv"},
        marker={"size": 7},
        name="Sell (discharge)",
    ))
    fig_bid.update_layout(
        title=f"Stepwise Bid Curve · {selected_label}",
        xaxis_title="Quantity (MWh)",
        yaxis_title="Price (€/MWh)",
        height=300,
        template="plotly_dark",
        legend={"orientation": "h", "y": 1.12},
        margin={"t": 60, "b": 40},
    )
    st.plotly_chart(fig_bid, use_container_width=True)

    # ── 6. Water value surface ───────────────────────────────────────────────

    st.divider()
    st.subheader("Water Value Surface  w(t, SoC)")
    st.caption(
        "Core pipeline artifact. Each cell is the marginal economic value (€/MWh) "
        "of one additional MWh stored at that time and state of charge."
    )

    wv = result["water_value_surface"]          # (T, K)
    soc_labels = [f"{p:.0f}%" for p in result["soc_levels_pct"]]

    fig_wv = go.Figure(data=go.Heatmap(
        z=wv.T,                  # (K, T) — SoC on y-axis, time on x-axis
        x=_TIME_LABELS,
        y=soc_labels,
        colorscale="Viridis",
        colorbar={"title": "€/MWh", "titleside": "right"},
        hoverongaps=False,
        hovertemplate="Time: %{x}<br>SoC: %{y}<br>Water value: €%{z:.1f}/MWh<extra></extra>",
    ))
    fig_wv.update_layout(
        xaxis_title="Time of day",
        yaxis_title="State of Charge",
        height=400,
        template="plotly_dark",
        margin={"t": 30, "b": 60},
    )
    st.plotly_chart(fig_wv, use_container_width=True)

    # ── 7. Downloadable schedule ─────────────────────────────────────────────

    st.divider()
    df_dl = pd.DataFrame({
        "interval": _TIME_LABELS,
        "price_forecast_eur_mwh": np.round(forecast, 2),
        "charge_mw": np.round(charge, 4),
        "discharge_mw": np.round(discharge, 4),
        "net_mw": np.round(result["schedule"]["net_mw"], 4),
        "soc_mwh": np.round(soc_mwh[:96], 4),
        "soc_pct": np.round(soc_pct_arr[:96], 2),
    })

    st.download_button(
        label="📥  Download schedule as CSV",
        data=df_dl.to_csv(index=False),
        file_name=f"helleniflex_schedule_{_latest_date}.csv",
        mime="text/csv",
        use_container_width=False,
    )

# ── Landing page (no result yet) ──────────────────────────────────────────────

else:
    st.info(
        "Configure battery specifications in the sidebar, select a delivery date, "
        "and click **🚀 Run optimisation** to start."
    )

    with st.expander("How it works", expanded=True):
        st.markdown("""
| Layer | Component | What happens |
|-------|-----------|--------------|
| 1 | **Data** | Historical 15-min Greek DAM prices loaded from pre-cached parquet |
| 2 | **Forecast** | Ridge regression on calendar + lag features → median price path |
| 3 | **Monte Carlo** | 100 correlated price scenarios around the median |
| 4 | **Scenario LPs** | scipy LP for each scenario → optimal charge/discharge + dual variables |
| 5 | **Water Values** | Dual variables averaged → w(t, SoC) surface |
| 6 | **Bid Curves** | Water values → HEnEx-formatted stepwise price–quantity bids |

The output is a **policy** (bid curves), not a fixed schedule — the battery executes
optimally whatever price the market actually clears.
        """)

    st.markdown("---")
    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown("**Default battery specs**")
        st.markdown("""
- Capacity: 10 MWh
- Power: 5 MW  (2-hour duration)
- Round-trip efficiency: 88%
- Usable SoC: 10%–90%
- Degradation cost: €5/MWh
- Max cycles/day: 2
        """)
    with col_b:
        st.markdown("**Available date range**")
        st.markdown("""
- 2024-01-15 → 2025-12-30
- 15-minute resolution (96 intervals/day)
- Synthetic Greek DAM prices calibrated to
  2024–2025 observed market patterns
- Negative-price slots included (~3% of
  spring/summer midday intervals)
        """)
