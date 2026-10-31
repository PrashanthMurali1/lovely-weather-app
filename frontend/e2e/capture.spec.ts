import { test } from "@playwright/test";
import { forecastFixture } from "./fixtures";
import * as fs from "node:fs";
import * as path from "node:path";

const outDir = path.resolve(process.cwd(), "../data/screenshots");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function makeDayFixture() {
  const fx = forecastFixture({ tempC: 28, lat: 13.08, lon: 80.28 });
  fx.current.isDay = true;
  fx.current.weatherCode = 2; // partly cloudy
  fx.current.time = "2026-10-31T14:00";
  return fx;
}

function makeNightFixture() {
  const fx = forecastFixture({ tempC: 28, lat: 13.08, lon: 80.28 });
  fx.current.isDay = false;
  fx.current.weatherCode = 2; // partly cloudy night
  fx.current.time = "2026-10-31T20:00";
  return fx;
}

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-360", width: 360, height: 800 },
];

for (const vp of viewports) {
  test(`capture ${vp.name} day`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.route("**/api/forecast**", (route) => route.fulfill({ json: makeDayFixture() }));
    await page.goto("/");
    await page.waitForSelector(".hero-temp");
    await page.screenshot({ path: path.join(outDir, `${vp.name}-day.png`), fullPage: true });
  });

  test(`capture ${vp.name} night`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.route("**/api/forecast**", (route) => route.fulfill({ json: makeNightFixture() }));
    await page.goto("/");
    await page.waitForSelector(".hero-temp");
    await page.screenshot({ path: path.join(outDir, `${vp.name}-night.png`), fullPage: true });
  });
}
