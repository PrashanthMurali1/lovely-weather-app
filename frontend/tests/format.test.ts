import { describe, expect, it } from "vitest";
import { formatFetchedTime, formatFetchedWhen, formatRainChance } from "../src/lib/format";

describe("formatRainChance", () => {
  it("formats numeric probability", () => {
    expect(formatRainChance(35, 2)).toBe("35%");
    expect(formatRainChance(0, 3)).toBe("0%");
  });
  it("handles null probability", () => {
    expect(formatRainChance(null, 0)).toBe("0%");
    expect(formatRainChance(null, 0.05)).toBe("Trace");
    expect(formatRainChance(null, 0.44)).toBe("0.4 mm");
  });
});

describe("formatFetchedWhen", () => {
  const fetched = "2026-10-31T08:42:00Z"; // Sat 31 Oct, 2:12 pm IST
  it("omits the day for same-day data in IST", () => {
    expect(formatFetchedWhen(fetched, new Date("2026-10-31T17:00:00Z"))).toBe(formatFetchedTime(fetched));
  });
  it("says yesterday across the IST midnight", () => {
    expect(formatFetchedWhen(fetched, new Date("2026-10-31T19:00:00Z"))).toBe(`yesterday ${formatFetchedTime(fetched)}`);
  });
  it("uses the weekday within a week and the date beyond", () => {
    expect(formatFetchedWhen(fetched, new Date("2026-11-03T06:00:00Z"))).toBe(`Sat ${formatFetchedTime(fetched)}`);
    expect(formatFetchedWhen(fetched, new Date("2026-11-12T06:00:00Z"))).toBe(`31 Oct ${formatFetchedTime(fetched)}`);
  });
});
