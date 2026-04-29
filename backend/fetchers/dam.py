"""Day-Ahead Market prices: HEnEx primary, ENTSO-E fallback (set ENTSOE_TOKEN env)."""
import io
import os
import warnings
from datetime import date, timedelta

import requests


def fetch_dam() -> dict:
    for delta in range(3):
        d = date.today() - timedelta(days=delta)
        try:
            return _henex(d)
        except Exception:
            pass

    token = os.getenv("ENTSOE_TOKEN")
    if token:
        try:
            return _entsoe(date.today(), token)
        except Exception:
            pass

    raise RuntimeError("DAM fetch failed — try setting ENTSOE_TOKEN env var")


def _henex(d: date) -> dict:
    """Download HEnEx daily DAM results Excel."""
    import pandas as pd

    url = (
        f"https://www.enexgroup.gr/documents/{d.year}/{d.month:02d}/{d.day:02d}/"
        f"EL_DAM_Results_HourlyMarginalPrices_{d.strftime('%Y%m%d')}.xlsx"
    )
    r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        df = pd.read_excel(io.BytesIO(r.content), header=None)

    prices = _parse_henex(df)
    return {
        "date": d.isoformat(),
        "prices_eur_mwh": prices,
        "resolution_min": 60 if len(prices) <= 24 else 15,
        "currency": "EUR/MWh",
        "source": "HEnEx",
    }


def _parse_henex(df) -> list:
    import pandas as pd

    for col in df.columns:
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(s) >= 24 and s.between(-4000, 4000).all() and s.between(-500, 600).mean() > 0.9:
            return s.iloc[:96].round(2).tolist()
    raise ValueError("Price column not found in HEnEx Excel")


def _entsoe(d: date, token: str) -> dict:
    from entsoe import EntsoePandasClient
    import pandas as pd

    client = EntsoePandasClient(api_key=token)
    start = pd.Timestamp(d.isoformat(), tz="Europe/Athens")
    end = start + pd.Timedelta(days=1)
    s = client.query_day_ahead_prices("GR", start=start, end=end)
    return {
        "date": d.isoformat(),
        "prices_eur_mwh": s.round(2).tolist(),
        "resolution_min": 60,
        "currency": "EUR/MWh",
        "source": "ENTSO-E",
    }
