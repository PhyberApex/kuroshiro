import type { Plugin } from '../entities/plugin.entity'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import type { PluginRenderCacheService } from '../services/plugin-render-cache.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginSchedulerService } from '../services/plugin-scheduler.service'
import { PluginTemplateContextService } from '../services/plugin-template-context.service'

let capturedCallback: (() => Promise<void>) | undefined

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((_expression, callback) => {
      capturedCallback = callback
      return {
        start: vi.fn(),
        stop: vi.fn(),
      }
    }),
  },
}))

describe('pluginSchedulerService', () => {
  let service: PluginSchedulerService
  let mockDataFetcher: PluginDataFetcherService
  let mockRenderCache: PluginRenderCacheService

  beforeEach(() => {
    capturedCallback = undefined

    mockDataFetcher = {
      fetchData: vi.fn(),
      fetchOrLiteral: vi.fn((source: any, ctx: any) =>
        source.mode === 'literal'
          ? Promise.resolve(source.literalValue ?? null)
          : mockDataFetcher.fetchData(source.method, source.url ?? '', source.headers, source.body, ctx),
      ),
    } as any

    mockRenderCache = {
      renderAndCache: vi.fn(),
    } as any

    service = new PluginSchedulerService(mockDataFetcher, mockRenderCache, new PluginTemplateContextService())
  })

  it('schedules a plugin with refresh interval', () => {
    const plugin = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      dataSources: [{ name: 'source', url: 'https://api.example.com', method: 'GET' }],
      templates: [{ layout: 'full', liquidMarkup: '{{ data }}' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(true)
  })

  it('does not schedule inactive plugins', () => {
    const plugin = {
      id: 'plugin-1',
      isActive: false,
      refreshInterval: 15,
    } as unknown as Plugin

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('removes a scheduled job', () => {
    const plugin = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      dataSources: [{ name: 'source', url: 'https://api.example.com', method: 'GET' }],
      templates: [{ layout: 'full', liquidMarkup: '{{ data }}' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)
    expect(service.hasScheduledJob('plugin-1')).toBe(true)

    service.removeScheduledJob('plugin-1')
    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('converts refresh interval to cron expression', () => {
    expect((service as any).getCronExpression(1)).toBe('*/1 * * * *')
    expect((service as any).getCronExpression(15)).toBe('*/15 * * * *')
    expect((service as any).getCronExpression(30)).toBe('*/30 * * * *')
    expect((service as any).getCronExpression(60)).toBe('0 * * * *')
  })

  it('schedules multiple plugins independently', () => {
    const plugin1 = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      dataSources: [{ name: 'source', url: 'https://api1.com', method: 'GET' }],
      templates: [{ layout: 'full', liquidMarkup: 'Test 1' }],
    } as unknown as Plugin

    const plugin2 = {
      id: 'plugin-2',
      refreshInterval: 30,
      isActive: true,
      dataSources: [{ name: 'source', url: 'https://api2.com', method: 'GET' }],
      templates: [{ layout: 'full', liquidMarkup: 'Test 2' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin1)
    service.schedulePlugin(plugin2)

    expect(service.hasScheduledJob('plugin-1')).toBe(true)
    expect(service.hasScheduledJob('plugin-2')).toBe(true)
  })

  it('reschedules plugin after removal', () => {
    const plugin = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET' }],
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)
    expect(service.hasScheduledJob('plugin-1')).toBe(true)

    service.removeScheduledJob('plugin-1')
    expect(service.hasScheduledJob('plugin-1')).toBe(false)

    service.schedulePlugin(plugin)
    expect(service.hasScheduledJob('plugin-1')).toBe(true)
  })

  it('does not schedule if there are no data sources', () => {
    const plugin = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('does not schedule a draft plugin with zero data sources', () => {
    const plugin = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      dataSources: [],
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('does not schedule if templates are missing', () => {
    const plugin = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('does not schedule Webhook-kind plugins', () => {
    const plugin = {
      id: 'plugin-1',
      kind: 'Webhook',
      refreshInterval: 15,
      templates: [{ layout: 'full', liquidMarkup: 'Test' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)

    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  describe('scheduled tick', () => {
    it('fetches all data sources in parallel and renders them under their own names', async () => {
      const plugin = {
        id: 'plugin-1',
        name: 'Multi Source',
        refreshInterval: 15,
        isActive: true,
        dataSources: [
          { name: 'weather', url: 'https://api.example.com/weather', method: 'GET' },
          { name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' },
        ],
        templates: [{ layout: 'full', liquidMarkup: '{{ weather.temp }} / {{ air_quality.aqi }}' }],
      } as unknown as Plugin

      let resolveWeather: (value: any) => void
      let resolveAirQuality: (value: any) => void
      const weatherPromise = new Promise((resolve) => {
        resolveWeather = resolve
      })
      const airQualityPromise = new Promise((resolve) => {
        resolveAirQuality = resolve
      })

      mockDataFetcher.fetchData = vi.fn((_method, url) => {
        return url.includes('weather') ? weatherPromise : airQualityPromise
      }) as any
      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      const tickPromise = capturedCallback!()

      // Both fetches were started before either resolved — proof they run in parallel, not sequentially
      expect(mockDataFetcher.fetchData).toHaveBeenCalledTimes(2)

      resolveAirQuality!({ aqi: 42 })
      resolveWeather!({ temp: 25 })
      await tickPromise

      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ weather: { temp: 25 }, air_quality: { aqi: 42 } }),
      )
    })

    it('schedules a plugin with only literal-mode data sources and renders its stored value without calling the data fetcher', async () => {
      const plugin = {
        id: 'plugin-1',
        name: 'Literal Only',
        refreshInterval: 15,
        isActive: true,
        dataSources: [
          { name: 'source', mode: 'literal', literalValue: { title: 'Hello' } },
        ],
        templates: [{ layout: 'full', liquidMarkup: '{{ source.title }}' }],
      } as unknown as Plugin

      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      expect(service.hasScheduledJob('plugin-1')).toBe(true)

      await capturedCallback!()

      expect(mockDataFetcher.fetchData).not.toHaveBeenCalled()
      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ source: { title: 'Hello' } }),
      )
    })

    it('renders a mixed plugin with one fetch and one literal source, without fetching the literal one', async () => {
      const plugin = {
        id: 'plugin-1',
        name: 'Mixed',
        refreshInterval: 15,
        isActive: true,
        dataSources: [
          { name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', method: 'GET' },
          { name: 'title', mode: 'literal', literalValue: 'Static Title' },
        ],
        templates: [{ layout: 'full', liquidMarkup: '{{ title }} {{ weather.temp }}' }],
      } as unknown as Plugin

      mockDataFetcher.fetchData = vi.fn().mockResolvedValue({ temp: 25 })
      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockDataFetcher.fetchData).toHaveBeenCalledTimes(1)
      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ weather: { temp: 25 }, title: 'Static Title' }),
      )
    })

    it('gives a failing fetch-mode source an error marker while a literal-mode source alongside it still renders normally', async () => {
      const plugin = {
        id: 'plugin-1',
        name: 'Mixed Partial Failure',
        refreshInterval: 15,
        isActive: true,
        dataSources: [
          { name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', method: 'GET' },
          { name: 'title', mode: 'literal', literalValue: 'Static Title' },
        ],
        templates: [{ layout: 'full', liquidMarkup: '{{ title }}' }],
      } as unknown as Plugin

      mockDataFetcher.fetchData = vi.fn().mockRejectedValue(new Error('API timeout'))
      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({
          weather: { error: true, message: 'API timeout' },
          title: 'Static Title',
        }),
      )
    })

    it('gives a failing data source an error marker and still renders the sources that succeeded', async () => {
      const plugin = {
        id: 'plugin-1',
        name: 'Partial Failure',
        refreshInterval: 15,
        isActive: true,
        dataSources: [
          { name: 'weather', url: 'https://api.example.com/weather', method: 'GET' },
          { name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' },
        ],
        templates: [{ layout: 'full', liquidMarkup: '{{ weather.temp }}' }],
      } as unknown as Plugin

      mockDataFetcher.fetchData = vi.fn((_method, url) => {
        return url.includes('weather')
          ? Promise.resolve({ temp: 25 })
          : Promise.reject(new Error('API timeout'))
      }) as any
      mockRenderCache.renderAndCache = vi.fn().mockResolvedValue(undefined)

      service.schedulePlugin(plugin)
      await capturedCallback!()

      expect(mockRenderCache.renderAndCache).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({
          weather: { temp: 25 },
          air_quality: { error: true, message: 'API timeout' },
        }),
      )
    })
  })
})
