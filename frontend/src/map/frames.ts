import type { RadarFrame } from "../api/types";
import { formatAge, formatEpochClock } from "./time";

/** Radar is only meaningful for a couple of hours; nothing older is ever shown, online or off. */
export const MAX_RADAR_AGE_MS = 3 * 60 * 60 * 1000;

/** Frames loaded eagerly: the newest, and the few before it so Play has something to show. */
const WARM_FRAMES = 4;

export function usableFrames(frames: RadarFrame[], nowMs: number): RadarFrame[] {
  return frames.filter((f) => nowMs - f.time * 1000 <= MAX_RADAR_AGE_MS);
}

/** Indices to load without being asked, newest first. */
export function warmIndices(count: number, keep: number = WARM_FRAMES): number[] {
  const out: number[] = [];
  for (let i = count - 1; i >= 0 && out.length < keep; i--) out.push(i);
  return out;
}

/** Storm data follows the same 3-hour limit: a stale position is worse than none. */
export function cyclonesUsable(fetchedAtIso: string, nowMs: number): boolean {
  const t = Date.parse(fetchedAtIso);
  return !Number.isNaN(t) && nowMs - t <= MAX_RADAR_AGE_MS;
}

export function offlineCyclonesLabel(fetchedAtIso: string, nowMs: number): string {
  const sec = Date.parse(fetchedAtIso) / 1000;
  return `Offline. Storm positions from ${formatEpochClock(sec)} IST (${formatAge(sec, nowMs)})`;
}

export function offlineRadarLabel(frameTimeSec: number, nowMs: number): string {
  return `Offline. Radar from ${formatEpochClock(frameTimeSec)} IST (${formatAge(frameTimeSec, nowMs)})`;
}
