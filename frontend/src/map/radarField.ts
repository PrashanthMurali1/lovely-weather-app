import { MIN_DBZ, dbzFromRgb, stepRgba } from "./radarScale";

/** The byte range 0..255 of an intensity channel covers 0..FIELD_MAX_DBZ. */
export const FIELD_MAX_DBZ = 100;

export const dbzOfByte = (b: number) => (b / 255) * FIELD_MAX_DBZ;

/**
 * One tile as data rather than a picture, two bytes per pixel:
 *   byte 0: reflectivity of the rain in and around the pixel (0..255 maps to 0..FIELD_MAX_DBZ)
 *   byte 1: how much rain surrounds the pixel (0 clear .. 255 solid), the basis of the outline.
 * The graphics card smooths both channels per screen pixel, so the picture stays sharp at any zoom.
 */
export interface RadarField {
  w: number;
  h: number;
  data: Uint8Array;
}

/** Separable [1 2 1] / 4 blur, clamped at the edges. */
function blur(src: Float32Array, w: number, h: number): Float32Array {
  const mid = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const l = src[r + (x > 0 ? x - 1 : 0)];
      const rt = src[r + (x < w - 1 ? x + 1 : x)];
      mid[r + x] = (l + 2 * src[r + x] + rt) / 4;
    }
  }
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const up = (y > 0 ? y - 1 : 0) * w;
    const dn = (y < h - 1 ? y + 1 : y) * w;
    const r = y * w;
    for (let x = 0; x < w; x++) out[r + x] = (mid[up + x] + 2 * mid[r + x] + mid[dn + x]) / 4;
  }
  return out;
}

/** Decode a tile's colours into reflectivity and build its smooth coverage and intensity channels. */
export function buildRadarField(rgba: Uint8ClampedArray, w: number, h: number): RadarField {
  const n = w * h;
  const mask = new Float32Array(n);
  const weighted = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (rgba[p + 3] === 0) continue;
    const dbz = dbzFromRgb(rgba[p], rgba[p + 1], rgba[p + 2]);
    if (dbz < MIN_DBZ) continue;
    mask[i] = 1;
    weighted[i] = dbz;
  }
  const cover = blur(mask, w, h);
  const value = blur(weighted, w, h);
  // Averaging over echo pixels only keeps strong cores strong and gives edges the colour of the rain beside them.
  let intensity = new Float32Array(n);
  for (let i = 0; i < n; i++) if (cover[i] >= 1e-3) intensity[i] = Math.min(FIELD_MAX_DBZ, value[i] / cover[i]);
  // Carry that intensity a couple of pixels past the edge, so smoothing across the outline never mixes in "empty" and dims its colour.
  for (let pass = 0; pass < 2; pass++) {
    const next = intensity.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (intensity[i] > 0) continue;
        let m = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) m = Math.max(m, intensity[ny * w + nx]);
          }
        }
        next[i] = m;
      }
    }
    intensity = next;
  }
  const data = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    data[i * 2] = Math.round(intensity[i] * (255 / FIELD_MAX_DBZ));
    data[i * 2 + 1] = Math.round(Math.min(1, cover[i]) * 255);
  }
  return { w, h, data };
}

/** The app's colour steps as a 256-entry RGBA lookup, indexed by the intensity byte. */
export function buildColourLut(): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const c = stepRgba(Math.max(MIN_DBZ, dbzOfByte(i)))!;
    lut.set([c[0], c[1], c[2], Math.round(c[3] * 255)], i * 4);
  }
  return lut;
}
