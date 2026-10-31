import { useCallback, useState } from "react";
import type { Place } from "../api/types";
import { safeGet, safeSet } from "../lib/storage";

const SAVED_KEY = "places.saved";
const RECENT_KEY = "places.recent";
const SAVED_MAX = 8;
const RECENT_MAX = 5;

function isPlace(v: unknown): v is Place {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.lat === "number" &&
    typeof o.lon === "number" &&
    typeof o.name === "string"
  );
}

function load(key: string, max: number): Place[] {
  const raw = safeGet<unknown>(key, []);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: Place[] = [];
  for (const p of raw) {
    if (isPlace(p) && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out.slice(0, max);
}

export function useSavedPlaces() {
  const [saved, setSaved] = useState<Place[]>(() => load(SAVED_KEY, SAVED_MAX));
  const [recent, setRecent] = useState<Place[]>(() => load(RECENT_KEY, RECENT_MAX));

  const save = useCallback((p: Place) => {
    setSaved((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      const next = [...prev, p].slice(-SAVED_MAX);
      safeSet(SAVED_KEY, next);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setSaved((prev) => {
      const next = prev.filter((x) => x.id !== id);
      safeSet(SAVED_KEY, next);
      return next;
    });
  }, []);

  const touch = useCallback((p: Place) => {
    setRecent((prev) => {
      const next = [p, ...prev.filter((x) => x.id !== p.id)].slice(0, RECENT_MAX);
      safeSet(RECENT_KEY, next);
      return next;
    });
  }, []);

  return { saved, recent, save, remove, touch };
}
