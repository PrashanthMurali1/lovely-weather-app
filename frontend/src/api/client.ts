import type { Cyclones, Forecast, Place, RadarFrames } from "./types";

const BASE: string = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    let code = "unknown";
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.error?.code === "string") code = body.error.code;
      if (typeof body?.error?.message === "string") message = body.error.message;
    } catch {
      // non-JSON error body: keep defaults
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export async function searchPlaces(q: string): Promise<Place[]> {
  const body = await request<{ results: Place[] }>(`/api/search?q=${encodeURIComponent(q)}`);
  return body.results;
}

export function getForecast(lat: number, lon: number): Promise<Forecast> {
  return request<Forecast>(`/api/forecast?lat=${lat}&lon=${lon}`);
}

export function getRadar(): Promise<RadarFrames> {
  return request<RadarFrames>("/api/radar");
}

export function getCyclones(): Promise<Cyclones> {
  return request<Cyclones>("/api/cyclones");
}
