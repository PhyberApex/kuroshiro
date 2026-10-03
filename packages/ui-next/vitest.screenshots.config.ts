import process from 'node:process'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'
import { chromiumProject } from './vitest.browser.ts'

// Font rendering differs between machines, so a baseline is only ever written or compared
// inside the pinned Playwright image that scripts/screenshots.mjs starts.
if (!process.env.KUROSHIRO_SCREENSHOT_IMAGE)
  throw new Error('Screenshots only run inside the pinned Playwright image: use `pnpm test:screenshots` or `pnpm test:screenshots:update`.')

export default mergeConfig(viteConfig, defineConfig({
  test: {
    projects: [
      chromiumProject({
        name: 'screenshots',
        include: ['src/**/*.shots.ts'],
        browser: {
          expect: {
            toMatchScreenshot: {
              // Exact: one image renders one way, and the default tolerance lets a small colour change of a token through.
              comparatorName: 'pixelmatch',
              comparatorOptions: { threshold: 0, allowedMismatchedPixels: 0 },
            },
          },
        },
      }),
    ],
  },
}))
