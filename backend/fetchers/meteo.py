"""Open-Meteo weather forecast for Athens — free, no API key required."""
import requests


def fetch_meteo(lat: float = 37.97, lon: float = 23.73) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,windspeed_10m,weathercode,relative_humidity_2m",
        "hourly": "temperature_2m,windspeed_10m,shortwave_radiation,precipitation_probability,cloudcover",
        "forecast_days": 2,
        "timezone": "Europe/Athens",
    }
    r = requests.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=15)
    r.raise_for_status()
    d = r.json()
    return {
        "current": d.get("current", {}),
        "hourly": d["hourly"],
        "location": {"lat": lat, "lon": lon, "name": "Athens"},
        "source": "Open-Meteo",
    }
