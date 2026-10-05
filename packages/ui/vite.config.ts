import type { Plugin } from 'vite'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { lazyModulesInFirstLoad } from './scripts/firstLoad.ts'

const DEV_ONLY_SOURCES = ['/src/gallery/', '/src/testing/']

const API_ORIGIN = `http://localhost:${process.env.KUROSHIRO_PORT || 3000}`

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

/** Fails the production build if the code editor's library or the Liquid engine would be fetched before a page shows its first editor. */
function keepTheEditorOutOfEveryFirstLoad(): Plugin {
  return {
    name: 'kuroshiro:lazy-editor',
    apply: 'build',
    generateBundle(_options, bundle) {
      const loaded = lazyModulesInFirstLoad(Object.values(bundle).filter(output => output.type === 'chunk'))
      if (loaded.length > 0)
        this.error(`The code editor's library or the Liquid engine is in a first load:\n${loaded.join('\n')}`)
    },
  }
}

export default defineConfig({
  // Relative asset URLs resolve against the <base href> the API injects into
  // index.html, so the same build works at / and under an ingress prefix.
  base: './',
  plugins: [vue(), keepDevOnlySourcesOutOfTheBundle(), keepTheEditorOutOfEveryFirstLoad()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': API_ORIGIN,
      '/screens': API_ORIGIN,
    },
  },
})
