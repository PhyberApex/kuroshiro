import type { Logger } from '@nestjs/common'
import type { DeviceRenderTarget } from './device-models.service.js'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { convertToPng } from '../utils/imageUtils.js'

/**
 * Screenshots an already-shelled HTML document at the render target's native
 * pixel size and converts the screenshot to the target's PNG at `outputPath`.
 */
export async function renderHtmlToPng(html: string, target: DeviceRenderTarget, outputPath: string, logger: Logger): Promise<void> {
  const { default: puppeteer } = await import('puppeteer')
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-web-security'] })
  const tmpPath = `${outputPath}.tmp-source`
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: target.model.width, height: target.model.height })
    await page.setContent(html, { waitUntil: 'load' })
    const image: Uint8Array = await page.screenshot()

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.promises.writeFile(tmpPath, buffer.Buffer.from(image))
    await convertToPng(tmpPath, outputPath, target, logger)
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
