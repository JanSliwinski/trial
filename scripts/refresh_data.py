"""
Regenerate the cached price parquet file.
Run this manually before deploying to Streamlit Cloud:

    python scripts/refresh_data.py

The generated file (data/prices.parquet) is committed to the repo so assessors
never hit rate limits from live API calls during the demo.
"""

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Load data_loader directly to avoid triggering helleniflex/__init__.py (imports cvxpy)
def _load(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = m
    spec.loader.exec_module(m)
    return m

_dl = _load(ROOT / "helleniflex" / "src" / "helleniflex" / "data_loader.py")
make_synthetic_greek_dam_prices = _dl.make_synthetic_greek_dam_prices


def main() -> None:
    print("Generating synthetic Greek DAM price data …")
    prices = make_synthetic_greek_dam_prices(
        start="2024-01-01",
        end="2025-12-31",
        freq="15min",
        seed=42,
    )

    out = ROOT / "data" / "prices.parquet"
    out.parent.mkdir(exist_ok=True)
    prices.to_frame("dam_price_eur_mwh").to_parquet(out)

    print(f"Saved {len(prices):,} 15-min price points -> {out}")
    print(f"Date range : {prices.index[0].date()} → {prices.index[-1].date()}")
    print(f"Mean price : €{prices.mean():.1f}/MWh")
    print(f"Price range: €{prices.min():.1f} – €{prices.max():.1f}/MWh")
    print(f"Negative slots: {(prices < 0).sum()} ({(prices < 0).mean()*100:.1f}%)")


if __name__ == "__main__":
    main()
