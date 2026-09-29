import path from 'node:path'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'MIU In-Venti-ry',
      short_name: 'MIU',
      theme_color: '#3f5e3d',
      background_color: '#3f5e3d',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Cache only previously visited shell files at runtime, using the network first.
      globPatterns: [],
      navigateFallback: null,
      runtimeCaching: [{
        urlPattern: ({ request, url }) => url.origin === self.location.origin
          && !url.hostname.endsWith('.supabase.co')
          && (request.mode === 'navigate' || /\.(?:js|css|html)$/.test(url.pathname)),
        handler: 'NetworkFirst',
        options: { cacheName: 'miu-shell', networkTimeoutSeconds: 4 },
      }],
    },
  })],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), './src'),
    },
  },
})
