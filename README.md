# India Weather

A fast, installable weather PWA for Indian cities. FastAPI backend proxies and caches forecasts; a React + Vite frontend renders them and works offline after the first load.

## Data source and attribution

Forecasts and place search come from [Open-Meteo](https://open-meteo.com/) (free tier, non-commercial use, 10,000 calls/day cap). The UI shows "Weather data by Open-Meteo.com" in the footer. To stay under the cap, the backend caches responses in SQLite (forecast TTL 30 min, search TTL 30 days), serves stale data when upstream fails, and enforces an 8,000 calls/day soft budget. No API key is needed.

## Architecture

- `backend/`: FastAPI app (`/api/forecast`, `/api/search`, `/api/health`), provider interface with an Open-Meteo adapter, SQLite cache with request coalescing, stale fallback and daily budget.
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
- No API key is needed.
- Release phase (hosting, Play Store TWA) is a separate later spec.

## PWA and offline behaviour

The app shell is precached. The last successful forecast per location is cached (network first, 4 s timeout), so after one online load the app opens offline and shows that forecast with an offline banner. Place searches use stale-while-revalidate. Nothing loads offline for locations never fetched online.

## Verification

Run 2026-10-31 against the production build served by `vite preview` (Lighthouse 12, mobile form factor):

| Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- |
| 100 | 100 | 100 | 100 |

Installability was checked manually (Lighthouse 12 has no PWA category): the manifest is valid with 192, 512 and maskable icons, the service worker activates and controls the page, and an offline reload renders the app shell and the last forecast with the offline banner. Repeated identical forecast requests produced a single upstream call (`/api/health` `upstreamCallsToday` went 0 to 1 over 3 requests). Port 8000 was occupied by another process on the author's machine, so the backend checks ran with `BACKEND_PORT=8001`: the Lighthouse/offline/health run used a temporary preview config, and `BACKEND_PORT=8001 npm run dev` was separately run for real (Vite and uvicorn both started, `/api/health` through the Vite port returned the backend JSON, and stopping the process tree freed both ports).

Not exercised on the author's machine (Windows): the POSIX process-group kill path of the dev command and its missing-venv error message.
