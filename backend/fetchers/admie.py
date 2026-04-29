"""ADMIE/IPTO Greek grid data — load forecast, RES generation (ISP1 file).

Primary: ADMIE Web Transparency API (apps.admie.gr)
Fallback: ENTSO-E actual generation (requires ENTSOE_TOKEN env var)
"""
import os
from datetime import date, timedelta

import requests


def fetch_admie() -> dict:
    for delta in range(2):
        d = date.today() - timedelta(days=delta)
        try:
            return _admie_isp(d)
        except Exception:
            pass

    token = os.getenv("ENTSOE_TOKEN")
    if token:
        try:
            return _entsoe_gen(date.today(), token)
        except Exception:
            pass

    raise RuntimeError("ADMIE fetch failed — try setting ENTSOE_TOKEN env var")


def _admie_isp(d: date) -> dict:
    """Fetch ISP1 (Indicative System Plan) from ADMIE Web Transparency."""
    url = "https://apps.admie.gr/webtransparency/actions/getISP.php"
    params = {
        "DateFrom": d.strftime("%d/%m/%Y"),
        "DateTo": d.strftime("%d/%m/%Y"),
        "FileCategory": "ISP1",
    }
    r = requests.get(
        url, params=params, timeout=15, headers={"User-Agent": "Mozilla/5.0"}
    )
    r.raise_for_status()
    raw = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if not raw:
        raise RuntimeError("Empty or non-JSON ADMIE response")

    return _parse_isp(raw, d)


def _parse_isp(raw: dict, d: date) -> dict:
    """Parse ISP JSON into structured dict with load + RES series."""
    # ADMIE ISP1 JSON structure varies; attempt common formats
    hours = list(range(1, 25))
    load, wind, solar = [], [], []

    # Try flat array format
    if isinstance(raw, list):
        for row in raw:
            if isinstance(row, dict):
                load.append(float(row.get("load", row.get("Load", 0)) or 0))
                wind.append(float(row.get("wind", row.get("Wind", 0)) or 0))
                solar.append(float(row.get("solar", row.get("Solar", row.get("pv", 0))) or 0))

    # Try nested format
    if not load and "ISP" in raw:
        for row in raw["ISP"]:
            load.append(float(row.get("load_mw", 0) or 0))
            wind.append(float(row.get("wind_mw", 0) or 0))
            solar.append(float(row.get("solar_mw", 0) or 0))

    if not load:
        raise ValueError("Could not parse ADMIE ISP data")

    return {
        "date": d.isoformat(),
        "hours": hours[: len(load)],
        "load_mw": [round(v, 1) for v in load],
        "wind_mw": [round(v, 1) for v in wind],
        "solar_mw": [round(v, 1) for v in solar],
        "source": "ADMIE ISP1",
    }


def _entsoe_gen(d: date, token: str) -> dict:
    """ENTSO-E actual generation per type for Greece."""
    from entsoe import EntsoePandasClient
    import pandas as pd

    client = EntsoePandasClient(api_key=token)
    start = pd.Timestamp(d.isoformat(), tz="Europe/Athens")
    end = start + pd.Timedelta(days=1)
    df = client.query_generation("GR", start=start, end=end)

    # Aggregate renewable types
    solar = df.get("Solar", pd.Series(dtype=float)).resample("h").mean().fillna(0)
    wind_on = df.get("Wind Onshore", pd.Series(dtype=float)).resample("h").mean().fillna(0)
    wind_off = df.get("Wind Offshore", pd.Series(dtype=float)).resample("h").mean().fillna(0)
    wind = wind_on.add(wind_off, fill_value=0)

    load_df = client.query_load("GR", start=start, end=end)
    load = load_df.resample("h").mean().fillna(0)

    return {
        "date": d.isoformat(),
        "hours": list(range(1, len(load) + 1)),
        "load_mw": load.round(1).tolist(),
        "wind_mw": wind.reindex(load.index, fill_value=0).round(1).tolist(),
        "solar_mw": solar.reindex(load.index, fill_value=0).round(1).tolist(),
        "source": "ENTSO-E",
    }
