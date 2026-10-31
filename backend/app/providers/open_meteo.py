from datetime import datetime, timedelta, timezone

import httpx
from pydantic import ValidationError

from app.errors import UpstreamRateLimited, UpstreamUnavailable
from app.models import Current, DailyPoint, Forecast, HourlyPoint, Location, Place

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ATTRIBUTION = "Weather data by Open-Meteo.com (ECMWF IFS)"
TIMEZONE = "Asia/Kolkata"
IST = timezone(timedelta(hours=5, minutes=30))

CURRENT_VARS = (
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,"
    "precipitation,weather_code,wind_speed_10m,wind_direction_10m"
)
HOURLY_VARS = "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m"
DAILY_VARS = (
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,"
    "precipitation_probability_max,sunrise,sunset"
)


def _iso(local: str) -> str:
    """Open-Meteo local time string (no offset) -> ISO 8601 with +05:30."""
    return datetime.fromisoformat(local).replace(tzinfo=IST).isoformat()


def _opt_int(v) -> int | None:
    return None if v is None else int(v)


class OpenMeteoProvider:
    def __init__(self, client: httpx.AsyncClient, timeout: float):
        self._client = client
        self._timeout = timeout

    async def _get_json(self, url: str, params: dict) -> dict:
        resp = None
        for attempt in range(2):
            try:
                resp = await self._client.get(url, params=params, timeout=self._timeout)
                break
            except httpx.TransportError as e:  # includes timeouts
                if attempt == 1:
                    raise UpstreamUnavailable(f"network error: {e!r}") from e
        assert resp is not None
        if resp.status_code == 429:
            try:
                retry_after = int(resp.headers.get("Retry-After", 60))
            except ValueError:
                retry_after = 60
            raise UpstreamRateLimited(retry_after=retry_after)
        if resp.status_code >= 400:
            raise UpstreamUnavailable(f"upstream status {resp.status_code}")
        try:
            data = resp.json()
        except ValueError as e:
            raise UpstreamUnavailable("invalid JSON from upstream") from e
        if not isinstance(data, dict):
            raise UpstreamUnavailable("unexpected JSON shape from upstream")
        return data

    async def search(self, q: str, limit: int = 8) -> list[Place]:
        data = await self._get_json(
            GEOCODE_URL,
            {"name": q, "count": limit, "language": "en", "countryCode": "IN"},
        )
        try:
            return [
                Place(
                    id=r["id"],
                    name=r["name"],
                    admin=r.get("admin1"),
                    lat=r["latitude"],
                    lon=r["longitude"],
                )
                for r in data.get("results") or []
            ]
        except (KeyError, ValueError, TypeError, ValidationError) as e:
            raise UpstreamUnavailable("malformed geocoding response") from e

    async def forecast(self, lat: float, lon: float, model: str) -> Forecast:
        data = await self._get_json(
            FORECAST_URL,
            {
                "latitude": lat,
                "longitude": lon,
                "models": model,
                "timezone": TIMEZONE,
                "forecast_days": 7,
                "current": CURRENT_VARS,
                "hourly": HOURLY_VARS,
                "daily": DAILY_VARS,
            },
        )
        try:
            return self._parse(data, lat, lon, model)
        except (KeyError, ValueError, TypeError, IndexError, ValidationError) as e:
            raise UpstreamUnavailable("malformed forecast response") from e

    @staticmethod
    def _parse(data: dict, lat: float, lon: float, model: str) -> Forecast:
        c = data["current"]
        cur = Current(
            time=_iso(c["time"]),
            temp_c=c["temperature_2m"],
            feels_like_c=c["apparent_temperature"],
            humidity_pct=c["relative_humidity_2m"],
            wind_kph=c["wind_speed_10m"],
            wind_dir_deg=c["wind_direction_10m"],
            precip_mm=c["precipitation"],
            weather_code=c["weather_code"],
            is_day=bool(c["is_day"]),
        )

        h = data["hourly"]
        hour_start = datetime.fromisoformat(c["time"]).replace(minute=0, second=0, microsecond=0)
        start = h["time"].index(hour_start.strftime("%Y-%m-%dT%H:%M"))
        idx = range(start, start + 48)
        hourly = [
            HourlyPoint(
                time=_iso(h["time"][i]),
                temp_c=h["temperature_2m"][i],
                precip_prob_pct=_opt_int(h["precipitation_probability"][i]),
                precip_mm=h["precipitation"][i],
                wind_kph=h["wind_speed_10m"][i],
                weather_code=h["weather_code"][i],
            )
            for i in idx
        ]

        d = data["daily"]
        daily = [
            DailyPoint(
                date=d["time"][i],
                temp_max_c=d["temperature_2m_max"][i],
                temp_min_c=d["temperature_2m_min"][i],
                precip_sum_mm=d["precipitation_sum"][i],
                precip_prob_pct=_opt_int(d["precipitation_probability_max"][i]),
                sunrise=_iso(d["sunrise"][i]),
                sunset=_iso(d["sunset"][i]),
                weather_code=d["weather_code"][i],
            )
            for i in range(len(d["time"]))
        ]
        if len(hourly) != 48 or not daily:
            raise ValueError("incomplete forecast")

        return Forecast(
            location=Location(lat=lat, lon=lon, timezone=TIMEZONE),
            model=model,
            generated_at=None,
            fetched_at=datetime.now(IST).isoformat(),
            stale=False,
            current=cur,
            hourly=hourly,
            daily=daily,
            attribution=ATTRIBUTION,
        )
