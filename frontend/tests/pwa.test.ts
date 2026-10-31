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
    const sw = readFileSync(path, "utf8");
    expect(sw).toContain("/api/forecast");
    expect(sw).toContain("/api/search");
    expect(sw).toContain("forecast");
    expect(sw).toContain("search");
  });
});
