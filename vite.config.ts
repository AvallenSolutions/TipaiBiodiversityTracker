import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync } from 'fs'
import path from 'path'

// Inject the list of bundled species reference photos at build time.
// public/species-images contains ~870 curated JPGs keyed by an uppercase,
// underscore-separated common name. The runtime helper in src/lib/speciesImages
// turns this list into a normalized lookup map so the species folio can show
// a curated photo when no user-uploaded reference_image_url exists.
const bundledSpeciesImages = (() => {
  try {
    return readdirSync(path.resolve(__dirname, 'public/species-images'))
      .filter(f => /\.jpe?g$/i.test(f))
  } catch {
    return []
  }
})()

export default defineConfig({
  define: {
    __SPECIES_IMAGES__: JSON.stringify(bundledSpeciesImages),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Tipai Biodiversity Tracker',
        short_name: 'Tipai Bio',
        description: 'Log and track biodiversity sightings at Tipai property',
        theme_color: '#166534',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Serve the cached SPA shell for any navigation so cold-launching the
        // installed PWA offline doesn't fall through to the OS offline page
        // (a black screen on iOS). React Router then resolves the route in JS.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\/v1\/object\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Take control of open clients as soon as a new SW activates so the
        // first visit after install can serve the cached shell offline.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
