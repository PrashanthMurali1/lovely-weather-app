import { TILE, latToY, lonToX } from "./projection";

interface RawShape {
  id?: string;
  name: string;
  rings: number[][];
}

interface RawGeo {
  box: { w: number; e: number; s: number; n: number };
  land: RawShape[];
  indiaStates: RawShape[];
  cities: { name: string; lon: number; lat: number; pop: number; capital: boolean }[];
}

/** A ring in normalised Mercator space (0..1), so drawing is two multiplies per vertex. */
export interface Ring {
  uv: Float64Array;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

export interface Shape {
  id: string;
  name: string;
  rings: Ring[];
}

export interface City {
  name: string;
  lon: number;
  lat: number;
  pop: number;
  capital: boolean;
}

export interface Geo {
  land: Shape[];
  states: Shape[];
  cities: City[];
  region: { west: number; south: number; east: number; north: number };
}

const unit = (lon: number, lat: number): [number, number] => [lonToX(lon, 0) / TILE, latToY(lat, 0) / TILE];

function prepareRing(flat: number[]): Ring {
  const n = flat.length / 2;
  const uv = new Float64Array(n * 2);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < n; i++) {
    const [u, v] = unit(flat[i * 2], flat[i * 2 + 1]);
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return { uv, minU, maxU, minV, maxV };
}

const prepareShapes = (shapes: RawShape[]): Shape[] =>
  shapes.map((s) => ({ id: s.id ?? s.name, name: s.name, rings: s.rings.map(prepareRing) }));

export function prepareGeo(raw: RawGeo): Geo {
  return {
    land: prepareShapes(raw.land),
    states: prepareShapes(raw.indiaStates),
    cities: raw.cities,
    region: { west: raw.box.w, south: raw.box.s, east: raw.box.e, north: raw.box.n },
  };
}

let loading: Promise<Geo> | null = null;

/** The geometry is a separate chunk so the forecast view never pays for it. */
export function loadGeo(): Promise<Geo> {
  loading ??= import("./geo.json").then((m) => prepareGeo(m.default as unknown as RawGeo));
  return loading;
}
