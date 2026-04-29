"""HelleniFlex Live Market Data + Optimization Backend

FastAPI server with:
  - Async background market data refresh (meteo, dam, ttf, eua, admie)
  - POST /api/optimize  — full BESS day-ahead bidding pipeline
  - GET  /api/battery-presets — available battery presets
  - GET  /api/status, /api/all, /api/{source}

Env vars:
  ENTSOE_TOKEN   — ENTSO-E API token (optional)
  REFRESH_MINS   — data refresh interval in minutes (default 15)
  FRONTEND_URL   — allowed CORS origin (default *)

Run:
  cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import asyncio
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
import os

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Make pipeline.py importable (it lives one level up from backend/)
_BACKEND_DIR = Path(__file__).parent
_ROOT = _BACKEND_DIR.parent
sys.path.insert(0, str(_ROOT))
import pipeline

from fetchers.meteo import fetch_meteo
from fetchers.dam import fetch_dam
from fetchers.market import fetch_ttf, fetch_eua
from fetchers.admie import fetch_admie

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

REFRESH_INTERVAL = int(os.getenv("REFRESH_MINS", "15")) * 60
_FRONTEND = _ROOT / "frontend"

# ── in-memory market data store ───────────────────────────────────────────────
_store: dict = {}


def _refresh_all() -> None:
    jobs = {
        "meteo": fetch_meteo,
        "dam": fetch_dam,
        "ttf": fetch_ttf,
        "eua": fetch_eua,
        "admie": fetch_admie,
    }
    for name, fn in jobs.items():
        try:
            _store[name] = {"ok": True, "data": fn()}
            log.info("  ✓ %s", name)
        except Exception as exc:
            log.warning("  ✗ %s: %s", name, exc)
            prev = _store.get(name, {})
            _store[name] = {**prev, "ok": False, "error": str(exc)}
    _store["_updated_at"] = time.time()


async def _scheduler() -> None:
    while True:
        log.info("Refreshing market data…")
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _refresh_all)
        log.info("Refresh done. Next in %d min.", REFRESH_INTERVAL // 60)
        await asyncio.sleep(REFRESH_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Initial data fetch…")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _refresh_all)
    task = asyncio.create_task(_scheduler())
    yield
    task.cancel()


app = FastAPI(title="HelleniFlex API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Pydantic models ───────────────────────────────────────────────────────────

class BatterySpecs(BaseModel):
    capacity_mwh: float = Field(10.0, gt=0, le=500)
    power_mw: float = Field(5.0, gt=0, le=250)
    rte_pct: float = Field(88.0, gt=50, lt=100)
    soc_min_pct: float = Field(10.0, ge=0, lt=50)
    soc_max_pct: float = Field(90.0, gt=50, le=100)
    deg_cost: float = Field(5.0, ge=0, le=50)
    max_cycles: float = Field(2.0, gt=0, le=10)
    initial_soc_pct: float = Field(50.0, ge=0, le=100)


class OptimizeRequest(BaseModel):
    date: str
    battery_specs: BatterySpecs


# ── Numpy serializer ──────────────────────────────────────────────────────────

def _serialize(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize(i) for i in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    return obj


# ── Optimization endpoint ─────────────────────────────────────────────────────

@app.post("/api/optimize")
async def run_optimize(req: OptimizeRequest):
    specs = req.battery_specs.model_dump()
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(None, pipeline.optimize, req.date, specs)
        return _serialize(result)
    except Exception as exc:
        log.error("Optimize error: %s", exc)
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── Battery presets endpoint ──────────────────────────────────────────────────

@app.get("/api/battery-presets")
def battery_presets():
    return [
        {
            "name": "Greek 1-hour BESS",
            "specs": {
                "capacity_mwh": 5.0, "power_mw": 5.0, "rte_pct": 88.0,
                "soc_min_pct": 10.0, "soc_max_pct": 90.0,
                "deg_cost": 5.0, "max_cycles": 2.0, "initial_soc_pct": 50.0,
            },
        },
        {
            "name": "Greek 2-hour BESS",
            "specs": {
                "capacity_mwh": 10.0, "power_mw": 5.0, "rte_pct": 88.0,
                "soc_min_pct": 10.0, "soc_max_pct": 90.0,
                "deg_cost": 5.0, "max_cycles": 2.0, "initial_soc_pct": 50.0,
            },
        },
        {
            "name": "Greek 4-hour BESS",
            "specs": {
                "capacity_mwh": 20.0, "power_mw": 5.0, "rte_pct": 88.0,
                "soc_min_pct": 10.0, "soc_max_pct": 90.0,
                "deg_cost": 5.0, "max_cycles": 2.0, "initial_soc_pct": 50.0,
            },
        },
        {
            "name": "Utility 50 MW / 2h",
            "specs": {
                "capacity_mwh": 100.0, "power_mw": 50.0, "rte_pct": 90.0,
                "soc_min_pct": 5.0, "soc_max_pct": 95.0,
                "deg_cost": 3.0, "max_cycles": 2.0, "initial_soc_pct": 50.0,
            },
        },
    ]


# ── Market data endpoints ─────────────────────────────────────────────────────

@app.get("/api/status")
def status():
    updated = _store.get("_updated_at")
    return {
        "updated_at": updated,
        "updated_ago_s": round(time.time() - updated, 1) if updated else None,
        "refresh_interval_s": REFRESH_INTERVAL,
        "sources": {k: v.get("ok") for k, v in _store.items() if not k.startswith("_")},
    }


@app.get("/api/all")
def get_all():
    payload = {
        k: v.get("data") if v.get("ok") else {"error": v.get("error")}
        for k, v in _store.items()
        if not k.startswith("_")
    }
    payload["_updated_at"] = _store.get("_updated_at")
    return payload


@app.get("/api/{source}")
def get_source(source: str):
    if source not in _store:
        return JSONResponse({"error": "unknown source"}, status_code=404)
    entry = _store[source]
    if entry.get("ok"):
        return entry["data"]
    return JSONResponse({"error": entry.get("error", "fetch failed")}, status_code=503)


# ── Serve static frontend ─────────────────────────────────────────────────────

@app.get("/")
def index():
    index_html = _FRONTEND / "index.html"
    if index_html.exists():
        return FileResponse(index_html)
    return {"message": "HelleniFlex API v2.0 — see /docs"}

if _FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=str(_FRONTEND)), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
