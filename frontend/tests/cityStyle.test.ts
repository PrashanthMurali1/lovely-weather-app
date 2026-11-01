import { describe, expect, it } from "vitest";
import { MAX_ZOOM } from "../src/map/projection";
import { CITY_FULL_ZOOM, CITY_START_ZOOM, cityAlpha, cityTileZ, placeVisible, radarOpacity, roadStyle } from "../src/map/cityStyle";

describe("city detail fade", () => {
  it("is absent at country scale, full at city scale, and fades in between", () => {
    expect(cityAlpha(CITY_START_ZOOM - 1)).toBe(0);
    expect(cityAlpha(CITY_FULL_ZOOM)).toBe(1);
    expect(cityAlpha(MAX_ZOOM)).toBe(1);
    const mid = cityAlpha((CITY_START_ZOOM + CITY_FULL_ZOOM) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("how far the viewer can zoom", () => {
  it("stops at the district view, where main roads and neighbourhood names show", () => {
    expect(MAX_ZOOM).toBe(10.5);
    expect(MAX_ZOOM).toBeGreaterThanOrEqual(CITY_FULL_ZOOM); // the street layer is fully in by then
  });

  it("never asks the tile server for more detail than that view needs", () => {
    expect(cityTileZ(MAX_ZOOM)).toBeLessThanOrEqual(10);
    expect(cityTileZ(99)).toBe(cityTileZ(MAX_ZOOM));
  });
});

describe("radar over streets", () => {
  it("keeps radar strong when zoomed out and lets streets show through when zoomed in", () => {
    expect(radarOpacity(5)).toBeCloseTo(0.92);
    expect(radarOpacity(14)).toBeLessThan(radarOpacity(5));
    expect(radarOpacity(14)).toBeGreaterThanOrEqual(0.5);
  });

  it("never gets more opaque as the viewer zooms in", () => {
    let last = 1;
    for (let z = 3; z <= MAX_ZOOM; z += 0.5) {
      const o = radarOpacity(z);
      expect(o).toBeLessThanOrEqual(last + 1e-9);
      last = o;
    }
  });
});

describe("cityTileZ", () => {
  it("picks the tile level whose tiles are about 512 px on screen, within what the server has", () => {
    expect(cityTileZ(10)).toBe(9);
    expect(cityTileZ(9.6)).toBe(9);
    expect(cityTileZ(12.4)).toBe(10); // beyond the zoom limit it stays at the limit's level
    expect(cityTileZ(3)).toBeGreaterThanOrEqual(0);
  });
});

describe("roadStyle", () => {
  it("hides minor streets until the viewer is close in, but shows highways earlier", () => {
    expect(roadStyle("motorway", 10)).not.toBeNull();
    expect(roadStyle("minor", 10)).toBeNull();
    expect(roadStyle("minor", 14)).not.toBeNull();
    expect(roadStyle("service", 12)).toBeNull();
  });

  it("draws bigger roads wider than smaller ones at the same zoom", () => {
    const primary = roadStyle("primary", 14)!;
    const minor = roadStyle("minor", 14)!;
    expect(primary.width).toBeGreaterThan(minor.width);
    expect(primary.rank).toBeGreaterThan(minor.rank);
  });

  it("widens roads as the viewer zooms in", () => {
    expect(roadStyle("primary", 15)!.width).toBeGreaterThan(roadStyle("primary", 12)!.width);
  });

  it("ignores road classes it does not draw", () => {
    expect(roadStyle("motorway_construction", 14)).toBeNull();
    expect(roadStyle("something_new", 14)).toBeNull();
  });
});

describe("placeVisible", () => {
  it("shows the city always, neighbourhoods only up close", () => {
    expect(placeVisible("city", 10)).toBe(true);
    expect(placeVisible("suburb", 10)).toBe(false);
    expect(placeVisible("suburb", 13)).toBe(true);
  });

  it("never labels countries or states at city scale", () => {
    expect(placeVisible("country", 12)).toBe(false);
    expect(placeVisible("state", 12)).toBe(false);
  });
});
