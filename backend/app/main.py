import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.budget import Budget
from app.cache import Cache
from app.config import Settings, get_settings
from app.errors import UpstreamRateLimited, UpstreamUnavailable
from app.providers.maps import MapsProvider
from app.providers.open_meteo import OpenMeteoProvider
from app.routes import router
from app.service import WeatherService

log = logging.getLogger(__name__)
PURGE_INTERVAL_SECONDS = 3600


def _error(status: int, code: str, message: str, headers: Optional[dict] = None):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


def _purge(service) -> None:
    cache = getattr(service, "cache", None)
    if cache is None:
        return
    try:
        cache.purge()
    except Exception:  # never let housekeeping crash the app
        log.exception("cache purge failed")


async def _purge_loop(service) -> None:
    while True:
        await asyncio.sleep(PURGE_INTERVAL_SECONDS)
        _purge(service)


def create_app(
    service: Optional[WeatherService] = None, settings: Optional[Settings] = None
) -> FastAPI:
    settings = settings or (service.settings if service is not None else get_settings())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        client = None
        svc = service
        if svc is None:
            client = httpx.AsyncClient()
            cache = Cache(
                settings.cache_path, retention_seconds=settings.stale_retention_seconds
            )
            budget = Budget(settings.cache_path, settings.daily_budget_soft_limit)
            provider = OpenMeteoProvider(client, settings.upstream_timeout_seconds)
            maps = MapsProvider(client, settings.upstream_timeout_seconds)
            svc = WeatherService(provider, cache, budget, settings, maps_provider=maps)
        app.state.service = svc
        _purge(svc)
        task = asyncio.create_task(_purge_loop(svc))
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            if client is not None:
                await client.aclose()

    app = FastAPI(lifespan=lifespan)
    if service is not None:
        # Available even when the lifespan has not run (e.g. plain TestClient).
        app.state.service = service

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        parts = []
        for e in exc.errors():
            loc = ".".join(str(p) for p in e.get("loc", ()) if p != "query")
            parts.append(f"{loc}: {e.get('msg', 'invalid')}" if loc else e.get("msg", "invalid"))
        return _error(422, "invalid_request", "; ".join(parts) or "invalid request")

    @app.exception_handler(UpstreamUnavailable)
    async def _unavailable(request: Request, exc: UpstreamUnavailable):
        return _error(502, "upstream_unavailable", "Weather data is temporarily unavailable.")

    @app.exception_handler(UpstreamRateLimited)
    async def _limited(request: Request, exc: UpstreamRateLimited):
        return _error(
            503,
            "upstream_rate_limited",
            "Weather provider is rate limited; try again shortly.",
            headers={"Retry-After": str(exc.retry_after)},
        )

    @app.exception_handler(Exception)
    async def _internal(request: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return _error(500, "internal_error", "Something went wrong.")

    return app


app = create_app()
