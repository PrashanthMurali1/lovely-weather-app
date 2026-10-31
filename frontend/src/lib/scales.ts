/** Rain chance as one of five print densities: 0 = dry, 4 = heavy. Mirrors formatRainChance's fallback to rain amount. */
export function rainDensity(probPct: number | null, precipMm: number): 0 | 1 | 2 | 3 | 4 {
  if (probPct !== null) {
    if (probPct < 10) return 0;
    if (probPct < 30) return 1;
    if (probPct < 50) return 2;
    if (probPct < 70) return 3;
    return 4;
  }
  if (precipMm === 0) return 0;
  if (precipMm < 0.1) return 1;
  if (precipMm < 1) return 2;
  if (precipMm < 4) return 3;
  return 4;
}

/** Stepped temperature band for a daytime high: 1 = cool, 5 = extreme heat. */
export function tempBand(tempC: number): 1 | 2 | 3 | 4 | 5 {
  if (tempC < 20) return 1;
  if (tempC < 28) return 2;
  if (tempC < 34) return 3;
  if (tempC < 39) return 4;
  return 5;
}
