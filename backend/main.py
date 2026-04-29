"""HelleniFlex Live Market Data Backend

FastAPI server with async background refresh for:
  - meteo   : Open-Meteo weather forecast (Athens)
  - dam     : HEnEx / ENTSO-E Day-Ahead Market prices
  - ttf     : TTF natural gas futures (Yahoo Finance)
  - eua     : EUA carbon price (Ember Climate / Yahoo Finance)
  - admie   : ADMIE/IPTO Greek grid load + RES forecast

Env vars:
  ENTSOE_TOKEN   — ENTSO-E API token (optional, improves DAM + ADMIE fallback)
  REFRESH_MINS   — data refresh interval in minutes (default 15)

Run:
  cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from fetchers.meteo import fetch_meteo
from fetchers.dam import fetch_dam
from fetchers.market import fetch_ttf, fetch_eua
from fetchers.admie import fetch_admie

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

REFRESH_INTERVAL = int(os.getenv("REFRESH_MINS", "15")) * 60
_FRONTEND = Path(__file__).parent.parent / "frontend"

# ── in-memory store ──────────────────────────────────────────────────────────
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


# ── app lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Initial data fetch…")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _refresh_all)
    task = asyncio.create_task(_scheduler())
    yield
    task.cancel()


app = FastAPI(title="HelleniFlex Live Data API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── API routes ────────────────────────────────────────────────────────────────
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


# ── serve frontend ────────────────────────────────────────────────────────────
@app.get("/")
def index():
    return FileResponse(_FRONTEND / "index.html")

if _FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=str(_FRONTEND)), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
