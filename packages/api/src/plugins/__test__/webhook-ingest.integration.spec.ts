import type { TestingModule } from '@nestjs/testing'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import type { Plugin } from '../entities/plugin.entity.js'
import { UnprocessableEntityException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { MashupSlot as MashupSlotEntity } from '../../mashup/entities/mashup-slot.entity.js'
import { Screen as ScreenEntity } from '../../screens/screens.entity.js'
import { makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginTemplate, makeScreen } from '../../test/fixtures.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockPluginFieldValuesService } from '../../test/mockPluginCollaborators.js'
import { DevicePlugin } from '../entities/device-plugin.entity.js'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { Plugin as PluginEntity } from '../entities/plugin.entity.js'
import { PluginsService } from '../plugins.service.js'
import { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'
import { PluginAssignmentsService } from '../services/plugin-assignments.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginDataSourceStateService } from '../services/plugin-data-source-state.service.js'
import { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
import { PluginRefreshService } from '../services/plugin-refresh.service.js'
import { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'
import { PluginSchedulerService } from '../services/plugin-scheduler.service.js'
import { PluginTemplateContextService } from '../services/plugin-template-context.service.js'
import { WebhookIngestService } from '../services/webhook-ingest.service.js'
import { WebhookIngestController } from '../webhook-ingest.controller.js'

function matches(entity: unknown, where: Record<string, unknown>): boolean {
  const record = entity as Record<string, unknown>
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'id' in value)
      return (record[key] as { id?: unknown } | undefined)?.id === (value as { id: unknown }).id
    return record[key] === value
  })
}

describe('webhook ingest integration', () => {
  let ingest: WebhookIngestService
  let module: TestingModule
  let plugin: Plugin
  let screens: Screen[]
  let mashupSlots: MashupSlot[]

  const template = { layout: 'full', liquidMarkup: 'readings: {{ readings.size }} status: {{ status }}' }

  beforeEach(async () => {
    plugin = makePlugin({
      id: 'plugin-1',
      name: 'Sensor Feed',
      kind: 'Webhook',
      refreshInterval: 15,
      webhookToken: 'token-abc',
      mergeStrategy: 'standard',
      streamLimit: null,
      webhookPayload: null,
      templates: [makePluginTemplate(template)],
    })

    screens = [
      makeScreen({ id: 'screen-1', type: 'plugin', plugin: makePlugin({ id: 'plugin-1' }), cachedPluginOutput: 'stale' }),
      makeScreen({ id: 'mashup-screen-1', type: 'mashup', cachedPluginOutput: 'stale mashup' }),
    ]

    mashupSlots = [
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

    const pluginRepo = {
      findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => (matches(plugin, where) ? plugin : null)),
      findOneBy: vi.fn(async (where: Record<string, unknown>) => (matches(plugin, where) ? plugin : null)),
      save: vi.fn(async (entity: Plugin) => entity),
      update: vi.fn(async (id: string, partial: Partial<Plugin>) => {
        if (id === plugin.id)
          Object.assign(plugin, partial)
      }),
      manager: { getRepository: (name: string) => (name === 'MashupSlot' ? mashupSlotRepo : null) },
    }

    module = await Test.createTestingModule({
      providers: [
        WebhookIngestService,
        PluginRenderCacheService,
        PluginRendererService,
        InstanceTimeZone,
        PluginsService,
        PluginRefreshService,
        PluginTemplateContextService,
        { provide: DataSourceFetchOutcomeService, useValue: {} },
        { provide: PluginDataSourceStateService, useValue: {} },
        { provide: getRepositoryToken(PluginEntity), useValue: pluginRepo },
        { provide: getRepositoryToken(DevicePlugin), useValue: {} },
        { provide: getRepositoryToken(ScreenEntity), useValue: screenRepo },
        { provide: getRepositoryToken(PluginDataSource), useValue: {} },
        { provide: getRepositoryToken(PluginTemplate), useValue: {} },
        { provide: getRepositoryToken(PluginField), useValue: {} },
        { provide: PluginFieldValuesService, useValue: createMockPluginFieldValuesService() },
        { provide: PluginAssignmentsService, useValue: {} },
        { provide: getRepositoryToken(MashupSlotEntity), useValue: mashupSlotRepo },
        { provide: PluginDataResolverService, useValue: {} },
        { provide: PluginSchedulerService, useValue: { schedulePlugin: vi.fn(), removeScheduledJob: vi.fn() } },
      ],
    }).compile()

    ingest = module.get(WebhookIngestService)

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

  describe('tRMNL merge_variables envelope', () => {
    it('stores what is inside the envelope and renders against it', async () => {
      plugin.templates = [makePluginTemplate({ layout: 'full', liquidMarkup: 'amount: {{ payment.amount }}' })]

      await ingest.ingest(plugin, { merge_variables: { payment: { amount: 5 } } })

      expect(plugin.webhookPayload).toEqual({ payment: { amount: 5 } })
      expect(ingest.readPayload(plugin)).toEqual({ payment: { amount: 5 } })
      expect(screens[0].cachedPluginOutput).toBe('amount: 5')
    })

    it('unwraps an array inside the envelope', async () => {
      await ingest.ingest(plugin, { merge_variables: [1, 2] })

      expect(plugin.webhookPayload).toEqual([1, 2])
    })

    it.each([['text'], [null], [7], [true]])('stores an envelope whose merge_variables is %j whole', async (value) => {
      await ingest.ingest(plugin, { merge_variables: value })

      expect(plugin.webhookPayload).toEqual({ merge_variables: value })
    })

    it('keeps the stream Merge Strategy and Stream Limit whatever the envelope says', async () => {
      plugin.mergeStrategy = 'stream'
      plugin.streamLimit = 3

      await ingest.ingest(plugin, { merge_variables: { readings: [1, 2] }, merge_strategy: 'standard', stream_limit: 10 })
      await ingest.ingest(plugin, { merge_variables: { readings: [1, 2] }, merge_strategy: 'standard', stream_limit: 10 })

      expect(plugin.webhookPayload).toEqual({ readings: [2, 1, 2] })
      expect(plugin.mergeStrategy).toBe('stream')
      expect(plugin.streamLimit).toBe(3)
    })

    it('does not deep-merge a standard Plugin when the envelope asks to', async () => {
      await ingest.ingest(plugin, { merge_variables: { sensor: { name: 'attic' } } })
      await ingest.ingest(plugin, { merge_variables: { sensor: { temp: 23 } }, deep_merge: true })

      expect(plugin.webhookPayload).toEqual({ sensor: { temp: 23 } })
    })

    it('deep-merges two enveloped POSTs on a deep_merge Plugin as two bare POSTs would', async () => {
      plugin.mergeStrategy = 'deep_merge'

      await ingest.ingest(plugin, { merge_variables: { sensor: { name: 'attic', temp: 21 }, status: 'ok' } })
      await ingest.ingest(plugin, { merge_variables: { sensor: { temp: 23 } } })

      expect(plugin.webhookPayload).toEqual({ sensor: { name: 'attic', temp: 23 }, status: 'ok' })
    })

    it('answers GET on the Webhook URL with the unwrapped value', async () => {
      const http = await createHttpTestApp({
        controllers: [WebhookIngestController],
        providers: [
          { provide: WebhookIngestService, useValue: ingest },
          { provide: getRepositoryToken(PluginEntity), useValue: module.get(getRepositoryToken(PluginEntity)) },
        ],
      })

      await ingest.ingest(plugin, { merge_variables: { payment: { amount: 5 } } })
      const response = await http.request('/api/webhook/token-abc')
      await http.app.close()

      expect(await response.json()).toEqual({ payment: { amount: 5 } })
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

    it('rejects with 422 rather than accumulating unbounded when a stream Plugin has no Stream Limit', async () => {
      plugin.mergeStrategy = 'stream'
      plugin.streamLimit = null

      await expect(ingest.ingest(plugin, { readings: [1] })).rejects.toThrow(UnprocessableEntityException)
      expect(plugin.webhookPayload).toBeNull()
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

  describe('gET /api/webhook/:token', () => {
    let http: HttpTestApp

    beforeEach(async () => {
      http = await createHttpTestApp({
        controllers: [WebhookIngestController],
        providers: [
          { provide: WebhookIngestService, useValue: ingest },
          { provide: getRepositoryToken(PluginEntity), useValue: module.get(getRepositoryToken(PluginEntity)) },
        ],
      })
    })

    afterEach(async () => {
      await http.app.close()
    })

    it('answers the stored payload as JSON with Content-Type: application/json', async () => {
      await ingest.ingest(plugin, { status: 'ok', readings: [1, 2] })

      const response = await http.request('/api/webhook/token-abc')

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toMatch(/^application\/json/)
      expect(await response.json()).toEqual({ status: 'ok', readings: [1, 2] })
    })

    it('answers null as the literal null body when nothing was stored', async () => {
      const response = await http.request('/api/webhook/token-abc')

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toMatch(/^application\/json/)
      expect(await response.text()).toBe('null')
    })
  })
})
