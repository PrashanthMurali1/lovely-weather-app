/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { forecastFetchPlugin } from "./src/sw/forecastPlugins.ts";
import { isCyclonesApi, isRadarFramesApi, isRadarTile } from "./src/sw/radarCaching.ts";

// Must match the port scripts/dev-backend.mjs starts uvicorn on.
const API_TARGET = `http://localhost:${process.env.BACKEND_PORT || "8001"}`;

const THEME = "#183b5b";
const GROUND = "#111b3b";
// Radar older than this is never shown, so there is no reason to keep it cached.
const RADAR_MAX_AGE_SECONDS = 3 * 60 * 60;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "India Weather",
        short_name: "Weather",
        start_url: "/",
        display: "standalone",
        theme_color: THEME,
        background_color: GROUND,
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/api/forecast",
            handler: "NetworkFirst",
            options: {
              cacheName: "forecast",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [200] },
              plugins: [forecastFetchPlugin],
            },
          },
          // Radar tiles never change once published, so serve them from cache and keep them for 3 hours.
          {
            urlPattern: isRadarTile,
            handler: "CacheFirst",
            options: {
              cacheName: "radar-tiles",
              expiration: { maxEntries: 600, maxAgeSeconds: RADAR_MAX_AGE_SECONDS, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          // The frame list and storms are small and change often: network first, last-known copy offline.
          {
            urlPattern: isRadarFramesApi,
            handler: "NetworkFirst",
            options: {
              cacheName: "radar-frames",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 2, maxAgeSeconds: RADAR_MAX_AGE_SECONDS },
              cacheableResponse: { statuses: [200] },
              plugins: [forecastFetchPlugin],
            },
          },
          {
            urlPattern: isCyclonesApi,
            handler: "NetworkFirst",
            options: {
              cacheName: "cyclones",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 2, maxAgeSeconds: RADAR_MAX_AGE_SECONDS },
              cacheableResponse: { statuses: [200] },
              plugins: [forecastFetchPlugin],
            },
          },
          {
            urlPattern: ({ url }) => url.pathname === "/api/search",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "search",
              expiration: { maxEntries: 50 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: { "/api": API_TARGET },
  },
  preview: {
    proxy: { "/api": API_TARGET },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", "dist", "dist-test", "e2e"],
  },
});
