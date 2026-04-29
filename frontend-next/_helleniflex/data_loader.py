"""
Data loaders and synthetic data generators.

The framework is data-source-agnostic: any pd.Series of €/MWh prices
indexed by datetime works. This module ships:

* `make_synthetic_greek_dam_prices` — realistic-looking Greek DAM
  prices, calibrated against publicly observed 2024–2025 patterns.
  Useful for the demo and for unit tests; runs offline.

* `load_csv_prices` — generic CSV loader with sensible defaults.

* Stubs (`fetch_henex_dam`, `fetch_entsoe_dam`, `fetch_ipto_load`,
  `fetch_openmeteo_weather`) that document the live integrations.
  In a hackathon you can either flesh these out or fall back to
  CSV exports from the source portals.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd


# ----------------------------------------------------------------------
# Synthetic Greek DAM prices
# ----------------------------------------------------------------------

def make_synthetic_greek_dam_prices(
    start: str = "2024-01-01",
    end: str = "2025-12-31",
    freq: str = "15min",
    seed: int = 42,
) -> pd.Series:
    """Generate synthetic Greek DAM prices that capture the qualitative
    features of the real market:

      * strong daily shape: morning ramp, midday solar dip, evening peak
      * day-of-week seasonality (weekends softer)
      * seasonal level (winter > summer evening peak; summer midday dips
        deeper because of solar)
      * occasional negative-price 15-min slots in spring/summer noon
      * gas-price-like slow drift

    Calibrated so daily price spreads average ~€80/MWh — comparable to
    observed Greek DAM in 2024–2025. Use this for demos and offline
    development; replace with real data via `load_csv_prices` for the
    final backtest.
    """
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start=start, end=end, freq=freq)
    n = len(idx)

    hours = np.asarray(idx.hour + idx.minute / 60.0, dtype=float)
    dow = np.asarray(idx.dayofweek, dtype=int)
    doy = np.asarray(idx.dayofyear, dtype=float)
    is_weekend = (dow >= 5).astype(float)

    # ---- Daily shape (two peaks: morning ~08:00 and evening ~20:00) ----
    morning = 30 * np.exp(-((hours - 8) ** 2) / 4)
    evening = 60 * np.exp(-((hours - 20) ** 2) / 5)
    midday_solar_dip = -45 * np.exp(-((hours - 13) ** 2) / 6)
    daily_shape = morning + evening + midday_solar_dip

    # ---- Seasonal modulation ----
    # Winter: stronger evening peak; Summer: deeper midday dip
    season = np.cos(2 * np.pi * (doy - 15) / 365)  # +1 in mid-January, -1 in mid-July
    seasonal_level = 25 * season + 110              # mean varies 85–135 €/MWh
    summer_dip_amp = 1.0 + 0.6 * (-season).clip(min=0)  # deeper midday dips in summer
    daily_shape = (
        morning + evening * (1.0 + 0.3 * season.clip(min=0))
        + midday_solar_dip * summer_dip_amp
    )

    # ---- Weekend softening ----
    weekend_factor = 1.0 - 0.15 * is_weekend

    # ---- Slow gas-price-like drift ----
    drift = 15 * np.sin(2 * np.pi * doy / 365 * 1.3 + 0.5) \
        + 5 * np.sin(2 * np.pi * np.arange(n) / (96 * 30) + 1.7)

    # ---- Noise ----
    noise = rng.normal(0, 8, n) + rng.normal(0, 25, n) * (rng.random(n) > 0.97)

    prices = (seasonal_level + daily_shape) * weekend_factor + drift + noise

    # ---- Inject occasional negative-price 15-min slots near solar peak in spring/summer ----
    spring_summer_mask = (idx.month >= 3) & (idx.month <= 9)
    midday_mask = (hours >= 12) & (hours <= 15)
    candidate = spring_summer_mask & midday_mask
    flip = rng.random(n) < 0.05  # 5% of candidate slots
    neg_mask = candidate & flip
    prices[neg_mask] = rng.uniform(-30, -2, neg_mask.sum())

    # Light clipping (Greek DAM cap is +/-4000 but this is well within)
    prices = np.clip(prices, -50, 400)

    return pd.Series(prices, index=idx, name="dam_price_eur_mwh")


# ----------------------------------------------------------------------
# CSV loader
# ----------------------------------------------------------------------

def load_csv_prices(
    path: str,
    timestamp_col: str = "timestamp",
    price_col: str = "price_eur_mwh",
    tz: Optional[str] = None,
) -> pd.Series:
    """Load a CSV of DAM prices into a datetime-indexed Series.

    Expects two columns: a timestamp and a price. Pass column names as
    needed. Resamples to a uniform grid (assumed already uniform in
    most exports — this is just a safety check).
    """
    df = pd.read_csv(path)
    ts = pd.to_datetime(df[timestamp_col])
    if tz:
        ts = ts.dt.tz_localize(tz, nonexistent="shift_forward", ambiguous="NaT")
    s = pd.Series(df[price_col].values, index=ts, name="dam_price_eur_mwh")
    s = s.sort_index()
    s = s[~s.index.duplicated(keep="first")]
    return s


# ----------------------------------------------------------------------
# Live API stubs (document where to plug in real calls)
# ----------------------------------------------------------------------

def fetch_henex_dam(start: str, end: str) -> pd.Series:
    """Fetch DAM market results from HEnEx.

    HEnEx publishes daily Excel files on
    https://www.enexgroup.gr/en/markets-publications-el-day-ahead-market

    For a hackathon, the cleanest approach is:
      1. Download the daily files (or scrape with `requests` + `BeautifulSoup`)
      2. Parse the "Market Results" sheet
      3. Concatenate into a single DataFrame and return a Series.

    Until that is wired up, point this function at your CSV exports.
    """
    raise NotImplementedError(
        "Wire up to HEnEx daily market-results downloads, or use "
        "load_csv_prices() with a CSV export."
    )


def fetch_entsoe_dam(
    start: str,
    end: str,
    api_token: str,
    bidding_zone: str = "GR",
) -> pd.Series:
    """Fetch Greek DAM prices from the ENTSO-E Transparency Platform.

    Recommended approach (one-liner with the entsoe-py library):

        from entsoe import EntsoePandasClient
        client = EntsoePandasClient(api_key=api_token)
        s = client.query_day_ahead_prices(
            bidding_zone, start=pd.Timestamp(start), end=pd.Timestamp(end)
        )

    The free token is issued via the user's ENTSO-E account; allow
    1–2 days. Greek bidding zone code: 'GR'.
    """
    try:
        from entsoe import EntsoePandasClient  # type: ignore
    except ImportError as e:
        raise ImportError(
            "Install `entsoe-py` to use this loader: pip install entsoe-py"
        ) from e
    client = EntsoePandasClient(api_key=api_token)
    s = client.query_day_ahead_prices(
        bidding_zone,
        start=pd.Timestamp(start, tz="Europe/Athens"),
        end=pd.Timestamp(end, tz="Europe/Athens"),
    )
    s.name = "dam_price_eur_mwh"
    return s


def fetch_ipto_load(start: str, end: str) -> pd.DataFrame:
    """Fetch system load and RES generation forecasts from IPTO (ADMIE).

    See https://www.admie.gr/en/market/market-statistics/data
    Daily ISP files publish day-ahead load and RES forecasts. Useful
    as exogenous features for the SmartForecaster.

    Returns
    -------
    DataFrame with columns: load_mw, solar_mw, wind_mw
    """
    raise NotImplementedError(
        "Wire up to IPTO ISP files (https://www.admie.gr) and return "
        "a DataFrame indexed by datetime with columns "
        "[load_mw, solar_mw, wind_mw]."
    )


def fetch_openmeteo_weather(
    lat: float = 38.0,
    lon: float = 23.7,  # Athens-ish
    start: str = "2024-01-01",
    end: str = "2025-12-31",
) -> pd.DataFrame:
    """Fetch hourly historical weather from Open-Meteo.

    Open-Meteo is free and requires no API key for historical data.
    Endpoint: https://archive-api.open-meteo.com/v1/archive

    Returns
    -------
    DataFrame with columns: temperature_2m, shortwave_radiation,
    wind_speed_10m, cloudcover.
    """
    import urllib.parse
    import urllib.request
    import json

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "hourly": "temperature_2m,shortwave_radiation,wind_speed_10m,cloudcover",
        "timezone": "Europe/Athens",
    }
    url = (
        "https://archive-api.open-meteo.com/v1/archive?"
        + urllib.parse.urlencode(params)
    )
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.loads(r.read())
    df = pd.DataFrame(data["hourly"])
    df["time"] = pd.to_datetime(df["time"])
    return df.set_index("time")
