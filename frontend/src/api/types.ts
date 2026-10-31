export interface Place {
  id: number;
  name: string;
  admin: string | null;
  lat: number;
  lon: number;
}

export interface Location {
  lat: number;
  lon: number;
  timezone: string;
}

export interface Current {
  time: string;
  tempC: number;
  feelsLikeC: number;
  humidityPct: number;
  windKph: number;
  windDirDeg: number;
  precipMm: number;
  weatherCode: number;
  isDay: boolean;
}

export interface HourlyPoint {
  time: string;
  tempC: number;
  precipProbPct: number | null;
  precipMm: number;
  windKph: number;
  weatherCode: number;
}

export interface DailyPoint {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipSumMm: number;
  precipProbPct: number | null;
  sunrise: string;
  sunset: string;
  weatherCode: number;
}

export interface Forecast {
  location: Location;
  model: string;
  generatedAt: string | null;
  fetchedAt: string;
  stale: boolean;
  current: Current;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  attribution: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
