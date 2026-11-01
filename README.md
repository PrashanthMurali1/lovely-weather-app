# India Weather

A fast, installable weather PWA for Indian cities. FastAPI backend proxies and caches forecasts; a React + Vite frontend renders them and works offline after the first load.

## Data source and attribution

Forecasts and place search come from [Open-Meteo](https://open-meteo.com/) (free tier, non-commercial use, 10,000 calls/day cap). The UI shows "Weather data by Open-Meteo.com" in the footer. To stay under the cap, the backend caches responses in SQLite (forecast TTL 30 min, search TTL 30 days), serves stale data when upstream fails, and enforces an 8,000 calls/day soft budget. No API key is needed.

## Architecture

- `frontend/src/map/`: the radar and cyclone map, built in-app: a canvas engine (own Mercator projection, pan/zoom, basemap drawn from bundled Natural Earth geometry, radar tiles recoloured with the app ramp, cyclone cone and track graphics). `node scripts/build-geo.mjs` regenerates the geometry. Zoomed in past about level 9, the map switches to a street-level layer drawn by the same engine from free OpenStreetMap vector tiles served by OpenFreeMap (no key, nothing hosted by us): main roads, water, parks and neighbourhood names. Zoom stops at a district-level view (about 10 km across the scale bar) so only a few coarse tiles are ever fetched. The tiles' own boundary lines are never drawn, so the app's India geometry stays the only source of borders at every zoom. Offline: the service worker caches radar tiles, the frame list and storms for 3 hours, and street tiles you have viewed for a week (production builds only); nothing older than 3 hours is shown for weather.
- `backend/`: FastAPI app (`/api/forecast`, `/api/search`, `/api/radar`, `/api/cyclones`, `/api/health`), provider interface with an Open-Meteo adapter and a map-data adapter (RainViewer radar frames, GDACS cyclone tracks), SQLite cache with request coalescing, stale fallback and daily budget.
- `frontend/`: React + TanStack Query SPA, built with Vite and `vite-plugin-pwa` (Workbox service worker). Saved/recent places live in `localStorage`.
- In dev, Vite proxies `/api` to `localhost:$BACKEND_PORT` (default 8000).

## Setup

Requires Python 3.11+ and Node 20+.

```sh
# backend virtualenv (use "py -m venv" on Windows, "python3 -m venv" elsewhere)
py -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -e "backend[dev]"   # Windows
# backend/.venv/bin/python -m pip install -e "backend[dev]"     # macOS/Linux

npm install            # root (concurrently)
npm install --prefix frontend
```

## Run

```sh
npm run dev
```

Starts the API on http://localhost:8000 (override with `BACKEND_PORT`, the Vite `/api` proxy follows the same variable). Examples: POSIX `BACKEND_PORT=8001 npm run dev`, PowerShell `$env:BACKEND_PORT = "8001"; npm run dev`, cmd `set BACKEND_PORT=8001 && npm run dev` and the web app on http://localhost:5173 (Vite picks the next free port if taken).

## Tests

```sh
npm run test       # backend pytest, then frontend vitest
npm run test:e2e   # Playwright smoke test (API mocked, no network)
```

First-time e2e setup: `npx playwright install chromium` inside `frontend/`. The e2e run starts its own Vite server on port 5273.

## Environment variables

All optional, prefix `WEATHER_`; see `backend/.env.example`.

| Variable | Default |
| --- | --- |
| `WEATHER_CACHE_PATH` | `data/weather.db` |
| `WEATHER_FORECAST_TTL_SECONDS` | `1800` |
| `WEATHER_SEARCH_TTL_SECONDS` | `2592000` |
| `WEATHER_STALE_RETENTION_SECONDS` | `86400` |
| `WEATHER_DAILY_BUDGET_SOFT_LIMIT` | `8000` |
| `WEATHER_UPSTREAM_TIMEOUT_SECONDS` | `8.0` |
| `WEATHER_FAILURE_COOLDOWN_SECONDS` | `20` |
| `WEATHER_ALLOWED_ORIGINS` | `["http://localhost:5173"]` |

`WEATHER_ALLOWED_ORIGINS` is a list, so it must be a JSON array, e.g. `WEATHER_ALLOWED_ORIGINS=["https://weather.example.com"]`.

## Deploy notes

- Serve the built SPA (`npm run build`, output `frontend/dist`) and `/api` from one origin, so the frontend's relative `/api` calls need no CORS or build-time URL.
- HTTPS is required for the service worker and PWA install (localhost is exempt).
- That includes `/api/radar` and `/api/cyclones`: the service worker matches them by path, so they must also be served from the site's own origin. If the backend ever moves to another domain, those matchers (`frontend/src/sw/radarCaching.ts`) need a configurable API origin.
- Radar tiles are fetched by the browser straight from `tilecache.rainviewer.com`; they do not pass through your backend, and the service worker caches them on each visitor's device (3 hours).
- Nothing in the built app refers to localhost or a port. The `localhost` backend target in `frontend/vite.config.ts` (`BACKEND_PORT`, default 8001) is only for `npm run dev` and `vite preview`.
- To try the production build locally, including offline behaviour: `npm run build`, then `BACKEND_PORT=<backend port> npx vite preview --port 4280` inside `frontend/`.
- No API key is needed.
- Release phase (hosting, Play Store TWA) is a separate later spec.

## Deployment automation

`node scripts/serve.mjs` runs the one local deployment: web on `127.0.0.1:4280` and API on `127.0.0.1:8012`. It serves `frontend/dist` and restarts the backend when the build job requests it. Start it manually after a reboot.

Relay's local manifest, `../automation-service/.local/applications/weather.json`, schedules `node scripts/relay-build.mjs run` every five minutes. The job fetches and fast-forwards a clean `main`, runs type checks and tests, builds into `frontend/dist-next`, activates the build, and rolls back if the live health check fails. Other branches, tracked local edits, and unpushed commits prevent deployment. Dependency installs run only when their manifests change; backend changes also request a backend restart. Validate manifest changes with Relay's `python -m backend.manage validate`, then `reload`.

Git-ignored `.deploy/` holds deployment and failure state plus `last-failure.log`. A failed commit is suppressed until a newer commit arrives or `node scripts/relay-build.mjs run --force` (Relay's manual `weather.rebuild`) retries it. `--force` still respects checkout ownership. `check`, `verify`, and `plan` inspect prerequisites, build presence, and the next action respectively; `plan` fetches remote refs. If the server is stopped, the job can prepare a build without starting it.

Run `node --test scripts/deploy-lib.test.mjs scripts/relay-build.test.mjs` for deployment tests (integration tests require frontend dependencies), and `npm test` for backend and frontend tests. In PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## PWA and offline behaviour

The app shell is precached. The last successful forecast per location is cached (network first, 4 s timeout), so after one online load the app opens offline and shows that forecast with an offline banner. Place searches use stale-while-revalidate. Nothing loads offline for locations never fetched online.

## Verification

Run 2026-10-31 against the production build served by `vite preview` (Lighthouse 12, mobile form factor):

| Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- |
| 100 | 100 | 100 | 100 |

Installability was checked manually (Lighthouse 12 has no PWA category): the manifest is valid with 192, 512 and maskable icons, the service worker activates and controls the page, and an offline reload renders the app shell and the last forecast with the offline banner. Repeated identical forecast requests produced a single upstream call (`/api/health` `upstreamCallsToday` went 0 to 1 over 3 requests). Port 8000 was occupied by another process on the author's machine, so the backend checks ran with `BACKEND_PORT=8001`: the Lighthouse/offline/health run used a temporary preview config, and `BACKEND_PORT=8001 npm run dev` was separately run for real (Vite and uvicorn both started, `/api/health` through the Vite port returned the backend JSON, and stopping the process tree freed both ports).

Not exercised on the author's machine (Windows): the POSIX process-group kill path of the dev command and its missing-venv error message.
