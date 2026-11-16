/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Namak — salt-aware irrigation',
        short_name: 'Namak',
        description: 'Tomorrow’s valve minutes for a desert farm, accounting for salty well water and the salt debt it leaves.',
        theme_color: '#0e4a4f',
        background_color: '#f4efe6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, every screen chunk, fonts and sample photos: works offline after one load. The recorded voice
        // notes in /demo (~700 KB) are cached the first time they are played instead of being downloaded up front.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/demo/'),
            handler: 'CacheFirst',
            options: { cacheName: 'voice-samples', expiration: { maxEntries: 10 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Weather: network first (fresh plan), fall back to the last response when offline.
            urlPattern: ({ url }) => url.hostname.endsWith('open-meteo.com'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
