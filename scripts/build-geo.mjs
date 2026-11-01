// Builds frontend/src/map/geo.json from Natural Earth (public domain).
// Run: node scripts/build-geo.mjs
//
// Borders follow India's official position: the countries come from Natural Earth's India
// point-of-view layer (ne_10m_admin_0_countries_ind), which shows all of Jammu & Kashmir and Ladakh
// (including Gilgit-Baltistan and Aksai Chin) and Arunachal Pradesh as part of India.
// The map draws this geometry itself; nothing here is a hosted map service.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../frontend/src/map/geo.json");

// Region the app maps: Arabian Sea to the South China Sea.
const BOX = { w: 35, e: 112, s: -12, n: 42 };

async function load(name) {
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

const round = (v) => Math.round(v * 100) / 100;

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const c = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + c * dx), p[1] - (a[1] + c * dy));
}

function simplify(points, tol) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

function ringTouchesBox(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return maxX >= BOX.w && minX <= BOX.e && maxY >= BOX.s && minY <= BOX.n;
}

// A polygon becomes a list of rings: [[lon,lat,...flat], ...]
function rings(geom, tol) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  const out = [];
  for (const poly of polys) {
    for (const ring of poly) {
      if (!ringTouchesBox(ring)) continue;
      const s = simplify(ring, tol).map(([x, y]) => [round(x), round(y)]);
      if (s.length < 4) continue;
      out.push(s.flat());
    }
  }
  return out;
}

const countries = await load("ne_10m_admin_0_countries_ind.geojson");
const states = await load("ne_10m_admin_1_states_provinces.geojson");
const places = await load("ne_10m_populated_places_simple.geojson");

const land = [];
for (const f of countries.features) {
  const r = rings(f.geometry, 0.03);
  if (r.length) land.push({ id: f.properties.ADM0_A3, name: f.properties.NAME, rings: r });
}

// The separate Jammu & Kashmir and Ladakh outlines cover only the administered area and would draw
// a line inside India's claimed territory, so those two are left out. The national outline (above)
// already carries the full claimed extent.
const OMIT_STATES = new Set(["Jammu and Kashmir", "Ladakh"]);

const indiaStates = [];
for (const f of states.features) {
  if (f.properties.admin !== "India" || OMIT_STATES.has(f.properties.name)) continue;
  const r = rings(f.geometry, 0.02);
  if (r.length) indiaStates.push({ name: f.properties.name, rings: r });
}

const cities = places.features
  .filter((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const inBox = lon >= BOX.w && lon <= BOX.e && lat >= BOX.s && lat <= BOX.n;
    return inBox && p.adm0name === "India" && (p.pop_max >= 1_500_000 || p.featurecla === "Admin-0 capital");
  })
  .map((f) => ({
    name: f.properties.name,
    lon: round(f.geometry.coordinates[0]),
    lat: round(f.geometry.coordinates[1]),
    pop: f.properties.pop_max,
    capital: f.properties.featurecla === "Admin-0 capital",
  }))
  .sort((a, b) => b.pop - a.pop);

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify({ box: BOX, land, indiaStates, cities });
writeFileSync(OUT, json);
console.log(`land=${land.length} states=${indiaStates.length} cities=${cities.length} bytes=${json.length}`);
