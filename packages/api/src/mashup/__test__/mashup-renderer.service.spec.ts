import type { ConfigService } from '@nestjs/config'
import type { Device } from '../../devices/devices.entity'
import type { Plugin } from '../../plugins/entities/plugin.entity'
import type { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import type { PluginTransformService } from '../../plugins/services/plugin-transform.service'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity'
import type { MashupSlot } from '../entities/mashup-slot.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MashupRendererService } from '../services/mashup-renderer.service'

describe('mashupRendererService', () => {
  let service: MashupRendererService
  let pluginDataFetcher: PluginDataFetcherService
  let pluginRenderer: PluginRendererService
  let pluginTransformer: PluginTransformService
  let configService: ConfigService

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

    service = new MashupRendererService(
      pluginDataFetcher,
      pluginRenderer,
      pluginTransformer,
      configService,
    )

    vi.resetAllMocks()
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
          dataSource: { method: 'GET', url: 'http://api/weather' },
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
          dataSource: { method: 'GET', url: 'http://api/calendar' },
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

  it('should render partial mashup with error placeholder when plugin fails', async () => {
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
          dataSource: { method: 'GET', url: 'http://api/working' },
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
          dataSource: { method: 'GET', url: 'http://api/failing' },
          templates: [{ layout: 'full', liquidMarkup: '<div>{{data}}</div>' }],
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

    pluginRenderer.render = vi.fn().mockResolvedValue('<div>Success</div>')

    const result = await service.renderMashup(config, device)

    expect(result).toContain('Success')
    expect(result).toContain('error.png')
    expect(result).toContain('class="mashup mashup--1Lx1R"')
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
      (slot.plugin as any).dataSource = { method: 'GET', url: 'http://api' };
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
    expect(result).toContain('<html>')
    expect(result).toContain('<body class="environment trmnl">')
    expect(result).toContain('usetrmnl.com/css/latest/plugins.css')
    expect(result).toContain('usetrmnl.com/js/latest/plugins.js')
  })

  it('should include TRMNL CSS and JS in rendered output', async () => {
    const device = { id: 'device-1', width: 800, height: 480 } as Device

    const slots: MashupSlot[] = [
      {
        position: 'top',
        size: 'view--half_horizontal',
        order: 0,
        plugin: {
          name: 'Test',
          dataSource: { method: 'GET', url: 'http://api' },
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

    expect(result).toContain('<link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">')
    expect(result).toContain('<script src="https://usetrmnl.com/js/latest/plugins.js">')
  })
})
