import type { ConfigService } from '@nestjs/config'
import type { MockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService'
import type { DeviceSensorsService } from '../../device-sensors/device-sensors.service'
import type { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import type { PluginTransformService } from '../../plugins/services/plugin-transform.service'
import type { MockPluginDataFetcherService, MockPluginRendererService, MockPluginTransformService } from '../../test/mockPluginCollaborators'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceSensorsService, primeMockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService'
import { PluginTemplateContextService } from '../../plugins/services/plugin-template-context.service'
import { makeDevice, makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginDataSource, makePluginTemplate } from '../../test/fixtures'
import { createMockPluginDataFetcherService, createMockPluginRendererService, createMockPluginTransformService } from '../../test/mockPluginCollaborators'
import { asService } from '../../test/mockService'
import { MashupRendererService } from '../services/mashup-renderer.service'

describe('mashupRendererService', () => {
  let service: MashupRendererService
  let pluginDataFetcher: MockPluginDataFetcherService
  let pluginRenderer: MockPluginRendererService
  let pluginTransformer: MockPluginTransformService
  let configService: { get: ReturnType<typeof vi.fn> }
  let deviceSensors: MockDeviceSensorsService

  beforeEach(() => {
    pluginDataFetcher = createMockPluginDataFetcherService()
    pluginRenderer = createMockPluginRendererService()
    pluginTransformer = createMockPluginTransformService()

    configService = {
      get: vi.fn().mockReturnValue('http://api'),
    }

    deviceSensors = createMockDeviceSensorsService()
    primeMockDeviceSensorsService(deviceSensors)

    service = new MashupRendererService(
      asService<PluginDataFetcherService>(pluginDataFetcher),
      asService<PluginRendererService>(pluginRenderer),
      asService<PluginTransformService>(pluginTransformer),
      asService<ConfigService>(configService),
      asService<DeviceSensorsService>(deviceSensors),
      new PluginTemplateContextService(),
    )

    vi.resetAllMocks()
    primeMockDeviceSensorsService(deviceSensors)
  })

  it('should render mashup with all plugins successful', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })

    const config: MashupConfiguration = makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        makeMashupSlot({
          id: 'slot-1',
          position: 'top-left',
          size: 'view--quadrant',
          order: 0,
          plugin: makePlugin({
            id: 'plugin-1',
            name: 'Weather',
            dataSources: [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://api/weather' })],
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>Weather: {{temp}}</div>' })],
          }),
        }),
        makeMashupSlot({
          id: 'slot-2',
          position: 'top-right',
          size: 'view--quadrant',
          order: 1,
          plugin: makePlugin({
            id: 'plugin-2',
            name: 'Calendar',
            dataSources: [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://api/calendar' })],
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>Events: {{count}}</div>' })],
          }),
        }),
      ],
    })

    pluginDataFetcher.fetchData = vi.fn().mockResolvedValue({ temp: '72F', count: 5 })
    pluginRenderer.render = vi.fn()
      .mockResolvedValueOnce('<div>Weather: 72F</div>')
      .mockResolvedValueOnce('<div>Events: 5</div>')

    const result = await service.renderMashup(config, device)

    expect(result).toContain('class="mashup mashup--1Lx1R"')
    expect(result).toContain('class="view view--quadrant"')
    expect(result).toContain('Weather: 72F')
    expect(result).toContain('Events: 5')
    expect(pluginDataFetcher.fetchData).toHaveBeenCalledTimes(2)
    expect(pluginRenderer.render).toHaveBeenCalledTimes(2)
  })

  it('gives a failing data source an error marker instead of aborting its slot render (ADR-0005)', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })

    const config: MashupConfiguration = makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        makeMashupSlot({
          id: 'slot-1',
          position: 'left',
          size: 'view--half_vertical',
          order: 0,
          plugin: makePlugin({
            id: 'plugin-1',
            name: 'Working Plugin',
            dataSources: [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://api/working' })],
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>Success</div>' })],
          }),
        }),
        makeMashupSlot({
          id: 'slot-2',
          position: 'right',
          size: 'view--half_vertical',
          order: 1,
          plugin: makePlugin({
            id: 'plugin-2',
            name: 'Failing Plugin',
            dataSources: [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://api/failing' })],
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>{{ source.error }}</div>' })],
          }),
        }),
      ],
    })

    pluginDataFetcher.fetchData = vi.fn()
      .mockResolvedValueOnce({ data: 'success' })
      .mockRejectedValueOnce(new Error('API timeout'))

    pluginRenderer.render = vi.fn()
      .mockResolvedValueOnce('<div>Success</div>')
      .mockResolvedValueOnce('<div>true</div>')

    const result = await service.renderMashup(config, device)

    expect(result).toContain('Success')
    expect(result).not.toContain('error.png')
    expect(pluginRenderer.render).toHaveBeenCalledWith(
      '<div>{{ source.error }}</div>',
      expect.objectContaining({ source: { error: true, message: 'API timeout' } }),
    )
  })

  it('falls back to the error placeholder when a slot has no data sources at all', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })

    const config: MashupConfiguration = makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        makeMashupSlot({
          id: 'slot-1',
          position: 'left',
          size: 'view--half_vertical',
          order: 0,
          plugin: makePlugin({
            id: 'plugin-1',
            name: 'Draft Plugin',
            dataSources: [],
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>Never rendered</div>' })],
          }),
        }),
      ],
    })

    const result = await service.renderMashup(config, device)

    expect(result).toContain('error.png')
    expect(pluginDataFetcher.fetchData).not.toHaveBeenCalled()
  })

  it('should build correct HTML structure for 2x2 layout', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })

    const slots = [
      makeMashupSlot({ position: 'top-left', size: 'view--quadrant', order: 0, plugin: makePlugin({ name: 'P1' }) }),
      makeMashupSlot({ position: 'top-right', size: 'view--quadrant', order: 1, plugin: makePlugin({ name: 'P2' }) }),
      makeMashupSlot({ position: 'bottom-left', size: 'view--quadrant', order: 2, plugin: makePlugin({ name: 'P3' }) }),
      makeMashupSlot({ position: 'bottom-right', size: 'view--quadrant', order: 3, plugin: makePlugin({ name: 'P4' }) }),
    ]

    for (const slot of slots) {
      slot.plugin.dataSources = [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://api' })]
      slot.plugin.templates = [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>Test</div>' })]
    }

    const config: MashupConfiguration = makeMashupConfiguration({
      id: 'config-1',
      layout: '2x2',
      slots,
    })

    pluginDataFetcher.fetchData = vi.fn().mockResolvedValue({})
    pluginRenderer.render = vi.fn().mockResolvedValue('<div>Test</div>')

    const result = await service.renderMashup(config, device)

    expect(result).toContain('class="mashup mashup--2x2"')
    expect(result.trim().startsWith('<div class="mashup')).toBe(true)
    expect(result).not.toContain('<html>')
  })

  it('returns device-independent body markup without a document shell', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })

    const config: MashupConfiguration = makeMashupConfiguration({
      layout: '1Tx1B',
      slots: [
        makeMashupSlot({
          position: 'top',
          size: 'view--half_horizontal',
          order: 0,
          plugin: makePlugin({
            name: 'Test',
            dataSources: [makePluginDataSource({ name: 'source', method: 'GET', url: 'http://api' })],
            templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>Test</div>' })],
          }),
        }),
      ],
    })

    pluginDataFetcher.fetchData = vi.fn().mockResolvedValue({})
    pluginRenderer.render = vi.fn().mockResolvedValue('<div>Test</div>')

    const result = await service.renderMashup(config, device)

    expect(result).toContain('class="mashup mashup--1Tx1B"')
    expect(result).not.toContain('<html>')
    expect(result).not.toContain('plugins.css')
  })
})
