import { describe, expect, it } from "vitest";
import { formatRainChance } from "../src/lib/format";

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
