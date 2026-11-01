from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="WEATHER_")

    cache_path: str = "data/weather.db"
    forecast_ttl_seconds: int = 1800
    search_ttl_seconds: int = 2592000
    radar_ttl_seconds: int = 120
    cyclone_ttl_seconds: int = 900
    stale_retention_seconds: int = 86400
    daily_budget_soft_limit: int = 8000
    upstream_timeout_seconds: float = 8.0
    failure_cooldown_seconds: int = 20
    allowed_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
