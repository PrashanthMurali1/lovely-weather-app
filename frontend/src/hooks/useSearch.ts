import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchPlaces } from "../api/client";

export function useSearch(q: string) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const term = debounced.trim();
  return useQuery({
    queryKey: ["search", term],
    queryFn: () => searchPlaces(term),
    enabled: term.length >= 2,
    staleTime: 30 * 60 * 1000,
  });
}
