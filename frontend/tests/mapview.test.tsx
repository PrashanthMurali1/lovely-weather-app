import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cyclone, Cyclones, RadarFrames } from "../src/api/types";

const state: { radar: unknown; cyclones: unknown } = { radar: null, cyclones: null };

vi.mock("../src/hooks/useRadar", () => ({ useRadar: () => state.radar }));
vi.mock("../src/hooks/useCyclones", () => ({ useCyclones: () => state.cyclones }));
// jsdom has no canvas; the engine itself is covered by the pure-function tests.
vi.mock("../src/map/MapCanvas", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef((props: { frameIndex: number; showRadar: boolean; showCyclones: boolean }, ref) => {
      React.useImperativeHandle(ref, () => ({ zoomIn() {}, zoomOut() {}, fitRegion() {}, flyToPlace() {}, flyToCyclone() {} }));
      return (
        <div data-testid="canvas" data-frame={props.frameIndex} data-radar={props.showRadar} data-cyclones={props.showCyclones} />
      );
    }),
  };
});

import MapView from "../src/map/MapView";

const radarData: RadarFrames = {
  host: "https://tilecache.rainviewer.com",
  generatedAt: 1793527533,
  stale: false,
  attribution: "Radar by RainViewer",
  frames: [0, 1, 2].map((i) => ({ time: 1793520000 + i * 600, path: `/v2/radar/f${i}` })),
};

const storm: Cyclone = {
  id: "9",
  name: "FOUR-26",
  alert: "Red",
  active: true,
  windKph: 120.4,
  center: [84.8, 12.2],
  fromDate: "",
  toDate: "",
  track: [
    { lon: 84.8, lat: 12.2, time: "2026-11-01T00:00:00+00:00", cls: "HU" },
    { lon: 82, lat: 13.6, time: "2026-11-02T06:00:00+00:00", cls: "TS" },
  ],
  cone: [],
  windFields: [],
  reportUrl: "https://www.gdacs.org/report.aspx?eventid=9",
};

const query = (data: unknown, over: Record<string, unknown> = {}) => ({
  data,
  isError: false,
  refetch: vi.fn(),
  ...over,
});

const cyclones = (list: Cyclone[]): Cyclones => ({
  fetchedAt: "2026-11-01T15:30:00+05:30",
  stale: false,
  cyclones: list,
  attribution: "Cyclone data by GDACS (UN OCHA / EC JRC)",
});

const place = { id: 1, name: "Chennai", admin: "Tamil Nadu", lat: 13.08, lon: 80.28 };

beforeEach(() => {
  state.radar = query(radarData);
  state.cyclones = query(cyclones([storm]));
});

describe("MapView", () => {
  it("shows the radar time in IST and starts on the newest frame", () => {
    render(<MapView theme="dark" place={place} online />);
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-frame", "2");
    expect(screen.getByText(/IST/)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Radar time" })).toHaveValue("2");
  });

  it("scrubbing the slider changes the frame and Latest returns to the newest", async () => {
    render(<MapView theme="dark" place={place} online />);
    fireEvent.change(screen.getByRole("slider", { name: "Radar time" }), { target: { value: "0" } });
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-frame", "0");
    await userEvent.click(screen.getByRole("button", { name: "Latest" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-frame", "2");
  });

  it("layer toggles report their state and hide the legend", async () => {
    render(<MapView theme="dark" place={place} online />);
    const radarBtn = screen.getByRole("button", { name: "Radar" });
    expect(radarBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Radar intensity legend" })).toBeInTheDocument();
    await userEvent.click(radarBtn);
    expect(radarBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "Radar intensity legend" })).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Radar time" })).toBeDisabled();
  });

  it("lists cyclones and expands one to show its forecast with sources", async () => {
    render(<MapView theme="dark" place={place} online />);
    const head = screen.getByRole("button", { name: /FOUR-26/ });
    expect(head).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Red alert/)).toBeInTheDocument();
    await userEvent.click(head);
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Forecast track/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IMD" })).toHaveAttribute("href", "https://mausam.imd.gov.in/");
    expect(screen.getByRole("link", { name: "GDACS report" })).toBeInTheDocument();
  });

  it("says plainly when there are no cyclones", () => {
    state.cyclones = query(cyclones([]));
    render(<MapView theme="dark" place={place} online />);
    expect(screen.getByText(/No active or recent cyclones/)).toBeInTheDocument();
  });

  it("offers retry when radar fails, and explains when offline", async () => {
    const refetch = vi.fn();
    state.radar = query(undefined, { isError: true, refetch });
    const { unmount } = render(<MapView theme="dark" place={place} online />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load radar.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
    unmount();

    render(<MapView theme="dark" place={place} online={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Radar needs a connection.");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("credits every data source", () => {
    render(<MapView theme="dark" place={place} online />);
    const text = document.querySelector(".map-attribution")!.textContent!;
    expect(text).toContain("RainViewer");
    expect(text).toContain("GDACS");
    expect(text).toContain("Natural Earth");
  });
});
