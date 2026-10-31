---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: ["frontend/src/components"]
---

# Surface brief: India Weather app screens (forecast, search sheet, status banner)

Mode: Operate (glance-and-go phone app). Code-led build.
Audience/job: everyday Indians on a phone, often outdoors in bright light and on patchy data, asking "how hot, will it rain soon, how will it feel, what's the week like". Constraints from PRODUCT.md: IST, offline/stale/error states are designed states, null rain probability shown via formatRainChance (never "—"), WCAG 4.5:1, prefers-reduced-motion, no information by color alone, no UI library.
User avoids: dense/cluttered, childish/cartoonish. Brief: minimalistic, modern, colorful, bold, clean.
Unresolved: app name/logo (working title "India Weather"); real icon artwork.

## Direction contract

THESIS: The weather answer is a flat block-printed field of colour: one giant numeral on an indigo ground, heat in madder red, nothing else competing. Refuses the category default of blue gradient, cloud clip-art and glass cards.
OWN-WORLD: Ajrakh woodblock print. Deep indigo (rain/moisture, the dominant field), madder red (heat/feels-like), turmeric yellow (sun, live accent), cream resist ground and ink for text. Flat unmodulated fields, no gradients or shadows; stepped (not gradient) tonal ramps for temperature. One workhorse grotesque for UI, numerals tabular and very large and light; the hourly strip is the only printed-pattern surface. Recognizable with content removed: indigo/madder/cream flat fields with a block-print dot/leaf motif at varying density.
STORY: In two seconds the visitor knows the temperature and condition, whether rain is coming in the next hours, and how it feels; the week is one scroll away. Offline/stale states say how old the data is.
FIRST VIEWPORT (390px wide phone): top bar with place name + IST update time and a search button; an indigo field owning ~45% of the height with the temperature numeral set giant and cream (cropped by the field edge is allowed), condition label beneath; a madder-red tile for feels-like beside a cream tile for humidity/wind; then the 12-hour rain strip as a row of printed blocks whose motif density equals rain chance (dry = clear cream, heavy = dense indigo print), labelled with hours and the formatRainChance text; the 7-day list begins below the fold. Primary action is the search button, top right.
FORM: assigned candidate 6 of 7 grounded directions, ordered by resonance; seed:7c588b2a6e8084d6. Raises kept: flat-colour field commitment with giant numerals (donor: metro-typographic-tiles); stepped tonal ramp for temperature (donor: exposure-record-zone-sheets). Signature move: rain-chance print density strip.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
