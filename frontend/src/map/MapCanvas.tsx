import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Cyclone, RadarFrames } from "../api/types";
import type { Theme } from "../hooks/useTheme";
import { drawBasemap, drawCities, drawPlaceMarker, drawScaleBar } from "./basemap";
import { drawCityGround, drawCityLabels } from "./cityLayer";
import { cityAlpha, cityTileZ, radarOpacity } from "./cityStyle";
import { cachedCityTile, loadCityTile } from "./cityTiles";
import { drawCyclones, hitCyclone, type CycloneHit } from "./cycloneLayer";
import { warmIndices } from "./frames";
import { loadGeo, type Geo } from "./geo";
import { PALETTES } from "./palette";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampView,
  fitBounds,
  panBy,
  project,
  tileRect,
  visibleTiles,
  zoomAround,
  type Size,
  type View,
} from "./projection";
import { clipToView, drawRadar, type RadarDraw } from "./radarRender";
import { cachedTile, cancelQueued, loadTile, tileUrl, tileZFor } from "./radarTiles";
import { INDIA_VIEW, PLACE_ZOOM, startView } from "./startView";

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitRegion: () => void;
  flyToPlace: () => void;
  flyToCyclone: (c: Cyclone) => void;
}

interface Props {
  theme: Theme;
  place: { lat: number; lon: number } | null;
  radar: RadarFrames | null;
  frameIndex: number;
  showRadar: boolean;
  /** Load every frame, not just the newest few: set once the viewer plays or scrubs the loop. */
  prefetchAll: boolean;
  cyclones: Cyclone[];
  showCyclones: boolean;
  selectedCycloneId: string | null;
  onSelectCyclone: (id: string | null) => void;
  /** Reports, per radar frame, whether every tile for the current view is loaded. */
  onFramesReady: (ready: boolean[]) => void;
  /** Reports whether the view is at its widest or closest, so the zoom buttons can grey out. */
  onZoomLimits: (limits: { atMin: boolean; atMax: boolean }) => void;
  label: string;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

const MapCanvas = forwardRef<MapHandle, Props>(function MapCanvas(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const geoRef = useRef<Geo | null>(null);
  const sizeRef = useRef<Size>({ w: 320, h: 420 });
  const dprRef = useRef(1);
  const viewRef = useRef<View>({ lon: 80, lat: 17, zoom: 4 });
  const hitsRef = useRef<CycloneHit[]>([]);
  const frameRaf = useRef(0);
  const flyRaf = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReady = useRef<string>("");
  const lastLimits = useRef<string>("");
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);

  // ---- tiles ---------------------------------------------------------------------------------
  const framePath = (i: number) => propsRef.current.radar?.frames[i]?.path;

  const tilesForView = useCallback(() => {
    const v = viewRef.current;
    return visibleTiles(v, sizeRef.current, tileZFor(v.zoom));
  }, []);

  const reportReady = useCallback(() => {
    const { radar, onFramesReady } = propsRef.current;
    if (!radar) return;
    const tiles = tilesForView();
    const ready = radar.frames.map((f) => tiles.every((t) => cachedTile(tileUrl(radar.host, f.path, t)) !== undefined));
    const key = ready.map(Number).join("");
    if (key !== lastReady.current) {
      lastReady.current = key;
      onFramesReady(ready);
    }
  }, [tilesForView]);

  // ---- drawing -------------------------------------------------------------------------------
  const draw = useCallback(() => {
    frameRaf.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { theme, place, radar, frameIndex, showRadar, cyclones, showCyclones, selectedCycloneId } = propsRef.current;
    const size = sizeRef.current;
    const view = viewRef.current;
    const palette = PALETTES[theme];
    const dpr = dprRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const geo = geoRef.current;
    const city = cityAlpha(view.zoom);
    if (city >= 1) {
      // Close in, the street-level layer replaces the country-scale shapes entirely.
      ctx.fillStyle = palette.landIndia;
      ctx.fillRect(0, 0, size.w, size.h);
    } else if (geo) {
      drawBasemap(ctx, geo, view, size, palette);
    } else {
      ctx.fillStyle = palette.oceanBottom;
      ctx.fillRect(0, 0, size.w, size.h);
    }
    if (city > 0) drawCityGround(ctx, view, size, palette, theme, dpr, city);

    if (showRadar && radar) {
      const path = framePath(frameIndex);
      if (path) {
        const z = tileZFor(view.zoom);
        const items: RadarDraw[] = [];
        for (const t of visibleTiles(view, size, z)) {
          const r = tileRect(view, size, t);
          const tile = cachedTile(tileUrl(radar.host, path, t));
          if (tile) {
            const d = clipToView({ field: tile, ...r, u0: 0, v0: 0, u1: 1, v1: 1 }, size.w, size.h);
            if (d) items.push(d);
            continue;
          }
          // Not loaded yet: borrow the matching quarter of the coarser parent tile if we have it.
          if (t.z > 0) {
            const parent = cachedTile(tileUrl(radar.host, path, { z: t.z - 1, x: t.x >> 1, y: t.y >> 1 }));
            if (parent) {
              const u0 = (t.x & 1) * 0.5;
              const v0 = (t.y & 1) * 0.5;
              const d = clipToView({ field: parent, ...r, u0, v0, u1: u0 + 0.5, v1: v0 + 0.5 }, size.w, size.h);
              if (d) items.push(d);
            }
          }
        }
        drawRadar(ctx, items, size.w, size.h, dpr, radarOpacity(view.zoom));
      }
    }

    // Keep place names clear of storm labels and of the selected place's own label.
    const avoid = showCyclones
      ? cyclones.map((c) => {
          const [x, y] = project(view, size, c.center[0], c.center[1]);
          return { x: x - 16, y: y - 22, w: 150, h: 48 };
        })
      : [];
    if (city < 1 && geo) drawCities(ctx, geo, view, size, palette, avoid);
    if (city > 0) {
      if (place) {
        const [mx, my] = project(view, size, place.lon, place.lat);
        avoid.push({ x: mx - 14, y: my - 14, w: 110, h: 28 });
      }
      drawCityLabels(ctx, view, size, palette, city, avoid);
    }

    if (showCyclones) {
      const angle = reducedMotion() ? 0 : (performance.now() / 1800) % (Math.PI * 2);
      hitsRef.current = drawCyclones(ctx, cyclones, view, size, palette, selectedCycloneId, angle);
    } else {
      hitsRef.current = [];
    }

    if (place) drawPlaceMarker(ctx, view, size, palette, place.lon, place.lat);
    drawScaleBar(ctx, view, size, palette);
  }, []);

  const invalidate = useCallback(() => {
    if (!frameRaf.current) frameRaf.current = requestAnimationFrame(draw);
  }, [draw]);

  // ---- radar loading -------------------------------------------------------------------------
  const requestTiles = useCallback(
    (settled: boolean) => {
      const { radar, frameIndex, showRadar, prefetchAll } = propsRef.current;
      if (!showRadar || !radar) return;
      const warm = new Set(warmIndices(radar.frames.length));
      const tiles = tilesForView();
      const keep = new Set<string>();
      const wanted: { url: string; priority: number }[] = [];
      radar.frames.forEach((f, i) => {
        const priority = i === frameIndex ? 0 : 1 + Math.abs(i - frameIndex);
        for (const t of tiles) {
          const url = tileUrl(radar.host, f.path, t);
          keep.add(url);
          if (i === frameIndex || (settled && (prefetchAll || warm.has(i)))) wanted.push({ url, priority });
        }
      });
      cancelQueued((url) => keep.has(url));
      for (const w of wanted) {
        if (cachedTile(w.url) !== undefined) continue;
        void loadTile(w.url, w.priority).then(() => {
          invalidate();
          reportReady();
        });
      }
      reportReady();
    },
    [invalidate, reportReady, tilesForView],
  );

  const requestCityTiles = useCallback(() => {
    const v = viewRef.current;
    if (cityAlpha(v.zoom) <= 0) return;
    for (const t of visibleTiles(v, sizeRef.current, cityTileZ(v.zoom))) {
      if (cachedCityTile(t)) continue;
      void loadCityTile(t).then((tile) => {
        if (tile) invalidate();
      });
    }
  }, [invalidate]);

  /** After any view change: fetch what the current frame needs now, the rest once things settle. */
  const viewChanged = useCallback(() => {
    const { zoom } = viewRef.current;
    const limits = `${zoom <= MIN_ZOOM + 0.01}|${zoom >= MAX_ZOOM - 0.01}`;
    if (limits !== lastLimits.current) {
      lastLimits.current = limits;
      propsRef.current.onZoomLimits({ atMin: zoom <= MIN_ZOOM + 0.01, atMax: zoom >= MAX_ZOOM - 0.01 });
    }
    invalidate();
    requestTiles(false);
    requestCityTiles();
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => requestTiles(true), 600);
  }, [invalidate, requestTiles, requestCityTiles]);

  // ---- view control --------------------------------------------------------------------------
  const setView = useCallback(
    (next: View) => {
      const region = geoRef.current?.region ?? { west: 35, south: -12, east: 112, north: 42 };
      viewRef.current = clampView(next, region);
      viewChanged();
    },
    [viewChanged],
  );

  const flyTo = useCallback(
    (target: View) => {
      cancelAnimationFrame(flyRaf.current);
      if (reducedMotion()) {
        setView(target);
        return;
      }
      const from = viewRef.current;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 520);
        const e = easeOut(t);
        setView({
          lon: from.lon + (target.lon - from.lon) * e,
          lat: from.lat + (target.lat - from.lat) * e,
          zoom: from.zoom + (target.zoom - from.zoom) * e,
        });
        if (t < 1) flyRaf.current = requestAnimationFrame(step);
      };
      flyRaf.current = requestAnimationFrame(step);
    },
    [setView],
  );

  const fitRegion = useCallback(() => flyTo(fitBounds(INDIA_VIEW, sizeRef.current, 12)), [flyTo]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const s = sizeRef.current;
        flyTo(zoomAround(viewRef.current, s, s.w / 2, s.h / 2, viewRef.current.zoom + 1));
      },
      zoomOut: () => {
        const s = sizeRef.current;
        flyTo(zoomAround(viewRef.current, s, s.w / 2, s.h / 2, viewRef.current.zoom - 1));
      },
      fitRegion,
      flyToPlace: () => {
        const p = propsRef.current.place;
        if (p) flyTo({ lon: p.lon, lat: p.lat, zoom: PLACE_ZOOM });
      },
      flyToCyclone: (c) => flyTo({ lon: c.center[0], lat: c.center[1], zoom: 5.4 }),
    }),
    [fitRegion, flyTo],
  );

  // ---- setup: size, geometry, input ----------------------------------------------------------
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let first = true;

    const resize = () => {
      const w = Math.max(1, Math.round(wrap.clientWidth));
      const h = Math.max(1, Math.round(wrap.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (first) {
        first = false;
        viewRef.current = startView(propsRef.current.place, { w, h });
      }
      viewChanged();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let alive = true;
    void loadGeo().then((g) => {
      if (!alive) return;
      geoRef.current = g;
      invalidate();
    });

    // Pointer: one finger pans, two pinch.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; zoom: number } | null = null;
    let travelled = 0;

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const dist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const mid = () => {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    const onDown = (e: PointerEvent) => {
      cancelAnimationFrame(flyRaf.current);
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      travelled = 0;
      if (pointers.size === 2) pinch = { dist: dist(), zoom: viewRef.current.zoom };
      setDragging(true);
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        setHovering(hitCyclone(hitsRef.current, p.x, p.y) !== null);
        return;
      }
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        travelled += Math.abs(dx) + Math.abs(dy);
        setView(panBy(viewRef.current, dx, dy));
      } else if (pointers.size === 2 && pinch) {
        const m = mid();
        const scale = dist() / pinch.dist;
        travelled += 10;
        setView(zoomAround(viewRef.current, sizeRef.current, m.x, m.y, pinch.zoom + Math.log2(scale)));
      }
    };
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) setDragging(false);
      if (wasSingle && travelled < 6 && e.type === "pointerup") {
        propsRef.current.onSelectCyclone(hitCyclone(hitsRef.current, p.x, p.y));
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(flyRaf.current);
      const p = local(e);
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      setView(zoomAround(viewRef.current, sizeRef.current, p.x, p.y, viewRef.current.zoom - delta * 0.0018));
    };
    const onDouble = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      flyTo(zoomAround(viewRef.current, sizeRef.current, e.clientX - r.left, e.clientY - r.top, viewRef.current.zoom + 1));
    };
    const onKey = (e: KeyboardEvent) => {
      const step = 90;
      const s = sizeRef.current;
      const v = viewRef.current;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (moves[e.key]) {
        e.preventDefault();
        setView(panBy(v, moves[e.key][0], moves[e.key][1]));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setView(zoomAround(v, s, s.w / 2, s.h / 2, v.zoom + 0.5));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setView(zoomAround(v, s, s.w / 2, s.h / 2, v.zoom - 0.5));
      } else if (e.key === "0") {
        e.preventDefault();
        fitRegion();
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDouble);
    canvas.addEventListener("keydown", onKey);

    // The storm spiral turns slowly; redraw at ~15 fps while cyclones are showing.
    const spin = setInterval(() => {
      if (!document.hidden && propsRef.current.showCyclones && propsRef.current.cyclones.length && !reducedMotion()) invalidate();
    }, 66);

    return () => {
      alive = false;
      ro.disconnect();
      clearInterval(spin);
      cancelAnimationFrame(frameRaf.current);
      frameRaf.current = 0; // StrictMode re-runs this effect: a stale id would block every later draw
      cancelAnimationFrame(flyRaf.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDouble);
      canvas.removeEventListener("keydown", onKey);
    };
  }, [fitRegion, flyTo, invalidate, setView, viewChanged]);

  // Redraw when anything the picture depends on changes; fetch tiles when the frame list or layer changes.
  const { theme, frameIndex, showRadar, showCyclones, cyclones, selectedCycloneId, radar, place, prefetchAll } = props;
  useEffect(() => {
    invalidate();
  }, [theme, frameIndex, showRadar, showCyclones, cyclones, selectedCycloneId, place, invalidate]);
  // Follow the viewer to a different city; the first place is already the opening view.
  const shownPlace = useRef(place ? `${place.lat},${place.lon}` : "");
  useEffect(() => {
    const key = place ? `${place.lat},${place.lon}` : "";
    if (key === shownPlace.current) return;
    shownPlace.current = key;
    if (place) flyTo({ lon: place.lon, lat: place.lat, zoom: PLACE_ZOOM });
  }, [place, flyTo]);
  useEffect(() => {
    lastReady.current = "";
    viewChanged();
  }, [radar, frameIndex, showRadar, viewChanged]);
  useEffect(() => {
    if (prefetchAll) requestTiles(true);
  }, [prefetchAll, requestTiles]);

  return (
    <div ref={wrapRef} className="map-canvas-wrap">
      <canvas
        ref={canvasRef}
        className={`map-canvas${dragging ? " is-dragging" : hovering ? " is-hovering" : ""}`}
        tabIndex={0}
        role="application"
        aria-label={props.label}
        aria-roledescription="interactive map"
      />
    </div>
  );
});

export default MapCanvas;
