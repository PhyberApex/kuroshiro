import type { MockDeviceModelsService, MockFallbackScreensService } from '../../device-models/__test__/mockDeviceModelsService'
import { promises as fs } from 'node:fs'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceModelsService, createMockFallbackScreensService, GRAY_4, GRAY_16, OG_PLUS, primeMockDeviceModelsService, primeMockFallbackScreensService, V2 } from '../../device-models/__test__/mockDeviceModelsService'
import { Display } from '../display'
import { DeviceDisplayService } from '../display.service'
import { DisplayScreen } from '../displayScreen'

const { fileExists, puppeteerPage, puppeteerLaunch } = vi.hoisted(() => ({
  fileExists: vi.fn(),
  puppeteerPage: {
    setViewport: vi.fn(),
    setContent: vi.fn(),
    screenshot: vi.fn(),
  },
  puppeteerLaunch: vi.fn(),
}))

vi.mock('../../utils/fileExists', () => ({
  fileExists,
}))

vi.mock('node:fs', () => ({
  promises: {
    unlink: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}))

vi.mock('../../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('puppeteer', () => ({
  default: { launch: puppeteerLaunch },
}))

function primePuppeteer() {
  puppeteerPage.setViewport.mockResolvedValue(undefined)
  puppeteerPage.setContent.mockResolvedValue(undefined)
  puppeteerPage.screenshot.mockResolvedValue(new Uint8Array())
  puppeteerLaunch.mockResolvedValue({ newPage: vi.fn().mockResolvedValue(puppeteerPage), close: vi.fn() })
}

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function createMockRepo() {
  return {
    findOneBy: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  }
}

describe('deviceDisplayService', () => {
  let service: DeviceDisplayService
  let deviceRepo: ReturnType<typeof createMockRepo>
  let screenRepo: ReturnType<typeof createMockRepo>
  let configService: { get: ReturnType<typeof vi.fn> }
  let deviceModels: MockDeviceModelsService
  let fallbackScreens: MockFallbackScreensService

  beforeEach(() => {
    deviceRepo = createMockRepo()
    screenRepo = createMockRepo()
    configService = { get: vi.fn() }
    deviceModels = createMockDeviceModelsService()
    fallbackScreens = createMockFallbackScreensService()
    service = new DeviceDisplayService(
      deviceRepo as any,
      screenRepo as any,
      configService as any,
      deviceModels as any,
      fallbackScreens as any,
    )
    vi.resetAllMocks()
    primeMockDeviceModelsService(deviceModels)
    primeMockFallbackScreensService(fallbackScreens)
    primePuppeteer()
  })

  const baseDevice = {
    id: '1',
    mac: 'mac',
    apikey: 'token',
    refreshRate: 60,
    resetDevice: false,
    updateFirmware: false,
    specialFunction: 'identify',
    mirrorEnabled: false,
    width: undefined,
    height: undefined,
  }

  const headers = { 'id': 'mac', 'access-token': 'token' }

  it('throws NotFoundException if device not found', async () => {
    deviceRepo.findOneBy.mockResolvedValue(null)
    await expect(service.getCurrentImage(headers as any)).rejects.toThrow(NotFoundException)
  })

  it('throws UnauthorizedException if API key is invalid', async () => {
    deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'wrong' })
    await expect(service.getCurrentImage(headers as any)).rejects.toThrow(UnauthorizedException)
  })

  describe('device report handling', () => {
    beforeEach(() => {
      screenRepo.findOneBy.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')
    })

    it('records the reported dimensions and model without rejecting changed values', async () => {
      const device = { ...baseDevice, width: 100, height: 200, deviceModel: OG_PLUS }
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage({ ...headers, width: '1872', height: '1404', model: 'x' } as any)
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ width: 1872, height: 1404, reportedModel: 'x' }))
    })

    it('keeps the stored dimensions when the headers are missing or unparsable', async () => {
      const device = { ...baseDevice, width: 800, height: 480, reportedModel: 'og', deviceModel: OG_PLUS }
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage({ ...headers, width: 'abc' } as any)
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ width: 800, height: 480, reportedModel: 'og' }))
    })

    it('resolves and assigns a device model when the device has none', async () => {
      const device = { ...baseDevice, deviceModel: null }
      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceModels.assignResolvedModel.mockResolvedValue(V2)
      await service.getCurrentImage({ ...headers, width: '1872', height: '1404', model: 'x' } as any)
      expect(deviceModels.assignResolvedModel).toHaveBeenCalledWith(expect.objectContaining({ reportedModel: 'x', width: 1872, height: 1404 }))
      expect(deviceRepo.save).toHaveBeenCalled()
    })

    it('never re-resolves a device that already has a model', async () => {
      const device = { ...baseDevice, deviceModel: OG_PLUS }
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage({ ...headers, model: 'x' } as any)
      expect(deviceModels.assignResolvedModel).not.toHaveBeenCalled()
    })
  })

  describe('rendering in the device model shell', () => {
    function primeRotation(nextScreen: Record<string, unknown>, device: Record<string, unknown>) {
      const activeScreen = { id: 'screen1', order: 1, device, isActive: true, generatedAt: new Date() }
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValueOnce(activeScreen).mockResolvedValueOnce(nextScreen)
      screenRepo.findOne.mockResolvedValue(nextScreen)
      screenRepo.save.mockResolvedValue(nextScreen)
      configService.get.mockReturnValue('http://api')
    }

    it('renders HTML screens at the model size inside the model shell', async () => {
      const device = { ...baseDevice, deviceModel: V2, palette: GRAY_16 }
      deviceModels.renderTargetFor.mockResolvedValue({ model: V2, palette: GRAY_16 })
      primeRotation({ id: 'screen2', type: 'html', order: 2, device, html: '<p>hi</p>', filename: 'x', generatedAt: new Date() }, device)

      const result = await service.getCurrentImage(headers as any)

      expect(puppeteerPage.setViewport).toHaveBeenCalledWith({ width: 1872, height: 1404 })
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('class="screen screen--v2 screen--lg screen--density-2x screen--4bit"')
      expect(html).toContain('--screen-w: 1040px;')
      expect(html).toContain('<div class="view view--full"><p>hi</p></div>')
      const { convertToPng } = await import('../../utils/imageUtils')
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('screen2.png'), { model: V2, palette: GRAY_16 }, expect.any(Object))
      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('tmp-source'))
    })

    it('wraps cached plugin output in a full view and the shell', async () => {
      const device = { ...baseDevice, deviceModel: OG_PLUS }
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, device, plugin: { id: 'p1' }, cachedPluginOutput: '<span>cached</span>', filename: 'x', generatedAt: new Date() }, device)

      await service.getCurrentImage(headers as any)

      expect(puppeteerPage.setViewport).toHaveBeenCalledWith({ width: 800, height: 480 })
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('screen--og_plus')
      expect(html).toContain('screen--2bit')
      expect(html).toContain('<div class="view view--full"><span>cached</span></div>')
    })

    it('caches only the rendered plugin body when rendering on demand', async () => {
      const device = { ...baseDevice, deviceModel: OG_PLUS }
      const plugin = { id: 'p1', name: 'P', dataSource: { method: 'GET', url: 'http://x' }, templates: [{ layout: 'full', liquidMarkup: '{{ v }}' }] }
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, device, plugin, filename: 'x', generatedAt: new Date() }, device)
      service.pluginDataFetcher = { fetchData: vi.fn().mockResolvedValue({ v: 1 }) } as any
      service.pluginRenderer = { render: vi.fn().mockResolvedValue('<b>1</b>') } as any

      await service.getCurrentImage(headers as any)

      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen2' }, expect.objectContaining({ cachedPluginOutput: '<b>1</b>' }))
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('<div class="view view--full"><b>1</b></div>')
    })

    it('places cached mashup markup directly inside the shell', async () => {
      const device = { ...baseDevice, deviceModel: OG_PLUS }
      primeRotation({ id: 'screen2', type: 'mashup', order: 2, device, cachedPluginOutput: '<div class="mashup mashup--1Lx1R">m</div>', mashupConfiguration: { id: 'c' }, filename: 'x', generatedAt: new Date() }, device)
      service.mashupRenderer = { renderMashup: vi.fn() } as any

      await service.getCurrentImage(headers as any)

      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toMatch(/screen--2bit"[^>]*><div class="mashup mashup--1Lx1R">m<\/div><\/div>/)
      expect(html).not.toContain('view--full')
    })
  })

  it('returns default no screen image if no active screen and not mirrored', async () => {
    deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'token' })
    screenRepo.findOneBy.mockResolvedValue(null)
    configService.get.mockReturnValue('http://api')
    deviceRepo.save.mockResolvedValue(undefined)
    const result = await service.getCurrentImage(headers as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('noScreen.png')
    expect(result.image_url).toBe('http://api/screens/noScreen.png')
  })

  it('cycles screens and returns next screen if not mirrored', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
    const filename = 'file.png'
    const generatedAt = new Date()
    const dynamicFilename = `${filename}_${generatedAt.toISOString()}`
    const activeScreen = { id: 'screen1', order: 1, device, isActive: true, fetchManual: false, externalLink: null, filename, generatedAt }
    const nextScreen = { ...activeScreen, id: 'screen2', order: 2, isActive: false }
    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.findOneBy
      .mockResolvedValueOnce(activeScreen) // activeScreen
      .mockResolvedValueOnce(nextScreen) // nextScreen
    screenRepo.update.mockResolvedValue(undefined)
    screenRepo.save.mockResolvedValue(nextScreen)
    configService.get.mockReturnValue('http://api')
    deviceRepo.save.mockResolvedValue(undefined)
    fileExists.mockResolvedValue(true)
    const result = await service.getCurrentImage(headers as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe(dynamicFilename)
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
  })

  it('processes external link images when fetchManual is false', async () => {
    const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
    const activeScreen = {
      id: 'screen1',
      order: 1,
      device,
      isActive: true,
      externalLink: 'http://example.com/image.jpg',
      fetchManual: false,
      filename: 'test.png',
      generatedAt: new Date(),
    }
    const nextScreen = { ...activeScreen, id: 'screen2', order: 2, isActive: false }

    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.findOneBy
      .mockResolvedValueOnce(activeScreen)
      .mockResolvedValueOnce(nextScreen)
    configService.get.mockReturnValue('http://api')

    const result = await service.getCurrentImage(headers as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('tmp-source'))
  })

  it('handles mirroring with proxy when MACs are identical', async () => {
    const device = {
      ...baseDevice,
      apikey: 'token',
      id: '1',
      width: 800,
      height: 480,
      mirrorEnabled: true,
      mirrorMac: 'mac',
      mirrorApikey: 'mirror-token',
    }

    const testHeaders = { ...headers, width: 800, height: 480 }

    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')

    const mockResponse = {
      filename: 'mirror.png',
      image_url: 'http://example.com/image.jpg',
      refresh_rate: 30,
      firmware_url: 'http://example.com/firmware',
      reset_firmware: true,
      special_function: 'test',
      update_firmware: true,
    }

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const { downloadImage, convertToPng } = await import('../../utils/imageUtils')

    vi.mocked(fs.unlink).mockResolvedValueOnce()
    const result = await service.getCurrentImage(testHeaders as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('mirror.png')
    expect(result.image_url).toContain('mirror.png')
    expect(result.refresh_rate).toBe(30)
    expect(result.firmware_url).toBe('http://example.com/firmware')
    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
    expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('mirror.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object))
    expect(fs.unlink).toHaveBeenCalled()
  })

  it('handles mirroring without proxy when MACs are different', async () => {
    const device = {
      ...baseDevice,
      apikey: 'token',
      id: '1',
      width: 800,
      height: 480,
      mirrorEnabled: true,
      mirrorMac: 'different-mac',
      mirrorApikey: 'mirror-token',
    }

    const testHeaders = { ...headers, width: 800, height: 480 }

    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')

    const mockResponse = {
      filename: 'mirror.png',
      image_url: 'http://example.com/image.jpg',
    }

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse),
    })

    const { downloadImage, convertToPng } = await import('../../utils/imageUtils')

    vi.mocked(fs.unlink).mockResolvedValueOnce()
    const result = await service.getCurrentImage(testHeaders as any)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('mirror.png')
    expect(result.image_url).toContain('mirror.png')
    expect(result.refresh_rate).toBe(device.refreshRate)
    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
    expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('mirror.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object))
    expect(fs.unlink).toHaveBeenCalled()
  })

  describe('getCurrentImageWithoutProgressing', () => {
    it('throws NotFoundException if device not found', async () => {
      deviceRepo.findOneBy.mockResolvedValue(null)
      await expect(service.getCurrentImageWithoutProgressing(headers)).rejects.toThrow(NotFoundException)
    })

    it('throws UnauthorizedException if API key is invalid', async () => {
      deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'wrong' })
      await expect(service.getCurrentImageWithoutProgressing(headers)).rejects.toThrow(UnauthorizedException)
    })

    it('returns default no screen image if no active screen and not mirrored', async () => {
      deviceRepo.findOneBy.mockResolvedValue({ ...baseDevice, apikey: 'token' })
      screenRepo.findOneBy.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toBe('noScreen.png')
      expect(result.image_url).toBe('http://api/screens/noScreen.png')
      expect(result.rendered_at).toBeInstanceOf(Date)
    })

    it('returns mirror image if device is mirrored and file exists', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: true }
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(fileExists).toHaveBeenCalled()
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toContain('mirror')
      expect(result.image_url).toBe('http://api/screens/devices/1/mirror.png')
      expect(result.rendered_at).toBeUndefined()
    })

    it('fetches the mirror image on demand if it is missing on disk', async () => {
      const device = {
        ...baseDevice,
        apikey: 'token',
        id: '1',
        width: 800,
        height: 480,
        mirrorEnabled: true,
        mirrorMac: 'different-mac',
        mirrorApikey: 'mirror-token',
      }
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ filename: 'remote.png', image_url: 'http://example.com/image.jpg' }),
      })

      const { downloadImage, convertToPng } = await import('../../utils/imageUtils')

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/current_screen', {
        headers: { 'access-token': 'mirror-token', 'ID': 'different-mac' },
      })
      expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('mirror.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object))
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toContain('mirror')
      expect(result.image_url).toBe('http://api/screens/devices/1/mirror.png')
      expect(result.rendered_at).toBeUndefined()
    })

    it('returns error image if device is mirrored, file does not exist and on-demand fetch fails', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: true }
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)
      mockFetch.mockRejectedValueOnce(new Error('TRMNL unreachable'))

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toContain('mirror')
      expect(result.image_url).toBe('http://api/screens/error.png')
      expect(result.rendered_at).toBeUndefined()
    })

    it('returns active screen image if not mirrored', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
      const activeScreen = {
        id: 'screen1',
        filename: 'test.png',
        generatedAt: new Date(),
        isActive: true,
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toBe(`${activeScreen.filename}_${activeScreen.generatedAt.toISOString()}`)
      expect(result.image_url).toBe(`http://api/screens/devices/1/screen1.png`)
      expect(result.rendered_at).toBe(activeScreen.generatedAt)
    })

    it('generates the screen image on demand if it is missing on disk', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', width: 800, height: 480, mirrorEnabled: false }
      const activeScreen = {
        id: 'screen1',
        filename: 'test.png',
        generatedAt: new Date(),
        isActive: true,
        externalLink: 'http://example.com/image.jpg',
        fetchManual: false,
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)

      const { downloadImage, convertToPng } = await import('../../utils/imageUtils')

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('screen1.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object))
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
    })

    it('returns error image if the screen image is missing and cannot be regenerated', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false }
      const activeScreen = {
        id: 'screen1',
        type: 'file',
        filename: 'test.png',
        generatedAt: new Date(),
        isActive: true,
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.image_url).toBe('http://api/screens/error.png')
    })

    it('returns fresh generation metadata after on-demand generation', async () => {
      const device = { ...baseDevice, apikey: 'token', id: '1', width: 800, height: 480, mirrorEnabled: false }
      const staleDate = new Date('2026-01-01T00:00:00.000Z')
      const activeScreen = {
        id: 'screen1',
        filename: 'test.png',
        generatedAt: staleDate,
        isActive: true,
        externalLink: 'http://example.com/image.jpg',
        fetchManual: false,
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result.rendered_at).not.toBe(staleDate)
      expect(result.rendered_at).toBe(activeScreen.generatedAt)
      expect(result.filename).toBe(`test.png_${activeScreen.generatedAt.toISOString()}`)
    })
  })

  describe('mashup screen rendering', () => {
    beforeEach(() => {
      // Inject services needed for mashup
      service.pluginDataFetcher = { fetchData: vi.fn() } as any
      service.pluginRenderer = { render: vi.fn() } as any
      service.pluginTransformer = { transform: vi.fn() } as any
    })

    it('should detect mashup screen and call renderer', async () => {
      const device = { ...baseDevice, width: 800, height: 480, apikey: 'token', id: 'device-1' }

      const mashupConfig = {
        id: 'config-1',
        layout: '2x2',
        slots: [
          { id: 'slot-1', plugin: { id: 'p1', name: 'Weather', dataSource: {}, templates: [] } },
          { id: 'slot-2', plugin: { id: 'p2', name: 'Calendar', dataSource: {}, templates: [] } },
        ],
      }

      const activeScreen = {
        id: 'screen1',
        type: 'file',
        filename: 'First',
        order: 1,
        isActive: true,
        device,
      }

      const nextScreenBase = {
        id: 'screen2',
        type: 'mashup',
        filename: 'Dashboard',
        order: 2,
        isActive: false,
        generatedAt: new Date(),
        device,
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceRepo.save.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValueOnce(activeScreen).mockResolvedValueOnce(nextScreenBase)
      screenRepo.findOne.mockResolvedValue({ ...nextScreenBase, mashupConfiguration: mashupConfig })
      screenRepo.update.mockResolvedValue(undefined)
      screenRepo.save.mockResolvedValue({ ...nextScreenBase, isActive: true })
      configService.get.mockReturnValue('http://api')

      // Mock MashupRendererService
      const mockMashupRenderer = {
        renderMashup: vi.fn().mockResolvedValue('<html>Mashup HTML</html>'),
      }
      service.mashupRenderer = mockMashupRenderer

      const result = await service.getCurrentImage({ ...headers, width: 800, height: 480 } as any)

      expect(mockMashupRenderer.renderMashup).toHaveBeenCalled()
      expect(result).toBeInstanceOf(Display)
    })

    it('should handle mashup with cached output', async () => {
      const device = { ...baseDevice, width: 800, height: 480, apikey: 'token' }
      const activeScreen = { id: 'screen1', isActive: true, order: 1, device }
      const nextScreen = {
        id: 'screen2',
        type: 'mashup',
        filename: 'Dashboard',
        order: 2,
        isActive: false,
        generatedAt: new Date(),
        device,
        cachedPluginOutput: '<html>Cached mashup</html>',
        mashupConfiguration: { id: 'config-1' },
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceRepo.save.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValueOnce(activeScreen).mockResolvedValueOnce(nextScreen)
      screenRepo.findOne.mockResolvedValue(nextScreen)
      screenRepo.update.mockResolvedValue(undefined)
      screenRepo.save.mockResolvedValue(nextScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)

      const result = await service.getCurrentImage({ ...headers, width: 800, height: 480 } as any)

      expect(result).toBeInstanceOf(Display)
      expect(result.image_url).toContain('/screens/devices/')
    })

    it('should fallback to error.png if mashup rendering fails', async () => {
      const device = { ...baseDevice, width: 800, height: 480, apikey: 'token' }
      const activeScreen = { id: 'screen1', isActive: true, order: 1, device }
      const nextScreen = {
        id: 'screen2',
        type: 'mashup',
        filename: 'Dashboard',
        order: 2,
        isActive: false,
        generatedAt: new Date(),
        device,
        mashupConfiguration: { id: 'config-1', slots: [] },
      }

      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceRepo.save.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValueOnce(activeScreen).mockResolvedValueOnce(nextScreen)
      screenRepo.findOne.mockResolvedValue(nextScreen)
      screenRepo.update.mockResolvedValue(undefined)
      screenRepo.save.mockResolvedValue(nextScreen)
      configService.get.mockReturnValue('http://api')

      const mockMashupRenderer = {
        renderMashup: vi.fn().mockRejectedValue(new Error('Render failed')),
      }
      service.mashupRenderer = mockMashupRenderer

      const result = await service.getCurrentImage({ ...headers, width: 800, height: 480 } as any)

      expect(result).toBeInstanceOf(Display)
      expect(result.image_url).toBe('http://api/screens/error.png')
    })
  })
})
