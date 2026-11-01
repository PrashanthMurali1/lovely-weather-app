from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import UpstreamUnavailable
from app.main import create_app
from app.models import Cyclones, RadarFrames
from app.providers.maps import (
    RADAR_HOST,
    in_north_indian_ocean,
    parse_cyclone,
    parse_radar,
)

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=timezone.utc)


def radar_index(**over):
    data = {
        "host": RADAR_HOST,
        "generated": 1793527533,
        "radar": {"past": [{"time": 1793520000, "path": "/v2/radar/abc"}, {"time": 1793520600, "path": "/v2/radar/def"}]},
    }
    data.update(over)
    return data


def feature(geom_type, coords, klass, label=""):
    return {
        "type": "Feature",
        "geometry": {"type": geom_type, "coordinates": coords},
        "properties": {"Class": klass, "polygonlabel": label},
    }


def square(cx, cy, d=0.1):
    return [[[cx - d, cy - d], [cx + d, cy - d], [cx + d, cy + d], [cx - d, cy + d], [cx - d, cy - d]]]


EVENT = {
    "geometry": {"type": "Point", "coordinates": [84.8, 12.2]},
    "properties": {
        "eventid": 1001346,
        "eventname": "FOUR-26",
        "alertlevel": "Red",
        "iscurrent": "true",
        "fromdate": "2026-11-01T00:00:00",
        "todate": "2026-11-01T06:00:00",
        "severitydata": {"severity": 120.37},
        "url": {"report": "https://www.gdacs.org/report.aspx?eventid=1001346"},
    },
}

GEOMETRY = {
    "features": [
        feature("Point", [84.8, 12.2], "Point_Centroid", "Centroid"),
        # Segments are unordered and some run backwards, as in the real feed.
        feature("LineString", [[81.0, 14.5], [82.0, 13.6]], "Line_Line_1", "TS"),
        feature("LineString", [[84.8, 12.2], [82.0, 13.6]], "Line_Line_0", "HU"),
        feature("Polygon", square(82.0, 13.6), "Point_Polygon_Point_1", "02/11 06:00 UTC"),
        feature("Polygon", square(84.8, 12.2), "Point_Polygon_Point_0", "01/11 00:00 UTC"),
        feature("Polygon", square(81.0, 14.5), "Point_Polygon_Point_2", "03/11 06:00 UTC"),
        feature("Polygon", [[[80, 10], [88, 10], [88, 16], [80, 16], [80, 10]]], "Poly_Cones", "Uncertainty Cones"),
        feature("Polygon", square(84.8, 12.2, 1.0), "Poly_Red", "120 km/h"),
        feature("Polygon", square(84.8, 12.2, 2.0), "Poly_Green", "60 km/h"),
        feature("Polygon", square(84.8, 12.2, 3.0), "Poly_Green", "02/11 06:00"),
    ]
}


def test_parse_radar_ok():
    r = parse_radar(radar_index())
    assert [f.path for f in r.frames] == ["/v2/radar/abc", "/v2/radar/def"]
    assert r.host == RADAR_HOST and r.stale is False


@pytest.mark.parametrize(
    "bad",
    [
        radar_index(host="https://evil.example"),
        radar_index(radar={"past": []}),
        radar_index(radar={"past": [{"time": 1, "path": "//evil.example/x"}]}),
    ],
)
def test_parse_radar_rejects_untrusted_or_empty(bad):
    with pytest.raises(ValueError):
        parse_radar(bad)


def test_north_indian_ocean_box():
    assert in_north_indian_ocean(84.8, 12.2)  # Bay of Bengal
    assert in_north_indian_ocean(68.0, 15.0)  # Arabian Sea
    assert not in_north_indian_ocean(144.1, 22.3)  # western Pacific
    assert not in_north_indian_ocean(-107.7, 20.7)  # eastern Pacific


def test_parse_cyclone_orders_track_by_time_and_classes_by_segment():
    c = parse_cyclone(EVENT, GEOMETRY, NOW)
    assert c.name == "FOUR-26" and c.active and c.alert == "Red"
    assert c.wind_kph == 120.4
    assert [(t.lon, t.lat) for t in c.track] == [(84.8, 12.2), (82.0, 13.6), (81.0, 14.5)]
    assert [t.time for t in c.track] == [
        "2026-11-01T00:00:00+00:00",
        "2026-11-02T06:00:00+00:00",
        "2026-11-03T06:00:00+00:00",
    ]
    assert [t.cls for t in c.track] == ["HU", "HU", "TS"]
    assert len(c.cone) == 1
    # Forecast-time footprints (label is a date) are not wind fields.
    assert [w.kph for w in c.wind_fields] == [60, 120]


def test_parse_cyclone_year_rollover():
    new_year = datetime(2027, 1, 1, 2, 0, tzinfo=timezone.utc)
    geometry = {"features": [
        feature("Polygon", square(84.8, 12.2), "Point_Polygon_Point_0", "31/12 06:00 UTC"),
        feature("Polygon", square(82.0, 13.6), "Point_Polygon_Point_1", "01/01 18:00 UTC"),
    ]}
    c = parse_cyclone(EVENT, geometry, new_year)
    assert [t.time for t in c.track] == ["2026-12-31T06:00:00+00:00", "2027-01-01T18:00:00+00:00"]


def test_parse_cyclone_without_track_is_an_error():
    with pytest.raises(ValueError):
        parse_cyclone(EVENT, {"features": []}, NOW)


class FakeMaps:
    def __init__(self):
        self.radar_calls = 0
        self.error = None

    async def radar(self):
        self.radar_calls += 1
        if self.error:
            raise self.error
        return parse_radar(radar_index())

    async def cyclones(self):
        if self.error:
            raise self.error
        return Cyclones(fetched_at="2026-11-01T15:30:00+05:30", stale=False, cyclones=[], attribution="x")


class FakeService:
    def __init__(self):
        self.settings = Settings()
        self.budget = SimpleNamespace(count_today=lambda: 0)
        self.maps = FakeMaps()

    async def get_radar(self) -> RadarFrames:
        return await self.maps.radar()

    async def get_cyclones(self) -> Cyclones:
        return await self.maps.cyclones()


@pytest.fixture
def svc():
    return FakeService()


@pytest.fixture
def client(svc):
    return TestClient(create_app(service=svc, settings=svc.settings))


def test_radar_route(client):
    r = client.get("/api/radar")
    assert r.status_code == 200
    body = r.json()
    assert body["host"] == RADAR_HOST and len(body["frames"]) == 2
    assert "max-age" in r.headers["cache-control"]


def test_cyclones_route_empty_is_a_valid_answer(client):
    r = client.get("/api/cyclones")
    assert r.status_code == 200
    assert r.json()["cyclones"] == []


def test_radar_upstream_failure_maps_to_502(svc, client):
    svc.maps.error = UpstreamUnavailable("down")
    r = client.get("/api/radar")
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "upstream_unavailable"
