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
      theme_color: '#863bff',
      background_color: '#ffffff',
      // TODO: Supply real 192x192 and 512x512 PNG icons before offering PWA installation.
      icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
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
