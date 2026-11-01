import { describe, expect, it } from "vitest";
import { isCyclonesApi, isRadarFramesApi, isRadarTile } from "../src/sw/radarCaching";

const url = (s: string) => ({ url: new URL(s) });

describe("service-worker route matchers", () => {
  it("matches radar tiles from the tile host only", () => {
    expect(isRadarTile(url("https://tilecache.rainviewer.com/v2/radar/abc/512/4/11/7/2/0_0.png"))).toBe(true);
    expect(isRadarTile(url("https://api.rainviewer.com/public/weather-maps.json"))).toBe(false);
    expect(isRadarTile(url("https://example.com/v2/radar/abc/512/4/11/7/2/0_0.png"))).toBe(false);
  });

  it("matches the radar frame list and the cyclone list on our own API", () => {
    expect(isRadarFramesApi(url("http://localhost:5173/api/radar"))).toBe(true);
    expect(isRadarFramesApi(url("http://localhost:5173/api/forecast?lat=1&lon=2"))).toBe(false);
    expect(isCyclonesApi(url("http://localhost:5173/api/cyclones"))).toBe(true);
    expect(isCyclonesApi(url("http://localhost:5173/api/radar"))).toBe(false);
  });

  it("is self-contained, because workbox serializes matchers into sw.js", () => {
    for (const fn of [isRadarTile, isRadarFramesApi, isCyclonesApi]) {
      // Re-create the function from its source with no access to this module's scope.
      const detached = new Function(`return (${fn.toString()})`)();
      expect(detached(url("https://tilecache.rainviewer.com/x.png"))).toBe(fn(url("https://tilecache.rainviewer.com/x.png")));
    }
  });
});
