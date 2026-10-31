import { expect, test } from "@playwright/test";
import { CHENNAI_TEMP, MUMBAI_TEMP, forecastFixture, mumbaiPlace } from "./fixtures";

test("shows Chennai, switches to Mumbai via search, shows attribution", async ({ page }) => {
  await page.route("**/api/search**", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    const results = q === "mumbai" ? [mumbaiPlace] : [];
    await route.fulfill({ json: { results } });
  });
  await page.route("**/api/forecast**", async (route) => {
    const lat = Number(new URL(route.request().url()).searchParams.get("lat"));
    const fx =
      Math.abs(lat - mumbaiPlace.lat) < 0.5
        ? forecastFixture({ tempC: MUMBAI_TEMP, lat: mumbaiPlace.lat, lon: mumbaiPlace.lon })
        : forecastFixture({ tempC: CHENNAI_TEMP, lat: 13.08, lon: 80.28 });
    await route.fulfill({ json: fx });
  });

  await page.goto("/");
  const hero = page.locator(".hero");
  await expect(hero).toContainText("Chennai");
  await expect(hero.locator(".hero-temp")).toHaveText(`${CHENNAI_TEMP}°`);
  await expect(page.locator(".hourly-item")).toHaveCount(48);
  await expect(page.locator(".daily-detail")).toHaveCount(7);

  await page.getByRole("button", { name: "Search places" }).click();
  await page.getByRole("searchbox").fill("mumbai");
  await page.getByRole("button", { name: /Mumbai/ }).first().click();

  await expect(hero).toContainText("Mumbai");
  await expect(hero.locator(".hero-temp")).toHaveText(`${MUMBAI_TEMP}°`);
  await expect(page.locator("footer")).toContainText("Open-Meteo");
});

test("phone forecast has no page overflow and search restores keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route("**/api/forecast**", route => route.fulfill({ json: forecastFixture({ tempC: 28, lat: 13.08, lon: 80.28 }) }));
  await page.goto("/");
  await expect(page.locator(".hourly-item")).toHaveCount(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const search = page.getByRole("button", { name: "Search places" });
  await search.click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  expect(await page.locator(".app-content").evaluate(el => (el as HTMLElement).inert)).toBe(true);
  await page.getByRole("dialog").getByRole("button", { name: "Use my location", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await page.locator(".hourly-list").focus();
  await page.keyboard.press("End");
  await page.locator(".hourly-item").last().scrollIntoViewIfNeeded();
  await expect(page.locator(".hourly-item").last()).toBeInViewport();
});

test("cached forecast keeps its age and attribution when the device goes offline", async ({ page, context }) => {
  const fixture = { ...forecastFixture({ tempC: 28, lat: 13.08, lon: 80.28 }), stale: true };
  await page.route("**/api/forecast**", route => route.fulfill({ json: fixture }));
  await page.goto("/");
  await expect(page.getByText("Showing older data — the weather service is unavailable.")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/Offline, showing data from/)).toBeVisible();
  await expect(page.locator(".hero-updated")).toContainText("Updated");
  await expect(page.locator("footer")).toContainText("Open-Meteo");
  await expect(page.locator(".hourly-item")).toHaveCount(48);
  await context.setOffline(false);
});

test("rainy night stays overcast and reduced motion stops atmospheric movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = forecastFixture({ tempC: 28, lat: 13.08, lon: 80.28 });
  fixture.current = { ...fixture.current, weatherCode: 61, isDay: false, time: "2026-10-31T21:00" };
  await page.route("**/api/forecast**", route => route.fulfill({ json: fixture }));
  await page.goto("/");
  await expect(page.locator(".weather-scene")).toHaveAttribute("data-scene", "rain");
  await expect(page.locator(".scene-stars")).toHaveCount(0);
  expect(await page.locator(".scene-cloud-front").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
});
