# India Weather — Living Sky

Approved by the owner on 31 October 2026. Replaces the previous printed indigo/cream identity. Reference: docs/redesign/2026-10-31-living-sky-proposal.md and its desktop/mobile previews. The surface is an Operate experience: get the weather in seconds, with depth available by scrolling.

## Visual world

Weather is the environment, not an ornament placed inside a dashboard. An open, temperature-led hero sits within the local sky. The hourly horizon spans the content width; the secondary desktop composition pairs the week ahead with conditions, and becomes a single deliberate column on phones. No sticky hero column, printed motifs, hard color blocks or future-feature filler.

## Scene system

`weatherScene.ts` maps WMO weather/daylight to day, night, dawn, dusk, cloudy, rain, storm, snow and fog. Rain/storm/snow/fog take precedence over solar light; rainy nights never acquire stars. Naive API timestamps are explicitly interpreted in IST. Use the forecast's timestamp to preserve honesty when displaying stale data. Dawn/dusk are within 45 minutes of the provided sunrise/sunset. Missing/invalid solar times omit the marker and do not create a fictional reading.

- Day: #125281 → #4A7FAB → #173B58, sunlight #FFF8DB → #FFCF86.
- Night: #111B3B → #303F6D → #182D47, moonlight #E9EDFE.
- Cloud/snow/fog: #3B586E → #617C93 → #263F59, diffuse light.
- Rain: #203B56 → #4C687F → #102E44.
- Storm: #17263E → #394963 → #1B2D43, no flashing lightning.
- Dawn/dusk: #3D497C → #9B728B → #313759, warm horizon light.
- Night variants of wet/overcast scenes: #15243C → #2C435A → #12283E.

The atmospheric layer is aria-hidden, pointer-inert and isolated behind the interface. CSS gradients, restrained cloud diffusion, static stars/precipitation, and one slow cloud drift require no image downloads or canvas runtime. Pause cloud motion when the document is hidden; reduced motion removes it entirely. No motion is essential to understand the weather.

## Type and hierarchy

Self-hosted Archivo variable with system fallbacks, tabular numerals. Current temperature: 124px desktop, 108px phone, weight 200, -0.04em tracking. City: 37/29px, weight 500. Condition: 23/20px. Headings: 17/15px, weight 550. Body/actions: 14–16px; supporting labels: at least 12px. Preserve whitespace around the primary answer and allow long place names to wrap. White foreground; muted #DCE9F6 and rain #BCE7FF. Do not lower label contrast through opacity.

## Surfaces, layout and controls

One dark scene-compatible reading surface (#102E4F at 91% alpha), 20px radius on desktop/18px phone, soft downward shadow. No nested cards. Transparent controls use a darker stable reading fill. Focus is a 3px warm #FFE1A6 outline with 4px offset. Controls are at least 44px. No backdrop-filter requirement; readable without blur. Declare safe-area insets at the page and search sheet edges.

Content max width: 72rem, 80rem on screens above 1600px. At widths under 1024px, stack the forecast sections; conditions may use four columns at intermediate widths. Under 700px, centered hero and two-column condition metrics, 18px page gutters, horizontal hourly strip with partial next item. Secondary desktop area: 1.3fr/1fr, 22px gap. No page-wide horizontal scrolling. Hourly items are positioned containers so offscreen assistive labels stay in the scroller.

Buttons use pills; major surfaces use rounded rectangles. Search uses a focused dialog up to 600px wide on desktop and a full-height phone sheet. Background content becomes inert; body scroll locks; Tab cycles within controls, Escape closes, and focus returns to the opener. Saved/recent rows remain text-first and never fetch decorative weather data. Search/geolocation actions retain their labels and recovery states.

## Forecast presentation

Hero: city/region, condition, temperature, daily high/low, feels-like, forecast timestamp and separate fetched/updated age. No station-observation or model-run claims.

Hourly: all 48 provided entries, date boundaries, times, decorative SVG weather icons, temperatures and existing rain-format labels. The strip is keyboard-focusable, horizontally scrollable and labelled. Day/night icons use the matching day's supplied solar times.

Daily: day/date, icon, low, shared-domain low/high range, high; a visible secondary line contains condition and precipitation. Range colors are pale blue → warm sand. Identical temperature domains stay finite. Keep numeric values and accessible labels rather than relying on color.

Conditions: current-interval rain, wind and direction, humidity, today's rain probability or amount, sunrise/sunset. The solar marker follows a quadratic path using actual solar progress and disappears outside daylight. Metrics share a semantic definition list. Do not introduce unsupported UV, visibility, pressure, maps, IMD alerts or model controls.

## Icons and installation artwork

One authored SVG family: warm sun, pale cloud/moon, cool rain, snow, fog, storm and unknown. Icons supplement text and are decorative to assistive technology. `public/icons/weather.svg` is the vector source for the 192px, 512px and maskable installation icons, with artwork inside the maskable safe zone. PWA theme color #183B5B, launch background #111B3B.

## States and resilience

Keep existing API/query/storage keys and caching policy. Loading reserves the forecast area with static shapes and a status message. Keep cached data visible while refreshing. Offline and stale messages include data age; network errors offer Retry and retain attribution. Geolocation shows progress, times out after 10 seconds and preserves the selected city on refusal or error, with a manual-search recovery message. Search has loading, no-results, unavailable and first-use instructions.

## Motion and browser details

Cloud drift: 22 seconds alternating ease-in-out; search entry: 240ms exponential ease-out; control hover: 160ms. No flashing, scroll parallax or cascaded card entrances. Reduced motion is static. Selection uses warm sand with dark ink; caret, scrollbars and focus use scene-compatible colors. Forced-colors mode supplies explicit surface/control outlines.

## Guardrails

Preserve true source data and existing rain formatting; no plausible invented metrics, official warnings or no-alert claims. Keep all weather detail and timestamp semantics. Verify composited text contrast, small screens, 200% zoom, keyboard navigation and production offline reload, not just desktop screenshots. Visual references guide composition; missing controls/content in a simplified mockup are not permission to remove existing functionality.
