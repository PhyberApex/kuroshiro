import type { Plugin } from '../entities/plugin.entity'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import type { PluginRenderCacheService } from '../services/plugin-render-cache.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginSchedulerService } from '../services/plugin-scheduler.service'

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
    } as any

    mockRenderCache = {
      renderAndCache: vi.fn(),
    } as any

    service = new PluginSchedulerService(mockDataFetcher, mockRenderCache)
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
