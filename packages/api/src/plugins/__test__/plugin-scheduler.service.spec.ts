import type { Plugin } from '../entities/plugin.entity'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../services/plugin-renderer.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginSchedulerService } from '../services/plugin-scheduler.service'

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((_expression, _callback) => ({
      start: vi.fn(),
      stop: vi.fn(),
    })),
  },
}))

describe('pluginSchedulerService', () => {
  let service: PluginSchedulerService
  let mockDataFetcher: PluginDataFetcherService
  let mockRenderer: PluginRendererService

  beforeEach(() => {
    mockDataFetcher = {
      fetchData: vi.fn(),
    } as any

    mockRenderer = {
      render: vi.fn(),
      renderForDisplay: vi.fn(),
    } as any

    service = new PluginSchedulerService(mockDataFetcher, mockRenderer)
  })

  it('schedules a plugin with refresh interval', () => {
    const plugin = {
      id: 'plugin-1',
      refreshInterval: 15,
      isActive: true,
      dataSource: { url: 'https://api.example.com', method: 'GET' },
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
      dataSource: { url: 'https://api.example.com', method: 'GET' },
      templates: [{ layout: 'full', liquidMarkup: '{{ data }}' }],
    } as unknown as Plugin

    service.schedulePlugin(plugin)
    expect(service.hasScheduledJob('plugin-1')).toBe(true)

    service.removeScheduledJob('plugin-1')
    expect(service.hasScheduledJob('plugin-1')).toBe(false)
  })

  it('converts refresh interval to cron expression', () => {
    expect(service.getCronExpression(1)).toBe('*/1 * * * *')
    expect(service.getCronExpression(15)).toBe('*/15 * * * *')
    expect(service.getCronExpression(30)).toBe('*/30 * * * *')
    expect(service.getCronExpression(60)).toBe('0 * * * *')
  })
})
