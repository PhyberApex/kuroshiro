import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'
import { browserProject } from './vitest.browser.ts'

/** The specs that drag a row by its grip, which are the ones a Firefox regression of #1277 would catch. */
const DRAG_SPECS = [
  'src/components/__test__/ScreenRow.spec.ts',
  'src/pages/devices/__test__/DeviceScreensPage.spec.ts',
  'src/pages/plugins/__test__/PluginFields.spec.ts',
]

export default mergeConfig(viteConfig, defineConfig({
  test: {
    // A click, an axe-core scan, or an overflow check across themes/widths can outrun
    // the 15s browser-mode default on a loaded CI runner (see #1248 for the same class of fix).
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,vue}'],
      // screenshots.ts only runs in the pinned-image run, which reports no coverage
      exclude: ['src/main.ts', 'src/testing/screenshots.ts', 'src/**/__test__/**', 'src/**/*.spec.ts', 'src/**/*.shots.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.node.spec.ts', 'scripts/**/*.node.spec.ts'],
        },
      },
      browserProject({
        name: 'browser',
        include: ['src/**/*.spec.ts'],
        exclude: ['src/**/*.node.spec.ts'],
      }),
      // Pointer dragging rides the browser's own drag and drop, and Firefox has a long history of
      // not starting a native drag from a `<button>`, so the drag specs run there too (#1277).
      browserProject({
        name: 'firefox',
        include: DRAG_SPECS,
      }, 'firefox'),
    ],
  },
}))
