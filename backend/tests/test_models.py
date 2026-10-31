from app.config import Settings, get_settings
from app.models import (
    Current, DailyPoint, Forecast, HourlyPoint, Location,
)


def test_forecast_serializes_camel_case():
    f = Forecast(
        location=Location(lat=19.07, lon=72.87, timezone="Asia/Kolkata"),
        model="ecmwf_ifs025",
        generated_at=None,
        fetched_at="2026-10-31T10:00:00Z",
        stale=False,
        current=Current(time="2026-10-31T10:00", temp_c=30.0, feels_like_c=33.0,
                        humidity_pct=70, wind_kph=10.0, wind_dir_deg=180,
                        precip_mm=0.0, weather_code=1, is_day=True),
        hourly=[HourlyPoint(time="2026-10-31T10:00", temp_c=30.0, precip_prob_pct=None,
                            precip_mm=0.0, wind_kph=10.0, weather_code=1)],
        daily=[DailyPoint(date="2026-10-31", temp_max_c=33.0, temp_min_c=25.0,
                          precip_sum_mm=0.0, precip_prob_pct=None,
                          sunrise="2026-10-31T06:30", sunset="2026-10-31T18:00",
                          weather_code=1)],
        attribution="Open-Meteo",
    )
    dump = f.model_dump(by_alias=True)
    assert dump["fetchedAt"] == "2026-10-31T10:00:00Z"
    assert dump["current"]["tempC"] == 30.0
    assert dump["hourly"][0]["precipProbPct"] is None
    assert dump["generatedAt"] is None


def test_settings_read_env(monkeypatch):
    assert Settings().forecast_ttl_seconds == 1800
    monkeypatch.setenv("WEATHER_FORECAST_TTL_SECONDS", "60")
    assert Settings().forecast_ttl_seconds == 60
    assert get_settings().forecast_ttl_seconds == 60
