import { fitBounds, type Size, type View } from "./projection";

/** The whole subcontinent, with room for Kashmir to the north. */
export const INDIA_VIEW = { west: 62, south: 4, east: 100, north: 38 };
/** City scale: a few degrees across, so the place and its surrounding coast or districts fill the map. */
export const PLACE_ZOOM = 8.5;

/** Where the map opens: on the selected place, or on all of India when there is none. */
export function startView(place: { lat: number; lon: number } | null, size: Size): View {
  if (place) return { lon: place.lon, lat: place.lat, zoom: PLACE_ZOOM };
  return fitBounds(INDIA_VIEW, size, 12);
}
