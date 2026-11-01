import { describe, expect, it } from "vitest";
import { scaleBar } from "../src/map/scaleBar";

const metresPerPx = (zoom: number, lat: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;

describe("scaleBar", () => {
  it("labels country-scale views in kilometres", () => {
    expect(scaleBar({ lon: 80, lat: 20, zoom: 5 }, 120).label).toMatch(/^\d+ km$/);
  });

  it("switches to metres at street level instead of overshooting the screen", () => {
    const bar = scaleBar({ lon: 80.27, lat: 13.08, zoom: 16 }, 120);
    expect(bar.label).toMatch(/^\d+ m$/);
    expect(bar.px).toBeLessThanOrEqual(120);
  });

  it("draws a bar whose length matches its label at every zoom", () => {
    for (let zoom = 3; zoom <= 16; zoom++) {
      const view = { lon: 80.27, lat: 13.08, zoom };
      const bar = scaleBar(view, 120);
      const value = bar.label.endsWith(" km") ? parseFloat(bar.label) * 1000 : parseFloat(bar.label);
      expect(bar.px, `zoom ${zoom}`).toBeCloseTo(value / metresPerPx(zoom, 13.08), 5);
      expect(bar.px, `zoom ${zoom}`).toBeLessThanOrEqual(120);
      expect(bar.px, `zoom ${zoom}`).toBeGreaterThan(20);
    }
  });
});
