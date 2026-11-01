import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const out = resolve(root, "dist-test");

describe("pwa build output", () => {
  beforeAll(() => {
    rmSync(out, { recursive: true, force: true });
    execSync("npx vite build --outDir dist-test --emptyOutDir", {
      cwd: root,
      stdio: "pipe",
    });
  }, 120_000);

  afterAll(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it("emits a manifest with name, display and icons", () => {
    const path = resolve(out, "manifest.webmanifest");
    expect(existsSync(path)).toBe(true);
    const m = JSON.parse(readFileSync(path, "utf8"));
    expect(m.name).toBe("India Weather");
    expect(m.short_name).toBe("Weather");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  });

  it("emits a service worker with the runtime caches", () => {
    const path = resolve(out, "sw.js");
    expect(existsSync(path)).toBe(true);
    const raw = readFileSync(path, "utf8");
    // Normalise whitespace/quotes: the SW is minified in builds, pretty-printed in test mode.
    const sw = raw.replace(/[\s"']+/g, "");
    expect(raw).toContain("/api/forecast");
    expect(raw).toContain("/api/search");
    expect(sw).toContain("cacheName:forecast");
    expect(sw).toContain("cacheName:search");
    expect(sw).toContain("fetchDidSucceed");
    expect(sw).toContain("networkTimeoutSeconds:4");
    expect(sw).toContain("statuses:[200]");
    expect(sw).toContain("maxEntries:20");
    expect(sw).toContain("maxEntries:50");
    expect(sw).toMatch(/NetworkFirst/);
    expect(sw).toMatch(/StaleWhileRevalidate/);
  });

  it("caches radar tiles for good, and the radar and cyclone lists network-first, for 3 hours", () => {
    const raw = readFileSync(resolve(out, "sw.js"), "utf8");
    const sw = raw.replace(/[\s"']+/g, "");
    expect(raw).toContain("tilecache.rainviewer.com");
    expect(raw).toContain("/api/radar");
    expect(raw).toContain("/api/cyclones");
    expect(sw).toContain("cacheName:radar-tiles");
    expect(sw).toContain("cacheName:radar-frames");
    expect(sw).toContain("cacheName:cyclones");
    expect(sw).toMatch(/CacheFirst/);
    expect(sw).toContain("maxAgeSeconds:10800");
    expect(sw).toContain("maxEntries:600");
  });

  it("keeps street-level map tiles for a week so a viewed area still draws offline", () => {
    const raw = readFileSync(resolve(out, "sw.js"), "utf8");
    const sw = raw.replace(/[\s"']+/g, "");
    expect(raw).toContain("tiles.openfreemap.org");
    expect(sw).toContain("cacheName:city-tiles");
    expect(sw).toContain("cacheName:city-tilejson");
    expect(sw).toContain("maxAgeSeconds:604800");
  });
});
