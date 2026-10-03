import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset URLs resolve against the <base href> the API injects into
  // index.html, so the same build works at / and under an ingress prefix.
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/screens': 'http://localhost:3001',
    },
  },
})
