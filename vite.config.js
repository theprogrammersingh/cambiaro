import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      // The plugin injects the registration snippet itself. Importing
      // `virtual:pwa-register` instead would pull in workbox-window, which
      // buys nothing here: autoUpdate has no update prompt to drive.
      injectRegister: 'inline',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
      manifest: {
        id: '/',
        name: 'Cambiaro — Currency Converter',
        short_name: 'Cambiaro',
        description:
          'Convert 165 world currencies with live and historical exchange rates. Installable, works offline, and operable by AI agents through built-in WebMCP tools.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F7F8FA',
        theme_color: '#2F6FED',
        categories: ['finance', 'utilities', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Rates outlive the network: a converter with no figures is
            // useless, so serve the last response immediately and refresh it
            // in the background.
            urlPattern: ({ url }) => url.origin === 'https://api.frankfurter.dev',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'frankfurter-rates',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Deliberately off. A dev-mode service worker on localhost:5173 is how a
      // different project's stale Workbox SW ended up serving its own shell
      // from this port.
      devOptions: { enabled: false },
    }),
  ],
})
