export function formatRainChance(probPct: number | null, precipMm: number): string {
  if (probPct !== null) return `${Math.round(probPct)}%`;
  if (precipMm === 0) return "0%";
  if (precipMm < 0.1) return "Trace";
  return `${(Math.round(precipMm * 10) / 10).toFixed(1)} mm`;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function compassDirection(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Local-time strings from the API (e.g. "2026-11-01T06:05") are already in the place's zone (IST). */
export function formatClock(localIso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(localIso);
  if (!m) return localIso;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${suffix}`;
}

export function formatDay(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatFetchedTime(fetchedAt: string): string {
  const d = new Date(fetchedAt);
  if (Number.isNaN(d.getTime())) return fetchedAt;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
