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

/** A Vitest project that runs its specs in a real browser with the tokens, the faces and the faked API loaded. */
export function browserProject(test: ProjectTestOptions & { name: string }, browser: 'chromium' | 'firefox' = 'chromium'): TestProjectInlineConfiguration {
  return {
    extends: true,
    plugins: [mockServiceWorker()],
    // Pre-bundled up front: a dependency Vite discovers mid-run reloads the page and fails the spec that was running.
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'reka-ui',
        'vitest-browser-vue',
        'msw',
        'msw/browser',
        'axe-core',
        '@atlaskit/pragmatic-drag-and-drop/combine',
        '@atlaskit/pragmatic-drag-and-drop/element/adapter',
        '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element',
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/lang-html',
        '@codemirror/lang-javascript',
        '@codemirror/lang-json',
        '@codemirror/lang-liquid',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/highlight',
      ],
    },
    test: {
      setupFiles: ['src/testing/setup.ts'],
      // v8 coverage instrumentation slows every page script down, so the default 15s budget
      // can run out mid-click on a loaded CI runner before the spec itself does anything slow.
      testTimeout: 30_000,
      // A click that saves and then navigates takes longer than Vitest's one second on a loaded CI runner.
      expect: { poll: { timeout: 5000 } },
      ...test,
      browser: {
        enabled: true,
        // Reduced motion collapses the duration tokens, so no assertion or shot lands mid-transition.
        // The clipboard is granted so a spec can read back what a control copied; Firefox has no such
        // permission to grant (`browser.newContext` throws "Unknown permission: clipboard-read" there).
        provider: playwright({ contextOptions: { reducedMotion: 'reduce', permissions: browser === 'chromium' ? ['clipboard-read', 'clipboard-write'] : [] } }),
        headless: true,
        screenshotFailures: false,
        instances: [{ browser }],
        viewport: { width: 1280, height: 800 },
        ...test.browser,
      },
    },
  }
}
