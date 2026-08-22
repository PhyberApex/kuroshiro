import type { ConfigService } from '@nestjs/config'
import type { MockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService'
import type { Device } from '../../devices/devices.entity'
import type { Plugin } from '../../plugins/entities/plugin.entity'
import type { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import type { PluginTransformService } from '../../plugins/services/plugin-transform.service'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity'
import type { MashupSlot } from '../entities/mashup-slot.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceSensorsService, primeMockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService'
import { PluginTemplateContextService } from '../../plugins/services/plugin-template-context.service'
import { MashupRendererService } from '../services/mashup-renderer.service'

describe('mashupRendererService', () => {
  let service: MashupRendererService
  let pluginDataFetcher: PluginDataFetcherService
  let pluginRenderer: PluginRendererService
  let pluginTransformer: PluginTransformService
  let configService: ConfigService
  let deviceSensors: MockDeviceSensorsService

  beforeEach(() => {
    pluginDataFetcher = {
      fetchData: vi.fn(),
    } as any

    pluginRenderer = {
      render: vi.fn(),
    } as any

    pluginTransformer = {
      transform: vi.fn(),
    } as any

    configService = {
      get: vi.fn().mockReturnValue('http://api'),
    } as any

    deviceSensors = createMockDeviceSensorsService()
    primeMockDeviceSensorsService(deviceSensors)

    service = new MashupRendererService(
      pluginDataFetcher,
      pluginRenderer,
      pluginTransformer,
      configService,
      deviceSensors as any,
      new PluginTemplateContextService(),
    )

    vi.resetAllMocks()
    primeMockDeviceSensorsService(deviceSensors)
  })

  it('should render mashup with all plugins successful', async () => {
    const device = { id: 'device-1', width: 800, height: 480 } as Device

    const slots: MashupSlot[] = [
      {
        id: 'slot-1',
        position: 'top-left',
        size: 'view--quadrant',
        order: 0,
        plugin: {
          id: 'plugin-1',
          name: 'Weather',
          dataSources: [{ name: 'source', method: 'GET', url: 'http://api/weather' }],
          templates: [{ layout: 'full', liquidMarkup: '<div>Weather: {{temp}}</div>' }],
        } as Plugin,
      } as MashupSlot,
      {
        id: 'slot-2',
        position: 'top-right',
        size: 'view--quadrant',
        order: 1,
        plugin: {
          id: 'plugin-2',
          name: 'Calendar',
          dataSources: [{ name: 'source', method: 'GET', url: 'http://api/calendar' }],
          templates: [{ layout: 'full', liquidMarkup: '<div>Events: {{count}}</div>' }],
        } as Plugin,
      } as MashupSlot,
    ]

    const config: MashupConfiguration = {
      id: 'config-1',
      layout: '1Lx1R',
      slots,
    } as MashupConfiguration

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
    const device = { id: 'device-1', width: 800, height: 480 } as Device

    const slots: MashupSlot[] = [
      {
        id: 'slot-1',
        position: 'left',
        size: 'view--half_vertical',
        order: 0,
        plugin: {
          id: 'plugin-1',
          name: 'Working Plugin',
          dataSources: [{ name: 'source', method: 'GET', url: 'http://api/working' }],
          templates: [{ layout: 'full', liquidMarkup: '<div>Success</div>' }],
        } as Plugin,
      } as MashupSlot,
      {
        id: 'slot-2',
        position: 'right',
        size: 'view--half_vertical',
        order: 1,
        plugin: {
          id: 'plugin-2',
          name: 'Failing Plugin',
          dataSources: [{ name: 'source', method: 'GET', url: 'http://api/failing' }],
          templates: [{ layout: 'full', liquidMarkup: '<div>{{ source.error }}</div>' }],
        } as Plugin,
      } as MashupSlot,
    ]

    const config: MashupConfiguration = {
      id: 'config-1',
      layout: '1Lx1R',
      slots,
    } as MashupConfiguration

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
    const device = { id: 'device-1', width: 800, height: 480 } as Device

    const slots: MashupSlot[] = [
      {
        id: 'slot-1',
        position: 'left',
        size: 'view--half_vertical',
        order: 0,
        plugin: {
          id: 'plugin-1',
          name: 'Draft Plugin',
          dataSources: [],
          templates: [{ layout: 'full', liquidMarkup: '<div>Never rendered</div>' }],
        } as unknown as Plugin,
      } as MashupSlot,
    ]

    const config: MashupConfiguration = {
      id: 'config-1',
      layout: '1Lx1R',
      slots,
    } as MashupConfiguration

    const result = await service.renderMashup(config, device)

    expect(result).toContain('error.png')
    expect(pluginDataFetcher.fetchData).not.toHaveBeenCalled()
  })

  it('should build correct HTML structure for 2x2 layout', async () => {
    const device = { id: 'device-1', width: 800, height: 480 } as Device

    const slots: MashupSlot[] = [
      { position: 'top-left', size: 'view--quadrant', order: 0, plugin: { name: 'P1' } } as MashupSlot,
      { position: 'top-right', size: 'view--quadrant', order: 1, plugin: { name: 'P2' } } as MashupSlot,
      { position: 'bottom-left', size: 'view--quadrant', order: 2, plugin: { name: 'P3' } } as MashupSlot,
      { position: 'bottom-right', size: 'view--quadrant', order: 3, plugin: { name: 'P4' } } as MashupSlot,
    ]

    for (const slot of slots) {
      (slot.plugin as any).dataSources = [{ name: 'source', method: 'GET', url: 'http://api' }];
      (slot.plugin as any).templates = [{ layout: 'full', liquidMarkup: '<div>Test</div>' }]
    }

    const config: MashupConfiguration = {
      id: 'config-1',
      layout: '2x2',
      slots,
    } as MashupConfiguration

    pluginDataFetcher.fetchData = vi.fn().mockResolvedValue({})
    pluginRenderer.render = vi.fn().mockResolvedValue('<div>Test</div>')

    const result = await service.renderMashup(config, device)

    expect(result).toContain('class="mashup mashup--2x2"')
    expect(result.trim().startsWith('<div class="mashup')).toBe(true)
    expect(result).not.toContain('<html>')
  })

  it('returns device-independent body markup without a document shell', async () => {
    const device = { id: 'device-1', width: 800, height: 480 } as Device

    const slots: MashupSlot[] = [
      {
        position: 'top',
        size: 'view--half_horizontal',
        order: 0,
        plugin: {
          name: 'Test',
          dataSources: [{ name: 'source', method: 'GET', url: 'http://api' }],
          templates: [{ layout: 'full', liquidMarkup: '<div>Test</div>' }],
        } as Plugin,
      } as MashupSlot,
    ]

    const config: MashupConfiguration = {
      layout: '1Tx1B',
      slots,
    } as any

    pluginDataFetcher.fetchData = vi.fn().mockResolvedValue({})
    pluginRenderer.render = vi.fn().mockResolvedValue('<div>Test</div>')

    const result = await service.renderMashup(config, device)

    expect(result).toContain('class="mashup mashup--1Tx1B"')
    expect(result).not.toContain('<html>')
    expect(result).not.toContain('plugins.css')
  })
})
