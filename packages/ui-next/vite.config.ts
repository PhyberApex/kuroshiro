import type { Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const DEV_ONLY_SOURCES = ['/src/gallery/', '/src/testing/']

/** Fails the production build if a module of the gallery or of the test harness made it into the bundle. */
function keepDevOnlySourcesOutOfTheBundle(): Plugin {
  return {
    name: 'kuroshiro:dev-only-sources',
    apply: 'build',
    generateBundle(_options, bundle) {
      const leaked = Object.values(bundle)
        .flatMap(output => output.type === 'chunk' ? output.moduleIds : [])
        .filter(moduleId => DEV_ONLY_SOURCES.some(source => moduleId.includes(source)))
      if (leaked.length > 0)
        this.error(`Dev-only modules are in the production bundle:\n${leaked.join('\n')}`)
    },
  }
}

export default defineConfig({
  // Relative asset URLs resolve against the <base href> the API injects into
  // index.html, so the same build works at / and under an ingress prefix.
  base: './',
  plugins: [vue(), keepDevOnlySourcesOutOfTheBundle()],
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
