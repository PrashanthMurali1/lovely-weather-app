import { useQuery } from "@tanstack/react-query";
import { getRadar } from "../api/client";

/** Radar frames refresh every few minutes; the tiles themselves are immutable per frame. */
export function useRadar(enabled = true) {
  return useQuery({
    queryKey: ["radar"],
    queryFn: getRadar,
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 1,
  });
}
