import { describe, expect, it } from "vitest";
import { fitBounds } from "../src/map/projection";
import { INDIA_VIEW, PLACE_ZOOM, startView } from "../src/map/startView";

const size = { w: 900, h: 600 };
const chennai = { lat: 13.08, lon: 80.28 };

describe("startView", () => {
  it("opens on the selected place, zoomed in", () => {
    expect(startView(chennai, size)).toEqual({ lon: 80.28, lat: 13.08, zoom: PLACE_ZOOM });
  });

  it("opens on all of India when no place is selected", () => {
    expect(startView(null, size)).toEqual(fitBounds(INDIA_VIEW, size, 12));
  });
});
