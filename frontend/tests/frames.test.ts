import { describe, expect, it } from "vitest";
import { MAX_RADAR_AGE_MS, cyclonesUsable, offlineCyclonesLabel, offlineRadarLabel, usableFrames, warmIndices } from "../src/map/frames";

const NOW = Date.UTC(2026, 10, 1, 10, 30, 0); // 16:00 IST
const sec = (msAgo: number) => (NOW - msAgo) / 1000;
const MIN = 60_000;

describe("usableFrames", () => {
  it("keeps recent frames in order and drops anything older than the limit", () => {
    const frames = [
      { time: sec(4 * 60 * MIN), path: "/v2/radar/old" },
      { time: sec(170 * MIN), path: "/v2/radar/a" },
      { time: sec(10 * MIN), path: "/v2/radar/b" },
    ];
    expect(usableFrames(frames, NOW).map((f) => f.path)).toEqual(["/v2/radar/a", "/v2/radar/b"]);
  });

  it("keeps a frame exactly at the limit and drops one just past it", () => {
    const edge = { time: sec(MAX_RADAR_AGE_MS), path: "/v2/radar/edge" };
    const past = { time: sec(MAX_RADAR_AGE_MS + MIN), path: "/v2/radar/past" };
    expect(usableFrames([past, edge], NOW)).toEqual([edge]);
  });

  it("returns an empty list when nothing is recent enough", () => {
    expect(usableFrames([{ time: sec(5 * 60 * MIN), path: "/v2/radar/x" }], NOW)).toEqual([]);
    expect(usableFrames([], NOW)).toEqual([]);
  });

  it("limits radar to 3 hours", () => {
    expect(MAX_RADAR_AGE_MS).toBe(3 * 60 * MIN);
  });
});

describe("warmIndices", () => {
  it("warms the newest frame first, then the ones just before it", () => {
    expect(warmIndices(13)).toEqual([12, 11, 10, 9]);
  });

  it("never goes below the first frame", () => {
    expect(warmIndices(2)).toEqual([1, 0]);
    expect(warmIndices(1)).toEqual([0]);
    expect(warmIndices(0)).toEqual([]);
  });
});

describe("offlineRadarLabel", () => {
  it("says it is offline and gives the frame time and age", () => {
    expect(offlineRadarLabel(sec(80 * MIN), NOW)).toBe("Offline. Radar from 2:40 pm IST (1 h 20 min ago)");
  });

  it("handles a very fresh frame", () => {
    expect(offlineRadarLabel(sec(20_000), NOW)).toBe("Offline. Radar from 3:59 pm IST (just now)");
  });
});

describe("cyclone data age", () => {
  const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

  it("uses cyclone data up to 3 hours old and no older", () => {
    expect(cyclonesUsable(at(10 * MIN), NOW)).toBe(true);
    expect(cyclonesUsable(at(MAX_RADAR_AGE_MS), NOW)).toBe(true);
    expect(cyclonesUsable(at(MAX_RADAR_AGE_MS + MIN), NOW)).toBe(false);
  });

  it("does not trust a timestamp it cannot read", () => {
    expect(cyclonesUsable("not a date", NOW)).toBe(false);
  });

  it("labels offline storm positions with their time and age", () => {
    expect(offlineCyclonesLabel("2026-11-01T15:30:00+05:30", NOW)).toBe("Offline. Storm positions from 3:30 pm IST (30 min ago)");
  });
});
