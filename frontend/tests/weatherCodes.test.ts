import { describe, expect, it } from "vitest";
import { describeWeather } from "../src/lib/weatherCodes";

const CODES = [0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99];

describe("describeWeather", () => {
  it("labels moderate rain", () => {
    expect(describeWeather(61, true)).toEqual({ label: "Rain", icon: "rain" });
  });
  it("has day and night variants for clear sky", () => {
    expect(describeWeather(0, true)).toEqual({ label: "Clear sky", icon: "clear-day" });
    expect(describeWeather(0, false)).toEqual({ label: "Clear sky", icon: "clear-night" });
  });
  it("covers every code Open-Meteo emits", () => {
    for (const c of CODES) {
      const d = describeWeather(c, true);
      expect(d.label).not.toBe("Unknown");
      expect(d.icon).not.toBe("unknown");
    }
  });
  it("falls back for unknown codes", () => {
    expect(describeWeather(1234, true)).toEqual({ label: "Unknown", icon: "unknown" });
  });
});
