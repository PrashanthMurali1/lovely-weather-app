import { forecastFetchPlugin } from "../src/sw/forecastPlugins";

describe("forecastFetchPlugin", () => {
  it("throws for a 503 so NetworkFirst falls back to cache", async () => {
    await expect(
      forecastFetchPlugin.fetchDidSucceed({ response: new Response("x", { status: 503 }) }),
    ).rejects.toThrow("forecast 503");
  });
  it("passes through a 200", async () => {
    const r = new Response("ok", { status: 200 });
    await expect(forecastFetchPlugin.fetchDidSucceed({ response: r })).resolves.toBe(r);
  });
});
