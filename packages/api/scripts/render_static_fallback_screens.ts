import type { DeviceRenderTarget } from '../src/device-models/device-models.service.js'
import type { FallbackScreenRequest } from '../src/device-models/fallback-screen-templates.js'
import path from 'node:path'
import process from 'node:process'
import { Logger } from '@nestjs/common'
import { fallbackScreenHtml } from '../src/device-models/fallback-screen-templates.js'
import { renderHtmlToPng } from '../src/device-models/render-html-to-png.js'

/**
 * Redraws the static last-resort Fallback Screens in assets/screens: what a
 * Device gets when even the per-Device render fails, so they carry no Device
 * facts and are drawn once, for a TRMNL OG in black and white.
 * Run after changing the template: pnpm --filter ./packages/api render:static-fallback-screens
 */
const TRMNL_OG_BLACK_AND_WHITE = {
  model: { name: 'og', width: 800, height: 480, rotation: 0, offsetX: 0, offsetY: 0 },
  palette: { id: 'bw', grays: 2, colors: null, frameworkClass: 'screen--1bit' },
} as DeviceRenderTarget

const REQUESTS: FallbackScreenRequest[] = [
  { kind: 'welcome' },
  { kind: 'noScreen' },
  { kind: 'sleep' },
  { kind: 'error', cause: 'render', screenName: null },
]

const outputDir = path.resolve(process.cwd(), 'assets', 'screens')
const logger = new Logger('StaticFallbackScreens')

for (const request of REQUESTS) {
  const html = fallbackScreenHtml(request, null, TRMNL_OG_BLACK_AND_WHITE.model)
  await renderHtmlToPng(html, TRMNL_OG_BLACK_AND_WHITE, path.join(outputDir, `${request.kind}.png`), logger, { dither: false })
}
