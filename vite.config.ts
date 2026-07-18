import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { VitePWA } from "vite-plugin-pwa";

// npm install -D vite-plugin-pwa
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Gym Workout Tracker",
        short_name: "Gym Tracker",
        description: "A premium mobile-first gym workout tracker.",
        theme_color: "#0F172A",
        background_color: "#0F172A",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the built JS/CSS bundle plus every workout JSON and GIF
        // in /public so the app works fully offline after the first visit.
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            // /json/M&T.json, /json/T&F.json, /json/W&S.json
            urlPattern: /\/json\/.*\.json$/,
            handler: "CacheFirst",
            options: {
              cacheName: "workout-json-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // exercise GIFs referenced from the JSON files
            urlPattern: /\/gifs\/.*\.gif$/,
            handler: "CacheFirst",
            options: {
              cacheName: "workout-gif-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});