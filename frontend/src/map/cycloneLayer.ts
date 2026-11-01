import type { Cyclone, TrackPoint } from "../api/types";
import type { MapPalette } from "./palette";
import { project, type Size, type View } from "./projection";
import { formatTrackTime } from "./time";

export const CLASS_COLOR: Record<string, string> = {
  TD: "#7dd3fc",
  TS: "#fde047",
  HU: "#fb923c",
};
const OTHER_CLASS_COLOR = "#e879f9";

export const CLASS_LABEL: Record<string, string> = {
  TD: "Tropical depression",
  TS: "Tropical storm",
  HU: "Cyclone",
};

const ALERT_FILL: Record<string, string> = {
  Red: "rgba(239,68,68,0.16)",
  Orange: "rgba(249,115,22,0.16)",
  Green: "rgba(45,212,150,0.14)",
};
const ALERT_STROKE: Record<string, string> = {
  Red: "rgba(248,113,113,0.85)",
  Orange: "rgba(251,146,60,0.85)",
  Green: "rgba(52,211,153,0.85)",
};
const WIND_FILL: Record<number, string> = {
  60: "rgba(45,212,150,0.13)",
  90: "rgba(250,204,21,0.17)",
  120: "rgba(239,68,68,0.24)",
};

export const classColor = (cls: string | null) => (cls ? CLASS_COLOR[cls] ?? OTHER_CLASS_COLOR : OTHER_CLASS_COLOR);

export interface CycloneHit {
  id: string;
  x: number;
  y: number;
}

/** Index of the track vertex nearest the storm's current position; later vertices are forecast. */
export function currentIndex(c: Cyclone): number {
  let best = 0;
  let bestD = Infinity;
  c.track.forEach((p, i) => {
    const d = (p.lon - c.center[0]) ** 2 + (p.lat - c.center[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function polygon(ctx: CanvasRenderingContext2D, ring: number[][], view: View, size: Size) {
  ring.forEach(([lon, lat], i) => {
    const [x, y] = project(view, size, lon, lat);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawSpiral(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, color: string, ring: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(10,20,40,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  ctx.rotate(angle);
  ctx.strokeStyle = "rgba(10,20,40,0.92)";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (let arm = 0; arm < 2; arm++) {
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.1) {
      const a = t * 4.2 + arm * Math.PI;
      const rr = 1.5 + t * (r - 3);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, p: MapPalette) {
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = p.labelHalo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = p.label;
  ctx.fillText(text, x, y);
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  c: Cyclone,
  view: View,
  size: Size,
  p: MapPalette,
  selected: boolean,
  angle: number,
): CycloneHit {
  const idx = currentIndex(c);
  ctx.save();
  ctx.globalAlpha = c.active ? 1 : 0.55;
  ctx.lineJoin = "round";

  // Uncertainty cone
  if (c.cone.length) {
    ctx.beginPath();
    for (const ring of c.cone) polygon(ctx, ring, view, size);
    ctx.fillStyle = ALERT_FILL[c.alert] ?? ALERT_FILL.Green;
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = ALERT_STROKE[c.alert] ?? ALERT_STROKE.Green;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Wind footprints, widest first so stronger winds sit on top
  for (const w of c.windFields) {
    ctx.beginPath();
    polygon(ctx, w.ring, view, size);
    ctx.fillStyle = WIND_FILL[w.kph] ?? "rgba(255,255,255,0.1)";
    ctx.fill();
  }

  // Track: dark casing, then coloured segments; dashed once it is forecast
  const pts = c.track.map((t) => project(view, size, t.lon, t.lat));
  for (const pass of ["casing", "colour"] as const) {
    for (let i = 1; i < pts.length; i++) {
      const forecast = i > idx;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.setLineDash(forecast ? [9, 6] : []);
      ctx.lineCap = "round";
      if (pass === "casing") {
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(8,18,38,0.65)";
      } else {
        ctx.lineWidth = 3;
        ctx.strokeStyle = classColor(c.track[i].cls);
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Forecast points with times
  ctx.font = "600 11px Onest, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  let lastLabel: [number, number] | null = null;
  c.track.forEach((t: TrackPoint, i) => {
    if (i <= idx) return;
    const [x, y] = pts[i];
    ctx.fillStyle = classColor(t.cls);
    ctx.strokeStyle = "rgba(8,18,38,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    if (t.time && view.zoom >= 4.2) {
      if (!lastLabel || Math.hypot(x - lastLabel[0], y - lastLabel[1]) > 70) {
        haloText(ctx, formatTrackTime(t.time), x + 9, y - 9, p);
        lastLabel = [x, y];
      }
    }
  });

  // Current position
  const [cx, cy] = project(view, size, c.center[0], c.center[1]);
  const color = classColor(c.track[idx]?.cls ?? null);
  if (selected) {
    ctx.strokeStyle = p.label;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawSpiral(ctx, cx, cy, 11, angle, color, "rgba(8,18,38,0.35)");
  ctx.font = "700 13px Onest, system-ui, sans-serif";
  haloText(ctx, c.name, cx + 20, cy - 2, p);
  if (c.windKph !== null) {
    ctx.font = "500 11px Onest, system-ui, sans-serif";
    haloText(ctx, `max ${Math.round(c.windKph)} km/h`, cx + 20, cy + 13, p);
  }
  ctx.restore();
  return { id: c.id, x: cx, y: cy };
}

/** Draw ended storms first (dimmed), active ones on top. Returns screen positions for hit-testing. */
export function drawCyclones(
  ctx: CanvasRenderingContext2D,
  cyclones: Cyclone[],
  view: View,
  size: Size,
  p: MapPalette,
  selectedId: string | null,
  angle: number,
): CycloneHit[] {
  const ordered = [...cyclones].sort((a, b) => Number(a.active) - Number(b.active));
  return ordered.map((c) => drawOne(ctx, c, view, size, p, c.id === selectedId, angle));
}

export function hitCyclone(hits: CycloneHit[], x: number, y: number, radius = 26): string | null {
  let best: string | null = null;
  let bestD = radius;
  for (const h of hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= bestD) {
      bestD = d;
      best = h.id;
    }
  }
  return best;
}
