import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/'))
            return 'vue'
          if (id.includes('node_modules/vue-router/'))
            return 'vue-router'
          if (id.includes('node_modules/pinia/'))
            return 'pinia'
          if (id.includes('node_modules/vuetify/') || id.includes('node_modules/@mdi/'))
            return 'vuetify'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/screens': 'http://localhost:3001',
    },
  },
})
