import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        id: '/',
        name: 'little tables.',
        short_name: 'little tables',
        description: 'Tiny multiplication practice for a growing little garden.',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#fff8ed',
        theme_color: '#fff8ed',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,webp,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
})
