import type { TestingModule } from '@nestjs/testing'
import type { Plugin } from '../entities/plugin.entity'
import { UnprocessableEntityException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity'
import { Screen } from '../../screens/screens.entity'
import { DevicePlugin } from '../entities/device-plugin.entity'
import { PluginDataSource } from '../entities/plugin-data-source.entity'
import { PluginField } from '../entities/plugin-field.entity'
import { PluginTemplate } from '../entities/plugin-template.entity'
import { Plugin as PluginEntity } from '../entities/plugin.entity'
import { PluginsService } from '../plugins.service'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import { PluginRenderCacheService } from '../services/plugin-render-cache.service'
import { PluginRendererService } from '../services/plugin-renderer.service'
import { PluginSchedulerService } from '../services/plugin-scheduler.service'
import { PluginTransformService } from '../services/plugin-transform.service'
import { WebhookIngestService } from '../services/webhook-ingest.service'

function matches(entity: any, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'id' in value)
      return entity[key]?.id === value.id
    return entity[key] === value
  })
}

describe('webhook ingest integration', () => {
  let ingest: WebhookIngestService
  let pluginsService: PluginsService
  let plugin: Plugin
  let screens: any[]
  let mashupSlots: any[]

  const template = { layout: 'full', liquidMarkup: 'readings: {{ readings.size }} status: {{ status }}' }

  beforeEach(async () => {
    plugin = {
      id: 'plugin-1',
      name: 'Sensor Feed',
      kind: 'Webhook',
      refreshInterval: 15,
      webhookToken: 'token-abc',
      mergeStrategy: 'standard',
      streamLimit: null,
      webhookPayload: null,
      templates: [template],
    } as unknown as Plugin

    screens = [
      { id: 'screen-1', plugin: { id: 'plugin-1' }, cachedPluginOutput: 'stale' },
      { id: 'mashup-screen-1', plugin: null, cachedPluginOutput: 'stale mashup' },
    ]

    mashupSlots = [
      { id: 'slot-1', plugin: { id: 'plugin-1' }, mashupConfiguration: { screen: { id: 'mashup-screen-1' } } },
    ]

    const mashupSlotRepo = {
      find: vi.fn(async ({ where }: any) => mashupSlots.filter(slot => matches(slot, where))),
    }

    const screenRepo = {
      update: vi.fn(async (where: any, partial: any) => {
        screens.filter(screen => matches(screen, where)).forEach(screen => Object.assign(screen, partial))
      }),
      manager: { getRepository: (name: string) => (name === 'MashupSlot' ? mashupSlotRepo : null) },
    }

    const pluginRepo = {
      findOne: vi.fn(async ({ where }: any) => (matches(plugin, where) ? plugin : null)),
      findOneBy: vi.fn(async (where: any) => (matches(plugin, where) ? plugin : null)),
      save: vi.fn(async (entity: any) => entity),
      update: vi.fn(async (id: string, partial: any) => {
        if (id === plugin.id)
          Object.assign(plugin, partial)
      }),
      manager: { getRepository: (name: string) => (name === 'MashupSlot' ? mashupSlotRepo : null) },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookIngestService,
        PluginRenderCacheService,
        PluginRendererService,
        PluginsService,
        { provide: getRepositoryToken(PluginEntity), useValue: pluginRepo },
        { provide: getRepositoryToken(DevicePlugin), useValue: {} },
        { provide: getRepositoryToken(Screen), useValue: screenRepo },
        { provide: getRepositoryToken(PluginDataSource), useValue: {} },
        { provide: getRepositoryToken(PluginTemplate), useValue: {} },
        { provide: getRepositoryToken(PluginField), useValue: {} },
        { provide: getRepositoryToken(MashupSlot), useValue: mashupSlotRepo },
        { provide: PluginDataFetcherService, useValue: {} },
        { provide: PluginTransformService, useValue: {} },
        { provide: PluginSchedulerService, useValue: { schedulePlugin: vi.fn(), removeScheduledJob: vi.fn() } },
      ],
    }).compile()

    ingest = module.get(WebhookIngestService)
    pluginsService = module.get(PluginsService)

    // Wait for lazy injection of mashupSlotRepository
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  describe('standard merge strategy', () => {
    it('replaces the stored Webhook Payload outright', async () => {
      await ingest.ingest(plugin, { status: 'ok', readings: [1, 2] })
      await ingest.ingest(plugin, { status: 'degraded' })

      expect(plugin.webhookPayload).toEqual({ status: 'degraded' })
    })
  })

  describe('deep_merge merge strategy', () => {
    beforeEach(() => {
      plugin.mergeStrategy = 'deep_merge'
    })

    it('recursively merges nested objects', async () => {
      await ingest.ingest(plugin, { sensor: { name: 'attic', temp: 21 }, status: 'ok' })
      await ingest.ingest(plugin, { sensor: { temp: 23 } })

      expect(plugin.webhookPayload).toEqual({ sensor: { name: 'attic', temp: 23 }, status: 'ok' })
    })

    it('replaces a colliding array wholesale instead of concatenating', async () => {
      await ingest.ingest(plugin, { readings: [1, 2, 3] })
      await ingest.ingest(plugin, { readings: [9] })

      expect(plugin.webhookPayload).toEqual({ readings: [9] })
    })
  })

  describe('stream merge strategy', () => {
    beforeEach(() => {
      plugin.mergeStrategy = 'stream'
      plugin.streamLimit = 3
    })

    it('appends top-level arrays and replaces other keys normally', async () => {
      await ingest.ingest(plugin, { readings: [1], status: 'ok' })
      await ingest.ingest(plugin, { readings: [2], status: 'degraded' })

      expect(plugin.webhookPayload).toEqual({ readings: [1, 2], status: 'degraded' })
    })

    it('evicts the oldest entries once the Stream Limit is exceeded', async () => {
      await ingest.ingest(plugin, { readings: [1, 2] })
      await ingest.ingest(plugin, { readings: [3, 4] })

      expect(plugin.webhookPayload).toEqual({ readings: [2, 3, 4] })
    })

    it('evicts within a single oversized POST', async () => {
      await ingest.ingest(plugin, { readings: [1, 2, 3, 4, 5] })

      expect(plugin.webhookPayload).toEqual({ readings: [3, 4, 5] })
    })
  })

  describe('rendering', () => {
    it('renders the template against the full merged payload and caches it to every Screen', async () => {
      plugin.mergeStrategy = 'stream'
      plugin.streamLimit = 10

      await ingest.ingest(plugin, { readings: [1, 2], status: 'ok' })
      await ingest.ingest(plugin, { readings: [3] })

      expect(screens[0].cachedPluginOutput).toBe('readings: 3 status: ok')
    })

    it('invalidates Mashup caches that include the Plugin', async () => {
      await ingest.ingest(plugin, { status: 'ok' })

      expect(screens[1].cachedPluginOutput).toBeNull()
    })

    it('rejects with 422 and stores nothing when the Plugin has no template', async () => {
      plugin.templates = []

      await expect(ingest.ingest(plugin, { status: 'ok' })).rejects.toThrow(UnprocessableEntityException)
      expect(plugin.webhookPayload).toBeNull()
    })
  })

  describe('reading the stored payload', () => {
    it('returns the Webhook Payload as-is', async () => {
      await ingest.ingest(plugin, { status: 'ok', readings: [1, 2] })

      expect(ingest.readPayload(plugin)).toEqual({ status: 'ok', readings: [1, 2] })
    })

    it('returns null before the first POST', () => {
      expect(ingest.readPayload(plugin)).toBeNull()
    })
  })

  describe('clearing the stored payload', () => {
    it('empties the Webhook Payload without touching the webhook configuration', async () => {
      plugin.mergeStrategy = 'stream'
      plugin.streamLimit = 3
      await ingest.ingest(plugin, { readings: [1] })

      await pluginsService.clearWebhookPayload('plugin-1')

      expect(plugin.webhookPayload).toBeNull()
      expect(plugin.webhookToken).toBe('token-abc')
      expect(plugin.mergeStrategy).toBe('stream')
      expect(plugin.streamLimit).toBe(3)
    })
  })
})
