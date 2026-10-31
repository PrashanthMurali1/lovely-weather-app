from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import UpstreamRateLimited, UpstreamUnavailable
from app.main import create_app
from app.models import Forecast, Place

FORECAST = Forecast.model_validate(
    {
        "location": {"lat": 13.08, "lon": 80.28, "timezone": "Asia/Kolkata"},
        "model": "ecmwf_ifs025",
        "generatedAt": None,
        "fetchedAt": "2026-10-31T00:00:00Z",
        "stale": False,
        "current": {
            "time": "2026-10-31T00:00", "tempC": 30, "feelsLikeC": 33,
            "humidityPct": 70, "windKph": 10, "windDirDeg": 90, "precipMm": 0,
            "weatherCode": 1, "isDay": True,
        },
        "hourly": [],
        "daily": [],
        "attribution": "Weather data by Open-Meteo.com",
    }
)


class FakeService:
    def __init__(self):
        self.settings = Settings()
        self.budget = SimpleNamespace(count_today=lambda: 42)
        self.forecast_calls = []
        self.search_calls = []
        self.error = None

    async def get_forecast(self, lat, lon, model):
        self.forecast_calls.append((lat, lon, model))
        if self.error:
            raise self.error
        return FORECAST

    async def search(self, q):
        self.search_calls.append(q)
        if self.error:
            raise self.error
        return [Place(id=1, name="Chennai", admin="Tamil Nadu", lat=13.08, lon=80.28)]


@pytest.fixture
def svc():
    return FakeService()


@pytest.fixture
def client(svc):
    return TestClient(create_app(service=svc, settings=svc.settings))


def test_forecast_ok_has_cache_control_header(client):
    r = client.get("/api/forecast", params={"lat": 13.08, "lon": 80.28})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=300, stale-while-revalidate=600"
    assert r.json()["current"]["tempC"] == 30


def test_search_ok_has_cache_control_header(client):
    r = client.get("/api/search", params={"q": "chennai"})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=86400"
    assert r.json()["results"][0]["name"] == "Chennai"


@pytest.mark.parametrize("q", ["a", "   ", " a ", ""])
def test_search_one_char_is_422_with_error_shape(client, q):
    r = client.get("/api/search", params={"q": q})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_request"
    assert isinstance(r.json()["error"]["message"], str)


def test_search_missing_q_is_422(client):
    assert client.get("/api/search").status_code == 422


@pytest.mark.parametrize("lat,lon", [(91, 80), (-91, 80), (13, 181), (13, -181)])
def test_forecast_lat_out_of_range_is_422(client, lat, lon):
    r = client.get("/api/forecast", params={"lat": lat, "lon": lon})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_request"


def test_forecast_non_numeric_is_422(client):
    r = client.get("/api/forecast", params={"lat": "abc", "lon": 80})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_request"


@pytest.mark.parametrize("models", ["gfs", "", "ecmwf_ifs025,ecmwf_ifs025", "ecmwf_ifs025,gfs"])
def test_unknown_model_is_422(client, models):
    r = client.get("/api/forecast", params={"lat": 13, "lon": 80, "models": models})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_request"


def test_default_model_used_when_omitted(client, svc):
    client.get("/api/forecast", params={"lat": 13, "lon": 80})
    assert svc.forecast_calls == [(13.0, 80.0, "ecmwf_ifs025")]


def test_upstream_unavailable_is_502_error_shape(client, svc):
    svc.error = UpstreamUnavailable("http://secret.example/x failed")
    r = client.get("/api/forecast", params={"lat": 13, "lon": 80})
    assert r.status_code == 502
    body = r.json()
    assert body["error"]["code"] == "upstream_unavailable"
    assert "secret.example" not in r.text


def test_rate_limited_is_503_with_retry_after_header(client, svc):
    svc.error = UpstreamRateLimited(retry_after=120)
    r = client.get("/api/search", params={"q": "chennai"})
    assert r.status_code == 503
    assert r.headers["retry-after"] == "120"
    assert r.json()["error"]["code"] == "upstream_rate_limited"


def test_health_reports_budget(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {
        "status": "ok", "cache": "ok", "upstreamCallsToday": 42, "budget": 8000,
    }


def test_cors_allows_configured_origin(client):
    r = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    r = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_lifespan_runs_with_fake_service(svc):
    with TestClient(create_app(service=svc, settings=svc.settings)) as c:
        assert c.get("/api/health").status_code == 200
