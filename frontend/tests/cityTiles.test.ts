import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cityTileUrl, decodeCityTile, loadCityTile, resetCityTiles } from "../src/map/cityTiles";

// A real z14 tile over central Chennai (Egmore, Triplicane, George Town) from OpenFreeMap.
const fixture = () => {
  const b = readFileSync(join(__dirname, "fixtures", "chennai-z14.pbf"));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetCityTiles();
});

describe("decodeCityTile", () => {
  const tile = decodeCityTile(fixture());

  it("keeps the layers the map draws", () => {
    for (const layer of ["water", "building", "transportation", "place", "landuse"]) {
      expect(tile.layers[layer]?.length, layer).toBeGreaterThan(0);
    }
  });

  it("drops boundaries, so the app's own India borders are the only ones ever drawn", () => {
    expect(tile.layers.boundary).toBeUndefined();
  });

  it("drops layers it does not draw", () => {
    expect(tile.layers.poi).toBeUndefined();
    expect(tile.layers.housenumber).toBeUndefined();
  });

  it("reads place names and classes", () => {
    const names = tile.layers.place.map((f) => `${f.cls}:${f.name}`);
    expect(names).toContain("city:Chennai");
    expect(names).toContain("suburb:Egmore");
  });

  it("reads road classes and decodes their geometry in tile units", () => {
    const roads = tile.layers.transportation;
    expect(roads.some((f) => f.cls === "primary")).toBe(true);
    const line = roads.find((f) => f.type === 2)!;
    expect(line.rings[0].length).toBeGreaterThan(1);
    expect(tile.extent).toBe(4096);
    for (const [x, y] of line.rings[0]) {
      expect(x).toBeGreaterThan(-512);
      expect(x).toBeLessThan(4096 + 512);
      expect(y).toBeGreaterThan(-512);
      expect(y).toBeLessThan(4096 + 512);
    }
  });

  it("marks polygons so they can be filled", () => {
    expect(tile.layers.building.every((f) => f.type === 3)).toBe(true);
    expect(tile.layers.water.every((f) => f.type === 3 || f.type === 2)).toBe(true);
  });
});

describe("loadCityTile", () => {
  const tilejson = { tiles: ["https://tiles.example.org/planet/v1/{z}/{x}/{y}.pbf"] };

  it("builds tile URLs from the server's current tile template", () => {
    expect(cityTileUrl(tilejson.tiles[0], { z: 14, x: 11845, y: 7591 })).toBe("https://tiles.example.org/planet/v1/14/11845/7591.pbf");
  });

  it("asks the server for its template once, then fetches and decodes tiles", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith(".pbf") ? new Response(fixture()) : new Response(JSON.stringify(tilejson)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const a = await loadCityTile({ z: 14, x: 11845, y: 7591 });
    const b = await loadCityTile({ z: 14, x: 11846, y: 7591 });
    expect(a?.layers.place.length).toBeGreaterThan(0);
    expect(b).not.toBeNull();
    const templateCalls = fetchMock.mock.calls.filter(([u]) => !String(u).endsWith(".pbf"));
    expect(templateCalls).toHaveLength(1);
  });

  it("serves a tile it already has without fetching again", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith(".pbf") ? new Response(fixture()) : new Response(JSON.stringify(tilejson)),
    );
    vi.stubGlobal("fetch", fetchMock);
    await loadCityTile({ z: 14, x: 1, y: 1 });
    const calls = fetchMock.mock.calls.length;
    await loadCityTile({ z: 14, x: 1, y: 1 });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("resolves null, not an error, when the server is unreachable, and retries later", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(loadCityTile({ z: 14, x: 2, y: 2 })).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith(".pbf") ? new Response(fixture()) : new Response(JSON.stringify(tilejson)))),
    );
    await expect(loadCityTile({ z: 14, x: 2, y: 2 })).resolves.not.toBeNull();
  });

  it("resolves null for a tile the server does not have", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith(".pbf") ? new Response("nope", { status: 404 }) : new Response(JSON.stringify(tilejson)))),
    );
    await expect(loadCityTile({ z: 14, x: 3, y: 3 })).resolves.toBeNull();
  });
});
