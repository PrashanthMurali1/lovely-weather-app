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

// ---- our own ramp: reflectivity -> colour --------------------------------------------------------

export type Rgba = [number, number, number, number];

interface Stop {
  dbz: number;
  rgba: Rgba;
}

/** Light sky blue, through green and amber, to red and violet. Alpha grows with intensity. */
export const RAMP: readonly Stop[] = [
  { dbz: 10, rgba: [125, 211, 252, 0.4] },
  { dbz: 18, rgba: [56, 189, 248, 0.62] },
  { dbz: 25, rgba: [37, 140, 240, 0.74] },
  { dbz: 30, rgba: [45, 212, 150, 0.8] },
  { dbz: 36, rgba: [250, 204, 21, 0.86] },
  { dbz: 42, rgba: [249, 115, 22, 0.9] },
  { dbz: 48, rgba: [239, 68, 68, 0.93] },
  { dbz: 55, rgba: [217, 70, 239, 0.95] },
  { dbz: 65, rgba: [250, 232, 255, 0.97] },
];

export function rampRgba(dbz: number): Rgba | null {
  if (dbz < MIN_DBZ) return null;
  const last = RAMP[RAMP.length - 1];
  if (dbz >= last.dbz) return last.rgba;
  for (let i = 1; i < RAMP.length; i++) {
    const a = RAMP[i - 1];
    const b = RAMP[i];
    if (dbz <= b.dbz) {
      const t = (dbz - a.dbz) / (b.dbz - a.dbz);
      return [
        a.rgba[0] + (b.rgba[0] - a.rgba[0]) * t,
        a.rgba[1] + (b.rgba[1] - a.rgba[1]) * t,
        a.rgba[2] + (b.rgba[2] - a.rgba[2]) * t,
        a.rgba[3] + (b.rgba[3] - a.rgba[3]) * t,
      ];
    }
  }
  return last.rgba;
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

/** Recolour a decoded RGBA tile in place with the app ramp. Transparent pixels stay transparent. */
export function recolour(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const c = rampRgba(dbzFromRgb(data[i], data[i + 1], data[i + 2]));
    if (!c) {
      data[i + 3] = 0;
    } else {
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = Math.round(c[3] * 255);
    }
  }
}
