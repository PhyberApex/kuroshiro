import type { Logger } from '@nestjs/common'
import { execFile, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'
import { fallbackScreenHtml } from '../fallback-screen-templates.js'
import { renderHtmlToPng } from '../render-html-to-png.js'

const execFileAsync = promisify(execFile)

function magickAvailable(): boolean {
  try {
    execFileSync('magick', ['--version'])
    return true
  }
  catch {
    return false
  }
}

const OG = makeDeviceModel({ name: 'og', width: 800, height: 480 })
const BLACK_AND_WHITE = makePalette({ id: 'bw', grays: 2, colors: null, frameworkClass: 'screen--1bit' })
const FULL_COLOUR = makePalette({ id: 'color-24bit', grays: 0, colors: null, frameworkClass: 'screen--color-full' })
const FACTS = { deviceName: 'Kitchen', friendlyId: '4F2A1C', instanceUrl: 'http://kuroshiro.local', wakeTime: '07:00' }

describe.runIf(magickAvailable())('the error Fallback Screen on a 1-bit Palette (real Chrome and magick)', () => {
  let tmpDir: string
  const logger = asService<Logger>({ log: () => {}, error: () => {} })
  const html = fallbackScreenHtml({ kind: 'error', cause: 'render', screenName: 'Weather' }, FACTS, OG)

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kuroshiro-fallback-'))
  })

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  /** Pixels that differ between two images; `magick compare` exits 1 when any do. */
  async function differingPixels(first: string, second: string): Promise<number> {
    const { stderr } = await execFileAsync('magick', ['compare', '-metric', 'AE', first, second, 'null:']).catch(error => error as { stderr: string })
    return Number.parseInt(stderr, 10)
  }

  it('holds only black and white, each pixel on the side of 50 % its screenshot was on', async () => {
    const oneBit = path.join(tmpDir, 'error-bw.png')
    const screenshot = path.join(tmpDir, 'error-colour.png')
    const thresholded = path.join(tmpDir, 'error-thresholded.png')
    await renderHtmlToPng(html, { model: OG, palette: BLACK_AND_WHITE }, oneBit, logger, { dither: false })
    await renderHtmlToPng(html, { model: OG, palette: FULL_COLOUR }, screenshot, logger, { dither: false })
    await execFileAsync('magick', [screenshot, '-colorspace', 'Gray', '-threshold', '50%', thresholded])

    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%wx%h %z-bit %k colours', oneBit])
    expect(stdout).toBe('800x480 1-bit 2 colours')
    expect(await differingPixels(oneBit, thresholded)).toBe(0)
  }, 60_000)
})
