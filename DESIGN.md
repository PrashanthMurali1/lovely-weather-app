---
name: India Weather
description: A flat Ajrakh block-print weather answer: one giant numeral on indigo, heat in madder, rain as printed density.
colors:
  ground: "#f4eedf"
  ground-deep: "#e9e1cc"
  surface: "#fbf8f0"
  ink: "#1b1a2b"
  ink-muted: "#5b5566"
  rule: "#d9cfb8"
  rule-strong: "#7d7462"
  indigo: "#1e2a5e"
  on-indigo-muted: "#c9cde3"
  madder: "#a3262a"
  turmeric: "#e8a317"
  turmeric-hover: "#d69410"
  info-bg: "#dce0ee"
  warn-bg: "#f6e3b0"
  band-1: "#d9deee"
  band-2: "#e9e1cc"
  band-3: "#f2c462"
  band-4: "#e9a79a"
  band-5: "#a3262a"
  dark-ground: "#12131f"
  dark-surface: "#1c1f33"
  dark-indigo: "#2a3870"
  dark-rain-text: "#aeb8e8"
typography:
  numeral:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif"
    fontSize: "clamp(8rem, 48vw, 12rem)"
    fontWeight: 200
    lineHeight: 0.82
    letterSpacing: "-0.04em"
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 12vw, 4rem)"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  block: "2px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  tap: "44px"
components:
  button-primary:
    backgroundColor: "{colors.turmeric}"
    textColor: "{colors.ink}"
    rounded: "{rounded.block}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.turmeric-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ground}"
    rounded: "{rounded.block}"
    size: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.indigo}"
  hero-field:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.ground}"
    padding: "12px 16px 24px"
  hero-feels-tile:
    backgroundColor: "{colors.madder}"
    textColor: "{colors.ground}"
    typography: "{typography.title}"
    padding: "16px"
  hero-air-tile:
    backgroundColor: "{colors.ground-deep}"
    textColor: "{colors.ink}"
    padding: "16px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.block}"
    height: "48px"
  status-offline:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.ink}"
  status-stale:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.ink}"
  status-error:
    backgroundColor: "{colors.madder}"
    textColor: "{colors.ground}"
  temp-chip-band-5:
    backgroundColor: "{colors.band-5}"
    textColor: "{colors.ground}"
    padding: "4px 8px"
---

# Design System: India Weather

## Overview

**Creative North Star: "The Ajrakh Block Print"**

The weather answer is a flat field of printed colour, not a dashboard. Deep indigo (rain and moisture) owns the dominant field, madder red marks heat and feels-like, turmeric is the single live accent, and cream is the resist ground that everything else sits on. One giant, light, tabular numeral is the whole first impression; nothing competes with it.

Depth does not exist. Fields are flat and unmodulated: no gradients, no shadows, no glass, no cloud art. Temperature is expressed in stepped bands, never a smooth ramp. The only patterned surface in the product is the hourly rain strip and the thin printed border band; everywhere else the print language shows up as colour blocking and near-square 2px corners. The app reads at a glance, outdoors, on a phone.

**Key Characteristics:**
- Flat indigo / madder / cream colour blocks, edge to edge on mobile.
- One typeface (Archivo variable), weight does the hierarchy: 200 for the numeral, 650-700 for labels.
- Tabular numerals everywhere (set on body).
- Rain chance is a printed density (5 steps), always paired with the text percentage.
- Light and dark both ship via `prefers-color-scheme`; dark re-dyes the same world on a night-indigo ground.

## Colors

A three-dye palette on a cream ground, re-dyed (not inverted) for dark.

### Primary
- **Indigo Vat** (`{colors.indigo}`, dark `{colors.dark-indigo}`): the dominant field: app header, hero, loading and empty states, search sheet top bar.

### Secondary
- **Madder Red** (`{colors.madder}`): heat. Feels-like tile, error banner, band 5 (39C and above), the Remove action text. Dark mode shifts it to #9e3036.

### Tertiary
- **Turmeric** (`{colors.turmeric}`, hover `{colors.turmeric-hover}`): the sun and the one live accent: primary buttons, the "updated" square marker, text selection, logo heart. Dark focus ring and hover use #f2c462.

### Neutral
- **Cream Ground** (`{colors.ground}`): page background and text on dye. Dark: `{colors.dark-ground}`.
- **Deep Cream** (`{colors.ground-deep}`): humidity/wind tile, hover wash, band 2.
- **Paper Surface** (`{colors.surface}`): search input and the hourly print ground. Dark: `{colors.dark-surface}`.
- **Night Ink** (`{colors.ink}`): body text (#1b1a2b); muted text `{colors.ink-muted}`.
- **Hairlines** (`{colors.rule}`, strong `{colors.rule-strong}`): 1px dividers, tile borders; strong for input borders and scrollbar.
- **State washes**: `{colors.info-bg}` (offline) and `{colors.warn-bg}` (stale), both with ink text.
- **Temperature bands** (daytime high): `{colors.band-1}` under 20C, `{colors.band-2}` 20-27, `{colors.band-3}` 28-33, `{colors.band-4}` 34-38, `{colors.band-5}` 39+. Dark variants are defined as `--band-*` overrides.

### Named Rules
**The Three Dyes Rule.** Indigo, madder and turmeric are the only chromatic dyes; each carries one meaning (moisture, heat, sun). A new colour needs a new meaning.

**The Stepped Heat Rule.** Temperature colour is five discrete bands with a printed number inside; never a gradient, never colour alone.

**The Re-Dye Rule.** Dark mode keeps the same roles with re-tuned values (rain text becomes #aeb8e8, print ink #7f8bc4). Do not invert.

## Typography

**Display / Body / Label Font:** Archivo (variable, weights 100-900, self-hosted woff2) with system-ui fallbacks.

**Character:** a single workhorse grotesque. Large numerals go very light; labels go semi-bold; there is no second family.

### Hierarchy
- **Numeral** (200, clamp(8rem, 48vw, 12rem), 0.82): the current temperature, cropped tight by the hero field.
- **Display** (300, clamp(2.5rem, 12vw, 4rem), 1): empty-state headline only.
- **Headline** (650, 1.5rem, 1.2): place name, condition, search heading (700).
- **Title** (700, 1.25rem, 1.2): section heads (Hourly, Today, 7 days), feels-like tile (650).
- **Body** (400, 1rem, 1.45): default; values in dd at 650.
- **Label** (400, 0.8125rem to 0.875rem): times, keys, stat captions, muted ink.

### Named Rules
**The Weight-Not-Size Rule.** Hierarchy comes from weight and the one oversized numeral, not from a ladder of similar sizes.

## Layout

Mobile first, single column, edge-to-edge dye fields with a 16px gutter. The column is capped at 40rem and centred; header padding aligns to that column. Spacing is a 4px rhythm (4/8/12/16/24/32/48) with 32px between forecast sections. Hero tiles (feels-like and air) sit as a two-column grid directly under the indigo field. The 7-day list is a two-line row on phones (day and condition, rain, temps) and a single four-column row on wide screens.

At 60rem and up the page widens to 75rem: a sticky 26rem hero column on the left, hourly / stats / daily stacked on the right, 48px column gap, gutter 32px. Tap targets are at least 44px (`--tap`). The hourly strip scrolls horizontally with proximity snap, about 5.25 items visible on a phone.

## Elevation & Depth

None. The system is flat by commitment: depth is carried by colour blocks, 1px hairlines and sticky position only. The only layering is the full-screen search sheet over the page (solid ground, no scrim or shadow) and a sticky indigo top bar. Focus is a 3px offset outline, not a glow.

### Named Rules
**The No-Shadow Rule.** Fields are flat ink on paper. Separation comes from a change of dye or a hairline.

## Shapes

Square printing blocks. Controls use a 2px radius; fields, tiles, chips and bands have no radius. The hourly print tiles are 1:1 squares with a 1px hairline. The tiny "updated" marker is a square, not a dot. Pattern motifs (quatrefoils and dots) are the only ornament.

## Components

### Buttons
- **Shape:** near-square (2px), 44px minimum height and width, weight 650.
- **Primary:** turmeric fill, ink text, 16px side padding (Save). Hover deepens to turmeric-hover over 160ms ease-out.
- **Quiet (on indigo):** transparent with a 1px pale-indigo outline and cream text; hover inverts to cream fill with indigo text.
- **Outline (on cream):** transparent, 2px-radius, strong-rule border; Remove uses madder text (dark: salmon #e9a79a) with deep-cream hover.

### Status Banner
Full-width strip, 56px minimum: offline = info wash, stale = warm wash, error = madder with cream text and an inverted cream retry button. Always carries an icon and text, with the data's age as detail.

### Inputs / Fields
Paper-surface field, 2px strong-rule border, 2px radius, 48px input height, leading icon, placeholder in muted ink. Focus draws the 3px offset outline on the wrapper.

### Navigation
App header: indigo bar, mark plus bold 1rem title left, quiet icon buttons right (search, locate). The search sheet replaces the screen with the same indigo bar sticky on top, then a printed border band.

### Rain Print Strip (signature)
Twelve-plus hourly square tiles on a paper ground. Density 0 to 4 from rain chance (under 10, 10-29, 30-49, 50-69, 70+; falls back to mm when probability is null): clear paper, sparse dots, paired dots, quatrefoil with corner dots, then a solid indigo field with resist quatrefoils. Each tile is labelled with time, the percentage text (hidden "Chance of rain" for assistive tech) and temperature. A key line reads "Denser print, likelier rain". Dark mode swaps ink to a light periwinkle on the night surface.

### Printed Border Band
24px repeating quatrefoil-and-dot band in pale indigo, used above the empty-state headline and under the search sheet header. Decorative only.

### Hero and Tiles
Indigo field (46svh, min 19rem) with place, updated time, giant numeral and condition; beneath, a madder feels-like tile and a deep-cream air tile (humidity, wind).

### Daily Temperature Chip
The day's high sits in a stepped-band block with bold number; the low is muted text. Rain uses indigo text with a drop icon.

### Icons
Seven inline 24px SVG line icons (2px stroke, round caps), shown at 20px (16px in lists), inheriting text colour.

### Motion
Only two motions: the search sheet slides up 1.5rem and fades in over 240ms with `cubic-bezier(0.16, 1, 0.3, 1)`, and button/row hover backgrounds fade 160ms. `prefers-reduced-motion` collapses all durations.

## Do's and Don'ts

### Do:
- **Do** colour in flat fields: indigo for dominant areas, madder only for heat or error, turmeric for the one action or live marker.
- **Do** pair every colour signal with text or an icon (band number, rain percentage, status icon).
- **Do** keep the numeral light (200) and huge, and use `tabular-nums`.
- **Do** keep text on dye at 4.5:1 using the `on-*` pairs, and keep 44px tap targets.
- **Do** use the 4px spacing steps and the 2px control radius.
- **Do** give every new surface a dark counterpart by re-dyeing, with the same role.

### Don't:
- **Don't** use gradients, drop shadows, glass blur, cloud or sun clip-art, or smooth temperature ramps.
- **Don't** add a second typeface or more chromatic dyes.
- **Don't** put pattern anywhere but the hourly strip and the printed band.
- **Don't** show a bare dash for unknown rain chance; route through the shared formatter.
- **Don't** lean on colour alone to convey temperature or rain.
