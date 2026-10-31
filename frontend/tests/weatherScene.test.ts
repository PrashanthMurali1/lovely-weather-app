import { describe, expect, it } from "vitest";
import type { Current, DailyPoint } from "../src/api/types";
import { resolveWeatherScene, solarProgress } from "../src/lib/weatherScene";

const current: Current = { time: "2026-10-31T12:00:00+05:30", tempC: 28, feelsLikeC: 32, humidityPct: 70, windKph: 12, windDirDeg: 90, precipMm: 0, weatherCode: 0, isDay: true };
const today: DailyPoint = { date: "2026-10-31", sunrise: "2026-10-31T06:00:00+05:30", sunset: "2026-10-31T18:00:00+05:30", tempMaxC: 31, tempMinC: 25, precipSumMm: 0, precipProbPct: null, weatherCode: 0 };

describe("weather atmosphere", () => {
  it.each([
    [0, true, "day"], [0, false, "night"], [2, true, "day"], [3, true, "cloudy"],
    [61, false, "rain"], [95, false, "storm"], [71, true, "snow"], [45, true, "fog"], [999, true, "cloudy"],
  ])("uses code %s and daylight %s to select %s", (weatherCode, isDay, expected) => {
    expect(resolveWeatherScene({ ...current, weatherCode, isDay }, today)).toBe(expected);
  });
  it("uses the forecast location's solar times for dawn and dusk", () => {
    expect(resolveWeatherScene({ ...current, time: "2026-10-31T06:20:00+05:30" }, today)).toBe("dawn");
    expect(resolveWeatherScene({ ...current, time: "2026-10-31T17:40:00+05:30" }, today)).toBe("dusk");
    expect(resolveWeatherScene({ ...current, time: "2026-10-31T05:45:00+05:30", isDay: false }, today)).toBe("dawn");
  });
  it("keeps storms and rain visible at sunset", () => {
    expect(resolveWeatherScene({ ...current, time: "2026-10-31T18:00:00+05:30", weatherCode: 95 }, today)).toBe("storm");
    expect(resolveWeatherScene({ ...current, time: "2026-10-31T18:00:00+05:30", weatherCode: 61 }, today)).toBe("rain");
  });
  it("falls back safely without usable solar times", () => {
    expect(resolveWeatherScene(current)).toBe("day");
    expect(resolveWeatherScene(current, { ...today, sunrise: "invalid" })).toBe("day");
  });
});

describe("solar position", () => {
  it.each([["06:00", 0], ["12:00", 0.5], ["18:00", 1]])("places %s correctly", (time, expected) => {
    expect(solarProgress(`2026-10-31T${time}:00+05:30`, today)).toBe(expected);
  });
  it("understands naive IST timestamps and explicit UTC offsets equally", () => {
    expect(solarProgress("2026-10-31T12:00", today)).toBe(0.5);
    expect(solarProgress("2026-10-31T06:30:00Z", today)).toBe(0.5);
  });
  it("does not invent a sun position outside daylight or for invalid data", () => {
    expect(solarProgress("2026-10-31T20:00", today)).toBeNull();
    expect(solarProgress(current.time)).toBeNull();
    expect(solarProgress("invalid", today)).toBeNull();
    expect(solarProgress(current.time, { ...today, sunset: today.sunrise })).toBeNull();
  });
});
