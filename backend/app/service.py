import asyncio
import logging
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Awaitable, Callable, Optional, TypeVar

from pydantic import ValidationError

from app.budget import Budget
from app.cache import Cache, CacheEntry, utcnow
from app.config import Settings
from app.errors import UpstreamRateLimited, UpstreamUnavailable
from app.models import DEFAULT_MODEL, Cyclones, Forecast, Place, RadarFrames
from app.providers.base import MapsProviderProtocol, WeatherProvider

T = TypeVar("T")
log = logging.getLogger(__name__)


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
        monotonic: Callable[[], float] = time.monotonic,
        maps_provider: Optional[MapsProviderProtocol] = None,
    ):
        self.provider = provider
        self.maps_provider = maps_provider
        self.cache = cache
        self.budget = budget
        self.settings = settings
        self._now = now
        self._monotonic = monotonic
        # key -> (monotonic timestamp, exception); pruned on insert so it stays bounded.
        self._failures: dict[str, tuple[float, Exception]] = {}
        # key -> [lock, waiters]; entries exist only while a call is in flight.
        self._locks: dict[str, list] = {}

    @asynccontextmanager
    async def _lock(self, key: str):
        slot = self._locks.get(key)
        if slot is None:
            slot = self._locks[key] = [asyncio.Lock(), 0]
        slot[1] += 1
        try:
            async with slot[0]:
                yield
        finally:
            slot[1] -= 1
            if slot[1] == 0:
                del self._locks[key]

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
            failure = self._failures.get(key)
            if failure is not None:
                if self._monotonic() - failure[0] < self.settings.failure_cooldown_seconds:
                    if value is not None:
                        return mark_stale(value)
                    raise failure[1]
                del self._failures[key]
            if value is not None and self.budget.exhausted():
                return mark_stale(value)
            try:
                self.budget.increment()
                result = await fetch()
            except (UpstreamUnavailable, UpstreamRateLimited) as exc:
                self._record_failure(key, exc)
                if value is not None:
                    return mark_stale(value)
                raise
            self._failures.pop(key, None)
            try:
                self.cache.set(key, dump(result), ttl)
            except (sqlite3.Error, OSError):
                log.exception("cache write failed for %s", key)
            return result

    def _record_failure(self, key: str, exc: Exception) -> None:
        now = self._monotonic()
        cooldown = self.settings.failure_cooldown_seconds
        self._failures = {
            k: v for k, v in self._failures.items() if now - v[0] < cooldown
        }
        self._failures[key] = (now, exc)

    async def get_forecast(
        self, lat: float, lon: float, model: str = DEFAULT_MODEL
    ) -> Forecast:
        lat, lon = round(lat, 2) + 0.0, round(lon, 2) + 0.0  # + 0.0 turns -0.0 into 0.0
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

    async def get_radar(self) -> RadarFrames:
        provider = self._maps()
        return await self._cached(
            key="radar:frames",
            ttl=self.settings.radar_ttl_seconds,
            load=lambda p: RadarFrames.model_validate(p).model_copy(update={"stale": False}),
            dump=lambda r: r.model_dump(mode="json", by_alias=True),
            fetch=provider.radar,
            mark_stale=lambda r: r.model_copy(update={"stale": True}),
        )

    async def get_cyclones(self) -> Cyclones:
        provider = self._maps()
        return await self._cached(
            key="cyclones:nio",
            ttl=self.settings.cyclone_ttl_seconds,
            load=lambda p: Cyclones.model_validate(p).model_copy(update={"stale": False}),
            dump=lambda c: c.model_dump(mode="json", by_alias=True),
            fetch=provider.cyclones,
            mark_stale=lambda c: c.model_copy(update={"stale": True}),
        )

    def _maps(self) -> MapsProviderProtocol:
        if self.maps_provider is None:
            raise UpstreamUnavailable("map data is not configured")
        return self.maps_provider

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
