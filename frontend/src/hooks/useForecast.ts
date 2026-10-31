import { useQuery } from "@tanstack/react-query";
import { getForecast } from "../api/client";
import type { Place } from "../api/types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function useForecast(place: Place | null) {
  const lat = place ? round2(place.lat) : null;
  const lon = place ? round2(place.lon) : null;
  return useQuery({
    queryKey: ["forecast", lat, lon],
    queryFn: () => getForecast(place!.lat, place!.lon),
    enabled: place !== null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
