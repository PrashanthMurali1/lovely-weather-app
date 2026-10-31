import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Place } from "../src/api/types";

vi.mock("../src/api/client", () => ({
  searchPlaces: vi.fn(async () => []),
  getForecast: vi.fn(async () => ({ ok: true })),
}));

import { getForecast, searchPlaces } from "../src/api/client";
import { useForecast } from "../src/hooks/useForecast";
import { useSavedPlaces } from "../src/hooks/useSavedPlaces";
import { useSearch } from "../src/hooks/useSearch";
import { createQueryClient } from "../src/lib/queryClient";
import { DEFAULT_PLACE } from "../src/lib/defaults";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const mk = (id: number): Place => ({ id, name: `P${id}`, admin: null, lat: id, lon: id });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(searchPlaces).mockClear();
  vi.mocked(getForecast).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DEFAULT_PLACE", () => {
  it("is Chennai", () => {
    expect(DEFAULT_PLACE).toEqual({ id: 1264527, name: "Chennai", admin: "Tamil Nadu", lat: 13.08, lon: 80.28 });
  });
});

describe("useSearch", () => {
  it("does not call API for 1 char, does for 2 after debounce", async () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ q }) => useSearch(q), {
      wrapper: wrapper(),
      initialProps: { q: "c" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(searchPlaces).not.toHaveBeenCalled();
    rerender({ q: "ch" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(searchPlaces).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(searchPlaces).toHaveBeenCalledWith("ch");
  });
});

describe("useForecast", () => {
  it("makes no request for null place", async () => {
    renderHook(() => useForecast(null), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(getForecast).not.toHaveBeenCalled();
  });
  it("fetches with rounded coords", async () => {
    const p = { ...mk(1), lat: 13.081234, lon: 80.2789 };
    const { result } = renderHook(() => useForecast(p), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getForecast).toHaveBeenCalledWith(p.lat, p.lon);
  });
});

describe("useSavedPlaces", () => {
  it("caps saved at 8, dropping oldest", () => {
    const { result } = renderHook(() => useSavedPlaces());
    act(() => {
      for (let i = 1; i <= 9; i++) result.current.save(mk(i));
    });
    expect(result.current.saved.map((p) => p.id).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(JSON.parse(localStorage.getItem("places.saved")!)).toHaveLength(8);
  });
  it("dedupes saved by id", () => {
    const { result } = renderHook(() => useSavedPlaces());
    act(() => {
      result.current.save(mk(1));
      result.current.save(mk(2));
      result.current.save(mk(1));
    });
    expect(result.current.saved.map((p) => p.id)).toEqual([1, 2]);
  });
  it("removes", () => {
    const { result } = renderHook(() => useSavedPlaces());
    act(() => {
      result.current.save(mk(1));
      result.current.save(mk(2));
    });
    act(() => result.current.remove(1));
    expect(result.current.saved.map((p) => p.id)).toEqual([2]);
  });
  it("recent caps at 5, most recent first, dedupes", () => {
    const { result } = renderHook(() => useSavedPlaces());
    act(() => {
      for (let i = 1; i <= 6; i++) result.current.touch(mk(i));
      result.current.touch(mk(3));
    });
    expect(result.current.recent.map((p) => p.id)).toEqual([3, 6, 5, 4, 2]);
  });
  it("works when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => useSavedPlaces());
    expect(() => act(() => result.current.save(mk(1)))).not.toThrow();
    act(() => result.current.touch(mk(2)));
    expect(result.current.saved.map((p) => p.id)).toEqual([1]);
    expect(result.current.recent.map((p) => p.id)).toEqual([2]);
  });
  it("ignores corrupt stored data", () => {
    localStorage.setItem("places.saved", JSON.stringify([mk(1), { id: "x" }, null, 5, { id: 2, lat: 1, lon: 1 }]));
    localStorage.setItem("places.recent", "{not an array");
    const { result } = renderHook(() => useSavedPlaces());
    expect(result.current.saved.map((p) => p.id)).toEqual([1]);
    expect(result.current.recent).toEqual([]);
  });
});

describe("offline-first fetching", () => {
  afterEach(() => onlineManager.setOnline(true));

  async function runOffline(client: QueryClient) {
    onlineManager.setOnline(false);
    const w = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(() => useForecast(mk(5)), { wrapper: w });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }

  it("still calls getForecast while offline with createQueryClient", async () => {
    await runOffline(createQueryClient());
    expect(getForecast).toHaveBeenCalledTimes(1);
  });

  it("default QueryClient would pause (guards the regression)", async () => {
    await runOffline(new QueryClient());
    expect(getForecast).not.toHaveBeenCalled();
  });
});
