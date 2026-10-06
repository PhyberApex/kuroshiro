import type { ConfigService } from '@nestjs/config'
import type { MockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService.js'
import type { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service.js'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service.js'
import type { PluginTransformService } from '../../plugins/services/plugin-transform.service.js'
import type { MockPluginDataFetcherService, MockPluginRendererService, MockPluginTransformService } from '../../test/mockPluginCollaborators.js'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceSensorsService, primeMockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService.js'
import { PluginDataResolverService } from '../../plugins/services/plugin-data-resolver.service.js'
import { makeDevice, makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginDataSource, makePluginTemplate } from '../../test/fixtures.js'
import { createMockPluginDataFetcherService, createMockPluginRendererService, createMockPluginTransformService, createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { asService } from '../../test/mockService.js'
import { MashupRendererService } from '../services/mashup-renderer.service.js'

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

    const pluginDataResolver = new PluginDataResolverService(
      asService<PluginDataFetcherService>(pluginDataFetcher),
      asService<PluginTransformService>(pluginTransformer),
    )

    service = new MashupRendererService(
      asService<PluginRendererService>(pluginRenderer),
      asService<ConfigService>(configService),
      asService<DeviceSensorsService>(deviceSensors),
      createPluginTemplateContextService({}, pluginDataResolver),
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

  function draftSlotConfiguration(plugin: Plugin): MashupConfiguration {
    return makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [makeMashupSlot({ id: 'slot-1', position: 'left', size: 'view--half_vertical', order: 0, plugin })],
    })
  }

  it('renders a Poll-kind Plugin without Data Sources in its slot', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })
    const plugin = makePlugin({ id: 'plugin-1', name: 'Clock', dataSources: [], templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>Clock</div>' })] })
    pluginRenderer.render.mockResolvedValue('<div>Clock</div>')

    const result = await service.renderMashup(draftSlotConfiguration(plugin), device)

    expect(result).toContain('<div>Clock</div>')
    expect(result).not.toContain('error.png')
    expect(pluginDataFetcher.fetchData).not.toHaveBeenCalled()
  })

  it('falls back to the error placeholder when a slot\'s Plugin has no Template', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })
    const plugin = makePlugin({ id: 'plugin-1', name: 'Draft Plugin', dataSources: [makePluginDataSource({ name: 'source' })], templates: [] })

    const result = await service.renderMashup(draftSlotConfiguration(plugin), device)

    expect(result).toContain('error.png')
    expect(pluginDataFetcher.fetchData).not.toHaveBeenCalled()
  })

  it('renders a Webhook-kind Plugin from its Webhook Payload in its slot', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })
    const plugin = makePlugin({
      id: 'plugin-1',
      name: 'Feed',
      kind: 'Webhook',
      webhookPayload: { reading: 42 },
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>{{ reading }}</div>' })],
    })
    pluginRenderer.render.mockResolvedValue('<div>42</div>')

    const result = await service.renderMashup(draftSlotConfiguration(plugin), device)

    expect(result).toContain('<div>42</div>')
    expect(result).not.toContain('error.png')
    expect(pluginDataFetcher.fetchData).not.toHaveBeenCalled()
    expect(pluginRenderer.render).toHaveBeenCalledWith(
      '<div>{{ reading }}</div>',
      expect.objectContaining({ reading: 42 }),
    )
  })

  it.each([
    ['never POSTed to', undefined],
    ['cleared', null],
  ])('renders a Webhook-kind Plugin with an empty Webhook Payload (%s) from just trmnl and Field Values', async (_scenario, webhookPayload) => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })
    const plugin = makePlugin({
      id: 'plugin-1',
      name: 'Feed',
      kind: 'Webhook',
      webhookPayload,
      templates: [makePluginTemplate({ layout: 'full', liquidMarkup: '<div>{{ trmnl.plugin_settings.instance_name }}</div>' })],
    })
    pluginRenderer.render.mockResolvedValue('<div>Feed</div>')

    const result = await service.renderMashup(draftSlotConfiguration(plugin), device)

    expect(result).toContain('<div>Feed</div>')
    expect(result).not.toContain('error.png')
    expect(pluginDataFetcher.fetchData).not.toHaveBeenCalled()
  })

  it('falls back to the error placeholder when a Webhook-kind Plugin has no matching Template', async () => {
    const device = makeDevice({ id: 'device-1', width: 800, height: 480 })
    const plugin = makePlugin({ id: 'plugin-1', name: 'Feed', kind: 'Webhook', webhookPayload: { reading: 42 }, templates: [] })

    const result = await service.renderMashup(draftSlotConfiguration(plugin), device)

    expect(result).toContain('error.png')
    expect(pluginRenderer.render).not.toHaveBeenCalled()
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
