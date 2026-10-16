import type { Logger } from '@nestjs/common'
import type { DeviceRenderTarget } from '../device-models.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'

const { fsMock, puppeteerPage, puppeteerLaunch, convertToPng } = vi.hoisted(() => ({
  fsMock: { mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn() },
  puppeteerPage: {
    setViewport: vi.fn(),
    setContent: vi.fn(),
    screenshot: vi.fn(),
    evaluate: vi.fn(),
    close: vi.fn(),
  },
  puppeteerLaunch: vi.fn(),
  convertToPng: vi.fn(),
}))

vi.mock('node:fs', () => ({ promises: fsMock }))
vi.mock('puppeteer', () => ({ default: { launch: puppeteerLaunch } }))
vi.mock('../../utils/imageUtils.js', () => ({ convertToPng }))

const { renderHtmlToPng } = await import('../render-html-to-png.js')
const { closeSharedBrowser } = await import('../shared-browser.js')

const TARGET: DeviceRenderTarget = { model: makeDeviceModel({ width: 800, height: 480 }), palette: makePalette() }
const logger = asService<Logger>({ log: () => {}, error: () => {} })

describe('renderHtmlToPng', () => {
  beforeEach(async () => {
    await closeSharedBrowser()
    vi.resetAllMocks()
    puppeteerPage.close.mockResolvedValue(undefined)
    puppeteerPage.setViewport.mockResolvedValue(undefined)
    puppeteerPage.setContent.mockResolvedValue(undefined)
    puppeteerPage.screenshot.mockResolvedValue(new Uint8Array())
    puppeteerPage.evaluate.mockResolvedValue({ skip: false, hold: false })
    puppeteerLaunch.mockResolvedValue({ newPage: vi.fn().mockResolvedValue(puppeteerPage), close: vi.fn(), connected: true })
  })

  it('screenshots and converts, reporting no signal, when the page sets nothing', async () => {
    const result = await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger)

    expect(result).toBeNull()
    expect(puppeteerPage.screenshot).toHaveBeenCalledOnce()
    expect(convertToPng).toHaveBeenCalledWith('/out/screen.png.tmp-source', '/out/screen.png', TARGET, logger, {})
  })

  it('reports skip and still converts when not honoring the signal', async () => {
    puppeteerPage.evaluate.mockResolvedValue({ skip: true, hold: false })

    const result = await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger)

    expect(result).toBe('skip')
    expect(puppeteerPage.screenshot).toHaveBeenCalledOnce()
    expect(convertToPng).toHaveBeenCalled()
  })

  it('reports skip and leaves the output untouched when honoring the signal', async () => {
    puppeteerPage.evaluate.mockResolvedValue({ skip: true, hold: false })

    const result = await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger, {}, { honorRenderSignal: true })

    expect(result).toBe('skip')
    expect(puppeteerPage.screenshot).not.toHaveBeenCalled()
    expect(convertToPng).not.toHaveBeenCalled()
  })

  it('reports hold and still converts when not honoring the signal', async () => {
    puppeteerPage.evaluate.mockResolvedValue({ skip: false, hold: true })

    const result = await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger)

    expect(result).toBe('hold')
    expect(puppeteerPage.screenshot).toHaveBeenCalledOnce()
    expect(convertToPng).toHaveBeenCalled()
  })

  it('reports hold and leaves the output untouched when honoring the signal', async () => {
    puppeteerPage.evaluate.mockResolvedValue({ skip: false, hold: true })

    const result = await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger, {}, { honorRenderSignal: true })

    expect(result).toBe('hold')
    expect(puppeteerPage.screenshot).not.toHaveBeenCalled()
    expect(convertToPng).not.toHaveBeenCalled()
  })

  it('reports skip, not hold, when the page sets both flags', async () => {
    puppeteerPage.evaluate.mockResolvedValue({ skip: true, hold: true })

    const result = await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger, {}, { honorRenderSignal: true })

    expect(result).toBe('skip')
  })

  it('still renders normally when honoring the signal but none is raised', async () => {
    puppeteerPage.evaluate.mockResolvedValue({ skip: false, hold: false })

    const result = await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger, {}, { honorRenderSignal: true })

    expect(result).toBeNull()
    expect(puppeteerPage.screenshot).toHaveBeenCalledOnce()
    expect(convertToPng).toHaveBeenCalled()
  })

  it('closes the page, not the browser, whether or not the signal was honored', async () => {
    puppeteerPage.evaluate.mockResolvedValue({ skip: true, hold: false })

    await renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger, {}, { honorRenderSignal: true })

    expect(puppeteerPage.close).toHaveBeenCalledOnce()
  })

  it('closes the page when the render throws', async () => {
    puppeteerPage.setContent.mockRejectedValue(new Error('Chrome crashed'))

    await expect(renderHtmlToPng('<html></html>', TARGET, '/out/screen.png', logger)).rejects.toThrow('Chrome crashed')

    expect(puppeteerPage.close).toHaveBeenCalledOnce()
  })

  it('launches Chromium once for two renders in a row', async () => {
    await renderHtmlToPng('<html></html>', TARGET, '/out/a.png', logger)
    await renderHtmlToPng('<html></html>', TARGET, '/out/b.png', logger)

    expect(puppeteerLaunch).toHaveBeenCalledOnce()
  })
})
