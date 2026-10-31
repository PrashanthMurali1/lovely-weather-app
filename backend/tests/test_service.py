import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.budget import Budget
from app.cache import Cache
from app.config import Settings
from app.errors import UpstreamRateLimited, UpstreamUnavailable
from app.models import Current, Forecast, Location, Place
from app.service import WeatherService, normalize_query

T0 = datetime(2026, 10, 31, 6, 0, tzinfo=timezone.utc)


def make_forecast(lat, lon, model):
    return Forecast(
        location=Location(lat=lat, lon=lon, timezone="Asia/Kolkata"),
        model=model,
        generated_at=None,
        fetched_at="2026-10-31T06:00:00Z",
        stale=False,
        current=Current(
            time="2026-10-31T11:30", temp_c=30.0, feels_like_c=33.0,
            humidity_pct=70, wind_kph=10.0, wind_dir_deg=90, precip_mm=0.0,
            weather_code=1, is_day=True,
        ),
        hourly=[],
        daily=[],
        attribution="test",
    )


class FakeProvider:
    def __init__(self):
        self.forecast_calls = []
        self.search_calls = []
        self.fail = None

    async def forecast(self, lat, lon, model):
        self.forecast_calls.append((lat, lon, model))
        await asyncio.sleep(0)
        if self.fail:
            raise self.fail
        return make_forecast(lat, lon, model)

    async def search(self, q, limit=8):
        self.search_calls.append(q)
        await asyncio.sleep(0)
        if self.fail:
            raise self.fail
        return [Place(id=1, name="Chennai", admin="Tamil Nadu", lat=13.08, lon=80.27)]


@pytest.fixture
def env(tmp_path):
    box = [T0]
    clock = lambda: box[0]
    p = str(tmp_path / "w.db")
    settings = Settings(daily_budget_soft_limit=100)
    cache = Cache(p, now=clock)
    budget = Budget(p, soft_limit=settings.daily_budget_soft_limit, now=clock)
    provider = FakeProvider()
    svc = WeatherService(provider, cache, budget, settings, now=clock)
    return svc, provider, box, cache, budget


def test_normalize_query():
    assert normalize_query("  New   DELHI ") == "new delhi"


async def test_second_call_uses_cache(env):
    svc, prov, *_ = env
    await svc.get_forecast(13.08, 80.27)
    f = await svc.get_forecast(13.08, 80.27)
    assert len(prov.forecast_calls) == 1
    assert f.stale is False


async def test_coordinates_rounded_share_cache(env):
    svc, prov, *_ = env
    await svc.get_forecast(13.081, 80.271)
    await svc.get_forecast(13.084, 80.269)
    assert prov.forecast_calls == [(13.08, 80.27, "ecmwf_ifs025")]


async def test_concurrent_requests_one_upstream_call(env):
    svc, prov, _, _, budget = env
    await asyncio.gather(*[svc.get_forecast(13.08, 80.27) for _ in range(10)])
    assert len(prov.forecast_calls) == 1
    assert budget.count_today() == 1
    assert svc._locks == {}


async def test_expired_entry_refreshes(env):
    svc, prov, box, *_ = env
    await svc.get_forecast(13.08, 80.27)
    box[0] += timedelta(seconds=svc.settings.forecast_ttl_seconds + 1)
    f = await svc.get_forecast(13.08, 80.27)
    assert len(prov.forecast_calls) == 2
    assert f.stale is False


@pytest.mark.parametrize("exc", [UpstreamUnavailable("x"), UpstreamRateLimited()])
async def test_upstream_failure_serves_stale(env, exc):
    svc, prov, box, *_ = env
    await svc.get_forecast(13.08, 80.27)
    box[0] += timedelta(seconds=svc.settings.forecast_ttl_seconds + 1)
    prov.fail = exc
    f = await svc.get_forecast(13.08, 80.27)
    assert f.stale is True
    assert len(prov.forecast_calls) == 2


async def test_upstream_failure_no_cache_raises(env):
    svc, prov, _, _, budget = env
    prov.fail = UpstreamUnavailable("down")
    with pytest.raises(UpstreamUnavailable):
        await svc.get_forecast(13.08, 80.27)
    assert budget.count_today() == 1  # attempts are counted
    assert svc._locks == {}


async def test_budget_exhausted_serves_stale_without_upstream_call(env):
    svc, prov, box, _, budget = env
    await svc.get_forecast(13.08, 80.27)
    box[0] += timedelta(seconds=svc.settings.forecast_ttl_seconds + 1)
    for _ in range(100):
        budget.increment()
    assert budget.exhausted()
    f = await svc.get_forecast(13.08, 80.27)
    assert f.stale is True
    assert len(prov.forecast_calls) == 1


async def test_budget_exhausted_and_no_cache_still_calls_upstream(env):
    svc, prov, _, _, budget = env
    for _ in range(100):
        budget.increment()
    f = await svc.get_forecast(13.08, 80.27)
    assert len(prov.forecast_calls) == 1
    assert f.stale is False


async def test_corrupt_cached_payload_is_a_miss(env):
    svc, prov, _, cache, _ = env
    cache.set("forecast:ecmwf_ifs025:13.08:80.27", {"bogus": 1}, 1000)
    await svc.get_forecast(13.08, 80.27)
    assert len(prov.forecast_calls) == 1


async def test_search_normalizes_query_key(env):
    svc, prov, *_ = env
    a = await svc.search(" CHENNAI ")
    b = await svc.search("chennai")
    assert prov.search_calls == ["chennai"]
    assert a == b and a[0].name == "Chennai"


async def test_search_failure_returns_expired_entry(env):
    svc, prov, box, *_ = env
    await svc.search("chennai")
    box[0] += timedelta(seconds=svc.settings.search_ttl_seconds + 1)
    prov.fail = UpstreamUnavailable("x")
    r = await svc.search("chennai")
    assert r[0].name == "Chennai"


async def test_search_failure_no_cache_raises(env):
    svc, prov, *_ = env
    prov.fail = UpstreamRateLimited()
    with pytest.raises(UpstreamRateLimited):
        await svc.search("chennai")
