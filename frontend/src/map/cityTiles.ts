import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import type { TileId } from "./projection";

/** Free OpenStreetMap vector tiles. No key; the current tile path comes from this document. */
export const CITY_TILEJSON_URL = "https://tiles.openfreemap.org/planet";

/** Only the layers the map draws. The data's own boundary lines are left out on purpose: borders come from the app's own India geometry. */
const KEEP = new Set(["water", "waterway", "landcover", "landuse", "park", "building", "transportation", "place", "water_name"]);

export interface CityFeature {
  cls: string;
  name?: string;
  /** 1 point, 2 line, 3 polygon. */
  type: 1 | 2 | 3;
  /** Rings or lines in tile units (0 to extent, with a little overshoot). */
  rings: [number, number][][];
}

export interface CityTile {
  extent: number;
  layers: Record<string, CityFeature[]>;
}

export function decodeCityTile(buffer: ArrayBuffer): CityTile {
  const tile = new VectorTile(new Pbf(new Uint8Array(buffer)));
  const out: CityTile = { extent: 4096, layers: {} };
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (!KEEP.has(name)) continue;
    out.extent = layer.extent;
    const features: CityFeature[] = [];
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type < 1 || f.type > 3) continue;
      const props = f.properties;
      features.push({
        cls: String(props.class ?? ""),
        name: (props["name:en"] ?? props.name) as string | undefined,
        type: f.type as 1 | 2 | 3,
        rings: f.loadGeometry().map((ring) => ring.map((p): [number, number] => [p.x, p.y])),
      });
    }
    out.layers[name] = features;
  }
  return out;
}

export function cityTileUrl(template: string, t: TileId): string {
  return template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y));
}

// ---- loading ---------------------------------------------------------------------------------

const MAX_PARALLEL = 6;
const CACHE_LIMIT = 160;

const cache = new Map<string, CityTile>();
const inflight = new Map<string, Promise<CityTile | null>>();
let template: Promise<string | null> | null = null;
let queue: (() => void)[] = [];
let running = 0;

async function fetchTemplate(): Promise<string | null> {
  try {
    const res = await fetch(CITY_TILEJSON_URL);
    if (!res.ok) return null;
    const json = (await res.json()) as { tiles?: string[] };
    return json.tiles?.[0] ?? null;
  } catch {
    return null;
  }
}

function getTemplate(): Promise<string | null> {
  if (!template) {
    template = fetchTemplate().then((t) => {
      if (t === null) template = null; // try again on the next request
      return t;
    });
  }
  return template;
}

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    running++;
    queue.shift()!();
  }
}

async function fetchTile(t: TileId): Promise<CityTile | null> {
  try {
    const tpl = await getTemplate();
    if (!tpl) return null;
    const res = await fetch(cityTileUrl(tpl, t));
    if (!res.ok) return null;
    return decodeCityTile(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const keyOf = (t: TileId) => `${t.z}/${t.x}/${t.y}`;

export function cachedCityTile(t: TileId): CityTile | undefined {
  const k = keyOf(t);
  const hit = cache.get(k);
  if (hit) {
    cache.delete(k); // refresh LRU order
    cache.set(k, hit);
  }
  return hit;
}

/** Load one street-level tile. Resolves null when unavailable; failures are retried on the next request. */
export function loadCityTile(t: TileId): Promise<CityTile | null> {
  const k = keyOf(t);
  const hit = cache.get(k);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(k);
  if (pending) return pending;
  const p = new Promise<CityTile | null>((resolve) => {
    queue.push(() => {
      void fetchTile(t).then((tile) => {
        running--;
        resolve(tile);
        pump();
      });
    });
    pump();
  }).then((tile) => {
    inflight.delete(k);
    if (tile) {
      cache.set(k, tile);
      while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    }
    return tile;
  });
  inflight.set(k, p);
  return p;
}

/** Forget everything loaded. For tests. */
export function resetCityTiles() {
  cache.clear();
  inflight.clear();
  queue = [];
  running = 0;
  template = null;
}
