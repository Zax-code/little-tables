import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // The artwork and manifests of the previous app, shared until it is removed (lot 5).
  publicDir: '../web/public',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      devOptions: { enabled: false },
      filename: 'sw.ts',
      injectManifest: {
        globIgnores: ['generated/**', 'screenshots/**'],
        globPatterns: [
          '**/*.{js,css,html,woff2,wasm}',
          'characters/miffy/*.webp',
          'avatars/miffy.png',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      injectRegister: false,
      manifest: false,
      registerType: 'prompt',
      srcDir: 'src',
      strategies: 'injectManifest',
    }),
  ],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:3000', '/health': 'http://localhost:3000' },
  },
})
