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

  await page.getByRole("button", { name: "Search places" }).click();
  await page.getByRole("searchbox").fill("mumbai");
  await page.getByRole("button", { name: /Mumbai/ }).first().click();

  await expect(hero).toContainText("Mumbai");
  await expect(hero.locator(".hero-temp")).toHaveText(`${MUMBAI_TEMP}°`);
  await expect(page.locator("footer")).toContainText("Open-Meteo");
});
