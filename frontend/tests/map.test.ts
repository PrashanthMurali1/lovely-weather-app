import { describe, expect, it } from "vitest";
import type { Cyclone } from "../src/api/types";
import { currentIndex, hitCyclone } from "../src/map/cycloneLayer";
import {
  MAX_ZOOM,
  fitBounds,
  latToY,
  lonToX,
  panBy,
  project,
  tileRect,
  unproject,
  visibleTiles,
  xToLon,
  yToLat,
  zoomAround,
} from "../src/map/projection";
import { BANDS, STEPS, bandFor, bandRateText, dbzFromRgb, rainRateMmH, stepRgba, stepsGradientCss } from "../src/map/radarScale";
import { MAX_TILE_Z, MIN_TILE_Z, tileUrl, tileZFor } from "../src/map/radarTiles";
import { formatAge } from "../src/map/time";

const size = { w: 800, h: 600 };
const view = { lon: 80, lat: 18, zoom: 5 };

describe("projection", () => {
  it("round-trips lon/lat through world pixels", () => {
    expect(xToLon(lonToX(77.59, 6), 6)).toBeCloseTo(77.59, 6);
    expect(yToLat(latToY(12.97, 6), 6)).toBeCloseTo(12.97, 6);
  });

  it("puts the view centre in the middle of the canvas", () => {
    const [x, y] = project(view, size, view.lon, view.lat);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  it("unproject inverts project", () => {
    const [x, y] = project(view, size, 72.87, 19.07);
    const [lon, lat] = unproject(view, size, x, y);
    expect(lon).toBeCloseTo(72.87, 6);
    expect(lat).toBeCloseTo(19.07, 6);
  });

  it("zoomAround keeps the point under the cursor fixed", () => {
    const [lon, lat] = unproject(view, size, 620, 150);
    const next = zoomAround(view, size, 620, 150, 6.5);
    const [x, y] = project(next, size, lon, lat);
    expect(x).toBeCloseTo(620, 4);
    expect(y).toBeCloseTo(150, 4);
    expect(next.zoom).toBe(6.5);
  });

  it("clamps zoom to the supported range", () => {
    expect(zoomAround(view, size, 0, 0, 99).zoom).toBe(MAX_ZOOM);
    expect(zoomAround(view, size, 0, 0, -3).zoom).toBe(3);
  });

  it("panBy moves the map with the pointer", () => {
    const [x0] = project(view, size, 80, 18);
    const next = panBy(view, 100, 0);
    const [x1] = project(next, size, 80, 18);
    expect(x1 - x0).toBeCloseTo(100, 6);
  });

  it("fitBounds frames India inside the canvas", () => {
    const b = { west: 62, south: 4, east: 100, north: 29 };
    const v = fitBounds(b, size, 12);
    const [x0, y0] = project(v, size, b.west, b.north);
    const [x1, y1] = project(v, size, b.east, b.south);
    expect(x0).toBeGreaterThanOrEqual(11);
    expect(y0).toBeGreaterThanOrEqual(11);
    expect(x1).toBeLessThanOrEqual(size.w - 11);
    expect(y1).toBeLessThanOrEqual(size.h - 11);
  });
});

describe("tiles", () => {
  it("covers the viewport with tiles that line up edge to edge", () => {
    const z = 3;
    const tiles = visibleTiles(view, size, z);
    expect(tiles.length).toBeGreaterThan(0);
    const rects = tiles.map((t) => tileRect(view, size, t));
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    const top = Math.min(...rects.map((r) => r.y));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    expect(left).toBeLessThanOrEqual(0);
    expect(right).toBeGreaterThanOrEqual(size.w);
    expect(top).toBeLessThanOrEqual(0);
    expect(bottom).toBeGreaterThanOrEqual(size.h);
  });

  it("tile edges match projected longitudes", () => {
    const t = { z: 4, x: 11, y: 7 };
    const r = tileRect(view, size, t);
    const west = xToLon(t.x * 256 * 2 ** (view.zoom - t.z) * 1, view.zoom);
    const [px] = project(view, size, west, 10);
    expect(r.x).toBeCloseTo(px, 4);
  });

  it("chooses a tile level inside the server's range and builds 512 px colour-2 urls", () => {
    expect(tileZFor(0)).toBe(MIN_TILE_Z);
    expect(tileZFor(20)).toBe(MAX_TILE_Z);
    expect(tileZFor(5)).toBe(4);
    expect(tileUrl("https://h", "/v2/radar/abc", { x: 1, y: 2, z: 3 })).toBe("https://h/v2/radar/abc/512/3/1/2/2/0_0.png");
  });
});

describe("radar scale", () => {
  it("decodes the source colour table back to reflectivity", () => {
    expect(dbzFromRgb(0, 136, 191)).toBe(23); // observed in a live tile
  });

  it("shows nothing below the drizzle floor and solid colour above it", () => {
    expect(stepRgba(5)).toBeNull();
    expect(stepRgba(10)![3]).toBeGreaterThan(0.85);
    expect(stepRgba(90)).toEqual(stepRgba(70));
  });

  it("uses flat steps: one colour across a whole step, a different one at the next", () => {
    expect(stepRgba(26)).toEqual(stepRgba(30));
    expect(stepRgba(30)).not.toEqual(stepRgba(32));
    expect(stepRgba(12)).toEqual(stepRgba(17.9));
  });

  it("goes from greens through yellow and orange to red and violet as rain gets heavier", () => {
    const [light, , , heavy, , red, , violet] = STEPS.map((s) => s.rgb);
    expect(light[1]).toBeGreaterThan(light[0]); // green
    expect(heavy[0]).toBeGreaterThan(200); // yellow-ish: strong red and green
    expect(heavy[1]).toBeGreaterThan(180);
    expect(red[0]).toBeGreaterThan(red[1] + 120);
    expect(violet[2]).toBeGreaterThan(violet[1]);
  });

  it("starts new steps exactly where the legend bands change", () => {
    const starts = STEPS.map((s) => s.dbz);
    for (const b of BANDS) expect(starts).toContain(b.fromDbz);
  });

  it("describes the steps as a hard-edged legend gradient", () => {
    const css = stepsGradientCss();
    expect(css).toMatch(/^linear-gradient\(90deg, /);
    for (const s of STEPS) expect(css).toContain(`rgb(${s.rgb.join(",")})`);
    // Hard edges: every colour has a start and an end position.
    expect((css.match(/%/g) ?? []).length).toBe(STEPS.length * 2);
  });

  it("estimates rain rate with Marshall-Palmer", () => {
    expect(rainRateMmH(30)).toBeCloseTo(2.7, 0);
    expect(rainRateMmH(40)).toBeGreaterThan(rainRateMmH(30));
  });

  it("labels bands with approximate rates", () => {
    expect(bandFor(30)?.label).toBe("Moderate");
    expect(bandFor(5)).toBeNull();
    expect(bandRateText(BANDS[BANDS.length - 1])).toMatch(/^>\d+ mm\/h$/);
    expect(bandRateText(BANDS[0])).toMatch(/mm\/h$/);
  });
});

const storm = (over: Partial<Cyclone> = {}): Cyclone => ({
  id: "1",
  name: "TEST",
  alert: "Red",
  active: true,
  windKph: 100,
  center: [82, 13.6],
  fromDate: "",
  toDate: "",
  track: [
    { lon: 84.8, lat: 12.2, time: "2026-11-01T00:00:00+00:00", cls: "HU" },
    { lon: 82, lat: 13.6, time: "2026-11-02T06:00:00+00:00", cls: "HU" },
    { lon: 81, lat: 14.5, time: "2026-11-03T06:00:00+00:00", cls: "TS" },
  ],
  cone: [],
  windFields: [],
  reportUrl: null,
  ...over,
});

describe("cyclone layer", () => {
  it("finds the track vertex nearest the current position", () => {
    expect(currentIndex(storm())).toBe(1);
    expect(currentIndex(storm({ center: [84.7, 12.3] }))).toBe(0);
  });

  it("hit-tests the nearest storm within the radius", () => {
    const hits = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 120, y: 100 },
    ];
    expect(hitCyclone(hits, 118, 102)).toBe("b");
    expect(hitCyclone(hits, 100, 100)).toBe("a");
    expect(hitCyclone(hits, 400, 400)).toBeNull();
  });
});

describe("time", () => {
  it("describes frame age", () => {
    const now = Date.UTC(2026, 10, 1, 10, 0, 0);
    expect(formatAge(now / 1000 - 20, now)).toBe("just now");
    expect(formatAge(now / 1000 - 12 * 60, now)).toBe("12 min ago");
    expect(formatAge(now / 1000 - 3600, now)).toBe("1 h ago");
    expect(formatAge(now / 1000 - 5400, now)).toBe("1 h 30 min ago");
  });
});
