import asyncio
import re
from datetime import datetime, timedelta, timezone

import httpx
from pydantic import ValidationError

from app.errors import UpstreamUnavailable
from app.models import Cyclone, Cyclones, RadarFrame, RadarFrames, TrackPoint, WindField
from app.providers.http import get_json

RADAR_INDEX_URL = "https://api.rainviewer.com/public/weather-maps.json"
RADAR_HOST = "https://tilecache.rainviewer.com"
RADAR_ATTRIBUTION = "Radar by RainViewer"

GDACS_EVENTS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
GDACS_GEOMETRY_URL = "https://www.gdacs.org/gdacsapi/api/polygons/getgeometry"
CYCLONE_ATTRIBUTION = "Cyclone data by GDACS (UN OCHA / EC JRC)"

# North Indian Ocean: Arabian Sea, Bay of Bengal and the Indian coasts.
NIO_LON = (40.0, 100.0)
NIO_LAT = (-5.0, 30.0)
RECENT_DAYS = 14
MAX_CYCLONES = 6
IST = timezone(timedelta(hours=5, minutes=30))

_TIME_LABEL = re.compile(r"^(\d{2})/(\d{2}) (\d{2}):(\d{2})(?: UTC)?$")
_KPH_LABEL = re.compile(r"^(\d+) km/h$")


def _r(v: float) -> float:
    return round(float(v), 2)


def _centroid(ring: list[list[float]]) -> tuple[float, float]:
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def _label_time(label: str, now: datetime) -> str | None:
    """'dd/mm HH:MM UTC' -> ISO 8601 UTC, picking the year closest to now."""
    m = _TIME_LABEL.match(label)
    if not m:
        return None
    day, month, hour, minute = (int(g) for g in m.groups())
    best = None
    for year in (now.year - 1, now.year, now.year + 1):
        try:
            cand = datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
        except ValueError:
            continue
        if best is None or abs(cand - now) < abs(best - now):
            best = cand
    return best.isoformat() if best else None


def parse_radar(data: dict) -> RadarFrames:
    host = data["host"]
    if host != RADAR_HOST:
        raise ValueError("unexpected radar tile host")
    frames = [RadarFrame(time=int(f["time"]), path=str(f["path"])) for f in data["radar"]["past"]]
    if not frames or any(not f.path.startswith("/v2/radar/") for f in frames):
        raise ValueError("no usable radar frames")
    return RadarFrames(
        host=host,
        generated_at=int(data.get("generated") or frames[-1].time),
        stale=False,
        frames=frames,
        attribution=RADAR_ATTRIBUTION,
    )


def in_north_indian_ocean(lon: float, lat: float) -> bool:
    return NIO_LON[0] <= lon <= NIO_LON[1] and NIO_LAT[0] <= lat <= NIO_LAT[1]


def parse_cyclone(event: dict, geometry: dict, now: datetime) -> Cyclone:
    props = event["properties"]
    segments: list[tuple[int, list[list[float]], str | None]] = []
    time_points: list[tuple[int, float, float, str]] = []
    cone: list[list[list[float]]] = []
    wind_fields: list[WindField] = []
    center = event["geometry"]["coordinates"]

    for f in geometry["features"]:
        p, g = f["properties"], f["geometry"]
        klass, label = p.get("Class") or "", p.get("polygonlabel") or ""
        if g["type"] == "LineString" and klass.startswith("Line_Line_"):
            segments.append((int(klass.rsplit("_", 1)[1]), g["coordinates"], label or None))
        elif g["type"] == "Polygon" and klass.startswith("Point_Polygon_Point_"):
            t = _label_time(label, now)
            if t:
                cx, cy = _centroid(g["coordinates"][0])
                time_points.append((int(klass.rsplit("_", 1)[1]), cx, cy, t))
        elif g["type"] == "Polygon" and klass == "Poly_Cones":
            cone = [[[_r(x), _r(y)] for x, y in ring] for ring in g["coordinates"]]
        elif g["type"] == "Polygon" and klass.startswith("Poly_"):
            m = _KPH_LABEL.match(label)
            if m:
                wind_fields.append(
                    WindField(
                        kph=int(m.group(1)),
                        ring=[[_r(x), _r(y)] for x, y in g["coordinates"][0]],
                    )
                )
        elif g["type"] == "Point" and klass == "Point_Centroid":
            center = g["coordinates"]

    # The time-labelled points are the chronological track. The line segments are not ordered
    # (and some run backwards), so they only tell us the intensity class at each point.
    endpoints = [(x, y, cls, i) for i, coords, cls in segments for x, y in (coords[0], coords[-1])]

    def class_at(x: float, y: float) -> str | None:
        if not endpoints:
            return None
        # A vertex joins two segments; on a tie the lower-numbered segment decides.
        ex, ey, cls, _ = min(endpoints, key=lambda e: ((e[0] - x) ** 2 + (e[1] - y) ** 2, e[3]))
        return cls if (ex - x) ** 2 + (ey - y) ** 2 < 0.25 else None

    track = [
        TrackPoint(lat=_r(cy), lon=_r(cx), time=t, cls=class_at(cx, cy))
        for _, cx, cy, t in sorted(time_points)
    ]
    if not track:
        raise ValueError("cyclone has no track")

    severity = (props.get("severitydata") or {}).get("severity")
    return Cyclone(
        id=str(props["eventid"]),
        name=str(props.get("eventname") or props.get("name")),
        alert=str(props.get("alertlevel") or "Green"),
        active=str(props.get("iscurrent")).lower() == "true",
        wind_kph=None if severity is None else round(float(severity), 1),
        center=[_r(center[0]), _r(center[1])],
        from_date=str(props.get("fromdate", "")),
        to_date=str(props.get("todate", "")),
        track=track,
        cone=cone,
        wind_fields=sorted(wind_fields, key=lambda w: w.kph),
        report_url=(props.get("url") or {}).get("report"),
    )


class MapsProvider:
    def __init__(self, client: httpx.AsyncClient, timeout: float):
        self._client = client
        self._timeout = timeout

    async def radar(self) -> RadarFrames:
        data = await get_json(self._client, RADAR_INDEX_URL, None, self._timeout)
        try:
            return parse_radar(data)
        except (KeyError, ValueError, TypeError, ValidationError) as e:
            raise UpstreamUnavailable("malformed radar index") from e

    async def cyclones(self) -> Cyclones:
        now = datetime.now(timezone.utc)
        params = {
            "eventlist": "TC",
            "fromdate": (now - timedelta(days=RECENT_DAYS)).strftime("%Y-%m-%d"),
            "todate": now.strftime("%Y-%m-%d"),
            "alertlevel": "Green;Orange;Red",
        }
        listing = await get_json(self._client, GDACS_EVENTS_URL, params, self._timeout)
        try:
            events = [
                e
                for e in listing["features"]
                if in_north_indian_ocean(*e["geometry"]["coordinates"][:2])
            ]
        except (KeyError, TypeError, ValueError) as e:
            raise UpstreamUnavailable("malformed cyclone list") from e
        events.sort(
            key=lambda e: (
                str(e["properties"].get("iscurrent")).lower() != "true",
                e["properties"].get("fromdate", ""),
            )
        )
        events = events[:MAX_CYCLONES]

        async def one(event: dict) -> Cyclone | None:
            p = event["properties"]
            try:
                geometry = await get_json(
                    self._client,
                    GDACS_GEOMETRY_URL,
                    {"eventtype": "TC", "eventid": p["eventid"], "episodeid": p["episodeid"]},
                    self._timeout,
                )
                return parse_cyclone(event, geometry, now)
            except (UpstreamUnavailable, KeyError, ValueError, TypeError, ValidationError):
                return None  # one bad storm must not hide the others

        parsed = await asyncio.gather(*(one(e) for e in events))
        return Cyclones(
            fetched_at=now.astimezone(IST).isoformat(),
            stale=False,
            cyclones=[c for c in parsed if c is not None],
            attribution=CYCLONE_ATTRIBUTION,
        )
