# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday people across India checking the weather on a phone, glance-and-go: "will it rain, how hot is it" in a few seconds, often on slow or patchy mobile data. Weather enthusiasts are a later audience (Phase 1.5 multi-model comparison); the first view must not demand their depth.

## Product Purpose

A free, non-commercial, India-focused weather app: search an Indian city and see current conditions, a 48-hour outlook and a 7-day forecast. It is an installable, offline-capable PWA, intended for a later Google Play release. Success is a fast, trustworthy answer that still works with no signal (last forecast shown with its age).

## Positioning

India-first and monsoon-aware: built around Indian cities, IST times and Indian weather (monsoon rain, heat), not a global app with an India setting.

## Operating Context

- Forecast data comes from Open-Meteo (ECMWF IFS in Phase 1) through our own FastAPI backend; the UI never talks to Open-Meteo directly.
- Rain probability is sometimes unavailable from the model; the UI then derives its label from rain amount ("0%", "Trace", or "x.x mm").
- All times are shown in IST.
- Attribution to Open-Meteo is shown on every view.
- No accounts; saved places live only on the device.

## Capabilities and Constraints

- Phase 1 screens: forecast (hero, stats row, 48-hour strip, 7-day list), search sheet, status banner (offline, stale, error with retry), footer attribution.
- Radar & storms map (added 1 Nov 2026): interactive India map with a 2-hour radar loop (RainViewer frames, recoloured in-app) and active North Indian Ocean cyclone tracks, cones and wind footprints (GDACS), always with their source and age. Radar coverage over India is partial: absence of echoes on the map is not a forecast of dry weather.
- Later phases (not designed now): multi-model comparison, IMD alerts, observations.
- Must work offline and on small phones; no UI component library.
- Free and non-commercial: no ads, subscriptions or purchases.

## Brand Commitments

Direction from the owner: minimalistic, modern, colorful, bold, clean. (Recorded as a binding constraint; the visual world itself is decided in design work, not here.)

## Evidence on Hand

Live Open-Meteo forecast data via the backend. No logo, brand name beyond the working title "India Weather", photography or testimonials exist; none should be invented.

## Product Principles

1. The answer comes first: today's condition and temperature are readable at a glance before any detail.
2. Be honest about the data: show how fresh it is and where it comes from; never present a missing value as a reassuring one.
3. India-first: IST, Indian places, monsoon and heat as first-class situations.
4. Works on bad connections: offline and error states are designed states, not afterthoughts.
5. Depth stays optional so later features (model comparison, alerts, maps) can grow in without cluttering the first view.

## Accessibility & Inclusion

Text contrast of at least 4.5:1, visible focus, no information carried by color alone, `prefers-reduced-motion` respected, semantic HTML. Readable in bright outdoor light on low-end phones.
