import type { Plugin } from 'vite'
import type { TestProjectInlineConfiguration } from 'vitest/config'
import { createReadStream } from 'node:fs'
import { createRequire } from 'node:module'
import { playwright } from '@vitest/browser-playwright'

const WORKER_PATH = '/mockServiceWorker.js'

/**
 * Serves MSW's service worker straight from the installed package, so no generated
 * copy sits in `public/` where the production build would pick it up.
 */
function mockServiceWorker(): Plugin {
  const workerFile = createRequire(import.meta.url).resolve('msw/mockServiceWorker.js')
  return {
    name: 'kuroshiro:mock-service-worker',
    configureServer(server) {
      server.middlewares.use(WORKER_PATH, (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript')
        createReadStream(workerFile).pipe(res)
      })
    },
  }
}

type ProjectTestOptions = NonNullable<TestProjectInlineConfiguration['test']>

/** A Vitest project that runs its specs in real Chromium with the tokens, the faces and the faked API loaded. */
export function chromiumProject(test: ProjectTestOptions & { name: string }): TestProjectInlineConfiguration {
  return {
    extends: true,
    plugins: [mockServiceWorker()],
    // Pre-bundled up front: a dependency Vite discovers mid-run reloads the page and fails the spec that was running.
    optimizeDeps: {
      include: ['vue', 'vue-router', 'reka-ui', 'vitest-browser-vue', 'msw', 'msw/browser', 'axe-core'],
    },
    test: {
      setupFiles: ['src/testing/setup.ts'],
      ...test,
      browser: {
        enabled: true,
        // Reduced motion collapses the duration tokens, so no assertion or shot lands mid-transition.
        // The clipboard is granted so a spec can read back what a control copied.
        provider: playwright({ contextOptions: { reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] } }),
        headless: true,
        screenshotFailures: false,
        instances: [{ browser: 'chromium' }],
        viewport: { width: 1280, height: 800 },
        ...test.browser,
      },
    },
  }
}
