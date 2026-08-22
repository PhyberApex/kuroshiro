import type { ConfigService } from '@nestjs/config'
import type { DeviceModelsService } from '../../device-models/device-models.service'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service'
import type { MockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService'
import type { DeviceSensorsService } from '../../device-sensors/device-sensors.service'
import type { FirmwareService } from '../../firmware/firmware.service'
import type { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import type { PluginTransformService } from '../../plugins/services/plugin-transform.service'
import type { Schedule } from '../../schedule/schedule.entity'
import type { Screen } from '../../screens/screens.entity'
import type { MockDeviceModelsService, MockFallbackScreensService } from '../../test/mockDeviceModelsService'
import type { Device } from '../devices.entity'
import type { TrmnlScreenResponse } from '../display.service'
import type { DisplayRequestHeadersDto } from '../dto/display-request-headers.dto'
import { promises as fs } from 'node:fs'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceSensorsService, primeMockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService'
import { PluginTemplateContextService } from '../../plugins/services/plugin-template-context.service'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { makeDevice, makeFirmware, makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginDataSource, makePluginTemplate, makeSchedule, makeScreen } from '../../test/fixtures'
import { createMockDeviceModelsService, createMockFallbackScreensService, GRAY_4, GRAY_16, OG_PLUS, primeMockDeviceModelsService, primeMockFallbackScreensService, V2 } from '../../test/mockDeviceModelsService'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { asService, injectPrivate } from '../../test/mockService'
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

const mockFetch = stubFetch()

describe('deviceDisplayService', () => {
  let service: DeviceDisplayService
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let configService: { get: ReturnType<typeof vi.fn> }
  let deviceModels: MockDeviceModelsService
  let fallbackScreens: MockFallbackScreensService
  let firmwareService: { verifyChecksum: ReturnType<typeof vi.fn>, fileUrl: ReturnType<typeof vi.fn> }
  let deviceSensors: MockDeviceSensorsService

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    screenRepo = createMockRepository<Screen>()
    configService = { get: vi.fn() }
    deviceModels = createMockDeviceModelsService()
    fallbackScreens = createMockFallbackScreensService()
    firmwareService = { verifyChecksum: vi.fn(), fileUrl: vi.fn() }
    deviceSensors = createMockDeviceSensorsService()
    service = new DeviceDisplayService(
      asRepository(deviceRepo),
      asRepository(screenRepo),
      asService<ConfigService>(configService),
      asService<DeviceModelsService>(deviceModels),
      asService<FallbackScreensService>(fallbackScreens),
      asService<FirmwareService>(firmwareService),
      asService<PluginDataFetcherService>({}),
      asService<PluginRendererService>({}),
      asService<PluginTransformService>({}),
      asService<DeviceSensorsService>(deviceSensors),
      new PluginTemplateContextService(),
    )
    vi.resetAllMocks()
    primeMockDeviceModelsService(deviceModels)
    primeMockFallbackScreensService(fallbackScreens)
    primeMockDeviceSensorsService(deviceSensors)
    primePuppeteer()
  })

  const baseDevice: Device = makeDevice({
    id: '1',
    mac: 'mac',
    apikey: 'token',
    refreshRate: 60,
    resetDevice: false,
    updateFirmware: false,
    specialFunction: 'identify',
    mirrorEnabled: false,
  })

  const headers: DisplayRequestHeadersDto = { 'id': 'mac', 'access-token': 'token' }

  it('throws NotFoundException if device not found', async () => {
    deviceRepo.findOneBy.mockResolvedValue(null)
    await expect(service.getCurrentImage(headers)).rejects.toThrow(NotFoundException)
  })

  it('throws UnauthorizedException if API key is invalid', async () => {
    deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, apikey: 'wrong' }))
    await expect(service.getCurrentImage(headers)).rejects.toThrow(UnauthorizedException)
  })

  describe('device report handling', () => {
    beforeEach(() => {
      screenRepo.find.mockResolvedValue([])
      configService.get.mockReturnValue('http://api')
    })

    it('records the reported dimensions and model without rejecting changed values', async () => {
      const device = makeDevice({ ...baseDevice, width: 100, height: 200, deviceModel: OG_PLUS })
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage({ ...headers, width: '1872', height: '1404', model: 'x' })
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ width: 1872, height: 1404, reportedModel: 'x' }))
    })

    it('keeps the stored dimensions when the headers are missing or unparsable', async () => {
      const device = makeDevice({ ...baseDevice, width: 800, height: 480, reportedModel: 'og', deviceModel: OG_PLUS })
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage({ ...headers, width: 'abc' })
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ width: 800, height: 480, reportedModel: 'og' }))
    })

    it('resolves and assigns a device model when the device has none', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: null })
      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceModels.assignResolvedModel.mockResolvedValue(V2)
      await service.getCurrentImage({ ...headers, width: '1872', height: '1404', model: 'x' })
      expect(deviceModels.assignResolvedModel).toHaveBeenCalledWith(expect.objectContaining({ reportedModel: 'x', width: 1872, height: 1404 }))
      expect(deviceRepo.save).toHaveBeenCalled()
    })

    it('never re-resolves a device that already has a model', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage({ ...headers, model: 'x' })
      expect(deviceModels.assignResolvedModel).not.toHaveBeenCalled()
    })
  })

  describe('sensor ingestion', () => {
    beforeEach(() => {
      screenRepo.find.mockResolvedValue([])
      configService.get.mockReturnValue('http://api')
    })

    it('syncs sensor readings from the resolved device and the raw sensors header', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      deviceRepo.findOneBy.mockResolvedValue(device)

      await service.getCurrentImage({ ...headers, sensors: 'kind=temperature;value=21.5;unit=C' })

      expect(deviceSensors.syncFromHeader).toHaveBeenCalledWith(device, 'kind=temperature;value=21.5;unit=C')
    })

    it('syncs even when the sensors header is absent, clearing any stale readings', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      deviceRepo.findOneBy.mockResolvedValue(device)

      await service.getCurrentImage(headers)

      expect(deviceSensors.syncFromHeader).toHaveBeenCalledWith(device, undefined)
    })
  })

  describe('rendering in the device model shell', () => {
    function primeRotation(nextScreenOverrides: Partial<Screen>, device: Device) {
      const activeScreen = makeScreen({ id: 'screen1', order: 1, device, isActive: true })
      const nextScreen = makeScreen({ device, ...nextScreenOverrides })
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, nextScreen])
      screenRepo.findOne.mockResolvedValue(nextScreen)
      screenRepo.save.mockResolvedValue(nextScreen)
      configService.get.mockReturnValue('http://api')
      return nextScreen
    }

    it('renders HTML screens at the model size inside the model shell', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: V2, palette: GRAY_16 })
      deviceModels.renderTargetFor.mockResolvedValue({ model: V2, palette: GRAY_16 })
      primeRotation({ id: 'screen2', type: 'html', order: 2, html: '<p>hi</p>', filename: 'x' }, device)

      const result = await service.getCurrentImage(headers)

      expect(puppeteerPage.setViewport).toHaveBeenCalledWith({ width: 1872, height: 1404 })
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('class="screen screen--v2 screen--lg screen--density-2x screen--4bit"')
      expect(html).toContain('--screen-w: 1040px;')
      expect(html).toContain('<div class="view view--full"><p>hi</p></div>')
      const { convertToPng } = await import('../../utils/imageUtils.js')
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('screen2.png'), { model: V2, palette: GRAY_16 }, expect.any(Object))
      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('tmp-source'))
    })

    it('wraps cached plugin output in a full view and the shell', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin: makePlugin({ id: 'p1' }), cachedPluginOutput: '<span>cached</span>', filename: 'x' }, device)

      await service.getCurrentImage(headers)

      expect(puppeteerPage.setViewport).toHaveBeenCalledWith({ width: 800, height: 480 })
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('screen--og_plus')
      expect(html).toContain('screen--2bit')
      expect(html).toContain('<div class="view view--full"><span>cached</span></div>')
    })

    it('caches only the rendered plugin body when rendering on demand', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      const plugin = makePlugin({
        id: 'p1',
        name: 'P',
        dataSources: [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://x' })],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ v }}' })],
      })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin, filename: 'x' }, device)
      injectPrivate(service, 'pluginDataFetcher', { fetchOrLiteral: vi.fn().mockResolvedValue({ v: 1 }) })
      injectPrivate(service, 'pluginRenderer', { render: vi.fn().mockResolvedValue('<b>1</b>') })

      await service.getCurrentImage(headers)

      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen2' }, expect.objectContaining({ cachedPluginOutput: '<b>1</b>' }))
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('<div class="view view--full"><b>1</b></div>')
    })

    it('places cached mashup markup directly inside the shell', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      primeRotation({ id: 'screen2', type: 'mashup', order: 2, cachedPluginOutput: '<div class="mashup mashup--1Lx1R">m</div>', mashupConfiguration: makeMashupConfiguration({ id: 'c' }), filename: 'x' }, device)
      injectPrivate(service, 'mashupRenderer', { renderMashup: vi.fn() })

      await service.getCurrentImage(headers)

      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toMatch(/screen--2bit"[^>]*><div class="mashup mashup--1Lx1R">m<\/div><\/div>/)
      expect(html).not.toContain('view--full')
    })
  })

  it('returns default no screen image if the device has no screens and is not mirrored', async () => {
    deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, apikey: 'token' }))
    screenRepo.find.mockResolvedValue([])
    configService.get.mockReturnValue('http://api')
    const result = await service.getCurrentImage(headers)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('noScreen.png')
    expect(result.image_url).toBe('http://api/screens/noScreen.png')
  })

  it('cycles screens and returns next screen if not mirrored', async () => {
    const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })
    const filename = 'file.png'
    const generatedAt = new Date()
    const dynamicFilename = `${filename}_${generatedAt.toISOString()}`
    const activeScreen = makeScreen({ id: 'screen1', order: 1, device, isActive: true, fetchManual: false, externalLink: null, filename, generatedAt })
    const nextScreen = makeScreen({ ...activeScreen, id: 'screen2', order: 2, isActive: false })
    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.find.mockResolvedValue([activeScreen, nextScreen])
    screenRepo.save.mockResolvedValue(nextScreen)
    configService.get.mockReturnValue('http://api')
    fileExists.mockResolvedValue(true)
    const result = await service.getCurrentImage(headers)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe(dynamicFilename)
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
  })

  it('processes external link images when fetchManual is false', async () => {
    const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })
    const activeScreen = makeScreen({
      id: 'screen1',
      order: 1,
      device,
      isActive: true,
      externalLink: 'http://example.com/image.jpg',
      fetchManual: false,
      filename: 'test.png',
    })
    const nextScreen = makeScreen({ ...activeScreen, id: 'screen2', order: 2, isActive: false })

    deviceRepo.findOneBy.mockResolvedValue(device)
    screenRepo.find.mockResolvedValue([activeScreen, nextScreen])
    configService.get.mockReturnValue('http://api')

    const result = await service.getCurrentImage(headers)
    expect(result).toBeInstanceOf(Display)
    expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('tmp-source'))
  })

  it('handles mirroring with proxy when MACs are identical', async () => {
    const device = makeDevice({
      ...baseDevice,
      apikey: 'token',
      id: '1',
      width: 800,
      height: 480,
      mirrorEnabled: true,
      mirrorMac: 'mac',
      mirrorApikey: 'mirror-token',
    })

    const testHeaders = { ...headers, width: '800', height: '480' }

    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')

    const mockResponse: TrmnlScreenResponse = {
      filename: 'mirror.png',
      image_url: 'http://example.com/image.jpg',
      refresh_rate: 30,
      firmware_url: 'http://example.com/firmware',
      reset_firmware: true,
      special_function: 'test',
      update_firmware: true,
    }

    mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse))

    const { downloadImage, convertToPng } = await import('../../utils/imageUtils.js')

    vi.mocked(fs.unlink).mockResolvedValueOnce()
    const result = await service.getCurrentImage(testHeaders)
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
    const device = makeDevice({
      ...baseDevice,
      apikey: 'token',
      id: '1',
      width: 800,
      height: 480,
      mirrorEnabled: true,
      mirrorMac: 'different-mac',
      mirrorApikey: 'mirror-token',
    })

    const testHeaders = { ...headers, width: '800', height: '480' }

    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')

    const mockResponse: TrmnlScreenResponse = {
      filename: 'mirror.png',
      image_url: 'http://example.com/image.jpg',
    }

    mockFetch.mockResolvedValueOnce(jsonResponse(mockResponse))

    const { downloadImage, convertToPng } = await import('../../utils/imageUtils.js')

    vi.mocked(fs.unlink).mockResolvedValueOnce()
    const result = await service.getCurrentImage(testHeaders)
    expect(result).toBeInstanceOf(Display)
    expect(result.filename).toBe('mirror.png')
    expect(result.image_url).toContain('mirror.png')
    expect(result.refresh_rate).toBe(device.refreshRate)
    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
    expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('mirror.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object))
    expect(fs.unlink).toHaveBeenCalled()
  })

  describe('special function acknowledgement and protocol fields', () => {
    function primeNoScreen(device: Device) {
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([])
      configService.get.mockReturnValue('http://api')
    }

    function primeCycling(device: Device) {
      const activeScreen = makeScreen({ id: 'screen1', order: 1, device, isActive: true, fetchManual: false, externalLink: null, filename: 'file.png' })
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, makeScreen({ ...activeScreen, id: 'screen2', order: 2, isActive: false })])
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)
    }

    function primeMirror(device: Device, response: TrmnlScreenResponse) {
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      mockFetch.mockResolvedValueOnce(jsonResponse(response))
    }

    function mirroredDevice(mirrorMac: string) {
      return makeDevice({ ...baseDevice, deviceModel: OG_PLUS, mirrorEnabled: true, mirrorMac, mirrorApikey: 'mirror-token' })
    }

    const upstreamResponse: TrmnlScreenResponse = { filename: 'mirror.png', image_url: 'http://example.com/image.jpg', special_function: 'sleep', action: 'sleep' }

    it('acknowledges the pending special function and clears it for the next poll', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, specialFunction: 'sleep' }))

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('sleep')
      expect(result.action).toBe('sleep')
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ specialFunction: 'none' }))
    })

    it('echoes none as the action when nothing is pending', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, specialFunction: 'none' }))

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('none')
      expect(result.action).toBe('none')
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ specialFunction: 'none' }))
    })

    it('acknowledges and clears the pending special function while cycling screens', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, specialFunction: 'add_wifi' }))

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('add_wifi')
      expect(result.action).toBe('add_wifi')
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ specialFunction: 'none' }))
    })

    it('relays the upstream special function and action when proxying', async () => {
      primeMirror(makeDevice({ ...mirroredDevice('mac'), specialFunction: 'identify' }), upstreamResponse)

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('sleep')
      expect(result.action).toBe('sleep')
    })

    it('falls back to the upstream special function when a proxied response omits the action', async () => {
      primeMirror(makeDevice({ ...mirroredDevice('mac'), specialFunction: 'identify' }), { filename: 'mirror.png', image_url: 'http://example.com/image.jpg', special_function: 'rewind' })

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('rewind')
      expect(result.action).toBe('rewind')
    })

    it('reports none on both fields when a proxied response carries neither', async () => {
      primeMirror(makeDevice({ ...mirroredDevice('mac'), specialFunction: 'identify' }), { filename: 'mirror.png', image_url: 'http://example.com/image.jpg' })

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('none')
      expect(result.action).toBe('none')
    })

    it('keeps the locally pending special function and action when mirroring another device', async () => {
      primeMirror(makeDevice({ ...mirroredDevice('different-mac'), specialFunction: 'identify' }), upstreamResponse)

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('identify')
      expect(result.action).toBe('identify')
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ specialFunction: 'none' }))
    })

    it.each([
      ['without a screen', () => primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS }))],
      ['while cycling screens', () => primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS }))],
      ['while mirroring', () => primeMirror(mirroredDevice('different-mac'), upstreamResponse)],
    ])('reports the default temperature profile and omits unsupported firmware fields %s', async (_path, prime) => {
      prime()

      const result = await service.getCurrentImage(headers)

      expect(result.temperature_profile).toBe('default')
      expect('touchbar_mode' in result).toBe(false)
      expect('maximum_compatibility' in result).toBe(false)
      expect('image_url_timeout' in result).toBe(false)
    })
  })

  describe('reset device delivery', () => {
    function primeNoScreen(device: Device) {
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([])
      configService.get.mockReturnValue('http://api')
    }

    function primeCycling(device: Device) {
      const activeScreen = makeScreen({ id: 'screen1', order: 1, device, isActive: true, fetchManual: false, externalLink: null, filename: 'file.png' })
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, makeScreen({ ...activeScreen, id: 'screen2', order: 2, isActive: false })])
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)
    }

    function primeMirror(device: Device, response: TrmnlScreenResponse) {
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      mockFetch.mockResolvedValueOnce(jsonResponse(response))
    }

    function mirroredDevice(mirrorMac: string, resetDevice: boolean) {
      return makeDevice({ ...baseDevice, deviceModel: OG_PLUS, mirrorEnabled: true, mirrorMac, mirrorApikey: 'mirror-token', resetDevice })
    }

    it('delivers a pending reset and clears the flag when the device has no screen', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: true }))

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(true)
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ resetDevice: false }))
    })

    it('delivers a pending reset while cycling screens', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: true }))

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(true)
    })

    it('does not report a reset while cycling screens when none is pending', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: false }))

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(false)
    })

    it('lets the upstream response own reset_firmware when proxying', async () => {
      primeMirror(mirroredDevice('mac', true), { filename: 'mirror.png', image_url: 'http://example.com/image.jpg', reset_firmware: false })

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(false)
    })

    it('falls back to the locally pending reset when a proxied response omits it', async () => {
      primeMirror(mirroredDevice('mac', true), { filename: 'mirror.png', image_url: 'http://example.com/image.jpg' })

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(true)
    })

    it('delivers a pending reset on a non-proxy mirrored device', async () => {
      primeMirror(mirroredDevice('different-mac', true), { filename: 'mirror.png', image_url: 'http://example.com/image.jpg' })

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(true)
    })

    it('does not report a reset on a non-proxy mirrored device when none is pending', async () => {
      primeMirror(mirroredDevice('different-mac', false), { filename: 'mirror.png', image_url: 'http://example.com/image.jpg' })

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(false)
    })
  })

  describe('firmware push', () => {
    const targetFirmware = makeFirmware({ id: 'fw-1', version: '1.5.6', checksum: 'abc123' })

    function primeNoScreen(device: Device) {
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([])
      configService.get.mockReturnValue('http://api')
    }

    it('serves the target firmware url and clears the flag when the checksum matches', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, updateFirmware: true, targetFirmware })
      primeNoScreen(device)
      firmwareService.verifyChecksum.mockResolvedValue(true)
      firmwareService.fileUrl.mockReturnValue('http://api/firmware/fw-1.bin')

      const result = await service.getCurrentImage(headers)

      expect(firmwareService.verifyChecksum).toHaveBeenCalledWith(targetFirmware)
      expect(result.firmware_url).toBe('http://api/firmware/fw-1.bin')
      expect(result.update_firmware).toBe(true)
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ updateFirmware: false }))
    })

    it('skips serving the url and leaves the flag set when the checksum does not match', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, updateFirmware: true, targetFirmware })
      primeNoScreen(device)
      firmwareService.verifyChecksum.mockResolvedValue(false)

      const result = await service.getCurrentImage(headers)

      expect(result.firmware_url).toBe('')
      expect(result.update_firmware).toBe(false)
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ updateFirmware: true }))
    })

    it('does nothing when updateFirmware is false', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, updateFirmware: false, targetFirmware }))

      const result = await service.getCurrentImage(headers)

      expect(firmwareService.verifyChecksum).not.toHaveBeenCalled()
      expect(result.firmware_url).toBe('')
      expect(result.update_firmware).toBe(false)
    })

    it('does nothing when no firmware is targeted', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, updateFirmware: true, targetFirmware: null }))

      const result = await service.getCurrentImage(headers)

      expect(firmwareService.verifyChecksum).not.toHaveBeenCalled()
      expect(result.update_firmware).toBe(false)
    })

    it('leaves a mirrored device unaffected by any firmware assignment', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, mirrorEnabled: true, mirrorMac: 'different-mac', updateFirmware: true, targetFirmware })
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      mockFetch.mockResolvedValueOnce(jsonResponse({ filename: 'mirror.png', image_url: 'http://example.com/image.jpg' }))

      const result = await service.getCurrentImage(headers)

      expect(firmwareService.verifyChecksum).not.toHaveBeenCalled()
      expect(result.firmware_url).toBeNull()
      expect(result.update_firmware).toBe(false)
    })
  })

  describe('getCurrentImageWithoutProgressing', () => {
    it('throws NotFoundException if device not found', async () => {
      deviceRepo.findOneBy.mockResolvedValue(null)
      await expect(service.getCurrentImageWithoutProgressing(headers)).rejects.toThrow(NotFoundException)
    })

    it('throws UnauthorizedException if API key is invalid', async () => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, apikey: 'wrong' }))
      await expect(service.getCurrentImageWithoutProgressing(headers)).rejects.toThrow(UnauthorizedException)
    })

    it('returns default no screen image if no active screen and not mirrored', async () => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, apikey: 'token' }))
      screenRepo.findOneBy.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.filename).toBe('noScreen.png')
      expect(result.image_url).toBe('http://api/screens/noScreen.png')
      expect(result.rendered_at).toBeInstanceOf(Date)
    })

    it('returns mirror image if device is mirrored and file exists', async () => {
      const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: true })
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
      const device = makeDevice({
        ...baseDevice,
        apikey: 'token',
        id: '1',
        width: 800,
        height: 480,
        mirrorEnabled: true,
        mirrorMac: 'different-mac',
        mirrorApikey: 'mirror-token',
      })
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)
      mockFetch.mockResolvedValueOnce(jsonResponse({ filename: 'remote.png', image_url: 'http://example.com/image.jpg' }))

      const { downloadImage, convertToPng } = await import('../../utils/imageUtils.js')

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
      const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: true })
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
      const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })
      const activeScreen = makeScreen({
        id: 'screen1',
        device,
        filename: 'test.png',
        isActive: true,
      })

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
      const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', width: 800, height: 480, mirrorEnabled: false })
      const activeScreen = makeScreen({
        id: 'screen1',
        device,
        filename: 'test.png',
        isActive: true,
        externalLink: 'http://example.com/image.jpg',
        fetchManual: false,
      })

      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)

      const { downloadImage, convertToPng } = await import('../../utils/imageUtils.js')

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object))
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('screen1.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object))
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
    })

    it('returns error image if the screen image is missing and cannot be regenerated', async () => {
      const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })
      const activeScreen = makeScreen({
        id: 'screen1',
        device,
        type: 'file',
        filename: 'test.png',
        isActive: true,
      })

      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)

      const result = await service.getCurrentImageWithoutProgressing(headers)
      expect(result).toBeInstanceOf(DisplayScreen)
      expect(result.image_url).toBe('http://api/screens/error.png')
    })

    it('returns fresh generation metadata after on-demand generation', async () => {
      const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', width: 800, height: 480, mirrorEnabled: false })
      const staleDate = new Date('2026-01-01T00:00:00.000Z')
      const activeScreen = makeScreen({
        id: 'screen1',
        device,
        filename: 'test.png',
        generatedAt: staleDate,
        isActive: true,
        externalLink: 'http://example.com/image.jpg',
        fetchManual: false,
      })

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
      injectPrivate(service, 'pluginDataFetcher', { fetchOrLiteral: vi.fn() })
      injectPrivate(service, 'pluginRenderer', { render: vi.fn() })
      injectPrivate(service, 'pluginTransformer', { transform: vi.fn() })
    })

    it('should detect mashup screen and call renderer', async () => {
      const device = makeDevice({ ...baseDevice, width: 800, height: 480, apikey: 'token', id: 'device-1' })

      const mashupConfig = makeMashupConfiguration({
        id: 'config-1',
        layout: '2x2',
        slots: [
          makeMashupSlot({ id: 'slot-1', plugin: makePlugin({ id: 'p1', name: 'Weather' }) }),
          makeMashupSlot({ id: 'slot-2', plugin: makePlugin({ id: 'p2', name: 'Calendar' }) }),
        ],
      })

      const activeScreen = makeScreen({
        id: 'screen1',
        type: 'file',
        filename: 'First',
        order: 1,
        isActive: true,
        device,
      })

      const nextScreenBase = makeScreen({
        id: 'screen2',
        type: 'mashup',
        filename: 'Dashboard',
        order: 2,
        isActive: false,
        device,
      })

      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceRepo.save.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, nextScreenBase])
      screenRepo.findOne.mockResolvedValue({ ...nextScreenBase, mashupConfiguration: mashupConfig })
      screenRepo.save.mockResolvedValue({ ...nextScreenBase, isActive: true })
      configService.get.mockReturnValue('http://api')

      const mockMashupRenderer = {
        renderMashup: vi.fn().mockResolvedValue('<html>Mashup HTML</html>'),
      }
      injectPrivate(service, 'mashupRenderer', mockMashupRenderer)

      const result = await service.getCurrentImage({ ...headers, width: '800', height: '480' })

      expect(mockMashupRenderer.renderMashup).toHaveBeenCalled()
      expect(result).toBeInstanceOf(Display)
    })

    it('should handle mashup with cached output', async () => {
      const device = makeDevice({ ...baseDevice, width: 800, height: 480, apikey: 'token' })
      const activeScreen = makeScreen({ id: 'screen1', isActive: true, order: 1, device })
      const nextScreen = makeScreen({
        id: 'screen2',
        type: 'mashup',
        filename: 'Dashboard',
        order: 2,
        isActive: false,
        device,
        cachedPluginOutput: '<html>Cached mashup</html>',
        mashupConfiguration: makeMashupConfiguration({ id: 'config-1' }),
      })

      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceRepo.save.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, nextScreen])
      screenRepo.findOne.mockResolvedValue(nextScreen)
      screenRepo.save.mockResolvedValue(nextScreen)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)

      const result = await service.getCurrentImage({ ...headers, width: '800', height: '480' })

      expect(result).toBeInstanceOf(Display)
      expect(result.image_url).toContain('/screens/devices/')
    })

    it('should fallback to error.png if mashup rendering fails', async () => {
      const device = makeDevice({ ...baseDevice, width: 800, height: 480, apikey: 'token' })
      const activeScreen = makeScreen({ id: 'screen1', isActive: true, order: 1, device })
      const nextScreen = makeScreen({
        id: 'screen2',
        type: 'mashup',
        filename: 'Dashboard',
        order: 2,
        isActive: false,
        device,
        mashupConfiguration: makeMashupConfiguration({ id: 'config-1', slots: [] }),
      })

      deviceRepo.findOneBy.mockResolvedValue(device)
      deviceRepo.save.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, nextScreen])
      screenRepo.findOne.mockResolvedValue(nextScreen)
      screenRepo.save.mockResolvedValue(nextScreen)
      configService.get.mockReturnValue('http://api')

      const mockMashupRenderer = {
        renderMashup: vi.fn().mockRejectedValue(new Error('Render failed')),
      }
      injectPrivate(service, 'mashupRenderer', mockMashupRenderer)

      const result = await service.getCurrentImage({ ...headers, width: '800', height: '480' })

      expect(result).toBeInstanceOf(Display)
      expect(result.image_url).toBe('http://api/screens/error.png')
    })
  })

  describe('schedule-gated rotation', () => {
    const scheduledDevice = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })

    function screen(overrides: Partial<Omit<Screen, 'schedule'>> & { schedule?: Partial<Schedule> | null } = {}): Screen {
      const { schedule, ...rest } = overrides
      return makeScreen({
        device: scheduledDevice,
        type: 'file',
        isActive: false,
        fetchManual: false,
        externalLink: null,
        filename: 'file.png',
        generatedAt: new Date('2026-08-21T00:00:00'),
        schedule: schedule == null ? null : makeSchedule(schedule),
        ...rest,
      })
    }

    function primeRotation(screens: Screen[]) {
      deviceRepo.findOneBy.mockResolvedValue(scheduledDevice)
      screenRepo.find.mockResolvedValue(screens)
      screenRepo.findOne.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)
    }

    // 2026-08-21 is a Friday, 2026-08-22 a Saturday.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('skips a screen whose schedule does not match now and advances to the next eligible one', async () => {
      vi.setSystemTime(new Date('2026-08-22T12:00:00'))
      primeRotation([
        screen({ id: 'screen1', order: 1, isActive: true }),
        screen({ id: 'screen2', order: 2, schedule: { enabled: true, weekdays: [1, 2, 3, 4, 5] } }),
        screen({ id: 'screen3', order: 3 }),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      expect(screenRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'screen3', isActive: true }))
    })

    it('wraps past the end of the rotation to reach an eligible screen', async () => {
      vi.setSystemTime(new Date('2026-08-22T12:00:00'))
      primeRotation([
        screen({ id: 'screen1', order: 1 }),
        screen({ id: 'screen2', order: 2, isActive: true }),
        screen({ id: 'screen3', order: 3, schedule: { enabled: true, weekdays: [1, 2, 3, 4, 5] } }),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
    })

    it('skips a scheduled mashup screen the same way as any other type', async () => {
      vi.setSystemTime(new Date('2026-08-22T12:00:00'))
      primeRotation([
        screen({ id: 'screen1', order: 1, isActive: true }),
        screen({ id: 'screen2', order: 2, type: 'mashup', schedule: { enabled: true, weekdays: [1, 2, 3, 4, 5] } }),
        screen({ id: 'screen3', order: 3 }),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
    })

    it('returns the no screen image and leaves no screen active when every screen is ineligible', async () => {
      vi.setSystemTime(new Date('2026-08-22T12:00:00'))
      primeRotation([
        screen({ id: 'screen1', order: 1, isActive: true, schedule: { enabled: true, weekdays: [1, 2, 3, 4, 5] } }),
        screen({ id: 'screen2', order: 2, schedule: { enabled: false } }),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result).toBeInstanceOf(Display)
      expect(result.filename).toBe('noScreen.png')
      expect(result.image_url).toBe('http://api/screens/noScreen.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ device: { id: '1' } }, { isActive: false })
      expect(screenRepo.save).not.toHaveBeenCalled()
    })

    it('resumes the rotation once a screen becomes eligible again, without an active screen to advance from', async () => {
      vi.setSystemTime(new Date('2026-08-21T08:00:00'))
      primeRotation([
        screen({ id: 'screen1', order: 1, schedule: { enabled: true, startTime: '07:00', endTime: '09:00' } }),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
      expect(screenRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'screen1', isActive: true }))
    })

    it('keeps a screen out of the rotation while its daily window is closed', async () => {
      vi.setSystemTime(new Date('2026-08-21T18:00:00'))
      primeRotation([
        screen({ id: 'screen1', order: 1, schedule: { enabled: true, startTime: '07:00', endTime: '09:00' } }),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('noScreen.png')
    })

    it('shows a screen whose schedule spans midnight on both sides of it', async () => {
      const overnight = { enabled: true, startTime: '22:00', endTime: '02:00' }

      vi.setSystemTime(new Date('2026-08-21T23:00:00'))
      primeRotation([screen({ id: 'screen1', order: 1, schedule: overnight })])
      expect((await service.getCurrentImage(headers)).image_url).toBe('http://api/screens/devices/1/screen1.png')

      vi.setSystemTime(new Date('2026-08-21T01:00:00'))
      primeRotation([screen({ id: 'screen1', order: 1, schedule: overnight })])
      expect((await service.getCurrentImage(headers)).image_url).toBe('http://api/screens/devices/1/screen1.png')

      vi.setSystemTime(new Date('2026-08-21T12:00:00'))
      primeRotation([screen({ id: 'screen1', order: 1, schedule: overnight })])
      expect((await service.getCurrentImage(headers)).filename).toBe('noScreen.png')
    })

    it('drops a seasonal screen from the rotation once its date range has passed', async () => {
      const december = { enabled: true, startDate: '2026-12-01', endDate: '2026-12-25' }

      vi.setSystemTime(new Date('2026-12-13T12:00:00'))
      primeRotation([screen({ id: 'screen1', order: 1, schedule: december })])
      expect((await service.getCurrentImage(headers)).image_url).toBe('http://api/screens/devices/1/screen1.png')

      vi.setSystemTime(new Date('2026-12-26T12:00:00'))
      primeRotation([screen({ id: 'screen1', order: 1, schedule: december })])
      expect((await service.getCurrentImage(headers)).filename).toBe('noScreen.png')
    })
  })

  describe('sleep mode', () => {
    const sleepingDevice = makeDevice({ ...baseDevice, apikey: 'token', id: '1', deviceModel: OG_PLUS, mirrorEnabled: false, sleepModeEnabled: true, sleepStartTime: 22 * 3600, sleepEndTime: 6 * 3600, sleepScreenEnabled: false })

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('leaves rotation and refresh rate unaffected when sleep mode is disabled', async () => {
      const device = makeDevice({ ...sleepingDevice, sleepModeEnabled: false, refreshRate: 60 })
      const activeScreen = makeScreen({ id: 'screen1', order: 1, device, isActive: true, fetchManual: false, externalLink: null, filename: 'file.png' })
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, makeScreen({ ...activeScreen, id: 'screen2', order: 2, isActive: false })])

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(result.refresh_rate).toBe(60)
    })

    it('does not advance the active screen while asleep', async () => {
      const activeScreen = makeScreen({ id: 'screen1', order: 1, device: sleepingDevice, isActive: true, fetchManual: false, externalLink: null, filename: 'file.png' })
      deviceRepo.findOneBy.mockResolvedValue(sleepingDevice)
      screenRepo.find.mockResolvedValue([activeScreen, makeScreen({ ...activeScreen, id: 'screen2', order: 2, isActive: false })])

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      await service.getCurrentImage(headers)

      expect(screenRepo.update).not.toHaveBeenCalled()
      expect(screenRepo.save).not.toHaveBeenCalled()
    })

    it('returns a refresh rate of seconds-until-sleepEndTime, wrapping past midnight', async () => {
      deviceRepo.findOneBy.mockResolvedValue(sleepingDevice)
      screenRepo.findOneBy.mockResolvedValue(null)

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.refresh_rate).toBe(7 * 3600)
    })

    it('floors the refresh rate at the minimum right at the boundary', async () => {
      deviceRepo.findOneBy.mockResolvedValue(sleepingDevice)
      screenRepo.findOneBy.mockResolvedValue(null)

      vi.setSystemTime(new Date('2026-08-22T05:59:30'))
      const result = await service.getCurrentImage(headers)

      expect(result.refresh_rate).toBe(60)
    })

    it('is not asleep outside the configured window', async () => {
      const device = makeDevice({ ...sleepingDevice, refreshRate: 60 })
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([])

      vi.setSystemTime(new Date('2026-08-22T12:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.refresh_rate).toBe(60)
    })

    it('serves the dedicated sleep screen when enabled, even for a screenless device', async () => {
      const device = makeDevice({ ...sleepingDevice, sleepScreenEnabled: true })
      deviceRepo.findOneBy.mockResolvedValue(device)

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('sleep.png')
      expect(result.image_url).toBe('http://api/screens/sleep.png')
      expect(screenRepo.find).not.toHaveBeenCalled()
    })

    it('keeps showing noScreen for a screenless device with the sleep screen disabled', async () => {
      deviceRepo.findOneBy.mockResolvedValue(sleepingDevice)
      screenRepo.findOneBy.mockResolvedValue(null)

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('noScreen.png')
      expect(result.image_url).toBe('http://api/screens/noScreen.png')
    })

    it('freezes the existing active screen image when the sleep screen is disabled', async () => {
      const generatedAt = new Date('2026-08-20T00:00:00Z')
      const activeScreen = makeScreen({ id: 'screen1', device: sleepingDevice, isActive: true, filename: 'file.png', generatedAt })
      deviceRepo.findOneBy.mockResolvedValue(sleepingDevice)
      screenRepo.findOneBy.mockResolvedValue(activeScreen)

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe(`file.png_${generatedAt.toISOString()}`)
      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
    })

    it('skips sleep mode entirely for a mirrored device', async () => {
      const device = makeDevice({ ...sleepingDevice, mirrorEnabled: true, mirrorMac: 'different-mac', mirrorApikey: 'mirror-token' })
      deviceRepo.findOneBy.mockResolvedValue(device)
      mockFetch.mockResolvedValueOnce(jsonResponse({ filename: 'mirror.png', image_url: 'http://example.com/image.jpg', refresh_rate: 30 }))

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('mirror.png')
    })

    describe('getCurrentImageWithoutProgressing', () => {
      it('mirrors the sleep-screen resolution used by the poll handler', async () => {
        const device = makeDevice({ ...sleepingDevice, sleepScreenEnabled: true })
        deviceRepo.findOneBy.mockResolvedValue(device)

        vi.setSystemTime(new Date('2026-08-22T23:00:00'))
        const result = await service.getCurrentImageWithoutProgressing(headers)

        expect(result.filename).toBe('sleep.png')
        expect(result.image_url).toBe('http://api/screens/sleep.png')
        expect(result.refresh_rate).toBe(7 * 3600)
      })

      it('keeps showing the active screen when the sleep screen is disabled', async () => {
        const activeScreen = makeScreen({ id: 'screen1', device: sleepingDevice, filename: 'file.png', isActive: true })
        deviceRepo.findOneBy.mockResolvedValue(sleepingDevice)
        screenRepo.findOneBy.mockResolvedValue(activeScreen)

        vi.setSystemTime(new Date('2026-08-22T23:00:00'))
        const result = await service.getCurrentImageWithoutProgressing(headers)

        expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
        expect(result.refresh_rate).toBe(7 * 3600)
      })
    })
  })
})
