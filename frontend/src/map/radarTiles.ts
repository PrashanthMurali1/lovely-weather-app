import type { TileId } from "./projection";
import { recolour } from "./radarScale";

export const TILE_PX = 512;
/** Highest tile level the radar server provides at 512 px. */
export const MAX_TILE_Z = 6;
export const MIN_TILE_Z = 2;

// The tile server allows 100 requests per minute per IP, so launches are spaced out.
const MIN_GAP_MS = 700;
const MAX_PARALLEL = 4;
const CACHE_LIMIT = 240;

/** The service worker's tile cache (vite.config.ts). Tiles it holds need no network, so no pacing. */
export const RADAR_TILE_CACHE = "radar-tiles";

export type RadarTile = HTMLCanvasElement | null;

interface Job {
  url: string;
  priority: number;
  resolve: (t: RadarTile) => void;
}

const cache = new Map<string, RadarTile>();
const inflight = new Map<string, Promise<RadarTile>>();
let queue: Job[] = [];
let running = 0;
let lastLaunch = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export function tileUrl(host: string, path: string, t: TileId): string {
  // Colour scheme 2 with no smoothing: exact reflectivity colours we can decode.
  return `${host}${path}/${TILE_PX}/${t.z}/${t.x}/${t.y}/2/0_0.png`;
}

export function tileZFor(zoom: number): number {
  return Math.max(MIN_TILE_Z, Math.min(MAX_TILE_Z, Math.round(zoom) - 1));
}

export function cachedTile(url: string): RadarTile | undefined {
  const hit = cache.get(url);
  if (hit !== undefined) {
    cache.delete(url); // refresh LRU order
    cache.set(url, hit);
  }
  return hit;
}

export async function isCachedLocally(url: string): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    return !!(await caches.match(url, { cacheName: RADAR_TILE_CACHE }));
  } catch {
    return false;
  }
}

async function fetchAndRecolour(url: string): Promise<RadarTile> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, canvas.width, canvas.height);
    recolour(px.data);
    g.putImageData(px, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

function pump() {
  if (timer || running >= MAX_PARALLEL || queue.length === 0) return;
  const wait = lastLaunch + MIN_GAP_MS - Date.now();
  if (wait > 0) {
    timer = setTimeout(() => {
      timer = null;
      pump();
    }, wait);
    return;
  }
  queue.sort((a, b) => a.priority - b.priority);
  const job = queue.shift()!;
  running++;
  lastLaunch = Date.now();
  void fetchAndRecolour(job.url).then((tile) => {
    running--;
    job.resolve(tile);
    pump();
  });
  pump();
}

function remember(url: string, tile: RadarTile) {
  if (tile === null) return; // failures are retried on the next request
  cache.set(url, tile);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

/** Load one recoloured tile. Lower priority numbers load first. Resolves null on failure. */
export function loadTile(url: string, priority = 0): Promise<RadarTile> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(url);
  if (pending) {
    const queued = queue.find((j) => j.url === url);
    if (queued && priority < queued.priority) queued.priority = priority;
    return pending;
  }
  const p = isCachedLocally(url)
    .then((local) =>
      local
        ? fetchAndRecolour(url) // already on this device: no network, so no need to wait our turn
        : new Promise<RadarTile>((resolve) => {
            queue.push({ url, priority, resolve });
            pump();
          }),
    )
    .then((tile) => {
      inflight.delete(url);
      remember(url, tile);
      return tile;
    });
  inflight.set(url, p);
  return p;
}

/** Drop queued work that is no longer wanted (the view or frame moved on). */
export function cancelQueued(keep: (url: string) => boolean) {
  const dropped = queue.filter((j) => !keep(j.url));
  queue = queue.filter((j) => keep(j.url));
  for (const j of dropped) {
    inflight.delete(j.url);
    j.resolve(null);
  }
}

export function clearTileCache() {
  cache.clear();
}
