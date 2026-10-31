/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { forecastFetchPlugin } from "./src/sw/forecastPlugins.ts";

const THEME = "#0e7490"; // placeholder; replaced in Task 11

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
        background_color: "#ffffff",
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
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
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
    proxy: { "/api": "http://localhost:8000" },
  },
  preview: {
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", "dist", "dist-test"],
  },
});
