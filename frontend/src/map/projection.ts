// Web Mercator projection and view maths. World size at zoom z is TILE * 2^z pixels.
export const TILE = 256;
export const MIN_ZOOM = 3;
/** The district view: main roads and neighbourhood names, without pulling in street-level tiles. */
export const MAX_ZOOM = 10.5;
const MAX_LAT = 85.05112878;

export interface View {
  lon: number;
  lat: number;
  zoom: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

const worldSize = (zoom: number) => TILE * 2 ** zoom;
const clampLat = (lat: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));

export function lonToX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * worldSize(zoom);
}

export function latToY(lat: number, zoom: number): number {
  const s = Math.sin((clampLat(lat) * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize(zoom);
}

export function xToLon(x: number, zoom: number): number {
  return (x / worldSize(zoom)) * 360 - 180;
}

export function yToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / worldSize(zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Longitude/latitude to canvas pixels for the given view. */
export function project(view: View, size: Size, lon: number, lat: number): [number, number] {
  return [
    lonToX(lon, view.zoom) - lonToX(view.lon, view.zoom) + size.w / 2,
    latToY(lat, view.zoom) - latToY(view.lat, view.zoom) + size.h / 2,
  ];
}

export function unproject(view: View, size: Size, px: number, py: number): [number, number] {
  const x = lonToX(view.lon, view.zoom) + px - size.w / 2;
  const y = latToY(view.lat, view.zoom) + py - size.h / 2;
  return [xToLon(x, view.zoom), yToLat(y, view.zoom)];
}

/** Move the view so the geographic point under (px, py) stays put while zooming. */
export function zoomAround(view: View, size: Size, px: number, py: number, nextZoom: number): View {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
  const [lon, lat] = unproject(view, size, px, py);
  const cx = lonToX(lon, zoom) - (px - size.w / 2);
  const cy = latToY(lat, zoom) - (py - size.h / 2);
  return { zoom, lon: xToLon(cx, zoom), lat: yToLat(cy, zoom) };
}

export function panBy(view: View, dx: number, dy: number): View {
  const x = lonToX(view.lon, view.zoom) - dx;
  const y = latToY(view.lat, view.zoom) - dy;
  return { ...view, lon: xToLon(x, view.zoom), lat: yToLat(y, view.zoom) };
}

/** Keep the view inside the mapped region so panning never reveals empty space. */
export function clampView(view: View, region: Bounds): View {
  return {
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom)),
    lon: Math.max(region.west, Math.min(region.east, view.lon)),
    lat: Math.max(region.south, Math.min(region.north, view.lat)),
  };
}

/** Largest zoom (clamped) at which the bounds fit inside the size with padding. */
export function fitBounds(b: Bounds, size: Size, padding = 24): View {
  const w = Math.max(1, size.w - padding * 2);
  const h = Math.max(1, size.h - padding * 2);
  const spanX = (b.east - b.west) / 360;
  const yTop = latToY(b.north, 0) / TILE;
  const yBottom = latToY(b.south, 0) / TILE;
  const spanY = Math.abs(yBottom - yTop);
  const zoom = Math.min(Math.log2(w / (TILE * spanX)), Math.log2(h / (TILE * spanY)));
  const midY = (yTop + yBottom) / 2;
  return {
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
    lon: (b.west + b.east) / 2,
    lat: yToLat(midY * TILE, 0),
  };
}

export interface TileId {
  x: number;
  y: number;
  z: number;
}

/** On-screen span (px) of one tile at tile level z; it covers 1/2^z of the world at any tile pixel size. */
export function tileSpan(view: View, z: number): number {
  return (TILE * 2 ** view.zoom) / 2 ** z;
}

/** Tiles at level z covering the viewport. */
export function visibleTiles(view: View, size: Size, z: number): TileId[] {
  const span = tileSpan(view, z);
  const left = lonToX(view.lon, view.zoom) - size.w / 2;
  const top = latToY(view.lat, view.zoom) - size.h / 2;
  const max = 2 ** z - 1;
  const x0 = Math.max(0, Math.floor(left / span));
  const x1 = Math.min(max, Math.floor((left + size.w) / span));
  const y0 = Math.max(0, Math.floor(top / span));
  const y1 = Math.min(max, Math.floor((top + size.h) / span));
  const out: TileId[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y, z });
  return out;
}

/** Screen-space rectangle of a tile for the current view. */
export function tileRect(view: View, size: Size, t: TileId) {
  const span = tileSpan(view, t.z);
  return {
    x: t.x * span - lonToX(view.lon, view.zoom) + size.w / 2,
    y: t.y * span - latToY(view.lat, view.zoom) + size.h / 2,
    w: span,
    h: span,
  };
}
