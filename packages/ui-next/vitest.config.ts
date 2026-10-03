import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'
import { chromiumProject } from './vitest.browser.ts'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/main.ts', 'src/**/__test__/**', 'src/**/*.spec.ts', 'src/**/*.shots.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.node.spec.ts'],
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
