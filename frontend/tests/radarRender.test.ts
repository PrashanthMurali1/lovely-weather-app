import { describe, expect, it } from "vitest";
import type { RadarField } from "../src/map/radarField";
import { clipToView, type RadarDraw } from "../src/map/radarRender";

const field: RadarField = { w: 4, h: 4, data: new Uint8Array(32) };
const draw = (over: Partial<RadarDraw>): RadarDraw => ({ field, x: 0, y: 0, w: 100, h: 100, u0: 0, v0: 0, u1: 1, v1: 1, ...over });

describe("clipToView", () => {
  it("leaves a tile that is fully on screen alone", () => {
    expect(clipToView(draw({}), 200, 200)).toEqual(draw({}));
  });

  it("drops a tile that is entirely off screen", () => {
    expect(clipToView(draw({ x: 300 }), 200, 200)).toBeNull();
    expect(clipToView(draw({ y: -300 }), 200, 200)).toBeNull();
  });

  it("trims a huge tile to the screen and keeps the data lined up with the map", () => {
    // A tile 10 000 px wide whose left edge is 5 000 px left of the screen.
    const d = clipToView(draw({ x: -5000, y: -5000, w: 10000, h: 10000 }), 200, 100)!;
    expect(d.x).toBeCloseTo(-2, 5);
    expect(d.w).toBeLessThan(300);
    // The screen shows the middle of the tile: u from about 0.5 to just over 0.52.
    expect(d.u0).toBeCloseTo((5000 - 2) / 10000, 5);
    expect(d.u1).toBeCloseTo((5000 + 200 + 2) / 10000, 4);
    expect(d.v1).toBeCloseTo((5000 + 100 + 2) / 10000, 4);
  });

  it("keeps the sub-range of the data when only part of a tile is used", () => {
    const d = clipToView(draw({ u0: 0.5, u1: 1, x: -100, w: 200 }), 300, 300)!;
    // The left half of the quad is off screen, so only the right 100 px (u from 0.75) remain, plus a margin.
    expect(d.u0).toBeGreaterThan(0.7);
    expect(d.u0).toBeLessThan(0.76);
    expect(d.u1).toBe(1);
  });
});
