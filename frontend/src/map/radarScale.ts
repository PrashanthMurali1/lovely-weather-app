import { SOURCE_TABLE } from "./sourceTable";

/** Reflectivity below this is clutter or drizzle too faint to show. */
export const MIN_DBZ = 10;

// ---- decoding: tile pixel colour -> reflectivity (dBZ) -------------------------------------------

const ENTRIES: { dbz: number; r: number; g: number; b: number }[] = [];
for (let i = 0; i < SOURCE_TABLE.length; i += 4) {
  ENTRIES.push({ dbz: SOURCE_TABLE[i], r: SOURCE_TABLE[i + 1], g: SOURCE_TABLE[i + 2], b: SOURCE_TABLE[i + 3] });
}
const decoded = new Map<number, number>();

export function dbzFromRgb(r: number, g: number, b: number): number {
  const key = (r << 16) | (g << 8) | b;
  const hit = decoded.get(key);
  if (hit !== undefined) return hit;
  let best = ENTRIES[0];
  let bestD = Infinity;
  for (const e of ENTRIES) {
    const d = (e.r - r) ** 2 + (e.g - g) ** 2 + (e.b - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  decoded.set(key, best.dbz);
  return best.dbz;
}

// ---- our own palette: reflectivity -> flat colour steps -----------------------------------------

export type Rgba = [number, number, number, number];

export interface Step {
  /** The step starts at this reflectivity. */
  dbz: number;
  rgb: [number, number, number];
}

/** How solid the rain is drawn. */
export const RADAR_ALPHA = 0.92;

/**
 * Flat, high-contrast steps: greens for light rain, yellow, orange and red as it gets heavier,
 * then magenta and violet for the most intense cores. Step edges line up with the legend bands
 * (10, 25, 36 and 48 dBZ).
 */
export const STEPS: readonly Step[] = [
  { dbz: 10, rgb: [143, 210, 122] },
  { dbz: 18, rgb: [63, 181, 108] },
  { dbz: 25, rgb: [27, 146, 82] },
  { dbz: 31, rgb: [244, 208, 63] },
  { dbz: 36, rgb: [245, 154, 35] },
  { dbz: 42, rgb: [230, 59, 46] },
  { dbz: 48, rgb: [190, 36, 140] },
  { dbz: 56, rgb: [110, 40, 170] },
];

/** The step colour for a reflectivity, or null below the display threshold. */
export function stepRgba(dbz: number): Rgba | null {
  if (dbz < MIN_DBZ) return null;
  let step = STEPS[0];
  for (const s of STEPS) if (dbz >= s.dbz) step = s;
  return [step.rgb[0], step.rgb[1], step.rgb[2], RADAR_ALPHA];
}

/** Rain rate from reflectivity with the Marshall-Palmer relation Z = 200 R^1.6. An estimate, not a gauge. */
export function rainRateMmH(dbz: number): number {
  return (10 ** (dbz / 10) / 200) ** (1 / 1.6);
}

export interface RadarBand {
  label: string;
  fromDbz: number;
  toDbz: number | null;
}

export const BANDS: readonly RadarBand[] = [
  { label: "Light", fromDbz: 10, toDbz: 25 },
  { label: "Moderate", fromDbz: 25, toDbz: 36 },
  { label: "Heavy", fromDbz: 36, toDbz: 48 },
  { label: "Intense", fromDbz: 48, toDbz: null },
];

export function bandFor(dbz: number): RadarBand | null {
  return BANDS.find((b) => dbz >= b.fromDbz && (b.toDbz === null || dbz < b.toDbz)) ?? null;
}

/** Approximate rain-rate text for a band, e.g. "0.2–1 mm/h" or ">12 mm/h". */
export function bandRateText(b: RadarBand): string {
  const fmt = (v: number) => (v < 1 ? v.toFixed(1) : String(Math.round(v)));
  const lo = fmt(rainRateMmH(b.fromDbz));
  return b.toDbz === null ? `>${lo} mm/h` : `${lo}–${fmt(rainRateMmH(b.toDbz))} mm/h`;
}

/** A CSS gradient with hard stops, one equal segment per step, for the legend bar. */
export function stepsGradientCss(): string {
  const n = STEPS.length;
  const parts = STEPS.map((s, i) => `rgb(${s.rgb.join(",")}) ${((i / n) * 100).toFixed(2)}% ${(((i + 1) / n) * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}
