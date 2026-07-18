import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.ico",
        "robots.txt",

        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",

        "json/**/*",
        "gifs/**/*",
      ],

      manifest: {
        name: "Gym Workout Tracker",
        short_name: "Gym Tracker",
        description: "Offline Gym Workout Tracker",

        theme_color: "#0F172A",
        background_color: "#0F172A",

        display: "standalone",
        orientation: "portrait",

        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,json,gif,webmanifest}"
        ],

        runtimeCaching: [
          {
            urlPattern: /\/json\/.*\.json$/,
            handler: "CacheFirst",
            options: {
              cacheName: "workout-json-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },

          {
            urlPattern: /\.(?:gif|png|jpg|jpeg|svg|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "workout-images-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },

          {
            urlPattern: ({ request }) => request.destination === "script",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "js-cache",
            },
          },

          {
            urlPattern: ({ request }) => request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "css-cache",
            },
          },

          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
            },
          },
        ],
      },

      devOptions: {
        enabled: true,
      },
    }),
  ],
});