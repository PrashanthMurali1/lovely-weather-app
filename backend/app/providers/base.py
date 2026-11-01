from typing import Protocol

from app.models import Cyclones, Forecast, Place, RadarFrames


class WeatherProvider(Protocol):
    async def search(self, q: str, limit: int = 8) -> list[Place]: ...

    async def forecast(self, lat: float, lon: float, model: str) -> Forecast: ...


class MapsProviderProtocol(Protocol):
    async def radar(self) -> RadarFrames: ...

    async def cyclones(self) -> Cyclones: ...
