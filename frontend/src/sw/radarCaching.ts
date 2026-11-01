// NOTE: these matchers are serialized into sw.js by workbox, so each must be self-contained:
// no imports, no outer constants.

/** Radar tiles. Their URLs carry a per-frame hash, so a published tile never changes. */
export const isRadarTile = ({ url }: { url: URL }) => url.hostname === "tilecache.rainviewer.com";

export const isRadarFramesApi = ({ url }: { url: URL }) => url.pathname === "/api/radar";

export const isCyclonesApi = ({ url }: { url: URL }) => url.pathname === "/api/cyclones";

/** Street-level vector tiles. The path carries a data version, so a published tile never changes. */
export const isCityTile = ({ url }: { url: URL }) => url.hostname === "tiles.openfreemap.org" && url.pathname.endsWith(".pbf");

/** The document that names the current tile path. */
export const isCityTileJson = ({ url }: { url: URL }) => url.hostname === "tiles.openfreemap.org" && url.pathname === "/planet";
