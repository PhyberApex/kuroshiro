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
              // As good as exact: the default tolerance lets a small colour change of a token through.
              // The threshold forgives one level of one pixel (a grey that is 155 in one run and 156 in
              // the next), which is how far Chromium's antialiasing of a rounded corner at the edge of
              // a shot wanders between runs. Two levels of grey are a mismatch.
              comparatorName: 'pixelmatch',
              comparatorOptions: { threshold: 0.004, allowedMismatchedPixels: 0 },
            },
          },
        },
      }),
    ],
  },
}))
