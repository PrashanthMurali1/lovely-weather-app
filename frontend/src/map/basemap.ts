import type { Geo, Ring, Shape } from "./geo";
import type { MapPalette } from "./palette";
import { TILE, latToY, lonToX, project, unproject, type Size, type View } from "./projection";

/** Screen transform for normalised Mercator coordinates. */
export interface Frame {
  world: number;
  left: number;
  top: number;
  w: number;
  h: number;
}

export function frameFor(view: View, size: Size): Frame {
  const world = TILE * 2 ** view.zoom;
  return {
    world,
    left: lonToX(view.lon, view.zoom) - size.w / 2,
    top: latToY(view.lat, view.zoom) - size.h / 2,
    w: size.w,
    h: size.h,
  };
}

function ringVisible(r: Ring, f: Frame): boolean {
  const x0 = r.minU * f.world - f.left;
  const x1 = r.maxU * f.world - f.left;
  const y0 = r.minV * f.world - f.top;
  const y1 = r.maxV * f.world - f.top;
  return x1 >= -8 && x0 <= f.w + 8 && y1 >= -8 && y0 <= f.h + 8;
}

function tracePath(ctx: CanvasRenderingContext2D, shapes: Shape[], f: Frame) {
  ctx.beginPath();
  for (const s of shapes) {
    for (const r of s.rings) {
      if (!ringVisible(r, f)) continue;
      const uv = r.uv;
      ctx.moveTo(uv[0] * f.world - f.left, uv[1] * f.world - f.top);
      // Skip vertices closer than a pixel: invisible at this zoom, and it keeps strokes cheap.
      let lx = uv[0] * f.world;
      let ly = uv[1] * f.world;
      for (let i = 2; i < uv.length; i += 2) {
        const x = uv[i] * f.world;
        const y = uv[i + 1] * f.world;
        if (Math.abs(x - lx) < 0.7 && Math.abs(y - ly) < 0.7 && i < uv.length - 2) continue;
        ctx.lineTo(x - f.left, y - f.top);
        lx = x;
        ly = y;
      }
      ctx.closePath();
    }
  }
}

function graticuleStep(zoom: number): number {
  if (zoom < 3.8) return 10;
  if (zoom < 5.2) return 5;
  if (zoom < 6.6) return 2;
  return 1;
}

function drawGraticule(ctx: CanvasRenderingContext2D, view: View, size: Size, p: MapPalette) {
  const step = graticuleStep(view.zoom);
  const [west, north] = unproject(view, size, 0, 0);
  const [east, south] = unproject(view, size, size.w, size.h);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.graticule;
  ctx.fillStyle = p.graticuleLabel;
  ctx.font = "500 10px Onest, system-ui, sans-serif";
  ctx.beginPath();
  for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
    const [x] = project(view, size, lon, 0);
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, size.h);
  }
  for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
    const [, y] = project(view, size, 0, lat);
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(size.w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.textBaseline = "top";
  for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
    const [x] = project(view, size, lon, 0);
    if (x > 24 && x < size.w - 24) ctx.fillText(`${lon}°E`, x + 4, size.h - 16);
  }
  ctx.textBaseline = "bottom";
  for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
    const [, y] = project(view, size, 0, lat);
    if (y > 24 && y < size.h - 64) ctx.fillText(`${lat}°${lat < 0 ? "S" : "N"}`, 6, y - 2);
  }
  ctx.restore();
}

/** Ocean, graticule, land, state and country borders. */
export function drawBasemap(ctx: CanvasRenderingContext2D, geo: Geo, view: View, size: Size, p: MapPalette) {
  const f = frameFor(view, size);
  const sea = ctx.createLinearGradient(0, 0, 0, size.h);
  sea.addColorStop(0, p.oceanTop);
  sea.addColorStop(1, p.oceanBottom);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, size.w, size.h);

  drawGraticule(ctx, view, size, p);

  ctx.lineJoin = "round";
  const india = geo.land.filter((s) => s.id === "IND");
  const others = geo.land.filter((s) => s.id !== "IND");
  ctx.fillStyle = p.land;
  tracePath(ctx, others, f);
  ctx.fill();
  ctx.fillStyle = p.landIndia;
  tracePath(ctx, india, f);
  ctx.fill();

  if (view.zoom >= 4.2) {
    ctx.strokeStyle = p.stateBorder;
    ctx.lineWidth = 0.8;
    tracePath(ctx, geo.states, f);
    ctx.stroke();
  }
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 1;
  tracePath(ctx, geo.land, f);
  ctx.stroke();
}

function labelMinPop(zoom: number): number {
  if (zoom < 4.3) return 9_000_000;
  if (zoom < 5) return 4_000_000;
  if (zoom < 6) return 2_000_000;
  return 0;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** City dots and labels, largest first, skipping any label that would collide. */
export function drawCities(ctx: CanvasRenderingContext2D, geo: Geo, view: View, size: Size, p: MapPalette, avoid: Box[] = []) {
  const minPop = labelMinPop(view.zoom);
  const placed: Box[] = [...avoid];
  ctx.save();
  ctx.font = "500 12px Onest, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const c of geo.cities) {
    if (c.pop < minPop && !(c.capital && view.zoom >= 4.8)) continue;
    const [x, y] = project(view, size, c.lon, c.lat);
    if (x < -20 || y < -20 || x > size.w + 20 || y > size.h + 20) continue;
    const tw = ctx.measureText(c.name).width;
    const box = { x: x + 7, y: y - 8, w: tw + 4, h: 16 };
    if (placed.some((b) => overlaps(b, box))) continue;
    placed.push(box);
    ctx.fillStyle = p.cityDot;
    ctx.beginPath();
    ctx.arc(x, y, c.capital ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.labelHalo;
    ctx.strokeText(c.name, x + 9, y);
    ctx.fillStyle = p.label;
    ctx.fillText(c.name, x + 9, y);
  }
  ctx.restore();
}

/** The user's selected place: a warm dot with a soft ring. */
export function drawPlaceMarker(ctx: CanvasRenderingContext2D, view: View, size: Size, p: MapPalette, lon: number, lat: number) {
  const [x, y] = project(view, size, lon, lat);
  if (x < -30 || y < -30 || x > size.w + 30 || y > size.h + 30) return;
  ctx.save();
  ctx.fillStyle = p.markerRing;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.marker;
  ctx.strokeStyle = p.labelHalo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/** A scale bar in km, measured along the view's central latitude. */
export function drawScaleBar(ctx: CanvasRenderingContext2D, view: View, size: Size, p: MapPalette) {
  const metresPerPx = (156543.03392 * Math.cos((view.lat * Math.PI) / 180)) / 2 ** view.zoom;
  const targets = [10, 20, 50, 100, 200, 500, 1000, 2000];
  const maxPx = Math.min(120, size.w * 0.25);
  let km = targets[0];
  for (const t of targets) if ((t * 1000) / metresPerPx <= maxPx) km = t;
  const px = (km * 1000) / metresPerPx;
  const x = 14;
  const y = size.h - 34;
  ctx.save();
  ctx.strokeStyle = p.scaleBar;
  ctx.fillStyle = p.scaleBar;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y);
  ctx.lineTo(x + px, y);
  ctx.lineTo(x + px, y - 4);
  ctx.stroke();
  ctx.font = "500 11px Onest, system-ui, sans-serif";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${km} km`, x + 2, y - 6);
  ctx.restore();
}
