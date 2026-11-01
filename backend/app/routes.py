from fastapi import APIRouter, Query, Request, Response
from fastapi.exceptions import RequestValidationError

from app.models import ALLOWED_MODELS, DEFAULT_MODEL
from app.service import normalize_query

router = APIRouter(prefix="/api")

FORECAST_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600"
SEARCH_CACHE_CONTROL = "public, max-age=86400"
RADAR_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"
CYCLONE_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=900"
MAX_QUERY_LENGTH = 100


def _invalid(field: str, msg: str) -> RequestValidationError:
    return RequestValidationError([{"loc": ("query", field), "msg": msg, "type": "value_error"}])


@router.get("/search")
async def search(request: Request, response: Response, q: str = Query(...)):
    nq = normalize_query(q)
    if len(nq) < 2:
        raise _invalid("q", "must be at least 2 characters")
    if len(nq) > MAX_QUERY_LENGTH:
        raise _invalid("q", f"must be at most {MAX_QUERY_LENGTH} characters")
    places = await request.app.state.service.search(nq)
    response.headers["Cache-Control"] = SEARCH_CACHE_CONTROL
    return {"results": [p.model_dump(by_alias=True) for p in places]}


@router.get("/forecast")
async def forecast(
    request: Request,
    response: Response,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    models: str = Query(DEFAULT_MODEL),
):
    items = [m.strip() for m in models.split(",")]
    if len(items) != 1 or items[0] not in ALLOWED_MODELS:
        raise _invalid("models", "must be exactly one supported model")
    result = await request.app.state.service.get_forecast(lat, lon, items[0])
    response.headers["Cache-Control"] = FORECAST_CACHE_CONTROL
    return result.model_dump(by_alias=True)


@router.get("/radar")
async def radar(request: Request, response: Response):
    result = await request.app.state.service.get_radar()
    response.headers["Cache-Control"] = RADAR_CACHE_CONTROL
    return result.model_dump(by_alias=True)


@router.get("/cyclones")
async def cyclones(request: Request, response: Response):
    result = await request.app.state.service.get_cyclones()
    response.headers["Cache-Control"] = CYCLONE_CACHE_CONTROL
    return result.model_dump(by_alias=True)


@router.get("/health")
async def health(request: Request):
    service = request.app.state.service
    return {
        "status": "ok",
        "cache": "ok",
        "upstreamCallsToday": service.budget.count_today(),
        "budget": service.settings.daily_budget_soft_limit,
    }
