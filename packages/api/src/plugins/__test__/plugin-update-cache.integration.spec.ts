import type { TestingModule } from '@nestjs/testing'
import type { Screen } from '../../screens/screens.entity.js'
import type { MockPluginDataFetcherService } from '../../test/mockPluginCollaborators.js'
import type { Plugin } from '../entities/plugin.entity.js'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MashupSlot as MashupSlotEntity } from '../../mashup/entities/mashup-slot.entity.js'
import { Screen as ScreenEntity } from '../../screens/screens.entity.js'
import { makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginDataSource, makePluginTemplate, makeScreen } from '../../test/fixtures.js'
import { createMockPluginDataFetcherService } from '../../test/mockPluginCollaborators.js'
import { DevicePlugin } from '../entities/device-plugin.entity.js'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { PluginVariable } from '../entities/plugin-variable.entity.js'
import { Plugin as PluginEntity } from '../entities/plugin.entity.js'
import { PluginsService } from '../plugins.service.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'
import { PluginSchedulerService } from '../services/plugin-scheduler.service.js'
import { PluginTemplateContextService } from '../services/plugin-template-context.service.js'

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

function matches(entity: unknown, where: Record<string, unknown>): boolean {
  const record = entity as Record<string, unknown>
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'id' in value)
      return (record[key] as { id?: unknown } | undefined)?.id === (value as { id: unknown }).id
    return record[key] === value
  })
}

describe('plugin update cache invalidation integration', () => {
  let pluginsService: PluginsService
  let scheduler: PluginSchedulerService
  let plugin: Plugin
  let screens: Screen[]
  let mockDataFetcher: MockPluginDataFetcherService

  beforeEach(async () => {
    capturedCallback = undefined

    plugin = makePlugin({
      id: 'plugin-1',
      name: 'Sensor Feed',
      kind: 'Poll',
      refreshInterval: 15,
      dataSources: [makePluginDataSource({ id: 'ds-1', name: 'reading', mode: 'fetch', url: 'https://api.example.com/reading', method: 'GET' })],
      templates: [makePluginTemplate({ id: 'template-1', layout: 'full', liquidMarkup: 'stale: {{ reading.value }}' })],
    })

    screens = [
      makeScreen({ id: 'screen-1', type: 'plugin', plugin: makePlugin({ id: 'plugin-1' }), cachedPluginOutput: 'stale output' }),
      makeScreen({ id: 'mashup-screen-1', type: 'mashup', cachedPluginOutput: 'stale mashup output' }),
    ]

    const mashupSlots = [
      makeMashupSlot({ id: 'slot-1', plugin: makePlugin({ id: 'plugin-1' }), mashupConfiguration: makeMashupConfiguration({ screen: makeScreen({ id: 'mashup-screen-1' }) }) }),
    ]

    const mashupSlotRepo = {
      find: vi.fn(async ({ where }: { where: Record<string, unknown> }) => mashupSlots.filter(slot => matches(slot, where))),
    }

    const screenRepo = {
      update: vi.fn(async (where: Record<string, unknown>, partial: Partial<Screen>) => {
        screens.filter(screen => matches(screen, where)).forEach(screen => Object.assign(screen, partial))
      }),
      manager: { getRepository: (name: string) => (name === 'MashupSlot' ? mashupSlotRepo : null) },
    }

    const templateRepo = {
      save: vi.fn(async (entity: unknown) => entity),
    }

    const pluginRepo = {
      findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => (matches(plugin, where) ? plugin : null)),
      save: vi.fn(async (entity: Plugin) => {
        Object.assign(plugin, entity)
        return plugin
      }),
      manager: { getRepository: (name: string) => (name === 'MashupSlot' ? mashupSlotRepo : null) },
    }

    mockDataFetcher = createMockPluginDataFetcherService()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginsService,
        PluginSchedulerService,
        PluginRenderCacheService,
        PluginRendererService,
        PluginTemplateContextService,
        { provide: PluginDataFetcherService, useValue: mockDataFetcher },
        { provide: getRepositoryToken(PluginEntity), useValue: pluginRepo },
        { provide: getRepositoryToken(DevicePlugin), useValue: {} },
        { provide: getRepositoryToken(ScreenEntity), useValue: screenRepo },
        { provide: getRepositoryToken(PluginDataSource), useValue: {} },
        { provide: getRepositoryToken(PluginTemplate), useValue: templateRepo },
        { provide: getRepositoryToken(PluginField), useValue: {} },
        { provide: getRepositoryToken(PluginVariable), useValue: {} },
        { provide: getRepositoryToken(MashupSlotEntity), useValue: mashupSlotRepo },
        { provide: PluginDataResolverService, useValue: {} },
      ],
    }).compile()

    pluginsService = module.get(PluginsService)
    scheduler = module.get(PluginSchedulerService)

    // Wait for lazy injection of mashupSlotRepository on both services
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  it('clears the direct Screen cache and Mashup caches on plugin update', async () => {
    await pluginsService.update('plugin-1', { name: 'Renamed Sensor Feed' })

    expect(screens[0].cachedPluginOutput).toBeNull()
    expect(screens[1].cachedPluginOutput).toBeNull()
  })

  it('re-fetches Data Sources and re-renders with the updated template on the next poll', async () => {
    // Simulate the Plugin already being scheduled with its pre-edit template
    scheduler.schedulePlugin(plugin)
    expect(capturedCallback).toBeDefined()

    await pluginsService.update('plugin-1', {
      templates: [{ layout: 'full', liquidMarkup: 'fresh: {{ reading.value }}' }],
    })

    // The update path cleared the cache rather than re-rendering inline
    expect(screens[0].cachedPluginOutput).toBeNull()

    mockDataFetcher.fetchData.mockResolvedValue({ value: 42 })

    // Re-scheduling after the update re-captured the cron callback against the updated Plugin
    await capturedCallback!()

    expect(mockDataFetcher.fetchData).toHaveBeenCalledWith('GET', 'https://api.example.com/reading', undefined, undefined, expect.anything())
    expect(screens[0].cachedPluginOutput).toBe('fresh: 42')
  })
})
