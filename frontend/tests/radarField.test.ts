import { describe, expect, it } from "vitest";
import { MIN_DBZ, stepRgba } from "../src/map/radarScale";
import { FIELD_MAX_DBZ, buildColourLut, buildRadarField, dbzOfByte } from "../src/map/radarField";
import { SOURCE_TABLE } from "../src/map/sourceTable";

// Tile pixels for a w x h tile holding the given echoes (dBZ), using the provider's real colours.
function tileWith(w: number, h: number, cells: Record<string, number>): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (const [k, dbz] of Object.entries(cells)) {
    const [x, y] = k.split(",").map(Number);
    let best = 0;
    for (let i = 0; i < SOURCE_TABLE.length; i += 4) if (Math.abs(SOURCE_TABLE[i] - dbz) < Math.abs(SOURCE_TABLE[best] - dbz)) best = i;
    const p = (y * w + x) * 4;
    px.set([SOURCE_TABLE[best + 1], SOURCE_TABLE[best + 2], SOURCE_TABLE[best + 3], 255], p);
  }
  return px;
}

function block(cx: number, cy: number, r: number, dbz: number) {
  const cells: Record<string, number> = {};
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) cells[`${x},${y}`] = dbz;
  return cells;
}

const W = 24;
const at = (f: ReturnType<typeof buildRadarField>, x: number, y: number) => {
  const i = (y * f.w + x) * 2;
  return { dbz: dbzOfByte(f.data[i]), cover: f.data[i + 1] / 255 };
};

describe("buildRadarField", () => {
  it("has two bytes per pixel", () => {
    const f = buildRadarField(tileWith(W, W, {}), W, W);
    expect(f.w).toBe(W);
    expect(f.h).toBe(W);
    expect(f.data.length).toBe(W * W * 2);
  });

  it("is all clear for a tile with no echoes", () => {
    const f = buildRadarField(tileWith(W, W, {}), W, W);
    expect(Math.max(...f.data)).toBe(0);
  });

  it("is solid and true to intensity inside an echo, and clear far from it", () => {
    const f = buildRadarField(tileWith(W, W, block(12, 12, 3, 40)), W, W);
    const mid = at(f, 12, 12);
    expect(mid.cover).toBeGreaterThan(0.95);
    expect(Math.abs(mid.dbz - 40)).toBeLessThan(1.5);
    expect(at(f, 0, 0).cover).toBe(0);
  });

  it("keeps the intensity at a soft edge instead of dimming it to nothing", () => {
    const f = buildRadarField(tileWith(W, W, block(12, 12, 3, 40)), W, W);
    const edge = at(f, 16, 12); // one cell outside the block
    expect(edge.cover).toBeGreaterThan(0.05);
    expect(edge.cover).toBeLessThan(0.7);
    expect(Math.abs(edge.dbz - 40)).toBeLessThan(1.5);
  });

  it("carries the rain's intensity a little beyond its edge, so smoothing never dims the outline's colour", () => {
    const f = buildRadarField(tileWith(W, W, block(12, 12, 3, 40)), W, W);
    // Three cells past the echo: no coverage, but the intensity channel still holds the echo's value.
    const beyond = at(f, 18, 12);
    expect(beyond.cover).toBeLessThan(0.05);
    expect(Math.abs(beyond.dbz - 40)).toBeLessThan(1.5);
    // Far from any echo it is empty.
    expect(at(f, 0, 0).dbz).toBe(0);
  });

  it("fades coverage smoothly across the edge", () => {
    const f = buildRadarField(tileWith(W, W, block(12, 12, 3, 30)), W, W);
    const row = Array.from({ length: W }, (_, x) => at(f, x, 12).cover);
    const partial = row.filter((c) => c > 0.02 && c < 0.98);
    expect(partial.length).toBeGreaterThanOrEqual(2);
  });

  it("still registers a lone small cell, but weaker than a solid echo", () => {
    const lone = at(buildRadarField(tileWith(W, W, { "12,12": 35 }), W, W), 12, 12);
    const solid = at(buildRadarField(tileWith(W, W, block(12, 12, 3, 35)), W, W), 12, 12);
    expect(lone.cover).toBeGreaterThan(0.1);
    expect(lone.cover).toBeLessThan(solid.cover);
  });

  it("ignores transparent pixels", () => {
    const px = tileWith(W, W, block(12, 12, 3, 40));
    for (let i = 3; i < px.length; i += 4) px[i] = 0;
    expect(Math.max(...buildRadarField(px, W, W).data)).toBe(0);
  });
});

describe("dbzOfByte", () => {
  it("maps the byte range onto 0 to the field maximum", () => {
    expect(dbzOfByte(0)).toBe(0);
    expect(dbzOfByte(255)).toBeCloseTo(FIELD_MAX_DBZ);
  });
});

describe("buildColourLut", () => {
  const lut = buildColourLut();

  it("has one RGBA entry per intensity byte", () => {
    expect(lut.length).toBe(256 * 4);
  });

  it("gives each reflectivity the colour of its step", () => {
    for (const dbz of [12, 22, 33, 40, 50, 70]) {
      const i = Math.round((dbz / FIELD_MAX_DBZ) * 255) * 4;
      const want = stepRgba(dbzOfByte(i / 4))!;
      expect([lut[i], lut[i + 1], lut[i + 2]]).toEqual([want[0], want[1], want[2]]);
      expect(lut[i + 3]).toBe(Math.round(want[3] * 255));
    }
  });

  it("clamps weak echoes to the lightest colour rather than going blank", () => {
    const weak = Math.round((2 / FIELD_MAX_DBZ) * 255) * 4;
    const first = stepRgba(MIN_DBZ)!;
    expect([lut[weak], lut[weak + 1], lut[weak + 2]]).toEqual([first[0], first[1], first[2]]);
    expect(lut[weak + 3]).toBeGreaterThan(0);
  });
});
