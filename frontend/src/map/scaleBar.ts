import type { View } from "./projection";

// Round lengths worth showing, in metres.
const STEPS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000];

/** The longest round-number bar that fits in maxPx at this view, with its on-screen length and label. */
export function scaleBar(view: View, maxPx: number): { px: number; label: string } {
  const metresPerPx = (156543.03392 * Math.cos((view.lat * Math.PI) / 180)) / 2 ** view.zoom;
  let metres = STEPS[0];
  for (const m of STEPS) if (m / metresPerPx <= maxPx) metres = m;
  return {
    px: metres / metresPerPx,
    label: metres >= 1000 ? `${metres / 1000} km` : `${metres} m`,
  };
}
