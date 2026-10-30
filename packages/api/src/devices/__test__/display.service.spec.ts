import type { ConfigService } from '@nestjs/config'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service.js'
import type { MockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService.js'
import type { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import type { FirmwareService } from '../../firmware/firmware.service.js'
import type { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import type { MashupRendererService } from '../../mashup/services/mashup-renderer.service.js'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service.js'
import type { Schedule } from '../../schedule/schedule.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { MockDeviceModelsService, MockFallbackScreensService } from '../../test/mockDeviceModelsService.js'
import type { Device } from '../devices.entity.js'
import type { TrmnlScreenResponse } from '../display.service.js'
import type { DisplayRequestHeadersDto } from '../dto/display-request-headers.dto.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { TRMNL_FRAMEWORK_VERSION } from 'kuroshiro-shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeSharedBrowser } from '../../device-models/shared-browser.js'
import { createMockDeviceSensorsService, primeMockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService.js'
import { ScreenRenderService } from '../../mashup/services/screen-render.service.js'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { makeDevice, makeDeviceSensor, makeFirmware, makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginDataSource, makePluginTemplate, makeSchedule, makeScreen } from '../../test/fixtures.js'
import { createMockDeviceModelsService, createMockFallbackScreensService, GRAY_4, GRAY_16, OG_PLUS, primeMockDeviceModelsService, primeMockFallbackScreensService, V2 } from '../../test/mockDeviceModelsService.js'
import { createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService, injectPrivate } from '../../test/mockService.js'
import { downloadImage } from '../../utils/imageUtils.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { fetchPublic } from '../../utils/ssrfGuard.js'
import { Display } from '../display.js'
import { DeviceDisplayService } from '../display.service.js'
import { DisplayScreen } from '../displayScreen.js'

const { fileExists, fileModifiedAt, puppeteerPage, puppeteerLaunch } = vi.hoisted(() => ({
  fileExists: vi.fn(),
  fileModifiedAt: vi.fn(),
  puppeteerPage: {
    setViewport: vi.fn(),
    setContent: vi.fn(),
    screenshot: vi.fn(),
    evaluate: vi.fn(),
    close: vi.fn(),
  },
  puppeteerLaunch: vi.fn(),
}))

vi.mock('../../utils/fileExists.js', () => ({
  fileExists,
}))

vi.mock('../../utils/fileModifiedAt.js', () => ({
  fileModifiedAt,
}))

vi.mock('node:fs', () => ({
  promises: {
    unlink: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}))

vi.mock('../../utils/imageUtils.js', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('puppeteer', () => ({
  default: { launch: puppeteerLaunch },
}))

/** Embedded in a Screen's `html` or cached output so the mocked page "sets" `window.TRMNL_SKIP_DISPLAY`. */
const SKIP_MARKER = 'window.TRMNL_SKIP_DISPLAY'
/** Embedded the same way to fake `window.TRMNL_SKIP_SCREEN_GENERATION`. */
const HOLD_MARKER = 'window.TRMNL_SKIP_SCREEN_GENERATION'

function primePuppeteer() {
  puppeteerPage.close.mockResolvedValue(undefined)
  puppeteerPage.setViewport.mockResolvedValue(undefined)
  puppeteerPage.setContent.mockResolvedValue(undefined)
  puppeteerPage.screenshot.mockResolvedValue(new Uint8Array())
  // No real browser runs, so the flags read back are faked from the HTML just handed to `setContent`.
  puppeteerPage.evaluate.mockImplementation(() => {
    const html = String(puppeteerPage.setContent.mock.calls.at(-1)?.[0] ?? '')
    return Promise.resolve({ skip: html.includes(SKIP_MARKER), hold: html.includes(HOLD_MARKER) })
  })
  puppeteerLaunch.mockResolvedValue({ newPage: vi.fn().mockResolvedValue(puppeteerPage), close: vi.fn(), connected: true })
}

const mockFetch = stubFetch()

describe('deviceDisplayService', () => {
  let service: DeviceDisplayService
  let screenRender: ScreenRenderService
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let configService: { get: ReturnType<typeof vi.fn> }
  let deviceModels: MockDeviceModelsService
  let fallbackScreens: MockFallbackScreensService
  let firmwareService: { verifyChecksum: ReturnType<typeof vi.fn>, fileUrl: ReturnType<typeof vi.fn> }
  let deviceSensors: MockDeviceSensorsService

  beforeEach(async () => {
    await closeSharedBrowser()
    deviceRepo = createMockRepository<Device>()
    screenRepo = createMockRepository<Screen>()
    configService = { get: vi.fn() }
    deviceModels = createMockDeviceModelsService()
    fallbackScreens = createMockFallbackScreensService()
    firmwareService = { verifyChecksum: vi.fn(), fileUrl: vi.fn() }
    deviceSensors = createMockDeviceSensorsService()
    screenRender = new ScreenRenderService(
      asRepository(screenRepo),
      asService<ConfigService>(configService),
      asService<DeviceModelsService>(deviceModels),
      asService<MashupRendererService>({}),
      asRepository(createMockRepository<MashupSlot>()),
      asRepository(createMockRepository<MashupConfiguration>()),
    )
    service = new DeviceDisplayService(
      asRepository(deviceRepo),
      asRepository(screenRepo),
      asService<ConfigService>(configService),
      asService<DeviceModelsService>(deviceModels),
      asService<FallbackScreensService>(fallbackScreens),
      asService<FirmwareService>(firmwareService),
      asService<PluginRendererService>({}),
      asService<DeviceSensorsService>(deviceSensors),
      createPluginTemplateContextService(),
      screenRender,
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

  describe('what a poll logs', () => {
    const secret = 'secret-device-apikey'

    beforeEach(() => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, apikey: secret, deviceModel: OG_PLUS }))
      screenRepo.find.mockResolvedValue([])
      screenRepo.findOneBy.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    function loggedLines() {
      const levels = ['log', 'debug', 'verbose', 'warn', 'error', 'fatal'] as const
      const spies = levels.map(level => vi.spyOn(Logger.prototype, level).mockImplementation(() => {}))
      return () => spies.flatMap(spy => spy.mock.calls.map(call => call.map(String).join(' ')))
    }

    it('never writes the API key a /display poll sends to the log', async () => {
      const lines = loggedLines()
      await service.getCurrentImage({ ...headers, 'access-token': secret })
      expect(lines().some(line => line.includes('Headers:'))).toBe(true)
      expect(lines().filter(line => line.includes(secret))).toEqual([])
    })

    it('never writes the API key a /current_screen poll sends to the log', async () => {
      const lines = loggedLines()
      await service.getCurrentImageWithoutProgressing({ ...headers, 'access-token': secret })
      expect(lines().some(line => line.includes('Headers:'))).toBe(true)
      expect(lines().filter(line => line.includes(secret))).toEqual([])
    })
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

    it('stores the Update-Source header as sent', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage({ ...headers, 'update-source': 'EXT0' })
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lastWakeSource: 'EXT0' }))
    })

    it('leaves the wake source null when the Device sends no Update-Source', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      deviceRepo.findOneBy.mockResolvedValue(device)
      await service.getCurrentImage(headers)
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lastWakeSource: null }))
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
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('screen2.png'), { model: V2, palette: GRAY_16 }, expect.any(Object), { dither: true })
      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('tmp-source'))
    })

    describe('dithering', () => {
      async function convertedWith(): Promise<unknown> {
        const { convertToPng } = await import('../../utils/imageUtils.js')
        return vi.mocked(convertToPng).mock.calls.at(-1)?.[4]
      }

      it('converts an HTML Screen with its own Dithering', async () => {
        const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
        primeRotation({ id: 'screen2', type: 'html', order: 2, html: '<p>hi</p>', filename: 'x', dither: false }, device)

        await service.getCurrentImage(headers)

        expect(await convertedWith()).toEqual({ dither: false })
      })

      it('converts a Plugin Screen with its Plugin\'s Dithering', async () => {
        const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
        primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin: makePlugin({ id: 'p1', dither: false }), cachedPluginOutput: '<span>cached</span>', filename: 'x' }, device)

        await service.getCurrentImage(headers)

        expect(await convertedWith()).toEqual({ dither: false })
      })

      it('converts a Mashup of undithered Plugins undithered', async () => {
        const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
        const config = makeMashupConfiguration({ id: 'c', slots: [{ id: 's', order: 0, plugin: makePlugin({ id: 'p1', dither: false }) }] } as never)
        primeRotation({ id: 'screen2', type: 'mashup', order: 2, cachedPluginOutput: '<div class="mashup mashup--1Lx1R">m</div>', mashupConfiguration: config, filename: 'x' }, device)

        await service.getCurrentImage(headers)

        expect(await convertedWith()).toEqual({ dither: false })
      })

      it('keeps a Mashup with one dithered slot dithered', async () => {
        const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
        const config = makeMashupConfiguration({
          id: 'c',
          slots: [
            { id: 's1', order: 0, plugin: makePlugin({ id: 'p1', dither: false }) },
            { id: 's2', order: 1, plugin: makePlugin({ id: 'p2', dither: true }) },
          ],
        } as never)
        primeRotation({ id: 'screen2', type: 'mashup', order: 2, cachedPluginOutput: '<div class="mashup mashup--1Lx1R">m</div>', mashupConfiguration: config, filename: 'x' }, device)

        await service.getCurrentImage(headers)

        expect(await convertedWith()).toEqual({ dither: true })
      })

      it('keeps an empty Mashup dithered', async () => {
        const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
        const config = makeMashupConfiguration({ id: 'c', slots: [] } as never)
        primeRotation({ id: 'screen2', type: 'mashup', order: 2, cachedPluginOutput: '<div class="mashup mashup--1Lx1R">m</div>', mashupConfiguration: config, filename: 'x' }, device)

        await service.getCurrentImage(headers)

        expect(await convertedWith()).toEqual({ dither: true })
      })
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

    it('loads the Instance pin for a Plugin without a Framework Version', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin: makePlugin({ id: 'p1' }), cachedPluginOutput: '<span>cached</span>', filename: 'x' }, device)

      await service.getCurrentImage(headers)

      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain(`https://trmnl.com/css/${TRMNL_FRAMEWORK_VERSION}/plugins.css`)
    })

    it('loads a Plugin\'s own Framework Version', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin: makePlugin({ id: 'p1', frameworkVersion: '3.3.1' }), cachedPluginOutput: '<span>cached</span>', filename: 'x' }, device)

      await service.getCurrentImage(headers)

      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('https://trmnl.com/css/3.3.1/plugins.css')
      expect(html).toContain('https://trmnl.com/js/3.3.1/plugins.js')
    })

    it('loads the Instance pin for a Mashup whose slot Plugins name other versions', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      const config = makeMashupConfiguration({ id: 'c', slots: [{ id: 's', order: 0, plugin: makePlugin({ id: 'p1', frameworkVersion: '3.3.1' }) }] } as never)
      primeRotation({ id: 'screen2', type: 'mashup', order: 2, cachedPluginOutput: '<div class="mashup mashup--1Lx1R">m</div>', mashupConfiguration: config, filename: 'x' }, device)

      await service.getCurrentImage(headers)

      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain(`https://trmnl.com/css/${TRMNL_FRAMEWORK_VERSION}/plugins.css`)
      expect(html).not.toContain('3.3.1')
    })

    it('serves the error Fallback Screen naming the Screen when its render fails', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      primeRotation({ id: 'screen2', type: 'html', order: 2, html: '<p>hi</p>', filename: 'Weather' }, device)
      puppeteerPage.setContent.mockRejectedValue(new Error('Chrome crashed'))

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/error.png')
      expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'error', cause: 'render', screenName: 'Weather' }, device, { model: OG_PLUS, palette: GRAY_4 })
    })

    it('names a plugin-type Screen that could not be rendered after its Plugin', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin: makePlugin({ id: 'p1', name: 'Weather' }), cachedPluginOutput: '<span>cached</span>', filename: null }, device)
      puppeteerPage.setContent.mockRejectedValue(new Error('Chrome crashed'))

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/error.png')
      expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'error', cause: 'render', screenName: 'Weather' }, device, { model: OG_PLUS, palette: GRAY_4 })
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
      injectPrivate(service, 'pluginTemplateContext', createPluginTemplateContextService({}, { resolveAll: vi.fn().mockResolvedValue({ v: 1 }) }))
      injectPrivate(service, 'pluginRenderer', { render: vi.fn().mockResolvedValue('<b>1</b>') })

      await service.getCurrentImage(headers)

      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen2' }, expect.objectContaining({ cachedPluginOutput: '<b>1</b>' }))
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('<div class="view view--full"><b>1</b></div>')
    })

    it('renders a Poll-kind Plugin without Data Sources on demand, with trmnl and its Field Values only', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      const plugin = makePlugin({ id: 'p1', name: 'Clock', dataSources: [], templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ city }}' })] })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin, filename: 'x' }, device)
      const render = vi.fn().mockResolvedValue('<b>Berlin</b>')
      injectPrivate(service, 'pluginRenderer', { render })
      injectPrivate(service, 'pluginTemplateContext', createPluginTemplateContextService({ city: 'Berlin' }))

      await service.getCurrentImage(headers)

      expect(render).toHaveBeenCalledWith('{{ city }}', { city: 'Berlin', sensors: {}, trmnl: expect.objectContaining({ plugin_settings: expect.objectContaining({ instance_name: 'Clock' }) }) })
      const html: string = puppeteerPage.setContent.mock.calls[0][0]
      expect(html).toContain('<div class="view view--full"><b>Berlin</b></div>')
    })

    it('renders a Poll-kind Plugin on demand with no Device Sensors, even though the polling Device has readings', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      const plugin = makePlugin({ id: 'p1', name: 'Clock', dataSources: [], templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ sensors }}' })] })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin, filename: 'x' }, device)
      deviceSensors.findForDevice.mockResolvedValue([makeDeviceSensor({ kind: 'temperature', value: 21.5, unit: 'C' })])
      const render = vi.fn().mockResolvedValue('<b></b>')
      injectPrivate(service, 'pluginRenderer', { render })

      await service.getCurrentImage(headers)

      expect(render).toHaveBeenCalledWith('{{ sensors }}', expect.objectContaining({ sensors: {} }))
    })

    it('fetches and renders with the Plugin\'s Field Values, in both address forms, when rendering on demand', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      const plugin = makePlugin({
        id: 'p1',
        name: 'P',
        dataSources: [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://x/{{ city }}' })],
        templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '{{ city }}' })],
      })
      primeRotation({ id: 'screen2', type: 'plugin', order: 2, plugin, filename: 'x' }, device)
      const resolveAll = vi.fn().mockResolvedValue({ source: 1 })
      const render = vi.fn().mockResolvedValue('<b>Berlin</b>')
      injectPrivate(service, 'pluginRenderer', { render })
      injectPrivate(service, 'pluginTemplateContext', createPluginTemplateContextService({ city: 'Berlin' }, { resolveAll }))

      await service.getCurrentImage(headers)

      const fieldValuesInContext = expect.objectContaining({
        city: 'Berlin',
        trmnl: expect.objectContaining({ plugin_settings: expect.objectContaining({ custom_fields_values: { city: 'Berlin' } }) }),
      })
      expect(resolveAll).toHaveBeenCalledWith(plugin.dataSources, fieldValuesInContext, { savedStates: {}, previousOutputs: {} })
      expect(render).toHaveBeenCalledWith('{{ city }}', expect.objectContaining({ source: 1 }))
      expect(render).toHaveBeenCalledWith('{{ city }}', fieldValuesInContext)
    })

    it('places cached mashup markup directly inside the shell', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS })
      primeRotation({ id: 'screen2', type: 'mashup', order: 2, cachedPluginOutput: '<div class="mashup mashup--1Lx1R">m</div>', mashupConfiguration: makeMashupConfiguration({ id: 'c' }), filename: 'x' }, device)
      injectPrivate(screenRender, 'mashupRenderer', { renderMashup: vi.fn() })

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

  describe('the request an External link Screen\'s image is fetched with', () => {
    function pollExternalLink(demoMode: boolean) {
      const device = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })
      const activeScreen = makeScreen({ id: 'screen1', order: 1, device, isActive: true, externalLink: 'http://169.254.169.254/latest/meta-data/', fetchManual: false, filename: 'test.png' })
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue([activeScreen, makeScreen({ ...activeScreen, id: 'screen2', order: 2, isActive: false })])
      configService.get.mockImplementation((key: string) => key === 'demo_mode' ? demoMode : 'http://api')
      return service.getCurrentImage(headers)
    }

    it('is the guarded fetch under demo_mode, so a private address or a redirect to one is refused', async () => {
      await pollExternalLink(true)
      expect(downloadImage).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/', expect.any(String), expect.any(Object), fetchPublic)
    })

    it('is plain fetch outside demo_mode', async () => {
      await pollExternalLink(false)
      expect(downloadImage).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/', expect.any(String), expect.any(Object), fetch)
    })
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

    // Shaped like Express's raw `req.headers`: lowercase keys, plus transport headers that are not TRMNL's
    const testHeaders = {
      ...headers,
      'width': '800',
      'height': '480',
      'refresh-rate': '900',
      'battery-voltage': '4.1',
      'fw-version': '1.6.0',
      'rssi': '-60',
      'model': 'og',
      'user-agent': 'ESP32HTTPClient',
      'update-source': 'timer',
      'sensors': 'make=Sensirion;model=SCD41;kind=temperature;value=21.5;unit=celsius;created_at=1714000000',
      'host': 'kuroshiro.local',
      'connection': 'keep-alive',
    } as DisplayRequestHeadersDto

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
    expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/display', {
      headers: {
        'id': 'mac',
        'access-token': 'mirror-token',
        'width': '800',
        'height': '480',
        'refresh-rate': '900',
        'battery-voltage': '4.1',
        'fw-version': '1.6.0',
        'rssi': '-60',
        'model': 'og',
        'user-agent': 'ESP32HTTPClient',
        'update-source': 'timer',
        'sensors': 'make=Sensirion;model=SCD41;kind=temperature;value=21.5;unit=celsius;created_at=1714000000',
      },
    })
    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object), expect.any(Function))
    expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('mirror.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object))
    expect(fs.unlink).toHaveBeenCalled()
  })

  it('proxies a Device whose mirror MAC is its own MAC in another letter case', async () => {
    const device = makeDevice({ ...baseDevice, id: '1', mirrorEnabled: true, mirrorMac: 'MAC', mirrorApikey: 'mirror-token' })
    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    mockFetch.mockResolvedValueOnce(jsonResponse({ filename: 'mirror.png', image_url: 'http://example.com/image.jpg' }))

    await service.getCurrentImage(headers)

    expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/display', expect.anything())
  })

  it('writes the downloaded mirror image inside the Device\'s screens folder whatever filename TRMNL answers', async () => {
    const device = makeDevice({ ...baseDevice, id: '1', mirrorEnabled: true, mirrorMac: 'different-mac', mirrorApikey: 'mirror-token' })
    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    mockFetch.mockResolvedValueOnce(jsonResponse({ filename: '../../../evil.png', image_url: 'http://example.com/image.jpg' }))

    const { downloadImage } = await import('../../utils/imageUtils.js')

    await service.getCurrentImage(headers)

    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', path.join(resolveAppPath('public', 'screens', 'devices', '1'), 'mirror-source'), expect.any(Object), expect.any(Function))
  })

  it('fetches the mirror image with the guarded fetch under demo_mode, whatever address TRMNL answers', async () => {
    const device = makeDevice({ ...baseDevice, id: '1', mirrorEnabled: true, mirrorMac: 'different-mac', mirrorApikey: 'mirror-token' })
    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockImplementation((key: string) => key === 'demo_mode' ? true : 'http://api')
    mockFetch.mockResolvedValueOnce(jsonResponse({ filename: 'mirror.png', image_url: 'http://127.0.0.1:3000/admin' }))

    await service.getCurrentImage(headers)

    expect(downloadImage).toHaveBeenCalledWith('http://127.0.0.1:3000/admin', expect.any(String), expect.any(Object), fetchPublic)
  })

  it('serves the error Fallback Screen in its mirror wording when TRMNL answers without an image', async () => {
    const device = makeDevice({ ...baseDevice, mirrorEnabled: true, mirrorMac: 'mac', mirrorApikey: 'mirror-token' })
    deviceRepo.findOneBy.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 500, error: 'Device not found' }))

    const { downloadImage } = await import('../../utils/imageUtils.js')

    const result = await service.getCurrentImage(headers)

    expect(downloadImage).not.toHaveBeenCalled()
    expect(result.image_url).toBe('http://api/screens/error.png')
    expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'error', cause: 'mirror' }, device, { model: OG_PLUS, palette: GRAY_4 })
  })

  it('serves the error Fallback Screen in its mirror wording when the mirror fetch fails', async () => {
    const device = makeDevice({ ...baseDevice, mirrorEnabled: true, mirrorMac: 'different-mac', mirrorApikey: 'mirror-token' })
    deviceRepo.findOneBy.mockResolvedValue(device)
    deviceRepo.save.mockResolvedValue(device)
    configService.get.mockReturnValue('http://api')
    mockFetch.mockRejectedValueOnce(new Error('TRMNL unreachable'))

    const result = await service.getCurrentImage(headers)

    expect(result.image_url).toBe('http://api/screens/error.png')
    expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'error', cause: 'mirror' }, device, { model: OG_PLUS, palette: GRAY_4 })
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
    expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object), expect.any(Function))
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
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1', specialFunction: 'sleep' }, { specialFunction: 'none' })
    })

    it('echoes none as the action when nothing is pending', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, specialFunction: 'none' }))

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('none')
      expect(result.action).toBe('none')
      expect(deviceRepo.update).not.toHaveBeenCalledWith(expect.anything(), { specialFunction: 'none' })
    })

    it('acknowledges and clears the pending special function while cycling screens', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, specialFunction: 'add_wifi' }))

      const result = await service.getCurrentImage(headers)

      expect(result.special_function).toBe('add_wifi')
      expect(result.action).toBe('add_wifi')
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1', specialFunction: 'add_wifi' }, { specialFunction: 'none' })
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
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1', specialFunction: 'identify' }, { specialFunction: 'none' })
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
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ resetDevice: false }))
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

    it('rotates the apikey and clears the rotation flag when a pending reset asks for a new key', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: true, resetDeviceNewApikey: true }))

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(true)
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ resetDeviceNewApikey: false, apikey: expect.not.stringMatching(/^token$/) }))
    })

    it('leaves the apikey unchanged when a pending reset does not ask for a new key', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: true, resetDeviceNewApikey: false }))

      await service.getCurrentImage(headers)

      expect(deviceRepo.update).not.toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ apikey: expect.anything() }))
    })

    it('does not rotate the apikey from a stray rotation flag with no reset pending', async () => {
      primeNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: false, resetDeviceNewApikey: true }))

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(false)
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ resetDeviceNewApikey: false }))
      expect(deviceRepo.update).not.toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ apikey: expect.anything() }))
    })

    it('rotates the apikey on a non-proxy mirrored Device too', async () => {
      primeMirror(makeDevice({ ...mirroredDevice('different-mac', true), resetDeviceNewApikey: true }), { filename: 'mirror.png', image_url: 'http://example.com/image.jpg' })

      await service.getCurrentImage(headers)

      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ resetDeviceNewApikey: false, apikey: expect.not.stringMatching(/^token$/) }))
    })
  })

  describe('wipe', () => {
    const WIPE_URL = 'http://api/screens/wipe/wipe.png'

    function primeCycling(device: Device) {
      const screens = [
        makeScreen({ id: 'screen1', order: 1, device, isActive: true, fetchManual: false, externalLink: null, filename: 'file.png' }),
        makeScreen({ id: 'screen2', order: 2, device, isActive: false, fetchManual: false, externalLink: null, filename: 'file.png' }),
      ]
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue(screens)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)
    }

    it('answers the poll with the blank image at the normal refresh rate and clears the flag', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true, refreshRate: 900 }))

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe(WIPE_URL)
      expect(result.filename).toBe('wipe.png')
      expect(result.refresh_rate).toBe(900)
      expect(result.reset_firmware).toBe(false)
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ wipe: false }))
    })

    it('leaves the Rotation where it stood', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true }))

      await service.getCurrentImage(headers)

      expect(screenRepo.update).not.toHaveBeenCalled()
    })

    it('keeps a Picked Screen for the poll after the Wipe', async () => {
      const picked = makeScreen({ id: 'screen2', order: 2, isActive: false, fetchManual: false, externalLink: null, filename: 'file.png' })
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true, pickedScreen: picked })
      primeCycling(device)

      await service.getCurrentImage(headers)

      expect(deviceRepo.update).not.toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ pickedScreen: null }))
      expect(device.pickedScreen).toBe(picked)
    })

    it('serves the Rotation on the poll after the Wipe', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: false }))

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
    })

    it('carries a pending special function in the same answer', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true, specialFunction: 'identify' }))

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe(WIPE_URL)
      expect(result.special_function).toBe('identify')
      expect(result.action).toBe('identify')
    })

    it('is dropped, not served, when a Reset is pending', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true, resetDevice: true }))

      const result = await service.getCurrentImage(headers)

      expect(result.reset_firmware).toBe(true)
      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, expect.objectContaining({ wipe: false }))
    })

    it('is served once inside a Sleep Mode window, at the normal refresh rate', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      try {
        primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true, refreshRate: 900, sleepModeEnabled: true, sleepStartTime: 22 * 3600, sleepEndTime: 6 * 3600 }))

        const result = await service.getCurrentImage(headers)

        expect(result.image_url).toBe(WIPE_URL)
        expect(result.refresh_rate).toBe(900)
      }
      finally {
        vi.useRealTimers()
      }
    })

    it('is served locally to a Device mirroring another through current_screen', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true, mirrorEnabled: true, mirrorMac: 'other-mac', mirrorApikey: 'mirror-token' })
      deviceRepo.findOneBy.mockResolvedValue(device)
      configService.get.mockReturnValue('http://api')

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe(WIPE_URL)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('is given up for the usual answer when the blank image cannot be made', async () => {
      primeCycling(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, wipe: true }))
      fallbackScreens.wipeUrlFor.mockRejectedValue(new Error('magick missing'))

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
    })

    describe('getCurrentImageWithoutProgressing', () => {
      it('serves the blank image while the last poll was answered with a Wipe', async () => {
        deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, lastServedKind: 'wipe' }))
        configService.get.mockReturnValue('http://api')

        const result = await service.getCurrentImageWithoutProgressing(headers)

        expect(result.image_url).toBe(WIPE_URL)
        expect(result.filename).toBe('wipe.png')
      })
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
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1', targetFirmware: { id: 'fw-1' } }, { updateFirmware: false })
    })

    it('skips serving the url and leaves the flag set when the checksum does not match', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, updateFirmware: true, targetFirmware })
      primeNoScreen(device)
      firmwareService.verifyChecksum.mockResolvedValue(false)

      const result = await service.getCurrentImage(headers)

      expect(result.firmware_url).toBe('')
      expect(result.update_firmware).toBe(false)
      expect(deviceRepo.update).not.toHaveBeenCalledWith(expect.anything(), { updateFirmware: false })
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

  describe('a poll whose answer cannot be made', () => {
    const targetFirmware = makeFirmware({ id: 'fw-1', version: '1.5.6', checksum: 'abc123' })

    function primeFailingNoScreen(device: Device, screens: Screen[] = []) {
      deviceRepo.findOneBy.mockResolvedValue(device)
      screenRepo.find.mockResolvedValue(screens)
      configService.get.mockReturnValue('http://api')
      firmwareService.verifyChecksum.mockResolvedValue(true)
      firmwareService.fileUrl.mockReturnValue('http://api/firmware/fw-1.bin')
      fallbackScreens.urlFor.mockRejectedValue(new Error('Chromium crashed'))
    }

    it.each([
      ['an OTA push', { updateFirmware: true, targetFirmware }],
      ['a Device Reset', { resetDevice: true }],
      ['a Special Function', { specialFunction: 'sleep' }],
    ] as const)('leaves %s pending for the Device\'s retry', async (_name, pending) => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, ...pending })
      primeFailingNoScreen(device)

      await expect(service.getCurrentImage(headers)).rejects.toThrow('Chromium crashed')

      expect(device).toEqual(expect.objectContaining(pending))
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining(pending))
      expect(deviceRepo.update).not.toHaveBeenCalled()
    })

    it('keeps the old API key and the request for a new one', async () => {
      const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: true, resetDeviceNewApikey: true })
      primeFailingNoScreen(device)

      await expect(service.getCurrentImage(headers)).rejects.toThrow('Chromium crashed')

      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ apikey: 'token', resetDevice: true, resetDeviceNewApikey: true }))
      expect(deviceRepo.update).not.toHaveBeenCalled()
    })

    it('keeps the Active Screen', async () => {
      const active = makeScreen({ id: 'screen1', order: 1, isActive: true, schedule: makeSchedule({ enabled: false }) })
      primeFailingNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS }), [active])

      await expect(service.getCurrentImage(headers)).rejects.toThrow('Chromium crashed')

      expect(screenRepo.update).not.toHaveBeenCalled()
    })

    it('clears a Special Function and an OTA push only while the row still holds what this poll fired', async () => {
      primeFailingNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, specialFunction: 'sleep', updateFirmware: true, targetFirmware }))
      fallbackScreens.urlFor.mockResolvedValue('http://api/screens/noScreen.png')

      await service.getCurrentImage(headers)

      // Conditioned on what this poll fired, so the row's newer values do not match and stay as they are
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1', specialFunction: 'sleep' }, { specialFunction: 'none' })
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1', targetFirmware: { id: 'fw-1' } }, { updateFirmware: false })
    })

    it('fails the poll rather than answer a Device Reset the row does not record as delivered', async () => {
      primeFailingNoScreen(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, resetDevice: true, resetDeviceNewApikey: true }))
      fallbackScreens.urlFor.mockResolvedValue('http://api/screens/noScreen.png')
      deviceRepo.update.mockRejectedValue(new Error('connection lost'))

      await expect(service.getCurrentImage(headers)).rejects.toThrow('connection lost')
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
        headers: { 'id': 'different-mac', 'access-token': 'mirror-token' },
      })
      expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object), expect.any(Function))
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
      expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'error', cause: 'mirror' }, device, { model: OG_PLUS, palette: GRAY_4 })
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
      expect(downloadImage).toHaveBeenCalledWith('http://example.com/image.jpg', expect.any(String), expect.any(Object), expect.any(Function))
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('screen1.png'), { model: OG_PLUS, palette: GRAY_4 }, expect.any(Object), { dither: true })
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
      expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'error', cause: 'render', screenName: 'test.png' }, device, { model: OG_PLUS, palette: GRAY_4 })
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
      injectPrivate(service, 'pluginRenderer', { render: vi.fn() })
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
        renderMashup: vi.fn().mockResolvedValue({ html: '<html>Mashup HTML</html>', slots: [] }),
      }
      injectPrivate(screenRender, 'mashupRenderer', mockMashupRenderer)

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
      injectPrivate(screenRender, 'mashupRenderer', mockMashupRenderer)

      const result = await service.getCurrentImage({ ...headers, width: '800', height: '480' })

      expect(result).toBeInstanceOf(Display)
      expect(result.image_url).toBe('http://api/screens/error.png')
      expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'error', cause: 'render', screenName: 'Dashboard' }, device, { model: OG_PLUS, palette: GRAY_4 })
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
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen3' }, expect.objectContaining({ isActive: true }))
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
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, expect.objectContaining({ isActive: true }))
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

  describe('picked screen rotation', () => {
    const pickedScreenDevice = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })

    function fileScreen(overrides: Partial<Omit<Screen, 'schedule'>> & { schedule?: Partial<Schedule> | null } = {}): Screen {
      const { schedule, ...rest } = overrides
      return makeScreen({
        device: pickedScreenDevice,
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

    /** An `html` Screen whose body embeds the marker `primePuppeteer` reads back as a fresh Render Signal. */
    function htmlScreen(overrides: Partial<Screen> & { id: string, order: number }, signal: 'skip' | 'hold'): Screen {
      const body = `<p>x</p><script>${signal === 'skip' ? SKIP_MARKER : HOLD_MARKER} = true</script>`
      return makeScreen({ device: pickedScreenDevice, type: 'html', html: body, isActive: false, fetchManual: false, externalLink: null, generatedAt: new Date('2026-08-21T00:00:00'), ...overrides })
    }

    function primeRotation(screens: Screen[], pickedScreen: Screen | null) {
      pickedScreenDevice.pickedScreen = pickedScreen
      deviceRepo.findOneBy.mockResolvedValue(pickedScreenDevice)
      screenRepo.find.mockResolvedValue(screens)
      screenRepo.findOne.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)
      fileModifiedAt.mockResolvedValue(new Date('2026-08-21T00:00:00'))
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-08-21T12:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('serves the Picked Screen instead of what Order would give, and clears the pick in the same poll', async () => {
      const picked = fileScreen({ id: 'screen3', order: 3 })
      primeRotation([
        fileScreen({ id: 'screen1', order: 1, isActive: true }),
        fileScreen({ id: 'screen2', order: 2 }),
        picked,
      ], picked)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, { pickedScreen: null })
    })

    it('continues Rotation in Order from the Picked Screen on the poll after it was served', async () => {
      const picked = fileScreen({ id: 'screen3', order: 3 })
      primeRotation([
        fileScreen({ id: 'screen1', order: 1, isActive: true }),
        fileScreen({ id: 'screen2', order: 2 }),
        picked,
      ], picked)
      await service.getCurrentImage(headers)

      // What the poll above persisted: screen3 is now Active, and the pick is cleared.
      primeRotation([
        fileScreen({ id: 'screen1', order: 1 }),
        fileScreen({ id: 'screen2', order: 2 }),
        fileScreen({ id: 'screen3', order: 3, isActive: true }),
      ], null)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
    })

    it('drops a pick whose Schedule now excludes it, running normal Rotation from the Active Screen instead', async () => {
      const picked = fileScreen({ id: 'screen2', order: 2, schedule: { enabled: false } })
      primeRotation([
        fileScreen({ id: 'screen1', order: 1, isActive: true }),
        picked,
        fileScreen({ id: 'screen3', order: 3 }),
      ], picked)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, { pickedScreen: null })
    })

    it('drops a pick carrying a remembered skip, running normal Rotation instead', async () => {
      const picked = fileScreen({ id: 'screen2', order: 2, renderSignal: 'skip' })
      primeRotation([
        fileScreen({ id: 'screen1', order: 1, isActive: true }),
        picked,
        fileScreen({ id: 'screen3', order: 3 }),
      ], picked)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, { pickedScreen: null })
    })

    it('drops a pick whose render raises a fresh skip, trying the next eligible Screen in Order instead', async () => {
      const picked = htmlScreen({ id: 'screen2', order: 2 }, 'skip')
      primeRotation([
        fileScreen({ id: 'screen1', order: 1, isActive: true }),
        picked,
        fileScreen({ id: 'screen3', order: 3 }),
      ], picked)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen2' }, { renderSignal: 'skip' })
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, { pickedScreen: null })
    })

    it('keeps the Picked Screen\'s turn on a hold, serving its stored image, and still clears the pick', async () => {
      const picked = htmlScreen({ id: 'screen2', order: 2 }, 'hold')
      primeRotation([
        fileScreen({ id: 'screen1', order: 1, isActive: true }),
        picked,
      ], picked)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, { pickedScreen: null })
    })

    it('is held, not cleared, while the Device sleeps', async () => {
      const picked = fileScreen({ id: 'screen2', order: 2 })
      const sleeper = makeDevice({ ...pickedScreenDevice, sleepModeEnabled: true, sleepStartTime: 22 * 3600, sleepEndTime: 6 * 3600, sleepScreenEnabled: false, pickedScreen: picked })
      deviceRepo.findOneBy.mockResolvedValue(sleeper)
      screenRepo.findOneBy.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)

      vi.setSystemTime(new Date('2026-08-21T23:00:00'))
      await service.getCurrentImage(headers)

      expect(screenRepo.find).not.toHaveBeenCalled()
      expect(deviceRepo.update).not.toHaveBeenCalledWith({ id: sleeper.id }, { pickedScreen: null })
    })

    it('is served at the first poll after wake', async () => {
      const picked = fileScreen({ id: 'screen2', order: 2 })
      const sleeper = makeDevice({ ...pickedScreenDevice, sleepModeEnabled: true, sleepStartTime: 22 * 3600, sleepEndTime: 6 * 3600, sleepScreenEnabled: false, pickedScreen: picked })
      deviceRepo.findOneBy.mockResolvedValue(sleeper)
      screenRepo.find.mockResolvedValue([fileScreen({ id: 'screen1', order: 1, isActive: true }), picked])
      screenRepo.findOne.mockResolvedValue(null)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(true)

      vi.setSystemTime(new Date('2026-08-22T07:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: sleeper.id }, { pickedScreen: null })
    })

    describe('manual Rotation', () => {
      const manual = (overrides: Partial<Device> = {}) => Object.assign(pickedScreenDevice, { rotationMode: 'manual', ...overrides })

      afterEach(() => {
        Object.assign(pickedScreenDevice, { rotationMode: 'automatic' })
      })

      const threeScreens = () => [
        fileScreen({ id: 'screen1', order: 1 }),
        fileScreen({ id: 'screen2', order: 2, isActive: true }),
        fileScreen({ id: 'screen3', order: 3 }),
      ]

      it('re-serves the Active Screen on a timer poll', async () => {
        manual()
        primeRotation(threeScreens(), null)

        const result = await service.getCurrentImage(headers)

        expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
        expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen2' }, expect.objectContaining({ isActive: true }))
      })

      it('re-renders the Active Screen on a timer poll rather than holding it', async () => {
        manual()
        const active = makeScreen({ device: pickedScreenDevice, id: 'screen2', order: 2, type: 'html', html: '<p>live</p>', isActive: true, fetchManual: false, externalLink: null, generatedAt: new Date('2026-08-21T00:00:00') })
        primeRotation([fileScreen({ id: 'screen1', order: 1 }), active], null)
        const render = vi.spyOn(screenRender, 'renderBodyToScreenPng').mockResolvedValue('http://api/screens/devices/1/screen2.png')

        await service.getCurrentImage(headers)

        expect(render).toHaveBeenCalledTimes(1)
      })

      it('treats a poll without an Update-Source as a timer poll', async () => {
        manual()
        primeRotation(threeScreens(), null)

        const result = await service.getCurrentImage(headers)

        expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      })

      it.each(['button', 'EXT0', 'EXT1'])('advances one step on a %s press', async (source) => {
        manual()
        primeRotation(threeScreens(), null)

        const result = await service.getCurrentImage({ ...headers, 'update-source': source })

        expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      })

      it('serves the Picked Screen on a timer poll and clears the pick', async () => {
        manual()
        const picked = fileScreen({ id: 'screen3', order: 3 })
        primeRotation([fileScreen({ id: 'screen1', order: 1 }), fileScreen({ id: 'screen2', order: 2, isActive: true }), picked], picked)

        const result = await service.getCurrentImage(headers)

        expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
        expect(deviceRepo.update).toHaveBeenCalledWith({ id: '1' }, { pickedScreen: null })
      })

      it('advances to the next eligible Screen when the Active Screen has become ineligible', async () => {
        manual()
        primeRotation([
          fileScreen({ id: 'screen1', order: 1 }),
          fileScreen({ id: 'screen2', order: 2, isActive: true, schedule: { enabled: false } }),
          fileScreen({ id: 'screen3', order: 3 }),
        ], null)

        const result = await service.getCurrentImage(headers)

        expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      })

      it('starts Rotation on the first poll when no Screen is active', async () => {
        manual()
        primeRotation([fileScreen({ id: 'screen1', order: 1 }), fileScreen({ id: 'screen2', order: 2 })], null)

        const result = await service.getCurrentImage(headers)

        expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
      })

      it('still advances on a timer poll in automatic', async () => {
        manual({ rotationMode: 'automatic' })
        primeRotation(threeScreens(), null)

        const result = await service.getCurrentImage(headers)

        expect(result.image_url).toBe('http://api/screens/devices/1/screen3.png')
      })
    })
  })

  describe('render-signal-gated rotation', () => {
    const signalDevice = makeDevice({ ...baseDevice, apikey: 'token', id: '1', mirrorEnabled: false })

    /** A `plugin`, `html` or `mashup` Screen; the signal embeds the marker(s) `primePuppeteer` reads back as the flag(s). */
    function renderedScreen(overrides: Partial<Screen> & { id: string, order: number }, signal: 'skip' | 'hold' | 'both' | null): Screen {
      const body = signal === 'both'
        ? `<p>x</p><script>${SKIP_MARKER} = true; ${HOLD_MARKER} = true</script>`
        : signal
          ? `<p>x</p><script>${signal === 'skip' ? SKIP_MARKER : HOLD_MARKER} = true</script>`
          : '<p>x</p>'
      const base = overrides.type === 'plugin'
        ? { plugin: makePlugin({ id: `${overrides.id}-plugin` }), cachedPluginOutput: body, html: null }
        : overrides.type === 'mashup'
          ? { mashupConfiguration: makeMashupConfiguration({ id: `${overrides.id}-mashup`, slots: [makeMashupSlot({ id: `${overrides.id}-slot`, renderedMarkup: body })] }), cachedPluginOutput: body, html: null }
          : { type: 'html' as const, html: body }
      return makeScreen({ device: signalDevice, isActive: false, fetchManual: false, externalLink: null, filename: 'x', generatedAt: new Date('2026-08-21T00:00:00'), ...base, ...overrides })
    }

    function primeRotation(screens: Screen[]) {
      const byId = new Map(screens.map(screen => [screen.id, screen]))
      deviceRepo.findOneBy.mockResolvedValue(signalDevice)
      screenRepo.find.mockResolvedValue(screens)
      screenRepo.findOne.mockImplementation(async options => byId.get((options.where as { id: string }).id) ?? null)
      configService.get.mockReturnValue('http://api')
      fileExists.mockResolvedValue(false)
      fileModifiedAt.mockResolvedValue(new Date('2026-08-21T00:00:00'))
      injectPrivate(screenRender, 'mashupRenderer', { renderMashup: vi.fn() })
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-08-21T12:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it.each(['plugin', 'html', 'mashup'] as const)('skips a %s Screen that sets the flag and shows the next eligible one instead', async (type) => {
      primeRotation([
        renderedScreen({ id: 'screen1', order: 1, type }, 'skip'),
        renderedScreen({ id: 'screen2', order: 2, type }, null),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, { renderSignal: 'skip' })
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen2' }, expect.objectContaining({ isActive: true, renderSignal: null }))
    })

    it('wraps past the end of the rotation to find a Screen that does not skip', async () => {
      primeRotation([
        renderedScreen({ id: 'screen1', order: 1, type: 'plugin' }, null),
        renderedScreen({ id: 'screen2', order: 2, type: 'plugin', isActive: true }, null),
        renderedScreen({ id: 'screen3', order: 3, type: 'plugin' }, 'skip'),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
    })

    it('returns the no screen image and leaves nothing active when every eligible Screen skips', async () => {
      primeRotation([
        renderedScreen({ id: 'screen1', order: 1, type: 'plugin' }, 'skip'),
        renderedScreen({ id: 'screen2', order: 2, type: 'html' }, 'skip'),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('noScreen.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, { renderSignal: 'skip' })
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen2' }, { renderSignal: 'skip' })
      expect(screenRepo.update).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ isActive: true }))
    })

    it('does not overwrite the skipped Screen\'s stored image', async () => {
      primeRotation([
        renderedScreen({ id: 'screen1', order: 1, type: 'plugin' }, 'skip'),
        renderedScreen({ id: 'screen2', order: 2, type: 'plugin' }, null),
      ])

      await service.getCurrentImage(headers)

      // Only the shown Screen's render reaches a screenshot; the skip returns before one is taken.
      expect(puppeteerPage.screenshot).toHaveBeenCalledOnce()
      const { convertToPng } = await import('../../utils/imageUtils.js')
      expect(convertToPng).toHaveBeenCalledOnce()
      expect(convertToPng).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('screen2.png'), expect.anything(), expect.anything(), expect.anything())
    })

    it.each(['plugin', 'mashup'] as const)('does not launch Chrome for a %s Screen whose Render Signal is already remembered as skip', async (type) => {
      primeRotation([renderedScreen({ id: 'screen1', order: 1, type, renderSignal: 'skip' }, null)])

      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('noScreen.png')
      expect(puppeteerLaunch).not.toHaveBeenCalled()
    })

    it('evaluates a raw html Screen fresh on every poll, even though its last verdict was skip', async () => {
      primeRotation([renderedScreen({ id: 'screen1', order: 1, type: 'html', renderSignal: 'skip' }, null)])

      const result = await service.getCurrentImage(headers)

      expect(puppeteerLaunch).toHaveBeenCalled()
      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, expect.objectContaining({ isActive: true, renderSignal: null }))
    })

    it('never renders a schedule-ineligible Screen to look for a signal', async () => {
      primeRotation([
        renderedScreen({ id: 'screen1', order: 1, type: 'plugin', schedule: makeSchedule({ enabled: false }) }, 'skip'),
        renderedScreen({ id: 'screen2', order: 2, type: 'plugin' }, null),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(puppeteerLaunch).toHaveBeenCalledOnce()
    })

    it.each(['plugin', 'html', 'mashup'] as const)('holds a %s Screen that sets the flag: Active on its turn, serving the stored image unchanged', async (type) => {
      primeRotation([renderedScreen({ id: 'screen1', order: 1, type }, 'hold')])
      fileExists.mockResolvedValue(true)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
      expect(result.filename).toBe(`x_${new Date('2026-08-21T00:00:00').toISOString()}`)
      // The screenshot never happens: honouring the signal returns before one is taken.
      expect(puppeteerPage.screenshot).not.toHaveBeenCalled()
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, { isActive: true, renderSignal: 'hold' })
    })

    it('holds a Screen with no stored image yet: still Active, serving the noScreen fallback', async () => {
      primeRotation([renderedScreen({ id: 'screen1', order: 1, type: 'plugin' }, 'hold')])
      fileExists.mockResolvedValue(false)

      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('noScreen.png')
      expect(result.image_url).toBe('http://api/screens/noScreen.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, { isActive: true, renderSignal: 'hold' })
    })

    it('treats a Screen that sets both flags as skip, not hold', async () => {
      primeRotation([
        renderedScreen({ id: 'screen1', order: 1, type: 'plugin' }, 'both'),
        renderedScreen({ id: 'screen2', order: 2, type: 'plugin' }, null),
      ])

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen2.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, { renderSignal: 'skip' })
    })

    it.each(['plugin', 'mashup'] as const)('does not launch Chrome for a %s Screen whose Render Signal is already remembered as hold, serving the stored image', async (type) => {
      primeRotation([renderedScreen({ id: 'screen1', order: 1, type, renderSignal: 'hold' }, null)])
      fileExists.mockResolvedValue(true)

      const result = await service.getCurrentImage(headers)

      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
      expect(puppeteerLaunch).not.toHaveBeenCalled()
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, { isActive: true, renderSignal: 'hold' })
    })

    it('evaluates a raw html Screen fresh on every poll, even though its last verdict was hold', async () => {
      primeRotation([renderedScreen({ id: 'screen1', order: 1, type: 'html', renderSignal: 'hold' }, null)])

      const result = await service.getCurrentImage(headers)

      expect(puppeteerLaunch).toHaveBeenCalled()
      expect(result.image_url).toBe('http://api/screens/devices/1/screen1.png')
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, expect.objectContaining({ isActive: true, renderSignal: null }))
    })

    it('names a freshly held Screen\'s filename by when its image was last written, not by the cache refresh that triggered this hold', async () => {
      const screen = renderedScreen({ id: 'screen1', order: 1, type: 'plugin', generatedAt: new Date('2026-08-21T06:00:00') }, 'hold')
      primeRotation([screen])
      fileExists.mockResolvedValue(true)
      fileModifiedAt.mockResolvedValue(new Date('2026-08-20T00:00:00'))

      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe(`x_${new Date('2026-08-20T00:00:00').toISOString()}`)
    })

    it('keeps the filename stable across a cache refresh that holds again', async () => {
      const screen = renderedScreen({ id: 'screen1', order: 1, type: 'plugin' }, 'hold')
      primeRotation([screen])
      fileExists.mockResolvedValue(true)
      // The stored image file is never rewritten while held, so its mtime never advances.
      fileModifiedAt.mockResolvedValue(new Date('2026-08-20T00:00:00'))

      const first = await service.getCurrentImage(headers)
      // An external cache writer (scheduler tick, Webhook, Plugin edit) refreshes the
      // content and clears the remembered verdict; the render it triggers at this
      // Screen's next turn holds again.
      screen.renderSignal = null
      screen.cachedPluginOutput = `<p>y</p><script>${HOLD_MARKER} = true</script>`
      const second = await service.getCurrentImage(headers)

      expect(first.filename).toBe(`x_${new Date('2026-08-20T00:00:00').toISOString()}`)
      expect(second.filename).toBe(first.filename)
    })

    it('regenerates the image and changes the filename once the content stops setting the flag', async () => {
      const screen = renderedScreen({ id: 'screen1', order: 1, type: 'plugin', generatedAt: new Date('2026-08-21T06:00:00') }, 'hold')
      primeRotation([screen])
      fileExists.mockResolvedValue(true)
      fileModifiedAt.mockResolvedValue(new Date('2026-08-20T00:00:00'))

      const held = await service.getCurrentImage(headers)
      // An external cache writer refreshes the content, now without the flag, bumping generatedAt.
      screen.renderSignal = null
      screen.generatedAt = new Date('2026-08-21T09:00:00')
      screen.cachedPluginOutput = '<p>y</p>'
      const resumed = await service.getCurrentImage(headers)

      expect(held.filename).toBe(`x_${new Date('2026-08-20T00:00:00').toISOString()}`)
      expect(resumed.filename).toBe(`x_${new Date('2026-08-21T09:00:00').toISOString()}`)
      expect(screenRepo.update).toHaveBeenCalledWith({ id: 'screen1' }, expect.objectContaining({ isActive: true, renderSignal: null }))
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
      expect(fallbackScreens.urlFor).toHaveBeenCalledWith({ kind: 'sleep' }, device, { model: OG_PLUS, palette: GRAY_4 })
    })

    it('serves the Device\'s own sleep image instead of the shared Fallback Screen when it has one', async () => {
      const sleepImageGeneratedAt = new Date('2026-08-20T00:00:00Z')
      const device = makeDevice({ ...sleepingDevice, sleepScreenEnabled: true, sleepImageGeneratedAt })
      deviceRepo.findOneBy.mockResolvedValue(device)

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe(`sleep-image_${sleepImageGeneratedAt.toISOString()}`)
      expect(result.image_url).toBe(`http://api/screens/devices/1/sleep-image.png`)
      expect(fallbackScreens.urlFor).not.toHaveBeenCalled()
    })

    it('falls back to the shared Sleep Fallback Screen when the Device\'s own sleep image has gone missing from disk', async () => {
      const device = makeDevice({ ...sleepingDevice, sleepScreenEnabled: true, sleepImageGeneratedAt: new Date('2026-08-20T00:00:00Z') })
      deviceRepo.findOneBy.mockResolvedValue(device)
      fileExists.mockResolvedValue(false)

      vi.setSystemTime(new Date('2026-08-22T23:00:00'))
      const result = await service.getCurrentImage(headers)

      expect(result.filename).toBe('sleep.png')
      expect(result.image_url).toBe('http://api/screens/sleep.png')
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

      it('serves the Device\'s own sleep image instead of the shared Fallback Screen when it has one', async () => {
        const sleepImageGeneratedAt = new Date('2026-08-20T00:00:00Z')
        const device = makeDevice({ ...sleepingDevice, sleepScreenEnabled: true, sleepImageGeneratedAt })
        deviceRepo.findOneBy.mockResolvedValue(device)

        vi.setSystemTime(new Date('2026-08-22T23:00:00'))
        const result = await service.getCurrentImageWithoutProgressing(headers)

        expect(result.filename).toBe(`sleep-image_${sleepImageGeneratedAt.toISOString()}`)
        expect(result.image_url).toBe(`http://api/screens/devices/1/sleep-image.png`)
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

  describe('the last-served record', () => {
    const POLLED_AT = new Date('2026-08-22T12:00:00')
    const ASLEEP_AT = new Date('2026-08-22T23:00:00')
    const device = makeDevice({ ...baseDevice, deviceModel: OG_PLUS, specialFunction: 'none' })
    const mirrored = makeDevice({ ...device, mirrorEnabled: true, mirrorMac: 'other-mac', mirrorApikey: 'mirror-token' })
    const sleeper = makeDevice({ ...device, sleepModeEnabled: true, sleepStartTime: 22 * 3600, sleepEndTime: 6 * 3600 })
    const shown = makeScreen({ id: 'screen1', order: 1, device, isActive: true, filename: 'Calendar' })
    const next = makeScreen({ id: 'screen2', order: 2, device, filename: 'Weather' })
    const nextFilename = 'Weather_2026-01-01T00:00:00.000Z'

    const answerBase = { action: 'none', firmware_url: '', refresh_rate: 60, reset_firmware: false, special_function: 'none', temperature_profile: 'default', update_firmware: false }
    const recordBase = { lastServedAt: POLLED_AT, lastServedScreenId: null, lastServedFallback: null, lastServedReason: null, lastServedRefreshRate: 60 }
    const errorAnswer = { ...answerBase, filename: nextFilename, image_url: 'http://api/screens/error.png' }
    const renderFailedRecord = { ...recordBase, lastServedKind: 'fallback', lastServedFallback: 'error', lastServedReason: 'renderFailed', lastServedScreenId: 'screen2', lastServedImagePath: '/screens/error.png' }

    function primeNext(overrides: Partial<Screen>) {
      const screen = makeScreen({ ...next, ...overrides })
      deviceRepo.findOneBy.mockResolvedValue(makeDevice(device))
      screenRepo.find.mockResolvedValue([makeScreen(shown), screen])
      screenRepo.findOne.mockResolvedValue(screen)
    }

    interface ServedCase {
      name: string
      at?: Date
      prime: () => void
      answer: Record<string, unknown>
      record: Record<string, unknown>
    }

    const cases: ServedCase[] = [
      {
        name: 'a Screen',
        prime: () => {
          primeNext({})
          fileExists.mockResolvedValue(true)
        },
        answer: { ...answerBase, filename: nextFilename, image_url: 'http://api/screens/devices/1/screen2.png' },
        record: { ...recordBase, lastServedKind: 'screen', lastServedScreenId: 'screen2', lastServedImagePath: '/screens/devices/1/screen2.png' },
      },
      {
        name: 'the no-screen Fallback Screen, without Screens',
        prime: () => {
          deviceRepo.findOneBy.mockResolvedValue(makeDevice(device))
          screenRepo.find.mockResolvedValue([])
        },
        answer: { ...answerBase, filename: 'noScreen.png', image_url: 'http://api/screens/noScreen.png' },
        record: { ...recordBase, lastServedKind: 'fallback', lastServedFallback: 'noScreen', lastServedReason: 'noScreens', lastServedImagePath: '/screens/noScreen.png' },
      },
      {
        name: 'the no-screen Fallback Screen, with every Screen passed over',
        prime: () => {
          deviceRepo.findOneBy.mockResolvedValue(makeDevice(device))
          screenRepo.find.mockResolvedValue([makeScreen({ ...next, schedule: makeSchedule({ enabled: false }) })])
        },
        answer: { ...answerBase, filename: 'noScreen.png', image_url: 'http://api/screens/noScreen.png' },
        record: { ...recordBase, lastServedKind: 'fallback', lastServedFallback: 'noScreen', lastServedReason: 'noneEligible', lastServedImagePath: '/screens/noScreen.png' },
      },
      {
        name: 'the error Fallback Screen, for a File Screen whose image is missing',
        prime: () => {
          primeNext({})
          fileExists.mockResolvedValue(false)
        },
        answer: errorAnswer,
        record: renderFailedRecord,
      },
      {
        name: 'the error Fallback Screen, for a Mashup that failed to render',
        prime: () => {
          primeNext({ type: 'mashup', mashupConfiguration: makeMashupConfiguration({ id: 'config-1', slots: [] }) })
          injectPrivate(screenRender, 'mashupRenderer', { renderMashup: vi.fn().mockRejectedValue(new Error('Render failed')) })
        },
        answer: errorAnswer,
        record: renderFailedRecord,
      },
      {
        name: 'the error Fallback Screen, for a Plugin whose cached output failed to render',
        prime: () => {
          primeNext({ type: 'plugin', plugin: makePlugin({ id: 'p1' }), cachedPluginOutput: '<span>cached</span>' })
          puppeteerPage.setContent.mockRejectedValue(new Error('Render failed'))
        },
        answer: errorAnswer,
        record: renderFailedRecord,
      },
      {
        name: 'the error Fallback Screen, for a Plugin that failed to render on demand',
        prime: () => {
          primeNext({ type: 'plugin', plugin: makePlugin({ id: 'p1', dataSources: [makePluginDataSource()], templates: [makePluginTemplate()] }) })
          injectPrivate(service, 'pluginTemplateContext', createPluginTemplateContextService({}, { resolveAll: vi.fn().mockRejectedValue(new Error('Fetch failed')) }))
        },
        answer: errorAnswer,
        record: renderFailedRecord,
      },
      {
        name: 'the error Fallback Screen, for an External link that could not be fetched',
        prime: () => {
          primeNext({ externalLink: 'http://example.com/image.jpg', fetchManual: false })
          vi.mocked(downloadImage).mockRejectedValue(new Error('Unreachable'))
        },
        answer: errorAnswer,
        record: renderFailedRecord,
      },
      {
        name: 'the mirrored image',
        prime: () => {
          deviceRepo.findOneBy.mockResolvedValue(makeDevice(mirrored))
          mockFetch.mockResolvedValueOnce(jsonResponse({ filename: 'trmnl-image', image_url: 'http://example.com/image.jpg', refresh_rate: 30 }))
        },
        answer: { ...answerBase, firmware_url: null, filename: 'trmnl-image', image_url: 'http://api/screens/devices/1/mirror.png' },
        record: { ...recordBase, lastServedKind: 'mirror', lastServedImagePath: '/screens/devices/1/mirror.png' },
      },
      {
        name: 'the mirrored image on a Proxied Device, at the refresh rate TRMNL gave',
        prime: () => {
          deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...mirrored, mirrorMac: 'mac' }))
          mockFetch.mockResolvedValueOnce(jsonResponse({ filename: 'trmnl-image', image_url: 'http://example.com/image.jpg', refresh_rate: 1800 }))
        },
        answer: { ...answerBase, firmware_url: null, filename: 'trmnl-image', image_url: 'http://api/screens/devices/1/mirror.png', refresh_rate: 1800 },
        record: { ...recordBase, lastServedKind: 'mirror', lastServedImagePath: '/screens/devices/1/mirror.png', lastServedRefreshRate: 1800 },
      },
      {
        name: 'the error Fallback Screen, for a failed mirror fetch',
        prime: () => {
          deviceRepo.findOneBy.mockResolvedValue(makeDevice(mirrored))
          mockFetch.mockRejectedValueOnce(new Error('TRMNL unreachable'))
        },
        answer: { ...answerBase, firmware_url: null, filename: 'error.png', image_url: 'http://api/screens/error.png' },
        record: { ...recordBase, lastServedKind: 'fallback', lastServedFallback: 'error', lastServedReason: 'mirrorFailed', lastServedImagePath: '/screens/error.png' },
      },
      {
        name: 'the sleep Fallback Screen while asleep, until the window ends',
        at: ASLEEP_AT,
        prime: () => deviceRepo.findOneBy.mockResolvedValue(makeDevice({ ...sleeper, sleepScreenEnabled: true })),
        answer: { ...answerBase, filename: 'sleep.png', image_url: 'http://api/screens/sleep.png', refresh_rate: 7 * 3600 },
        record: { ...recordBase, lastServedAt: ASLEEP_AT, lastServedKind: 'fallback', lastServedFallback: 'sleep', lastServedReason: 'asleep', lastServedImagePath: '/screens/sleep.png', lastServedRefreshRate: 7 * 3600 },
      },
      {
        name: 'the Active Screen kept while asleep',
        at: ASLEEP_AT,
        prime: () => {
          deviceRepo.findOneBy.mockResolvedValue(makeDevice(sleeper))
          screenRepo.findOneBy.mockResolvedValue(makeScreen(shown))
          fileExists.mockResolvedValue(true)
        },
        answer: { ...answerBase, filename: 'Calendar_2026-01-01T00:00:00.000Z', image_url: 'http://api/screens/devices/1/screen1.png', refresh_rate: 7 * 3600 },
        record: { ...recordBase, lastServedAt: ASLEEP_AT, lastServedKind: 'screen', lastServedScreenId: 'screen1', lastServedReason: 'asleep', lastServedImagePath: '/screens/devices/1/screen1.png', lastServedRefreshRate: 7 * 3600 },
      },
      {
        name: 'the no-screen Fallback Screen while asleep with no Active Screen to keep',
        at: ASLEEP_AT,
        prime: () => {
          deviceRepo.findOneBy.mockResolvedValue(makeDevice(sleeper))
          screenRepo.findOneBy.mockResolvedValue(null)
          screenRepo.count.mockResolvedValue(2)
        },
        answer: { ...answerBase, filename: 'noScreen.png', image_url: 'http://api/screens/noScreen.png', refresh_rate: 7 * 3600 },
        record: { ...recordBase, lastServedAt: ASLEEP_AT, lastServedKind: 'fallback', lastServedFallback: 'noScreen', lastServedReason: 'noneEligible', lastServedImagePath: '/screens/noScreen.png', lastServedRefreshRate: 7 * 3600 },
      },
    ]

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      configService.get.mockReturnValue('http://api')
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function poll({ at = POLLED_AT, prime }: ServedCase): Promise<Display> {
      vi.setSystemTime(at)
      prime()
      return service.getCurrentImage(headers)
    }

    it.each(cases)('answers the Device as it did before the record existed when serving $name', async (served) => {
      expect({ ...await poll(served) }).toEqual(served.answer)
    })

    it('answers the Device even when the record cannot be written', async () => {
      deviceRepo.update.mockRejectedValue(new Error('connection lost'))

      expect({ ...await poll(cases[0]) }).toEqual(cases[0].answer)
    })

    it.each(cases)('records $name', async (served) => {
      await poll(served)

      expect(deviceRepo.update).toHaveBeenCalledExactlyOnceWith({ id: '1' }, served.record)
    })
  })
})
