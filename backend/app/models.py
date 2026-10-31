from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

ALLOWED_MODELS = {"ecmwf_ifs025"}
DEFAULT_MODEL = "ecmwf_ifs025"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Place(CamelModel):
    id: int
    name: str
    admin: str | None
    lat: float
    lon: float


class Location(CamelModel):
    lat: float
    lon: float
    timezone: str


class Current(CamelModel):
    time: str
    temp_c: float
    feels_like_c: float
    humidity_pct: int
    wind_kph: float
    wind_dir_deg: int
    precip_mm: float
    weather_code: int
    is_day: bool


class HourlyPoint(CamelModel):
    time: str
    temp_c: float
    precip_prob_pct: int | None
    precip_mm: float
    wind_kph: float
    weather_code: int


class DailyPoint(CamelModel):
    date: str
    temp_max_c: float
    temp_min_c: float
    precip_sum_mm: float
    precip_prob_pct: int | None
    sunrise: str
    sunset: str
    weather_code: int


class Forecast(CamelModel):
    location: Location
    model: str
    generated_at: str | None
    fetched_at: str
    stale: bool
    current: Current
    hourly: list[HourlyPoint]
    daily: list[DailyPoint]
    attribution: str
