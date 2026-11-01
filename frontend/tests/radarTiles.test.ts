import { afterEach, describe, expect, it, vi } from "vitest";
import { RADAR_TILE_CACHE, isCachedLocally } from "../src/map/radarTiles";

const URL_A = "https://tilecache.rainviewer.com/v2/radar/abc/512/4/11/7/2/0_0.png";

afterEach(() => vi.unstubAllGlobals());

describe("isCachedLocally", () => {
  it("is true when the service worker already holds the tile", async () => {
    const match = vi.fn(async () => new Response("png"));
    vi.stubGlobal("caches", { match });
    await expect(isCachedLocally(URL_A)).resolves.toBe(true);
    expect(match).toHaveBeenCalledWith(URL_A, { cacheName: RADAR_TILE_CACHE });
  });

  it("is false when it does not", async () => {
    vi.stubGlobal("caches", { match: async () => undefined });
    await expect(isCachedLocally(URL_A)).resolves.toBe(false);
  });

  it("is false where the Cache API is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(isCachedLocally(URL_A)).resolves.toBe(false);
  });

  it("is false, not an error, when the cache lookup throws", async () => {
    vi.stubGlobal("caches", {
      match: async () => {
        throw new Error("storage blocked");
      },
    });
    await expect(isCachedLocally(URL_A)).resolves.toBe(false);
  });

  it("uses the same cache name the service worker writes", () => {
    expect(RADAR_TILE_CACHE).toBe("radar-tiles");
  });
});
