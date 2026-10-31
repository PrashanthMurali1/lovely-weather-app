import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getForecast, searchPlaces } from "../src/api/client";

function mockFetch(status: number, body: string) {
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(body, { status }));
  return spy;
}

afterEach(() => vi.restoreAllMocks());

describe("searchPlaces", () => {
  it("hits /api/search and parses results", async () => {
    const place = { id: 1, name: "Chennai", admin: "Tamil Nadu", lat: 13.08, lon: 80.27 };
    const spy = mockFetch(200, JSON.stringify({ results: [place] }));
    const out = await searchPlaces("chennai");
    expect(spy.mock.calls[0][0]).toBe("/api/search?q=chennai");
    expect(out).toEqual([place]);
  });

  it("url-encodes the query", async () => {
    const spy = mockFetch(200, JSON.stringify({ results: [] }));
    await searchPlaces("new delhi&x=1");
    expect(spy.mock.calls[0][0]).toBe("/api/search?q=new%20delhi%26x%3D1");
  });
});

describe("getForecast", () => {
  it("returns the parsed forecast", async () => {
    const spy = mockFetch(200, JSON.stringify({ model: "ecmwf_ifs025" }));
    const out = await getForecast(13.08, 80.27);
    expect(spy.mock.calls[0][0]).toBe("/api/forecast?lat=13.08&lon=80.27");
    expect(out).toMatchObject({ model: "ecmwf_ifs025" });
  });

  it("throws ApiError parsed from the error body", async () => {
    mockFetch(502, JSON.stringify({ error: { code: "upstream_unavailable", message: "down" } }));
    const err = await getForecast(1, 2).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, code: "upstream_unavailable", message: "down" });
  });

  it("handles a non-JSON error body", async () => {
    mockFetch(500, "<html>boom</html>");
    const err = await getForecast(1, 2).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500, code: "unknown" });
  });
});
