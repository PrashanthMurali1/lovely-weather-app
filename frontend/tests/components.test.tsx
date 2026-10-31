import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyPoint, Forecast, HourlyPoint, Place } from "../src/api/types";

vi.mock("../src/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/api/client")>()),
  searchPlaces: vi.fn(),
  getForecast: vi.fn(),
}));

import { ApiError, getForecast, searchPlaces } from "../src/api/client";
import App from "../src/App";
import DailyList from "../src/components/DailyList";
import Footer from "../src/components/Footer";
import Hero from "../src/components/Hero";
import HourlyStrip from "../src/components/HourlyStrip";
import SearchSheet from "../src/components/SearchSheet";
import StatusBanner from "../src/components/StatusBanner";

const chennai: Place = { id: 1264527, name: "Chennai", admin: "Tamil Nadu", lat: 13.08, lon: 80.28 };
const cheran: Place = { id: 5, name: "Chengalpattu", admin: "Tamil Nadu", lat: 12.69, lon: 79.98 };

const hourly = (over: Partial<HourlyPoint> = {}): HourlyPoint => ({
  time: "2026-10-31T14:00",
  tempC: 31,
  precipProbPct: 20,
  precipMm: 0,
  windKph: 10,
  weatherCode: 1,
  ...over,
});
const daily = (i: number, over: Partial<DailyPoint> = {}): DailyPoint => ({
  date: `2026-11-0${i + 1}`,
  tempMaxC: 32,
  tempMinC: 25,
  precipSumMm: 0,
  precipProbPct: 10,
  sunrise: "2026-11-01T06:05",
  sunset: "2026-11-01T17:40",
  weatherCode: 2,
  ...over,
});
const forecast: Forecast = {
  location: { lat: 13.08, lon: 80.28, timezone: "Asia/Kolkata" },
  model: "m",
  generatedAt: null,
  fetchedAt: "2026-10-31T08:30:00Z",
  stale: false,
  current: {
    time: "2026-10-31T14:00",
    tempC: 31.4,
    feelsLikeC: 36.2,
    humidityPct: 70,
    windKph: 12,
    windDirDeg: 90,
    precipMm: 0,
    weatherCode: 2,
    isDay: true,
  },
  hourly: [hourly(), hourly({ time: "2026-10-31T15:00" })],
  daily: Array.from({ length: 7 }, (_, i) => daily(i)),
  attribution: "Weather data by Open-Meteo.com (test)",
};

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getForecast).mockReset();
  vi.mocked(searchPlaces).mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Hero", () => {
  it("shows temperature and condition label", () => {
    render(<Hero place={chennai} current={forecast.current} fetchedAt={forecast.fetchedAt} />);
    expect(screen.getByText("31°", { selector: ".hero-temp" })).toBeInTheDocument();
    expect(screen.getByText("Partly cloudy")).toBeInTheDocument();
    expect(screen.getByText(/Chennai/)).toBeInTheDocument();
    expect(screen.getByText(/Feels like 36°/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });
});

describe("HourlyStrip", () => {
  it("shows Trace and 0% labels", () => {
    render(
      <HourlyStrip
        hourly={[
          hourly({ precipProbPct: null, precipMm: 0.05 }),
          hourly({ time: "2026-10-31T15:00", precipProbPct: 0, precipMm: 2 }),
        ]}
      />,
    );
    expect(screen.getByText("Trace")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("DailyList", () => {
  it("renders 7 rows and uses precipSumMm when probability is null", () => {
    const d = Array.from({ length: 7 }, (_, i) => daily(i));
    d[3] = daily(3, { precipProbPct: null, precipSumMm: 4.26 });
    render(<DailyList daily={d} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("4.3 mm")).toBeInTheDocument();
  });
});

describe("StatusBanner", () => {
  it("offline", () => {
    render(<StatusBanner offline stale={false} fetchedAt="2026-10-31T08:30:00Z" onRetry={() => {}} />);
    expect(screen.getByText(/Offline, showing data from/)).toBeInTheDocument();
  });
  it("stale", () => {
    render(<StatusBanner offline={false} stale onRetry={() => {}} />);
    expect(screen.getByText("Showing older data — the weather service is unavailable.")).toBeInTheDocument();
  });
  it("error with retry", async () => {
    const onRetry = vi.fn();
    render(
      <StatusBanner
        offline={false}
        stale={false}
        error={new ApiError(502, "upstream_unavailable", "raw server text")}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("Weather data is temporarily unavailable.")).toBeInTheDocument();
    expect(screen.queryByText(/raw server text/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it("generic error for non-ApiError", () => {
    render(<StatusBanner offline={false} stale={false} error={new TypeError("fetch failed")} onRetry={() => {}} />);
    expect(screen.getByText("Can't reach the weather service.")).toBeInTheDocument();
  });
  it("renders nothing when clear", () => {
    const { container } = render(<StatusBanner offline={false} stale={false} onRetry={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Footer", () => {
  it("shows attribution", () => {
    render(<Footer attribution="Weather data by Open-Meteo.com" />);
    expect(screen.getByText("Weather data by Open-Meteo.com")).toBeInTheDocument();
  });
});

describe("SearchSheet", () => {
  it("lists results and selects one", async () => {
    vi.mocked(searchPlaces).mockResolvedValue([cheran]);
    const onSelect = vi.fn();
    wrap(<SearchSheet open onClose={() => {}} onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText("Search for a city"), "chen");
    await userEvent.click(await screen.findByRole("button", { name: "Chengalpattu, Tamil Nadu" }));
    expect(onSelect).toHaveBeenCalledWith(cheran);
    expect(JSON.parse(localStorage.getItem("places.recent")!)).toEqual([cheran]);
  });
  it("shows saved and recent when empty", () => {
    localStorage.setItem("places.saved", JSON.stringify([chennai]));
    localStorage.setItem("places.recent", JSON.stringify([cheran]));
    wrap(<SearchSheet open onClose={() => {}} onSelect={() => {}} />);
    const saved = screen.getByRole("region", { name: "Saved places" });
    expect(within(saved).getByText(/Chennai/)).toBeInTheDocument();
    const recent = screen.getByRole("region", { name: "Recent places" });
    expect(within(recent).getByText(/Chengalpattu/)).toBeInTheDocument();
  });
  it("shows No cities found", async () => {
    vi.mocked(searchPlaces).mockResolvedValue([]);
    wrap(<SearchSheet open onClose={() => {}} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText("Search for a city"), "zzzz");
    expect(await screen.findByText("No cities found")).toBeInTheDocument();
  });
  it("closes on Escape and is a modal dialog", async () => {
    const onClose = vi.fn();
    wrap(<SearchSheet open onClose={onClose} onSelect={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Search for a city")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("saves and removes via toggle", async () => {
    vi.mocked(searchPlaces).mockResolvedValue([cheran]);
    wrap(<SearchSheet open onClose={() => {}} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText("Search for a city"), "chen");
    await userEvent.click(await screen.findByRole("button", { name: "Save Chengalpattu" }));
    expect(JSON.parse(localStorage.getItem("places.saved")!)).toEqual([cheran]);
    await userEvent.click(screen.getByRole("button", { name: "Remove Chengalpattu" }));
    expect(JSON.parse(localStorage.getItem("places.saved")!)).toEqual([]);
  });
});

describe("App", () => {
  it("renders the Chennai forecast on first load", async () => {
    vi.mocked(getForecast).mockResolvedValue(forecast);
    wrap(<App />);
    expect(await screen.findByText("31°", { selector: ".hero-temp" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Chennai/ })).toBeInTheDocument();
    expect(screen.getByText("Weather data by Open-Meteo.com (test)")).toBeInTheDocument();
    expect(getForecast).toHaveBeenCalledWith(13.08, 80.28);
  });

  it("still renders when geolocation rejects and localStorage throws", async () => {
    vi.mocked(getForecast).mockResolvedValue(forecast);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, err: () => void) => err() },
    });
    wrap(<App />);
    expect(await screen.findByText("31°", { selector: ".hero-temp" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByText("31°", { selector: ".hero-temp" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("selects my location on geolocation success", async () => {
    vi.mocked(getForecast).mockResolvedValue(forecast);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 19.0761, longitude: 72.8777 } }),
      },
    });
    wrap(<App />);
    await screen.findByText("31°", { selector: ".hero-temp" });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByRole("heading", { name: /My location/ })).toBeInTheDocument();
    expect(getForecast).toHaveBeenLastCalledWith(19.08, 72.88);
    expect(localStorage.getItem("places.recent")).toBeNull();
  });
});
