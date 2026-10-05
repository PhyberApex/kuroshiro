import type { Logger } from '@nestjs/common'
import type { RenderSignal } from 'kuroshiro-shared'
import type { Page } from 'puppeteer'
import type { ConversionOptions } from '../utils/imageUtils.js'
import type { DeviceRenderTarget } from './device-models.service.js'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { convertToPng } from '../utils/imageUtils.js'

export interface RenderHtmlToPngOptions {
  /**
   * Whether a `skip` Render Signal should leave `outputPath` untouched. Only
   * the `/display` poll's Rotation evaluates the signal (ADR-0031); every
   * other caller renders unconditionally, as it always has.
   */
  honorRenderSignal?: boolean
}

/** `window.TRMNL_SKIP_DISPLAY` read at the page's `load` event, the moment the screenshot is taken. */
async function readRenderSignal(page: Page): Promise<RenderSignal | null> {
  const skipDisplay = await page.evaluate(() => Boolean((window as unknown as { TRMNL_SKIP_DISPLAY?: unknown }).TRMNL_SKIP_DISPLAY))
  return skipDisplay ? 'skip' : null
}

/**
 * Screenshots an already-shelled HTML document at the render target's native
 * pixel size and converts the screenshot to the target's PNG at `outputPath`,
 * reporting the Render Signal observed at the same moment. `honorRenderSignal`
 * leaves `outputPath` as it was on a `skip`, instead of overwriting it.
 */
export async function renderHtmlToPng(html: string, target: DeviceRenderTarget, outputPath: string, logger: Logger, conversion: ConversionOptions = {}, options: RenderHtmlToPngOptions = {}): Promise<RenderSignal | null> {
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-web-security'] })
  const tmpPath = `${outputPath}.tmp-source`
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: target.model.width, height: target.model.height })
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    const renderSignal = await readRenderSignal(page)
    if (renderSignal === 'skip' && options.honorRenderSignal)
      return renderSignal

    const image: Uint8Array = await page.screenshot()

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.promises.writeFile(tmpPath, buffer.Buffer.from(image))
    await convertToPng(tmpPath, outputPath, target, logger, conversion)
    return renderSignal
  }
  finally {
    await browser.close()
    try {
      await fs.promises.unlink(tmpPath)
    }
    catch {
      // best-effort cleanup
    }
  }
}
