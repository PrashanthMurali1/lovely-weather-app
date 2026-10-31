// Realistic API payloads (shapes from src/api/types.ts) for mocked e2e runs.
interface Fixture {
  tempC: number;
  lat: number;
  lon: number;
}

export function forecastFixture({ tempC, lat, lon }: Fixture) {
  const base = Date.UTC(2026, 9, 31, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (ms: number) => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    time: iso(base + i * 3600_000),
    tempC: tempC - 3 + Math.round(4 * Math.sin((i / 24) * 2 * Math.PI - 2)),
    precipProbPct: i % 5 === 0 ? null : (i * 7) % 100,
    precipMm: i % 6 === 0 ? 0.4 : 0,
    windKph: 10 + (i % 8),
    weatherCode: i % 9 === 0 ? 61 : 2,
  }));
  const daily = Array.from({ length: 7 }, (_, i) => {
    const day = iso(base + i * 86_400_000).slice(0, 10);
    return {
      date: day,
      tempMaxC: tempC + 2 - (i % 3),
      tempMinC: tempC - 6 + (i % 2),
      precipSumMm: i % 2 ? 3.2 : 0,
      precipProbPct: i === 3 ? null : 30 + i * 5,
      sunrise: `${day}T06:05`,
      sunset: `${day}T17:42`,
      weatherCode: i % 2 ? 80 : 1,
    };
  });
  return {
    location: { lat, lon, timezone: "Asia/Kolkata" },
    model: "open-meteo-best-match",
    generatedAt: null,
    fetchedAt: iso(base + 11 * 3600_000 + 30 * 60_000) + ":00Z",
    stale: false,
    current: {
      time: iso(base + 12 * 3600_000),
      tempC,
      feelsLikeC: tempC + 3,
      humidityPct: 71,
      windKph: 14,
      windDirDeg: 80,
      precipMm: 0,
      weatherCode: 2,
      isDay: true,
    },
    hourly,
    daily,
    attribution: "Weather data by Open-Meteo.com",
  };
}

export const CHENNAI_TEMP = 31;
export const MUMBAI_TEMP = 27;

export const mumbaiPlace = {
  id: 1275339,
  name: "Mumbai",
  admin: "Maharashtra",
  lat: 19.07,
  lon: 72.88,
};
