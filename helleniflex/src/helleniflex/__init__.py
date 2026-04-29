"""HelleniFlex — universal battery optimization for the Greek electricity market.

Quick start
-----------
>>> from helleniflex import (
...     BatteryAsset, BatteryOptimizer, Backtester,
...     PerfectForesightForecaster, NaiveForecaster, SmartForecaster,
...     make_synthetic_greek_dam_prices,
... )
>>> prices = make_synthetic_greek_dam_prices()
>>> battery = BatteryAsset(power_mw=1.0, capacity_mwh=2.0)
>>> bt = Backtester(battery, forecaster=PerfectForesightForecaster())
>>> result = bt.run(prices, start="2025-01-01", end="2025-01-31")
>>> print(result.summary())
"""

from .battery import BatteryAsset, PRESETS
from .optimizer import BatteryOptimizer, DispatchResult
from .forecaster import (
    PerfectForesightForecaster,
    NaiveForecaster,
    SmartForecaster,
)
from .backtester import Backtester, BacktestResult
from .data_loader import (
    make_synthetic_greek_dam_prices,
    load_csv_prices,
    fetch_entsoe_dam,
    fetch_openmeteo_weather,
)

__version__ = "0.1.0"

__all__ = [
    "BatteryAsset",
    "PRESETS",
    "BatteryOptimizer",
    "DispatchResult",
    "PerfectForesightForecaster",
    "NaiveForecaster",
    "SmartForecaster",
    "Backtester",
    "BacktestResult",
    "make_synthetic_greek_dam_prices",
    "load_csv_prices",
    "fetch_entsoe_dam",
    "fetch_openmeteo_weather",
]
