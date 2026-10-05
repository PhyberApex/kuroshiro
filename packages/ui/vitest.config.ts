import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'
import { chromiumProject } from './vitest.browser.ts'

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
      chromiumProject({
        name: 'browser',
        include: ['src/**/*.spec.ts'],
        exclude: ['src/**/*.node.spec.ts'],
      }),
    ],
  },
}))
