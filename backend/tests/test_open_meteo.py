import json
from pathlib import Path

import httpx
import pytest
import respx

from app.errors import UpstreamRateLimited, UpstreamUnavailable
from app.providers.open_meteo import OpenMeteoProvider

FIX = Path(__file__).parent / "fixtures"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"


def _load(name):
    return json.loads((FIX / name).read_text())


@pytest.fixture
async def provider():
    async with httpx.AsyncClient() as client:
        yield OpenMeteoProvider(client, timeout=5.0)


@respx.mock
async def test_forecast_normalizes_fields(provider):
    route = respx.get(FORECAST_URL).mock(return_value=httpx.Response(200, json=_load("forecast_ifs.json")))
    f = await provider.forecast(13.08, 80.27, "ecmwf_ifs025")
    assert f.current.temp_c == 28.4
    assert f.current.is_day is True
    assert f.current.time == "2026-10-31T09:15:00+05:30"
    assert len(f.hourly) == 48
    assert f.hourly[0].time == "2026-10-31T09:00:00+05:30"
    assert len(f.daily) == 7
    assert f.daily[0].date == "2026-10-31"
    assert f.daily[0].sunrise.endswith("+05:30")
    assert f.attribution == "Weather data by Open-Meteo.com (ECMWF IFS)"
    assert f.stale is False and f.generated_at is None
    assert f.location.timezone == "Asia/Kolkata"
    params = route.calls[0].request.url.params
    assert params["timezone"] == "Asia/Kolkata"
    assert params["forecast_days"] == "7"
    assert params["models"] == "ecmwf_ifs025"


@respx.mock
async def test_null_precip_probability_maps_to_none(provider):
    respx.get(FORECAST_URL).mock(return_value=httpx.Response(200, json=_load("forecast_ifs.json")))
    f = await provider.forecast(13.08, 80.27, "ecmwf_ifs025")
    assert f.hourly[1].precip_prob_pct is None  # 10:00 is null in fixture


@respx.mock
async def test_search_maps_places_and_sends_country_code(provider):
    route = respx.get(GEO_URL).mock(return_value=httpx.Response(200, json=_load("geocode_chennai.json")))
    places = await provider.search("Chennai")
    p = route.calls[0].request.url.params
    assert p["countryCode"] == "IN" and p["count"] == "8" and p["name"] == "Chennai"
    assert places[0].admin == "Tamil Nadu" and places[0].id == 1264527
    assert places[1].admin is None


@respx.mock
async def test_search_no_results_returns_empty_list(provider):
    respx.get(GEO_URL).mock(return_value=httpx.Response(200, json={"generationtime_ms": 0.1}))
    assert await provider.search("zzzz") == []


@respx.mock
async def test_429_raises_rate_limited(provider):
    respx.get(FORECAST_URL).mock(return_value=httpx.Response(429, headers={"Retry-After": "30"}))
    with pytest.raises(UpstreamRateLimited) as ei:
        await provider.forecast(1, 2, "ecmwf_ifs025")
    assert ei.value.retry_after == 30


@respx.mock
async def test_5xx_raises_unavailable(provider):
    respx.get(FORECAST_URL).mock(return_value=httpx.Response(503))
    with pytest.raises(UpstreamUnavailable):
        await provider.forecast(1, 2, "ecmwf_ifs025")


@respx.mock
async def test_network_error_retried_once_then_unavailable(provider):
    route = respx.get(FORECAST_URL).mock(side_effect=httpx.ConnectError("boom"))
    with pytest.raises(UpstreamUnavailable):
        await provider.forecast(1, 2, "ecmwf_ifs025")
    assert route.call_count == 2


@respx.mock
async def test_4xx_not_retried(provider):
    route = respx.get(FORECAST_URL).mock(return_value=httpx.Response(400, json={"error": True}))
    with pytest.raises(UpstreamUnavailable):
        await provider.forecast(1, 2, "ecmwf_ifs025")
    assert route.call_count == 1


@respx.mock
async def test_malformed_json_raises_unavailable(provider):
    data = _load("forecast_ifs.json")
    del data["hourly"]
    respx.get(FORECAST_URL).mock(return_value=httpx.Response(200, json=data))
    with pytest.raises(UpstreamUnavailable):
        await provider.forecast(1, 2, "ecmwf_ifs025")


@respx.mock
async def test_non_json_body_raises_unavailable(provider):
    respx.get(FORECAST_URL).mock(return_value=httpx.Response(200, text="<html>"))
    with pytest.raises(UpstreamUnavailable):
        await provider.forecast(1, 2, "ecmwf_ifs025")
