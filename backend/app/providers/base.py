from typing import Protocol

from app.models import Forecast, Place


class WeatherProvider(Protocol):
    async def search(self, q: str, limit: int = 8) -> list[Place]: ...

    async def forecast(self, lat: float, lon: float, model: str) -> Forecast: ...
