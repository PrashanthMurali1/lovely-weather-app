import asyncio
from datetime import datetime
from typing import Awaitable, Callable, Optional, TypeVar

from pydantic import ValidationError

from app.budget import Budget
from app.cache import Cache, CacheEntry, utcnow
from app.config import Settings
from app.errors import UpstreamRateLimited, UpstreamUnavailable
from app.models import DEFAULT_MODEL, Forecast, Place
from app.providers.base import WeatherProvider

T = TypeVar("T")


def normalize_query(q: str) -> str:
    return " ".join(q.split()).casefold()


class WeatherService:
    def __init__(
        self,
        provider: WeatherProvider,
        cache: Cache,
        budget: Budget,
        settings: Settings,
        now: Callable[[], datetime] = utcnow,
    ):
        self.provider = provider
        self.cache = cache
        self.budget = budget
        self.settings = settings
        self._now = now
        self._locks: dict[str, asyncio.Lock] = {}

    def _lock(self, key: str) -> asyncio.Lock:
        return self._locks.setdefault(key, asyncio.Lock())

    def _read(
        self, key: str, load: Callable[[dict], T]
    ) -> tuple[Optional[T], bool]:
        """Return (parsed value, is_fresh). Invalid payloads count as a miss."""
        entry: Optional[CacheEntry] = self.cache.get(key)
        if entry is None:
            return None, False
        try:
            value = load(entry.payload)
        except (ValidationError, KeyError, TypeError, ValueError):
            return None, False
        return value, entry.is_fresh(self._now())

    async def _cached(
        self,
        key: str,
        ttl: int,
        load: Callable[[dict], T],
        dump: Callable[[T], dict],
        fetch: Callable[[], Awaitable[T]],
        mark_stale: Callable[[T], T],
    ) -> T:
        value, fresh = self._read(key, load)
        if value is not None and fresh:
            return value
        async with self._lock(key):
            # Another caller may have refreshed while we waited for the lock.
            value, fresh = self._read(key, load)
            if value is not None and fresh:
                return value
            if value is not None and self.budget.exhausted():
                return mark_stale(value)
            try:
                self.budget.increment()
                result = await fetch()
            except (UpstreamUnavailable, UpstreamRateLimited):
                if value is not None:
                    return mark_stale(value)
                raise
            self.cache.set(key, dump(result), ttl)
            return result

    async def get_forecast(
        self, lat: float, lon: float, model: str = DEFAULT_MODEL
    ) -> Forecast:
        lat, lon = round(lat, 2), round(lon, 2)
        return await self._cached(
            key=f"forecast:{model}:{lat:.2f}:{lon:.2f}",
            ttl=self.settings.forecast_ttl_seconds,
            load=lambda p: Forecast.model_validate(p).model_copy(
                update={"stale": False}
            ),
            dump=lambda f: f.model_dump(mode="json", by_alias=True),
            fetch=lambda: self.provider.forecast(lat, lon, model),
            mark_stale=lambda f: f.model_copy(update={"stale": True}),
        )

    async def search(self, q: str) -> list[Place]:
        nq = normalize_query(q)
        return await self._cached(
            key=f"search:{nq}",
            ttl=self.settings.search_ttl_seconds,
            load=lambda p: [Place.model_validate(r) for r in p["results"]],
            dump=lambda places: {
                "results": [pl.model_dump(mode="json", by_alias=True) for pl in places]
            },
            fetch=lambda: self.provider.search(nq),
            mark_stale=lambda places: places,
        )
