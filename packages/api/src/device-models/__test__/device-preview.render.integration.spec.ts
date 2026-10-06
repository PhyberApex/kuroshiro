import type { Logger } from '@nestjs/common'
import type { DeviceModelsService } from '../device-models.service.js'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { wrapInScreenShell } from 'kuroshiro-shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'
import { DevicePreviewService } from '../device-preview.service.js'
import { renderHtmlToPng } from '../render-html-to-png.js'

function magickAvailable(): boolean {
  try {
    execFileSync('magick', ['--version'])
    return true
  }
  catch {
    return false
  }
}

const OG = makeDeviceModel({ name: 'og_plus', width: 800, height: 480, paletteIds: ['bw', 'color-7a'] })
const BLACK_AND_WHITE = makePalette({ id: 'bw', grays: 2, colors: null, frameworkClass: 'screen--1bit' })
const SEVEN_COLOUR = makePalette({ id: 'color-7a', grays: 0, colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500'], frameworkClass: 'screen--color-7a' })
const HTML = '<div class="view view--full"><span class="title">Kitchen</span></div>'

describe.runIf(magickAvailable())('devicePreviewService (real Chrome and magick)', () => {
  let tmpDir: string
  const logger = asService<Logger>({ log: () => {}, error: () => {} })

  function buildService() {
    const deviceModels = asService<DeviceModelsService>({
      findByName: async (name: string) => (name === OG.name ? OG : null),
      findPalette: async (id: string) => [BLACK_AND_WHITE, SEVEN_COLOUR].find(p => p.id === id) ?? null,
      supportsPalette: async (model: unknown, palette: { id: string }) => (model === OG) && [BLACK_AND_WHITE.id, SEVEN_COLOUR.id].includes(palette.id),
    })
    return new DevicePreviewService(deviceModels)
  }

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kuroshiro-device-preview-it-'))
  })

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  it('answers a PNG at the Device Model size holding only black and white for a 1-bit Palette', async () => {
    const { buffer } = await buildService().render({ html: HTML, deviceModelName: OG.name, paletteId: BLACK_AND_WHITE.id })
    const outPath = path.join(tmpDir, 'bw.png')
    await fs.promises.writeFile(outPath, buffer)

    const identify = execFileSync('magick', ['identify', '-format', '%wx%h %z-bit %k colours', outPath]).toString()
    expect(identify).toBe('800x480 1-bit 2 colours')
  }, 30_000)

  it('answers a PNG holding only the 7 colours of a colour Palette', async () => {
    const { buffer } = await buildService().render({ html: HTML, deviceModelName: OG.name, paletteId: SEVEN_COLOUR.id })
    const outPath = path.join(tmpDir, 'colour.png')
    await fs.promises.writeFile(outPath, buffer)

    const colours = Number(execFileSync('magick', ['identify', '-format', '%k', outPath]).toString())
    expect(colours).toBeLessThanOrEqual(SEVEN_COLOUR.colors!.length)
  }, 30_000)

  it('answers the same bytes `/display` produces for the same body HTML and target, since both call wrapInScreenShell + renderHtmlToPng', async () => {
    const { buffer } = await buildService().render({ html: HTML, deviceModelName: OG.name, paletteId: BLACK_AND_WHITE.id })

    const referencePath = path.join(tmpDir, 'reference.png')
    await renderHtmlToPng(wrapInScreenShell({ model: OG, palette: BLACK_AND_WHITE }, HTML), { model: OG, palette: BLACK_AND_WHITE }, referencePath, logger)
    const reference = await fs.promises.readFile(referencePath)

    expect(buffer.equals(reference)).toBe(true)
  }, 30_000)

  it('still answers an image, reporting the signal, when the content raises skip', async () => {
    const skippingHtml = '<div class="view view--full"><script>window.TRMNL_SKIP_DISPLAY = true</script></div>'
    const { buffer, signal } = await buildService().render({ html: skippingHtml, deviceModelName: OG.name, paletteId: BLACK_AND_WHITE.id })

    expect(signal).toBe('skip')
    expect(buffer.length).toBeGreaterThan(0)
  }, 30_000)

  it('still answers an image, reporting the signal, when the content raises hold', async () => {
    const holdingHtml = '<div class="view view--full"><script>window.TRMNL_SKIP_SCREEN_GENERATION = true</script></div>'
    const { buffer, signal } = await buildService().render({ html: holdingHtml, deviceModelName: OG.name, paletteId: BLACK_AND_WHITE.id })

    expect(signal).toBe('hold')
    expect(buffer.length).toBeGreaterThan(0)
  }, 30_000)

  it('leaves no file behind after a successful render', async () => {
    const before = fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('kuroshiro-device-preview-'))
    await buildService().render({ html: HTML, deviceModelName: OG.name, paletteId: BLACK_AND_WHITE.id })
    const after = fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('kuroshiro-device-preview-'))

    expect(after).toEqual(before)
  }, 30_000)
})
