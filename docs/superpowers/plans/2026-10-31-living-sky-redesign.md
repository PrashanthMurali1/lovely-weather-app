# Living Sky Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved atmospheric, responsive India Weather redesign while retaining all existing weather and location functionality.

**Architecture:** Keep App orchestration, query/client/storage contracts and the backend unchanged. Add a pure presentation scene resolver and SVG weather/solar components; recompose existing forecast components and replace the CSS world. Continue using the self-hosted font and Workbox PWA.

**Tech Stack:** Existing React, TypeScript, Vite, CSS, SVG, Vitest/Testing Library and Playwright. No added dependencies.

**Spec:** `docs/redesign/2026-10-31-living-sky-proposal.md` (approved in chat), with `docs/redesign/proposal.html` and day/night screenshots as visual references.

## Global Constraints

- Frontend-only; preserve backend contracts, weather values/calculations, query policy, storage keys and attribution.
- All 48 forecast hours must be accessible; retain daily condition and precipitation visibly.
- Keep location search, geolocation, save/remove, recent places, offline/stale/error and retry.
- No fabricated UV/pressure/visibility/alerts/maps/models. No inactive feature placeholders.
- Existing Archivo font; 44px controls, 4.5:1 body contrast, 3:1 large text, reduced motion, keyboard and safe-area support.
- Approved daytime/night/weather palettes; full-width hero and hourly horizon, secondary 56/44 desktop area, stacked mobile.

## Review Focus

1. Rainy nights must not become clear starry skies; severe weather outranks warm solar lighting (Task 1).
2. Missing/invalid solar data and zero temperature ranges must not create NaN styles or fictional sunrise markers (Tasks 1–2).
3. Last forecast hours and null precipitation remain readable; no accidental 24-hour truncation (Task 2).
4. Search modal must trap/restore focus, block background interaction, scroll on phones and retain geolocation fallback (Task 3).
5. Cached/stale data retains age and attribution; production PWA survives offline reload (Tasks 3–4).

## Task 1: Atmospheric presentation and hero

**Files:** Create `frontend/src/lib/weatherScene.ts`, `frontend/src/components/WeatherScene.tsx`, `frontend/src/components/WeatherIcon.tsx`; modify `Hero.tsx`; add `frontend/tests/weatherScene.test.ts`; extend `components.test.tsx`.

**Interfaces:** `resolveWeatherScene(current: Current, today?: DailyPoint): WeatherSceneName`; `solarProgress(time: string, today?: DailyPoint): number | null` (0–1 during daylight, null outside/invalid). `WeatherScene({current?,today?})` is decorative. `WeatherIcon({code,isDay?})` uses WMO descriptions and decorative SVG. Hero accepts optional `today` and retains existing place/current/fetchedAt props.

- [x] Write/run failing scene tests: clear daytime, clear night, night rain, storm at sunset, dawn/dusk windows, cloudy/snow/fog/unknown, invalid/missing solar data, sunrise/midpoint/sunset and offset equivalence. Extend hero test for provided low/high and current/fetch time distinction.
- [x] Implement exact scene palettes and solar presentation from ISO times; preserve API values; update Hero and add SVG icons/atmospheric layers.
- [x] Run focused tests and existing frontend suite. Expected: green.

## Task 2: Forecast horizon and daily/condition details

**Files:** Modify `App.tsx`, `HourlyStrip.tsx`, `DailyList.tsx`, `Stats.tsx`; create `SunPath.tsx`; extend `components.test.tsx`.

**Interfaces:** Existing HourlyStrip/DailyList props retained. Stats consumes current/today and renders real precipitation, humidity, wind/direction, daily rain and solar times. `SunPath({time,today})` uses Task 1 solarProgress. App supplies today matched to current date and passes all provided hours.

- [x] Add/run failing tests: 48 rendered hours, last hour present, daily condition and rain retained, constant daily temperature ranges finite, solar marker absent for invalid data.
- [x] Replace printed patterns with weather icons and numbers; add shared-domain low/high range geometry and visible secondary day detail; recompose App into hero/hourly/details; retain accessible headings and footer.
- [x] Run frontend suite. Expected: green, existing rainfall formatter tests unchanged.

## Task 3: Responsive visual system and interaction states

**Files:** Replace `styles/tokens.css`, `base.css`, `components.css`; modify `SearchSheet.tsx`, `Footer.tsx`, `App.tsx`, `vite.config.ts`, `index.html`; update `DESIGN.md`; create `styles/atmosphere.css` if useful.

**Interfaces:** Semantic UI remains stable. SearchSheet gains optional `onLocate():void`, `locating?:boolean`; App shares one geolocation action and progress state. Search traps/restores focus, locks background scrolling and makes main/header/footer inert while open. Theme color stays install-compatible.

- [x] Add/run failing keyboard/progress tests: search geolocation action, Tab wrap and focus restore; retain denial/storage tests.
- [x] Apply approved palette, hero sizing, scene lighting, 18–20px forecast surfaces, responsive spacing and weather icons. Mobile full-height search and desktop focused dialog share content. No decorative slogan, sample selector or future-feature filler ships.
- [x] Add clear loading skeleton, offline/stale/error presentation, progress and geolocation outcome feedback; preserve default location on refusal. Reduced motion and hidden-page motion stop cloud drift.
- [x] Update DESIGN.md from approved world; PWA colors only, preserving caching. Run frontend tests and build. Expected: green.

## Task 4: Visual, browser and PWA verification

**Files:** Extend `frontend/e2e/smoke.spec.ts` for all hours, keyboard search, responsive overflow and offline/stale data; keep screenshots/inspection scripts under ignored `data/`; document results in README and ledger.

- [x] Run full unit suites and browser smoke. Use project-local pytest temp paths because Windows temp cleanup is restricted.
- [x] Capture desktop 1440px and phones 390px/360px for deterministic day/night fixtures, plus live API view. Inspect one batched round against approved previews and fix material defects in one batch. Verify keyboard, reduced motion, zoom and contrast across scenes.
- [x] Build production, serve preview with existing API proxy, verify service worker controls page and offline reload retains forecast age/attribution. Run available accessibility/performance checks and report measured limits honestly.
- [x] Obtain one independent whole-change review, address material findings with regression checks, then leave the updated local app running for testing. No merge, push or deployment to an external host.

## Execution notes

Native execution chosen by the implementer because all tasks share the same presentational interfaces and user approval authorizes the implementation. A local feature branch isolates commits while working in the existing directory so the user's local test URL continues to reflect the changes; no separate worktree or duplicate dependency installation. No automatic commits or branch integration are needed to deliver the requested testable working tree.

Self-review: proposal sections map to Tasks 1–4; unsupported integrations remain out of scope. Icons are decorative beside meaningful text; data age remains distinct from model run time. Pure visual changes are checked in rendered browser captures, not source-string tests.
