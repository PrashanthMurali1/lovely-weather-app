/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { forecastFetchPlugin } from "./src/sw/forecastPlugins.ts";

// Must match the port scripts/dev-backend.mjs starts uvicorn on.
const API_TARGET = `http://localhost:${process.env.BACKEND_PORT || "8001"}`;

const THEME = "#183b5b";
const GROUND = "#111b3b";

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
