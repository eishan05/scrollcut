import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    allowedHosts: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      // Workbox's SW bundling uses Rollup + terser in production mode.
      // With Node v25 this can fail with "Unexpected early exit" / unfinished terser hooks.
      // Keeping mode=development avoids terser while we spike capabilities.
      workbox: {
        mode: 'development',
      },
      manifest: {
        name: 'Video Editor - Capability Spike',
        short_name: 'VidSpike',
        description: 'M0 capability spike for mobile video editor',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
