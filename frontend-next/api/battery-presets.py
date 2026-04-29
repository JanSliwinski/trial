"""Vercel Python serverless function — GET /api/battery-presets"""

from http.server import BaseHTTPRequestHandler
import json

PRESETS = [
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


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        payload = json.dumps(PRESETS).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        pass
