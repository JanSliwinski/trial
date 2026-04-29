"""TTF natural gas futures and EUA carbon price via yfinance + Ember Climate."""
import requests


# ---------------------------------------------------------------------------
# TTF natural gas
# ---------------------------------------------------------------------------

def fetch_ttf() -> dict:
    import yfinance as yf

    ticker = yf.Ticker("TTF=F")
    hist = ticker.history(period="30d", interval="1d")
    if hist.empty:
        raise RuntimeError("No TTF data from Yahoo Finance")

    closes = hist["Close"].dropna()
    return {
        "current_price": round(float(closes.iloc[-1]), 2),
        "currency": "EUR/MWh",
        "dates": [d.strftime("%Y-%m-%d") for d in closes.index],
        "prices": closes.round(2).tolist(),
        "ticker": "TTF=F",
        "source": "Yahoo Finance / ICE",
    }


# ---------------------------------------------------------------------------
# EUA carbon allowances
# ---------------------------------------------------------------------------

def fetch_eua() -> dict:
    try:
        return _eua_ember()
    except Exception:
        pass
    return _eua_yfinance()


def _eua_ember() -> dict:
    """Ember Climate free API — monthly EUA carbon price."""
    r = requests.get(
        "https://api.ember-climate.org/v2/carbon-price/monthly/",
        params={"region": "EU", "limit": 13},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json().get("data", [])
    if not data:
        raise RuntimeError("Empty Ember response")
    latest = data[-1]
    return {
        "current_price": round(float(latest["price_eur"]), 2),
        "currency": "EUR/tCO2",
        "dates": [d["date"] for d in data],
        "prices": [round(float(d["price_eur"]), 2) for d in data],
        "source": "Ember Climate",
    }


def _eua_yfinance() -> dict:
    import yfinance as yf

    for sym in ["EUA=F", "EUAS.L", "CEC=F"]:
        try:
            hist = yf.Ticker(sym).history(period="30d")
            if not hist.empty:
                closes = hist["Close"].dropna()
                return {
                    "current_price": round(float(closes.iloc[-1]), 2),
                    "currency": "EUR/tCO2",
                    "dates": [d.strftime("%Y-%m-%d") for d in closes.index],
                    "prices": closes.round(2).tolist(),
                    "ticker": sym,
                    "source": "Yahoo Finance",
                }
        except Exception:
            continue
    raise RuntimeError("EUA price unavailable")
