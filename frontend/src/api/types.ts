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

export interface RadarFrame {
  time: number;
  path: string;
}

export interface RadarFrames {
  host: string;
  generatedAt: number;
  stale: boolean;
  frames: RadarFrame[];
  attribution: string;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  time: string | null;
  cls: string | null;
}

export interface WindField {
  kph: number;
  ring: number[][];
}

export interface Cyclone {
  id: string;
  name: string;
  alert: string;
  active: boolean;
  windKph: number | null;
  center: number[];
  fromDate: string;
  toDate: string;
  track: TrackPoint[];
  cone: number[][][];
  windFields: WindField[];
  reportUrl: string | null;
}

export interface Cyclones {
  fetchedAt: string;
  stale: boolean;
  cyclones: Cyclone[];
  attribution: string;
}
