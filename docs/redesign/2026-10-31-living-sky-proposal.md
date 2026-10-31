# India Weather: Living Sky

31 October 2026 · Design proposal · Approved by owner in chat

This is Phase 1 of the supplied redesign brief. Application code, backend contracts, dependencies, and the running application remain unchanged. `proposal.html` is an isolated visual study with illustrative values. Its atmosphere selector previews colors, not real condition changes; its search control is a visual placeholder. It is not an implemented app or a functional acceptance test.

## Existing application and constraints

The React/Vite SPA uses TanStack Query against the existing FastAPI API. `App` selects the location, requests forecasts, opens search, handles optional geolocation, and tracks connectivity. `Hero`, `HourlyStrip`, `DailyList`, `Stats`, `SearchSheet`, `StatusBanner`, and `Footer` render the main experience. `useSavedPlaces` preserves up to eight saved and five recent places locally, with storage-failure handling. Search already supports debouncing, keyboard focus trapping, Escape, and restoring focus. The PWA caches the shell and forecasts. All remain requirements.

The current flat indigo/cream, printed motifs, square controls, and sticky left-hero desktop composition are intentionally replaced. Existing DESIGN.md remains intact until approval; this proposal supersedes its aesthetic rules only if approved.

The API supplies temperature, feels-like, humidity, wind speed/direction, precipitation, weather codes, day/night, daily sunrise/sunset, and nullable rain probability. It provides 48 hourly points, but App currently limits the visible strip to 24. The redesign should expose all 48 without changing the API. Model run time is nullable; do not manufacture it. Current conditions are modeled, not measured station observations.

No API fields currently supply visibility, pressure, or UV. There is no IMD-alert, map-layer, or model-comparison integration. These are future designs, not implementation scope for this frontend-only change. Missing data never means zero, no warnings, or good conditions. Existing rain formatting/calculations must remain unchanged. A future correction to the current null-probability/zero-rain label is a separate decision, not silently bundled into this redesign.

## Direction and approaches

**Recommended: Living Sky.** An open atmospheric hero establishes place and weather; the forecast is a quiet, readable layer within that atmosphere. Real weather and the location's solar times govern color and lighting. The experience leads with the everyday question: what does it feel like, and what comes next?

Two alternatives considered: a **map-first canvas** suits enthusiasts, but introduces an unavailable integration and distracts from the immediate forecast; a **cinematic photographic backdrop** can feel rich, but adds asset weight and less precise weather/time matching. Neither is recommended for this phase. The recommendation remains a proposal, not a recorded user choice.

The visual identity comes from the Indian sky: humid coastal blue, muted monsoon light, warm evening haze, and deep night. No decorative regional motifs or city landmarks invented from coordinates. Apple Weather is the craft reference for atmosphere and hierarchy; the original composition uses a horizontal forecast horizon and broad, restrained surfaces rather than reproducing its tile grid.

## Atmospheric palette

| Scene | Background stops | Light/accent | Treatment |
| --- | --- | --- | --- |
| Clear day | #125281 → #337AA6 → #698FBA | #FFF8DB / #FFCF86 | Broad sunlight, open blue; soft horizon warmth |
| Overcast | #3B586E → #738B9B → #425F77 | #D9E7ED | Diffuse layered cloud light; no bright sun |
| Rain | #203B56 → #5B7891 → #102E44 | #A5DDFF | Restrained fine rain, slate-blue depth |
| Thunderstorm | #17263E → #394963 → #1B2D43 | #CAD5EF | Dense cloud light; no flashing lightning |
| Night | #111B3B → #253864 → #4D517E | #E9EDFE | Moonlight; sparse, static stars where appropriate |
| Sunrise/sunset | #3D497C → #A37897 → #C78F8E | #FFE0B5 | A warm horizon under cooler upper sky |

Snow uses the overcast family with pale daylight; fog reduces scene contrast and removes sharp celestial effects. These are intentional variants, not arbitrary gradients. The preview includes day, night, rain, and dusk palettes; weather-specific precipitation particles and the complete condition set are implementation work after approval.

Use `current.isDay` and weather codes; sunrise/sunset windows derive from the matching daily entry and the API's Asia/Kolkata timestamps. Check night weather before adding stars: a rainy night stays cloudy. At high noon in bright outdoor use, retain darker stable reading surfaces rather than relying on white text directly over the brightest sky. Background transitions must not imply that a refreshed forecast is a live observation.

## Typography, icons, and surfaces

Retain the self-hosted Archivo variable font to avoid another download; change its expression through lighter numerals and quiet medium-weight headings. Hero temperature: roughly 108px mobile, 124–144px desktop, weight 200. City: 29px mobile/37px desktop. Section titles: 15–18px; body: 14–16px; metadata: 12–13px. Mockup labels may be smaller for hierarchy; final outdoor-readability and 200% zoom verification determine the lower bound. Use tabular numerals and tracking no tighter than -0.04em.

Use a consistent authored SVG weather-icon family: warm sun, pale clouds, cool rain, moonlight. Forecast icons remain compact, legible geometry; no emoji. Condition words remain available to assistive technology. Decorative atmospheric layers are aria-hidden and pointer-inert.

One translucent surface family: scene-tinted dark fill, 18–20px radii for major forecast containers, a restrained downward soft shadow. No card-within-card hierarchy. Small controls use rounded shapes with 44px minimum targets. Blur is optional progressive enhancement on a few foreground surfaces, not a requirement for reading; opaque fallback maintains contrast without backdrop-filter. Body text must meet 4.5:1 and large text 3:1 over the actual composited surface in every scene. Use a warm, clearly outlined focus state, not color alone.

## Desktop composition

At 1440px, use a centered content area around 1150px wide, with generous but useful side margins. A compact brand/search/location header spans the page. Below it, a 330–360px open sky hero places city and large temperature to the left, with restrained atmospheric light to the right. High/low, feels-like, condition, and data age belong to that hero, not detached statistic tiles.

A full-width hourly horizon follows. Below it, a roughly 56/44 split pairs the seven-day outlook with a compact conditions composition. This is a secondary reading area: the hero and hourly horizon span the entire composition, rather than a permanent hero column beside a dashboard. At intermediate widths the sections stack before labels compress. On ultrawide screens, cap the readable area; expand atmospheric space rather than rows of small cards.

Attribution and model identity sit at the bottom and remain readable in loading/error views. Remove the mockup's decorative sky slogan in production; that space should carry atmosphere rather than repeated product explanation.

## Mobile composition

At 360–430px, center the location and temperature in the sky, keep header actions reachable, and allow approximately 300–345px for the hero without a full-screen spacer. Put high/low and feels-like directly under the condition. Hourly information should appear in the first scroll, with roughly 4.5–5 hours visible and a clear horizontal continuation.

Seven-day rows follow, then a two-column set of conditions inside one surface. Safe-area insets support installed PWA use. No persistent bottom navigation for a one-screen product. Search becomes a focused full-height sheet on phones and a compact centered dialog on desktop; keep existing search/recent/saved functions, focus handling, and close behavior. Add a labelled “Use my location” action within that flow while preserving the header affordance. Design saved-city rows without fetching many forecasts simply to decorate the picker.

## Forecast components

- **Hero:** city, region, condition, temperature, daily high/low, feels-like, current forecast time and fetched time. Label them accurately; no fabricated model-run time.
- **Hourly horizon:** all 48 entries, horizontal scroll, weather icons, temperature and the existing precipitation labels. A thin temperature trend can connect points only when aligned to the time axis and available values; it must not replace numeric values. A temperature/rain view control is optional depth, not necessary to read the default. The current visual study shows a representative portion of the strip, not the full data set.
- **Seven-day outlook:** clear day, weather icon, low and high with a shared-domain temperature range. The range is a visual projection of API values, not a new forecast calculation. Provide the existing condition and rain amount/probability as a secondary line or accessible details so the redesign does not discard content. The preview's compact rows demonstrate hierarchy, not the full interaction/detail state.
- **Conditions:** current precipitation amount, wind speed/direction, humidity, today's rain forecast, and sunrise/sunset. A solar arc communicates timing; it must place its marker from solar times during implementation, not repeat the decorative mockup position. Keep current-interval precipitation distinct from daily precipitation.
- **Future metrics:** visibility, pressure, UV occupy the same visual vocabulary only when their source and API fields exist. Omit them from production for now, rather than showing reassuring dummy values or a wall of empty cards.

## Maps, alerts, and models: future connected experience

Do not ship inactive map tabs, empty warning panels, or a model switcher with one selectable choice. Show ECMWF IFS as source information now. The preview's future-features note is for proposal review and will not be shipped as homepage filler.

When available, Maps opens a dedicated full-width map view from an Explore entry, rather than squeezing an interactive map into a small dashboard tile. Mobile uses an edge-to-edge map with a bottom sheet; desktop uses a broad canvas with a narrow, collapsible layer panel. Controls: radar/wind/precipitation/temperature, time scrubber, playback, legend with units, recenter, location, back to forecast. Maintain a distinct layer timestamp; clearly distinguish past radar observations from future model forecasts. Provide buttons as alternatives to drag and a textual forecast fallback when maps are offline or unavailable. Respect the free-source constraint; provider licensing and integrations require separate work. A decorative synthetic map is not a functioning map preview.

IMD alerts, once integrated, appear as one prominent severity-labelled notice between hero and hourly horizon; open official details with area, issued/expiry times, source link and localized message. No alerts state may only claim “No active alerts” after a successful, current, geographically relevant response; failed data gets its own state. Never simulate an official warning in the current app.

Model comparison, once integrated, belongs in optional Explore depth: available models, timestamps and side-by-side values on aligned times. Agreement does not imply certainty. Preserve the everyday default homepage; do not build a dense model dashboard into it.

## Motion, interaction, and resilient states

One restrained atmospheric motion: a very slow cloud drift. Refresh changes scene colors over about 600ms without moving the content. Search opens in 240ms; hover/press responses take 120–160ms. Animate transform/opacity rather than layout. Avoid perpetual weather particles on low-power devices; pause offscreen/hidden-page motion. No flashes, parallax linked to scroll, or repeated staggered card entrances. Reduced motion uses static skies and immediate state changes.

Loading uses a reserved hero/forecast silhouette with a short “Loading forecast” status; preserve cached data during refresh. Offline/stale appears in a clearly readable inline banner with the cached forecast's timestamp. Initial network failure uses a restrained empty view, Retry and Search; geolocation refusal keeps the chosen/default city and offers manual search without repeated permission prompts. Search has explicit loading, no-results, unavailable, saved-empty and storage-unavailable behavior. Network and geolocation actions communicate progress; icons are labelled, status announcements avoid repeated chatter. All views retain attribution.

## Proposed component structure and implementation

Keep API client, query behavior, providers, backend, schema and storage keys. `App` continues orchestrating state. Introduce a presentational `WeatherScene` and a pure scene resolver for weather/daylight presentation. Extend Hero props with daily high/low and current timestamp. Restyle/recompose existing HourlyStrip, DailyList, Stats, SearchSheet, StatusBanner and Footer. Share `WeatherIcon`, `TemperatureRange`, `ConditionMetric` and `SunPath`; decorative weather effects remain independent of the data/interaction layer. Remove PrintBand from rendered UI after approval; it can remain in git history.

Use CSS scene tokens for sky stops, foreground, surface fill, muted text, precipitation accent and focus. Responsive breakpoints are content-driven: phone below roughly 700px, stacked intermediate layouts, full desktop around 1024px and up. Use local CSS/SVG and the existing font; no UI kit, paid API, new animation runtime or backend migration. Theme-color should follow a stable scene tone; preserve manifest/install/offline behavior.

After approval: (1) scene/tokens/hero; (2) hourly/daily/conditions; (3) search and resilient states; (4) responsive, accessibility and production-PWA verification. Update DESIGN.md to describe the approved replacement world at implementation time. This sequence is a proposed approach, not an implementation plan or authorization to build.

Acceptance after implementation: existing behavior tests and browser search smoke pass; verify 48-hour availability, labels, saved places, geolocation refusal and offline data; capture 1440px desktop plus 390px and 360px mobile in both day/night, compare with approved previews, and check reduced motion, keyboard navigation, zoom, composited contrast, overflow and production service-worker behavior. Run the production build and appropriate performance/accessibility checks once changes are complete. Avoid performance claims until measured.

## Review artifacts and approval

Open `proposal.html` directly in a browser. Its top selector previews Daylight, Moonlight, Monsoon and Dusk. Desktop/mobile screenshots capture the same isolated HTML. All weather values are labelled illustrative and none come from the running app. These previews establish visual hierarchy and material direction; they do not demonstrate working weather features.

Builder review found no material scope blockers. Two clarifications bind the proposed implementation even though the visual study simplifies them: retain an accessible header geolocation control alongside Search, and put condition text plus daily precipitation on a visible secondary line in every seven-day row, rather than behind an undiscoverable details action. The atmosphere selector is a review tool and will not replace the location control in production.

Requested approval: approve Living Sky's visual world, desktop/mobile composition, these content/control clarifications, and frontend-only scope, with unsupported data features designed as future extensions. Any requested refinements will be incorporated before application implementation begins.
