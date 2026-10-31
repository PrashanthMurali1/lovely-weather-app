import type { Current, DailyPoint } from "../api/types";

export type WeatherSceneName = "day" | "night" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "dawn" | "dusk";

// Offset-free API timestamps belong to IST, independent of the device timezone.
export function forecastTime(time: string): number {
  return Date.parse(/[zZ]|[+-]\d{2}:\d{2}$/.test(time) ? time : `${time}+05:30`);
}

export function solarProgress(time: string, today?: DailyPoint): number | null {
  if (!today) return null;
  const start = forecastTime(today.sunrise), end = forecastTime(today.sunset), now = forecastTime(time);
  if (![start, end, now].every(Number.isFinite) || end <= start || now < start || now > end) return null;
  return (now - start) / (end - start);
}

export function resolveWeatherScene(current: Current, today?: DailyPoint): WeatherSceneName {
  const code = current.weatherCode;
  if ([95, 96, 99].includes(code)) return "storm";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([45, 48].includes(code)) return "fog";
  if (![0, 1, 2].includes(code)) return "cloudy";
  if (today) {
    const now = forecastTime(current.time), sunrise = forecastTime(today.sunrise), sunset = forecastTime(today.sunset);
    if ([now, sunrise, sunset].every(Number.isFinite) && sunset > sunrise) {
      const window = 45 * 60_000;
      if (Math.abs(now - sunrise) <= window) return "dawn";
      if (Math.abs(now - sunset) <= window) return "dusk";
    }
  }
  return current.isDay ? "day" : "night";
}
