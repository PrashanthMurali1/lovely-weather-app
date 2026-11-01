import { cachedCityTile, type CityFeature, type CityTile } from "./cityTiles";
import { cityTileZ, placeVisible, roadStyle } from "./cityStyle";
import type { MapPalette } from "./palette";
import { tileRect, visibleTiles, type Size, type TileId, type View } from "./projection";

/** A tile drawn at this many style pixels across, before it is scaled to the screen. */
const STYLE_PX = 512;
const BITMAP_LIMIT = 16;
const BUILDINGS_FROM_ZOOM = 13.5;

const bitmaps = new Map<string, HTMLCanvasElement>();
let paletteKey = "";

const tileKey = (t: TileId, px: number) => `${t.z}/${t.x}/${t.y}@${px}`;

const WOOD = new Set(["wood", "forest"]);
const GREEN = new Set(["grass", "park", "garden", "playground", "pitch", "golf_course", "recreation_ground", "village_green", "farmland"]);

function fillPolys(ctx: CanvasRenderingContext2D, features: CityFeature[], color: string) {
  if (!features.length) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const f of features) {
    for (const ring of f.rings) {
      ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    }
  }
  ctx.fill("evenodd");
}

function strokeLine(ctx: CanvasRenderingContext2D, f: CityFeature) {
  ctx.beginPath();
  for (const line of f.rings) line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

/** Draw one tile's ground (land cover, water, buildings, roads) onto a transparent bitmap. */
function renderGround(tile: CityTile, t: TileId, px: number, p: MapPalette): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const zoom = t.z + 1; // the map zoom at which this tile is 512 style pixels wide
  const unit = px / STYLE_PX; // one style pixel in bitmap pixels
  ctx.scale(px / tile.extent, px / tile.extent);
  const k = tile.extent / px; // one bitmap pixel in tile units
  const w = (styleWidth: number) => styleWidth * unit * k;
  const layer = (name: string) => tile.layers[name] ?? [];

  fillPolys(ctx, layer("landcover").filter((f) => WOOD.has(f.cls)), p.cityWood);
  fillPolys(ctx, layer("landcover").filter((f) => GREEN.has(f.cls)), p.cityPark);
  fillPolys(ctx, layer("landuse").filter((f) => GREEN.has(f.cls) || f.cls === "cemetery"), p.cityPark);
  fillPolys(ctx, layer("landuse").filter((f) => f.cls === "industrial" || f.cls === "commercial" || f.cls === "retail"), p.cityIndustrial);
  fillPolys(ctx, layer("park"), p.cityPark);
  fillPolys(ctx, layer("water").filter((f) => f.type === 3), p.cityWater);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = p.cityWater;
  ctx.lineWidth = w(zoom >= 13 ? 2.4 : 1.4);
  for (const f of layer("waterway")) if (f.type === 2) strokeLine(ctx, f);

  if (zoom >= BUILDINGS_FROM_ZOOM) fillPolys(ctx, layer("building"), p.cityBuilding);

  const roads = layer("transportation")
    .filter((f) => f.type === 2)
    .map((f) => ({ f, s: roadStyle(f.cls, zoom) }))
    .filter((r): r is { f: CityFeature; s: NonNullable<ReturnType<typeof roadStyle>> } => r.s !== null)
    .sort((a, b) => a.s.rank - b.s.rank);

  // Casings first so crossings read cleanly, then the road bodies.
  for (const { f, s } of roads) {
    if (s.kind !== "road" || s.width < 1.6) continue;
    ctx.strokeStyle = s.rank >= 5 ? p.roadMajorCasing : p.roadMinorCasing;
    ctx.lineWidth = w(s.width + 1.6);
    strokeLine(ctx, f);
  }
  for (const { f, s } of roads) {
    if (s.kind === "rail") {
      ctx.strokeStyle = p.rail;
      ctx.lineWidth = w(s.width);
      ctx.setLineDash([w(7), w(6)]);
      strokeLine(ctx, f);
      ctx.setLineDash([]);
      continue;
    }
    ctx.strokeStyle = s.rank >= 5 && s.kind === "road" ? p.roadMajor : p.roadMinor;
    ctx.lineWidth = w(s.width);
    if (s.kind === "path") ctx.setLineDash([w(3), w(3)]);
    strokeLine(ctx, f);
    ctx.setLineDash([]);
  }
  return canvas;
}

function bitmapFor(tile: CityTile, t: TileId, px: number, p: MapPalette): HTMLCanvasElement {
  const key = tileKey(t, px);
  const hit = bitmaps.get(key);
  if (hit) {
    bitmaps.delete(key); // refresh LRU order
    bitmaps.set(key, hit);
    return hit;
  }
  const canvas = renderGround(tile, t, px, p);
  bitmaps.set(key, canvas);
  while (bitmaps.size > BITMAP_LIMIT) bitmaps.delete(bitmaps.keys().next().value as string);
  return canvas;
}

/** Bitmap resolution for a tile shown this many screen pixels wide. */
function bitmapPx(span: number, dpr: number): number {
  return span * dpr > STYLE_PX * 1.25 ? STYLE_PX * 2 : STYLE_PX;
}

/** Street-level ground: land cover, water, buildings and roads, one cached bitmap per tile. */
export function drawCityGround(ctx: CanvasRenderingContext2D, view: View, size: Size, p: MapPalette, themeKey: string, dpr: number, alpha: number) {
  if (paletteKey !== themeKey) {
    bitmaps.clear();
    paletteKey = themeKey;
  }
  const z = cityTileZ(view.zoom);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const t of visibleTiles(view, size, z)) {
    const r = tileRect(view, size, t);
    const px = bitmapPx(r.w, dpr);
    const tile = cachedCityTile(t);
    if (tile) {
      ctx.drawImage(bitmapFor(tile, t, px, p), r.x, r.y, r.w + 0.5, r.h + 0.5);
      continue;
    }
    // Not loaded yet: borrow the matching quarter of an already-drawn parent tile.
    if (t.z > 0) {
      const parent = bitmaps.get(tileKey({ z: t.z - 1, x: t.x >> 1, y: t.y >> 1 }, px)) ?? bitmaps.get(tileKey({ z: t.z - 1, x: t.x >> 1, y: t.y >> 1 }, STYLE_PX));
      if (parent) {
        const half = parent.width / 2;
        ctx.drawImage(parent, (t.x & 1) * half, (t.y & 1) * half, half, half, r.x, r.y, r.w + 0.5, r.h + 0.5);
      }
    }
  }
  ctx.restore();
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Bigger places are placed first and so win any collision.
const PLACE_ORDER: Record<string, number> = { city: 0, town: 1, suburb: 2, quarter: 3, village: 3, neighbourhood: 4, hamlet: 5 };

/** Neighbourhood, city and water names for the tiles in view, thinned so none collide. */
export function drawCityLabels(ctx: CanvasRenderingContext2D, view: View, size: Size, p: MapPalette, alpha: number, avoid: Box[]) {
  const z = cityTileZ(view.zoom);
  const labels: { text: string; x: number; y: number; order: number; water: boolean; big: boolean }[] = [];
  for (const t of visibleTiles(view, size, z)) {
    const tile = cachedCityTile(t);
    if (!tile) continue;
    const r = tileRect(view, size, t);
    const sx = r.w / tile.extent;
    const add = (f: CityFeature, order: number, water: boolean, big: boolean) => {
      const pt = f.rings[0]?.[0];
      if (!pt || !f.name) return;
      const x = r.x + pt[0] * sx;
      const y = r.y + pt[1] * sx;
      if (x < -40 || y < -20 || x > size.w + 40 || y > size.h + 20) return;
      labels.push({ text: f.name, x, y, order, water, big });
    };
    for (const f of tile.layers.place ?? []) {
      if (f.type === 1 && placeVisible(f.cls, view.zoom)) add(f, PLACE_ORDER[f.cls] ?? 6, false, f.cls === "city" || f.cls === "town");
    }
    if (view.zoom >= 10.5) for (const f of tile.layers.water_name ?? []) if (f.type === 1) add(f, 7, true, false);
  }
  labels.sort((a, b) => a.order - b.order);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  const placed: Box[] = [...avoid];
  const seen = new Set<string>();
  for (const l of labels) {
    if (seen.has(l.text)) continue;
    ctx.font = l.water ? "italic 500 11px Onest, system-ui, sans-serif" : l.big ? "600 14px Onest, system-ui, sans-serif" : "500 11.5px Onest, system-ui, sans-serif";
    const w = ctx.measureText(l.text).width;
    const box = { x: l.x - w / 2 - 3, y: l.y - 8, w: w + 6, h: 16 };
    if (placed.some((b) => overlaps(b, box))) continue;
    placed.push(box);
    seen.add(l.text);
    ctx.textAlign = "center";
    ctx.strokeStyle = p.labelHalo;
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = l.water ? p.waterLabel : l.big ? p.label : p.suburbLabel;
    ctx.fillText(l.text, l.x, l.y);
  }
  ctx.restore();
}
