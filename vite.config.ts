/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'VerdeMar - Marketplace B2B de Hortifrúti',
        short_name: 'VerdeMar',
        description: 'Marketplace B2B de hortifrúti para atacado',
        theme_color: '#2d6a4f',
        background_color: '#f8f9fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // On new deploys, take over immediately so users don't get stuck on
        // a stale cached bundle (a common source of "I can only log in on
        // incognito" bug reports).
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // Auth endpoints must NEVER be served from cache — they need fresh
        // tokens every time. Navigation requests also bypass the SW when an
        // auth request is in flight to avoid stale session issues.
        navigateFallbackDenylist: [/^\/auth\//, /supabase\.co/],
        runtimeCaching: [
          {
            // Product images: StaleWhileRevalidate (not CacheFirst) so that
            // new uploads with the same URL still refresh in background.
            // Logos/banners now use unique per-upload filenames so this cache
            // never serves the wrong version.
            urlPattern: /^https:\/\/.*supabase\.co\/storage\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          // NOTE: Supabase REST (`/rest/*`) and Auth (`/auth/*`) endpoints are
          // deliberately NOT cached — caching them served stale profiles and
          // broke login in regular browser tabs (worked in incognito where the
          // SW hadn't registered yet).
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
