import { describe, expect, it } from "vitest";
import geo from "../src/map/geo.json";

// The basemap must show India as officially mapped. Regenerating the geometry
// (scripts/build-geo.mjs) must never change who owns these places.

function inRing(x: number, y: number, flat: number[]): boolean {
  let inside = false;
  const n = flat.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[i * 2];
    const yi = flat[i * 2 + 1];
    const xj = flat[j * 2];
    const yj = flat[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function owners(lon: number, lat: number): string[] {
  return (geo as { land: { id: string; rings: number[][] }[] }).land
    .filter((c) => c.rings.some((r) => inRing(lon, lat, r)))
    .map((c) => c.id);
}

describe("basemap borders follow India's official map", () => {
  const india: [string, number, number][] = [
    ["Srinagar", 74.8, 34.08],
    ["Leh", 77.58, 34.15],
    ["Muzaffarabad (PoK)", 73.47, 34.37],
    ["Mirpur (PoK)", 73.75, 33.15],
    ["Gilgit", 74.31, 35.92],
    ["Skardu", 75.62, 35.3],
    ["Aksai Chin", 79.5, 35.2],
    ["Tawang (Arunachal Pradesh)", 91.86, 27.59],
    ["Itanagar (Arunachal Pradesh)", 93.62, 27.09],
  ];

  it.each(india)("%s is India and nobody else's", (_name, lon, lat) => {
    expect(owners(lon, lat)).toEqual(["IND"]);
  });

  it.each([
    ["Islamabad", 73.05, 33.68, "PAK"],
    ["Lahore", 74.35, 31.55, "PAK"],
    ["Kashgar", 76.0, 39.47, "CHN"],
    ["Lhasa", 91.1, 29.65, "CHN"],
    ["Kathmandu", 85.32, 27.7, "NPL"],
  ])("%s stays in its own country", (_name, lon, lat, id) => {
    expect(owners(lon, lat)).toEqual([id]);
  });

  it("draws no internal outline for Jammu & Kashmir or Ladakh", () => {
    const names = (geo as { indiaStates: { name: string }[] }).indiaStates.map((s) => s.name);
    expect(names).not.toContain("Jammu and Kashmir");
    expect(names).not.toContain("Ladakh");
    expect(names).toContain("Punjab");
  });
});
