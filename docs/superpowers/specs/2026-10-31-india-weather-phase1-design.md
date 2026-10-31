# India Weather App — Phase 1 Design

Date: 2026-10-31
Status: Draft for review

## 1. Purpose and scope

A free, India-focused weather app. It uses no paid weather APIs, needs no ID submission, and runs no weather model of its own. It is a non-commercial hobby project (no ads, subscriptions or purchases) that will later be released on Google Play as a PWA.

The project is decomposed into separate spec → plan → build cycles:

1. **Phase 1 (this spec):** installable, offline-capable PWA with a FastAPI backend. City search, current conditions, hourly and daily forecasts from one model (ECMWF IFS), caching, attribution.
2. **Phase 1.5:** multi-model comparison (ECMWF IFS and AIFS, NOAA GFS, DWD ICON), plus MET Norway as an extra source and fallback.
3. **Phase 2:** SACHET (IMD) alerts and NOAA airport observations, with measured data visibly distinct from modeled data.
4. **Phase 3:** interactive maps (MapLibre, RainViewer radar, satellite).
5. **Phase 4:** custom GFS-derived tiles and a forecast-validation system.
6. **Release (separate spec):** hosting, Trusted Web Activity wrapper, Digital Asset Links, Play listing.

### Out of scope for Phase 1
Multi-model UI, alerts, observations, maps, accounts, notifications, unit switching, hosting and Play packaging.

### Success criteria
- Run one command locally and get both servers.
- Search an Indian city, select it, see current conditions, a 48-hour strip and a 7-day list.
- Repeat requests are served from cache. Upstream calls stay well under Open-Meteo's 10,000/day limit.
- The app installs as a PWA, opens offline with the last forecast, and shows the attribution.
- Lighthouse PWA checks pass.

## 2. Architecture

```
React SPA (Vite + TS, PWA)  ──►  FastAPI  ──►  Open-Meteo forecast API
                                  │       └─►  Open-Meteo geocoding API
                                  ▼
                             SQLite cache (TTL)
```

- **`backend/`**
  - `providers/base.py`: a `WeatherProvider` interface.
  - `providers/open_meteo.py`: the only code that knows Open-Meteo URLs and JSON. It returns our normalized models.
  - `cache.py`: SQLite key/value store with a TTL.
  - `routes/`: `search`, `forecast`, `health`.
  - `config.py`: environment-driven settings (cache path, TTLs, allowed origins, upstream budget).
- **`frontend/`**: React app that only knows our API schema.
- The forecast route takes a `models` list (default `["ecmwf_ifs025"]`, allowlist-validated) so Phase 1.5 needs no backend rewrite.
- One root command (`npm run dev`) starts both processes. Layout is deploy-friendly (no hardcoded paths or origins).

## 3. API contract

All endpoints return JSON. Metric units only. Times are ISO 8601 with offset in `Asia/Kolkata`. The frontend never sees Open-Meteo field names.

### `GET /api/search?q=`
Proxies Open-Meteo geocoding with `countryCode=IN`, up to 8 results, minimum 2 characters.

```json
{ "results": [
  { "id": 1264527, "name": "Chennai", "admin": "Tamil Nadu",
    "lat": 13.08, "lon": 80.28 } ] }
```

### `GET /api/forecast?lat=&lon=&models=ecmwf_ifs025`

```json
{
  "location": { "lat": 13.08, "lon": 80.28, "timezone": "Asia/Kolkata" },
  "model": "ecmwf_ifs025",
  "generatedAt": "2026-10-31T09:30:00+05:30",
  "fetchedAt":   "2026-10-31T09:41:12+05:30",
  "stale": false,
  "current": { "time": "...", "tempC": 29.4, "feelsLikeC": 33.1,
               "humidityPct": 71, "windKph": 14, "windDirDeg": 60,
               "precipMm": 0.0, "weatherCode": 3, "isDay": true },
  "hourly": [ { "time": "...", "tempC": 28.9, "precipProbPct": 20,
                "precipMm": 0.1, "windKph": 13, "weatherCode": 3 } ],
  "daily":  [ { "date": "2026-10-31", "tempMaxC": 31.2, "tempMinC": 25.8,
                "precipSumMm": 2.4, "precipProbPct": 60,
                "sunrise": "...", "sunset": "...", "weatherCode": 61 } ],
  "attribution": "Weather data by Open-Meteo.com (ECMWF IFS)"
}
```

- 48 hourly entries, 7 daily entries. `weatherCode` is the WMO code, mapped to label and icon in the frontend.
- `generatedAt` is the model run time. `fetchedAt` is when we pulled it. Both are kept so the UI can be honest about data age and Phase 1.5 can show run times.
- In Phase 1 the response has a single `model` field. In Phase 1.5 it becomes a `models` map keyed by model id (a deliberate breaking change, versioned at that time).
- `attribution` comes from the API so the UI cannot omit it.

### `GET /api/health`
`{ "status": "ok", "cache": "ok", "upstreamCallsToday": n, "budget": n }`

### Errors
Shape: `{ "error": { "code": "...", "message": "..." } }`.
- Invalid input: 422.
- Upstream down with cached entry: serve it with `stale: true`.
- Upstream down, nothing cached: 502.
- Upstream 429: 503 with `Retry-After`.

## 4. Caching and quota protection

### Server cache (SQLite: `key`, `payload`, `fetched_at`, `expires_at`)

| Data | Key | TTL |
|---|---|---|
| Forecast | `forecast:{model}:{lat2}:{lon2}` | 30 min |
| Geocoding | `search:{normalized q}` | 30 days |

- Coordinates are rounded to 2 decimals (~1 km) before lookup.
- A per-key lock ensures concurrent requests for an expired entry cause one upstream call.
- **Stale-while-error:** expired entries are retained 24 h past TTL and served with `stale: true` if upstream fails or returns 429.
- **Daily budget guard:** a counter table tracks upstream calls per IST day. At a configurable soft limit (default 8,000 of 10,000) the server stops refreshing expired forecasts and serves stale data.
- Upstream timeout 8 s, one retry on network error, none on 4xx.
- Expired rows older than 24 h are removed on startup and hourly.

### HTTP caching
- `/api/forecast`: `Cache-Control: public, max-age=300, stale-while-revalidate=600`.
- `/api/search`: `max-age=86400`.

### Service worker (Workbox via `vite-plugin-pwa`)
- App shell precached (opens offline).
- `/api/forecast`: network-first, falling back to the last cached response. The UI shows "Offline, last updated {time}" from `fetchedAt`.
- `/api/search`: stale-while-revalidate.
- Saved places live in `localStorage` only. Nothing about the user is sent to our server.

## 5. Frontend

**Stack:** React 18, Vite, TypeScript, `vite-plugin-pwa`, TanStack Query. No router, Redux or UI kit.

### Screens (mobile-first, single page)
1. **Forecast:** hero with current temperature, feels-like, condition and last-updated time. Stats row (humidity, wind, rain, sunrise/sunset). Scrollable 48-hour strip with temperature and rain probability. 7-day list with high, low and rain.
2. **Search sheet:** debounced input against `/api/search`. Empty input shows recent and saved places.
3. **Saved places:** up to ~8, `localStorage` only.

### Behavior
- First launch offers an optional "Use my location" button (permission-based). If declined, fall back to Chennai. No IP geolocation, never blocked.
- A banner is shown when offline or when `stale: true`.
- Errors are inline with a retry button. Empty search results have their own state.
- Accessibility: semantic HTML, 4.5:1 contrast minimum, visible focus, no color-only meaning, `prefers-reduced-motion` respected.
- The attribution string is shown in the footer of every view.

### PWA requirements
Web manifest with maskable icons, installable service worker, offline app shell, last forecast cached on device, passing Lighthouse PWA and performance checks. These are also what the later TWA/Play release requires.

### Code layout (`frontend/src/`)
- `api/`: typed client matching section 3.
- `components/`: `Hero`, `HourlyStrip`, `DailyList`, `SearchSheet`, `StatusBanner`.
- `hooks/`: `useForecast`, `useSearch`, `useSavedPlaces`.
- `lib/weatherCodes.ts`: WMO code to label and icon.
- `main.tsx`, `App.tsx`.

### Visual design
**To be designed with the impeccable plugin** after this spec is approved. Direction given: minimalistic, modern, colorful, bold, clean.

## 6. Testing

- **Backend (pytest):** cache hit/miss and TTL expiry, per-key lock (concurrent requests → one upstream call), stale-while-error, budget guard, coordinate rounding, input validation, error shapes. Open-Meteo is mocked.
- **Frontend (Vitest + Testing Library):** hooks and components with mocked API responses.
- **End-to-end:** one Playwright smoke test (search → select → forecast renders).
- **PWA:** Lighthouse check as part of verification.

## 7. Data-source notes and risks

- Open-Meteo's free API is for non-commercial use, capped at 10,000 calls/day, with no uptime guarantee. This project stays non-commercial (no ads, subscriptions or purchases). Re-check the terms before the Play release.
- MET Norway Locationforecast is the planned second adapter (Phase 1.5), as a comparison source and fallback. It requires an identifying `User-Agent`, honoring `Expires`/`If-Modified-Since`, 4-decimal coordinates and attribution. It has no geocoding, so Open-Meteo geocoding remains. Verify its current terms when that phase starts.
- Agreement between models does not prove correctness. Validation against real observations is a later phase.
- Play Developer account (one-time fee, Google identity verification) is required for the Release phase only.
