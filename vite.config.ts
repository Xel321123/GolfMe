import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Vite + Vitest configuration for GolfMe.
 *
 * The test environment defaults to `node` because the domain, storage, and
 * analytics layers are pure TypeScript and must never require a DOM. Files
 * that legitimately need a DOM (React hook tests) opt in per-file with the
 * `@vitest-environment jsdom` pragma.
 *
 * PWA / deployment notes:
 * - `base: '/GolfMe/'` targets GitHub Pages hosting from the repo subpath
 *   (https://<owner>.github.io/GolfMe/). Asset URLs, the web app manifest,
 *   and the service worker registration all resolve through this base, so
 *   the build is directly deployable without post-processing.
 * - The Workbox service worker precaches the entire app shell, so the app
 *   works fully offline once visited (and auto-updates on new deploys via
 *   `registerType: 'autoUpdate'`).
 */
export default defineConfig({
  base: '/GolfMe/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'GolfMe — Golf Round Tracker',
        short_name: 'GolfMe',
        description:
          'Track golf rounds with GPS shot logging, live stats, and advanced analytics. Works offline.',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        // Relative start_url/scope keep the manifest valid on any hosting
        // subpath (browsers resolve them against the manifest URL).
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Any navigation (online or offline) falls back to the app shell.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        // Keep the dev server simple; enable PWA only in production builds.
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
})
