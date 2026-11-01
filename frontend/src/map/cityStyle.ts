import { MAX_ZOOM } from "./projection";

/** The street-level layer starts to fade in at this map zoom and is fully there at CITY_FULL_ZOOM. */
export const CITY_START_ZOOM = 9;
export const CITY_FULL_ZOOM = 10;
/** The vector tile server's deepest level; closer views reuse it. */
const SERVER_MAX_Z = 14;

const RADAR_OPACITY_FAR = 0.92;
const RADAR_OPACITY_NEAR = 0.86;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function cityAlpha(zoom: number): number {
  return clamp01((zoom - CITY_START_ZOOM) / (CITY_FULL_ZOOM - CITY_START_ZOOM));
}

/** Radar thins out as the viewer zooms in, so streets and neighbourhoods stay readable beneath it. */
export function radarOpacity(zoom: number): number {
  const t = clamp01((zoom - 9) / 3);
  return RADAR_OPACITY_FAR + (RADAR_OPACITY_NEAR - RADAR_OPACITY_FAR) * t;
}

/** Tile level whose tiles come out about 512 px on screen (our world is 256 px at zoom 0). */
export function cityTileZ(zoom: number): number {
  return Math.max(0, Math.min(SERVER_MAX_Z, Math.round(Math.min(zoom, MAX_ZOOM)) - 1));
}

export interface RoadStyle {
  width: number;
  /** Draw order: larger ranks are painted on top. */
  rank: number;
  kind: "road" | "path" | "rail";
}

// class -> [first zoom it is drawn, width in px at zoom 12, draw rank, kind]
const ROADS: Record<string, [number, number, number, RoadStyle["kind"]]> = {
  motorway: [9.5, 3.2, 9, "road"],
  trunk: [9.5, 3.0, 8, "road"],
  primary: [10, 2.6, 7, "road"],
  secondary: [11, 2.2, 6, "road"],
  tertiary: [11.5, 1.8, 5, "road"],
  minor: [12.5, 1.4, 4, "road"],
  service: [14, 0.9, 3, "road"],
  path: [14.5, 0.7, 2, "path"],
  track: [14.5, 0.7, 2, "path"],
  rail: [11, 0.8, 1, "rail"],
};

/** How to draw a road class at this zoom, or null when it is too small to show or not drawn at all. */
export function roadStyle(cls: string, zoom: number): RoadStyle | null {
  const row = ROADS[cls];
  if (!row || zoom < row[0]) return null;
  const width = Math.max(0.6, Math.min(16, row[1] * 2 ** ((zoom - 12) * 0.5)));
  return { width, rank: row[2], kind: row[3] };
}

// place class -> first zoom its names are shown. Countries and states are not labelled at city scale.
const PLACES: Record<string, number> = {
  city: 0,
  town: 9,
  village: 11.5,
  suburb: 11.5,
  quarter: 12.5,
  neighbourhood: 13,
  hamlet: 13,
};

export function placeVisible(cls: string, zoom: number): boolean {
  const from = PLACES[cls];
  return from !== undefined && zoom >= from;
}
