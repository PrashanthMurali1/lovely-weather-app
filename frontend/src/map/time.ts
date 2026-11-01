const IST = "Asia/Kolkata";

/** "5:30 pm" in IST from epoch seconds. */
export function formatEpochClock(epochSec: number): string {
  return new Date(epochSec * 1000)
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST })
    .toLowerCase();
}

/** "Mon 5:30 pm" in IST from an ISO timestamp. */
export function formatTrackTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("en-IN", { weekday: "short", timeZone: IST });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST }).toLowerCase();
  return `${day} ${time}`;
}

/** "12 min ago" style age for an epoch-seconds timestamp. */
export function formatAge(epochSec: number, nowMs: number = Date.now()): string {
  const mins = Math.max(0, Math.round((nowMs - epochSec * 1000) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h ago` : `${h} h ${m} min ago`;
}
