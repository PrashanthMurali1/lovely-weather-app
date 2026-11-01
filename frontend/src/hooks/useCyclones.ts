import { useQuery } from "@tanstack/react-query";
import { getCyclones } from "../api/client";

export function useCyclones(enabled = true) {
  return useQuery({
    queryKey: ["cyclones"],
    queryFn: getCyclones,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });
}
