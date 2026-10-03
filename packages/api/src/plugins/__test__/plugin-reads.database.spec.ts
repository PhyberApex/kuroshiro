import type { ConfigService } from '@nestjs/config'
import type { ApiError, PluginDetail, PluginSummary } from 'kuroshiro-shared'
import type { DataSource, DeepPartial } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { Schedule } from '../../schedule/schedule.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { stubFetch } from '../../test/fetch.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { DevicePlugin } from '../entities/device-plugin.entity.js'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../entities/plugin-field-value.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { Plugin } from '../entities/plugin.entity.js'
import { WebhookPluginGuard } from '../guards/webhook-plugin.guard.js'
import { PluginsController } from '../plugins.controller.js'
import { PluginsService } from '../plugins.service.js'
import { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'
import { PluginAssignmentsService } from '../services/plugin-assignments.service.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginExporterService } from '../services/plugin-exporter.service.js'
import { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
import { PluginImporterService } from '../services/plugin-importer.service.js'
import { PluginReadsService } from '../services/plugin-reads.service.js'
import { PluginRefreshService } from '../services/plugin-refresh.service.js'
import { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'
import { PluginSchedulerService } from '../services/plugin-scheduler.service.js'
import { PluginTemplateContextService } from '../services/plugin-template-context.service.js'
import { PluginTransformService } from '../services/plugin-transform.service.js'
import { RecipeUpdateService } from '../services/recipe-update.service.js'
import { WebhookIngestService } from '../services/webhook-ingest.service.js'
import { WebhookIngestController } from '../webhook-ingest.controller.js'

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })) },
}))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const API_URL = 'https://kuroshiro.example'
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// The spec's own requests go to the test server through the real fetch; only
// a Data Source's fetch is answered by `dataSourceAnswer`.
const realFetch = globalThis.fetch
const mockFetch = stubFetch()
let dataSourceAnswer: (url: string) => Response

function isOwnRequest(input: Parameters<typeof fetch>[0]): boolean {
  return String(input).startsWith('http://127.0.0.1')
}

describe('the Plugin reads, GET /api/plugins and GET /api/plugins/:id, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let plugins: PluginsService
  let assignments: PluginAssignmentsService
  let refresh: PluginRefreshService
  let deviceCount = 0

  beforeAll(async () => {
    database = await createTestDatabase()

    const renderer = new PluginRendererService()
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const templateContext = new PluginTemplateContextService(fieldValues)
    const config = asService<ConfigService>({ get: () => false, getOrThrow: () => API_URL })
    const resolver = new PluginDataResolverService(new PluginDataFetcherService(renderer, config), new PluginTransformService())
    const renderCache = new PluginRenderCacheService(renderer, database.getRepository(Screen))
    refresh = new PluginRefreshService(resolver, renderCache, templateContext, new DataSourceFetchOutcomeService(database.getRepository(PluginDataSource)), database.getRepository(Plugin))
    plugins = new PluginsService(
      database.getRepository(Plugin),
      database.getRepository(Screen),
      database.getRepository(PluginDataSource),
      database.getRepository(PluginTemplate),
      database.getRepository(PluginField),
      resolver,
      renderer,
      new PluginSchedulerService(refresh),
      renderCache,
      fieldValues,
      refresh,
      templateContext,
    )
    assignments = new PluginAssignmentsService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DevicePlugin))
    const reads = new PluginReadsService(database.getRepository(Plugin), database.getRepository(Screen), database.getRepository(Alert), fieldValues, config)

    http = await createHttpTestApp({
      controllers: [PluginsController, WebhookIngestController],
      providers: [
        { provide: PluginsService, useValue: plugins },
        { provide: PluginReadsService, useValue: reads },
        { provide: PluginAssignmentsService, useValue: assignments },
        { provide: PluginImporterService, useValue: asService<PluginImporterService>({}) },
        { provide: PluginExporterService, useValue: asService<PluginExporterService>({}) },
        { provide: RecipeUpdateService, useValue: asService<RecipeUpdateService>({}) },
        { provide: WebhookIngestService, useValue: new WebhookIngestService(database.getRepository(Plugin), refresh) },
        { provide: getRepositoryToken(Plugin), useValue: database.getRepository(Plugin) },
        WebhookPluginGuard,
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    dataSourceAnswer = () => new Response(JSON.stringify({ temperature: 21 }))
    mockFetch.mockImplementation(async (input, init) => isOwnRequest(input) ? realFetch(input, init) : dataSourceAnswer(String(input)))
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function addDevice(name: string, overrides: DeepPartial<Device> = {}): Promise<Device> {
    deviceCount += 1
    return database.getRepository(Device).save({ name, friendlyId: `DEV${deviceCount}`, mac: `AA:BB:CC:DD:EE:${String(deviceCount).padStart(2, '0')}`, apikey: `device-secret-${deviceCount}`, mirrorApikey: 'mirror-secret', refreshRate: 300, ...overrides })
  }

  async function addScreen(device: Device, order: number, overrides: DeepPartial<Screen> = {}): Promise<Screen> {
    return database.getRepository(Screen).save({ type: 'html', filename: `Screen ${order}`, html: '<p>Hi</p>', order, isActive: false, fetchManual: false, generatedAt: new Date(), device, ...overrides })
  }

  async function addMashup(device: Device, name: string, order: number, pluginIds: string[]): Promise<Screen> {
    const screen = await addScreen(device, order, { type: 'mashup', filename: name, html: null })
    const configuration = await database.getRepository(MashupConfiguration).save({ layout: '1Lx1R', screen })
    await database.getRepository(MashupSlot).save(pluginIds.map((id, index) => ({ position: index === 0 ? 'left' : 'right', size: 'view--half_vertical', order: index, plugin: { id }, mashupConfiguration: configuration })))
    return screen
  }

  function createPollPlugin(overrides: Partial<Parameters<PluginsService['create']>[0]> = {}) {
    return plugins.create({
      name: 'Weather',
      kind: 'Poll',
      refreshInterval: 15,
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', headers: { Authorization: 'Bearer abc' } }],
      templates: [{ layout: 'full', liquidMarkup: '<p>{{ weather.temperature }}</p>' }],
      ...overrides,
    })
  }

  function createWebhookPlugin(overrides: Partial<Parameters<PluginsService['create']>[0]> = {}) {
    return plugins.create({
      name: 'Sensor Feed',
      kind: 'Webhook',
      mergeStrategy: 'standard',
      templates: [{ layout: 'full', liquidMarkup: '<p>{{ reading }}</p>' }],
      ...overrides,
    })
  }

  function loadForRender(pluginId: string): Promise<Plugin> {
    return database.getRepository(Plugin).findOneOrFail({ where: { id: pluginId }, relations: { dataSources: true, templates: true } })
  }

  async function scheduledTick(pluginId: string): Promise<void> {
    await refresh.refresh(await loadForRender(pluginId), { scheduled: true })
  }

  async function readList(): Promise<PluginSummary[]> {
    const response = await http.request('/api/plugins')
    expect(response.status).toBe(200)
    return response.json()
  }

  async function readDetail(pluginId: string): Promise<PluginDetail> {
    const response = await http.request(`/api/plugins/${pluginId}`)
    expect(response.status).toBe(200)
    return response.json()
  }

  describe('the list', () => {
    it('answers rows without a Template, a Webhook Payload, a Recipe Snapshot, a Webhook Token or a Device secret', async () => {
      const device = await addDevice('Kitchen')
      const poll = await createPollPlugin({ sourceRecipeId: 'recipe-7', sourceRecipeSnapshot: { name: 'Weather Recipe' } })
      const webhook = await createWebhookPlugin()
      await assignments.assign(poll.id, device.id)
      await http.postJson(`/api/webhook/${webhook.webhookToken}`, { reading: 4 })

      const response = await http.request('/api/plugins')
      const body = await response.text()

      for (const absent of ['apikey', 'mirrorApikey', 'webhookToken', 'liquidMarkup', 'webhookPayload"', 'sourceRecipeSnapshot', 'device-secret', 'mirror-secret', webhook.webhookToken!, 'Bearer abc'])
        expect(body).not.toContain(absent)
      expect(JSON.parse(body)).toEqual([
        {
          id: webhook.id,
          name: 'Sensor Feed',
          kind: 'Webhook',
          sourceRecipeId: null,
          devices: [],
          mashups: [],
          worstFetchFailureStreak: 0,
          fetchAlertFiring: false,
          needsValues: false,
          webhookPayloadStored: true,
        },
        {
          id: poll.id,
          name: 'Weather',
          kind: 'Poll',
          sourceRecipeId: 'recipe-7',
          devices: [{ id: device.id, name: 'Kitchen' }],
          mashups: [],
          worstFetchFailureStreak: 0,
          fetchAlertFiring: false,
          needsValues: false,
          webhookPayloadStored: null,
        },
      ])
    })

    it('is ordered by name without regard to case', async () => {
      for (const name of ['banana', 'Cherry', 'apple', 'Date'])
        await createPollPlugin({ name })

      expect((await readList()).map(plugin => plugin.name)).toEqual(['apple', 'banana', 'Cherry', 'Date'])
    })

    it('answers an empty list when there is no Plugin', async () => {
      expect(await readList()).toEqual([])
    })

    it('reads the worst Fetch Failure Streak among a Plugin\'s Data Sources', async () => {
      const plugin = await createPollPlugin({ dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather' }, { name: 'air', mode: 'fetch', url: 'https://api.example.com/air' }] })
      dataSourceAnswer = url => url.includes('air') ? new Response('down', { status: 503 }) : new Response('{}')

      await scheduledTick(plugin.id)
      await scheduledTick(plugin.id)

      expect((await readList())[0].worstFetchFailureStreak).toBe(2)
    })
  })

  describe('one Plugin', () => {
    it('answers 404 plugin-not-found for an id no Plugin has, and for one that is no id at all', async () => {
      for (const id of [UNKNOWN_ID, 'not-an-id']) {
        const response = await http.request(`/api/plugins/${id}`)
        const envelope: ApiError = await response.json()

        expect(response.status).toBe(404)
        expect(envelope.code).toBe('plugin-not-found')
      }
    })

    it('reads two assignments, each with its place in the Device\'s Order and its Screen State, and one Mashup', async () => {
      const [kitchen, hall, attic] = [await addDevice('Kitchen'), await addDevice('Hall'), await addDevice('Attic')]
      const plugin = await createPollPlugin()
      const other = await createPollPlugin({ name: 'Other' })
      await addScreen(kitchen, 1, { isActive: true })
      const onKitchen = await assignments.assign(plugin.id, kitchen.id)
      await addScreen(kitchen, 3)
      const onHall = await assignments.assign(plugin.id, hall.id)
      await database.getRepository(Schedule).save({ enabled: false, screen: { id: onHall } })
      const mashup = await addMashup(attic, 'Morning', 1, [plugin.id, other.id])

      const detail = await readDetail(plugin.id)
      const [row] = (await readList()).filter(summary => summary.id === plugin.id)

      expect(detail.assignments).toEqual([
        { deviceId: hall.id, deviceName: 'Hall', screenId: onHall, order: 1, screenCount: 1, state: 'scheduleOff' },
        { deviceId: kitchen.id, deviceName: 'Kitchen', screenId: onKitchen, order: 2, screenCount: 3, state: 'upNext' },
      ])
      expect(detail.mashups).toEqual([{ screenId: mashup.id, name: 'Morning', deviceId: attic.id, deviceName: 'Attic' }])
      expect(row.devices).toEqual([{ id: hall.id, name: 'Hall' }, { id: kitchen.id, name: 'Kitchen' }])
      expect(row.mashups).toEqual(detail.mashups)
      expect((await readDetail(other.id)).assignments).toEqual([])
    })

    it('lists a Mashup once when the Plugin fills two of its slots', async () => {
      const device = await addDevice('Kitchen')
      const plugin = await createPollPlugin()
      await addMashup(device, 'Twice', 1, [plugin.id, plugin.id])

      expect((await readDetail(plugin.id)).mashups).toHaveLength(1)
      expect((await readList())[0].mashups).toHaveLength(1)
    })

    it('reads a Poll-kind Plugin whole, Data Source headers as written, and leaks no Device secret', async () => {
      const device = await addDevice('Kitchen')
      const plugin = await createPollPlugin({ description: 'Shows the weather' })
      await assignments.assign(plugin.id, device.id)

      const response = await http.request(`/api/plugins/${plugin.id}`)
      const body = await response.text()
      const detail: PluginDetail = JSON.parse(body)

      expect(body).not.toContain('device-secret')
      expect(body).not.toContain('mirror-secret')
      expect(detail).toMatchObject({
        id: plugin.id,
        name: 'Weather',
        description: 'Shows the weather',
        kind: 'Poll',
        refreshInterval: 15,
        templates: [{ size: 'full', liquidMarkup: '<p>{{ weather.temperature }}</p>' }],
        webhook: null,
        recipe: null,
        lastScheduledRender: null,
      })
      expect(detail.createdAt).toMatch(ISO_TIME)
      expect(detail.dataSources).toEqual([expect.objectContaining({
        name: 'weather',
        mode: 'fetch',
        method: 'GET',
        url: 'https://api.example.com/weather',
        headers: { Authorization: 'Bearer abc' },
        fetchFailureStreak: 0,
        lastFetchAttemptAt: null,
        lastFetchSucceededAt: null,
        alertFiring: false,
      })])
    })

    it('reads a firing fetch Alert on its Data Source and on the Plugin, and a resolved one on neither', async () => {
      const firing = await createPollPlugin({ name: 'Firing' })
      const resolved = await createPollPlugin({ name: 'Resolved' })
      const dataSourceOf = (pluginId: string) => database.getRepository(PluginDataSource).findOneOrFail({ where: { plugin: { id: pluginId } } })
      await database.getRepository(Alert).save({ kind: 'data-source-fetch-failing', dataSource: await dataSourceOf(firing.id), openedAt: new Date() })
      await database.getRepository(Alert).save({ kind: 'data-source-fetch-failing', dataSource: await dataSourceOf(resolved.id), openedAt: new Date(), resolvedAt: new Date() })

      expect((await readDetail(firing.id)).dataSources[0].alertFiring).toBe(true)
      expect((await readDetail(resolved.id)).dataSources[0].alertFiring).toBe(false)
      expect((await readList()).map(plugin => [plugin.name, plugin.fetchAlertFiring])).toEqual([['Firing', true], ['Resolved', false]])
    })

    it('reads a stored password Field Value only as set, and needs values on both reads while a required Plugin Field is empty', async () => {
      const plugin = await createPollPlugin({
        fields: [
          { keyname: 'city', name: 'City', fieldType: 'string', required: true, description: 'Where you live', order: 1 },
          { keyname: 'api_key', name: 'API key', fieldType: 'password', order: 2 },
        ],
        fieldValues: { api_key: 's3cret' },
      })

      const response = await http.request(`/api/plugins/${plugin.id}`)
      const body = await response.text()
      const detail: PluginDetail = JSON.parse(body)

      expect(body).not.toContain('s3cret')
      expect(detail.fieldValues).toEqual({ city: { secret: false, value: null }, api_key: { secret: true, set: true } })
      expect(detail.fields.map(field => [field.keyname, field.label, field.type, field.helpText])).toEqual([['city', 'City', 'string', 'Where you live'], ['api_key', 'API key', 'password', null]])
      expect(detail.needsValues).toBe(true)
      expect((await readList())[0].needsValues).toBe(true)
    })
  })

  describe('the facts stored for the reads', () => {
    it('sets the last successful fetch on a scheduled fetch that succeeds, and keeps it through one that fails while the last attempt moves', async () => {
      const plugin = await createPollPlugin()

      await scheduledTick(plugin.id)
      const [succeeded] = (await readDetail(plugin.id)).dataSources
      dataSourceAnswer = () => new Response('down', { status: 503 })
      await new Promise(resolve => setTimeout(resolve, 5))
      await scheduledTick(plugin.id)
      const [failed] = (await readDetail(plugin.id)).dataSources

      expect(succeeded.lastFetchSucceededAt).toMatch(ISO_TIME)
      expect(succeeded.lastFetchAttemptAt).toBe(succeeded.lastFetchSucceededAt)
      expect(failed.lastFetchSucceededAt).toBe(succeeded.lastFetchSucceededAt)
      expect(new Date(failed.lastFetchAttemptAt!).getTime()).toBeGreaterThan(new Date(succeeded.lastFetchAttemptAt!).getTime())
      expect(failed.fetchFailureStreak).toBe(1)
    })

    it('records the time of a scheduler tick that rendered, without an error and without touching when the Plugin was last changed', async () => {
      const plugin = await createPollPlugin()
      const before = await readDetail(plugin.id)

      await new Promise(resolve => setTimeout(resolve, 5))
      await scheduledTick(plugin.id)
      const after = await readDetail(plugin.id)

      expect(before.lastScheduledRender).toBeNull()
      expect(after.lastScheduledRender).toEqual({ at: expect.stringMatching(ISO_TIME), error: null })
      expect(after.updatedAt).toBe(before.updatedAt)
    })

    it('records no scheduled render for a render that no scheduler tick made', async () => {
      const plugin = await createPollPlugin()

      await refresh.refresh(await loadForRender(plugin.id))

      expect((await readDetail(plugin.id)).lastScheduledRender).toBeNull()
    })

    it('sets when the Webhook Payload was received on a Webhook POST, and reads the address a sender posts to', async () => {
      const plugin = await createWebhookPlugin({ mergeStrategy: 'stream', streamLimit: 5 })
      const before = await readDetail(plugin.id)

      const posted = await http.postJson(`/api/webhook/${plugin.webhookToken}`, { readings: [4] })
      const after = await readDetail(plugin.id)

      expect(posted.status).toBe(201)
      expect(await posted.json()).toEqual({ success: true })
      expect(before.webhook).toEqual({
        token: plugin.webhookToken,
        url: `${API_URL}/api/webhook/${plugin.webhookToken}`,
        mergeStrategy: 'stream',
        streamLimit: 5,
        payload: null,
        payloadReceivedAt: null,
      })
      expect(after.webhook).toMatchObject({ payload: { readings: [4] }, payloadReceivedAt: expect.stringMatching(ISO_TIME) })
      expect(after).toMatchObject({ refreshInterval: null, dataSources: [] })
    })

    it('stamps the Recipe Snapshot when a Recipe is imported, and a duplicate keeps the time its snapshot was taken', async () => {
      const imported = await createPollPlugin({ sourceRecipeId: 'recipe-7', sourceRecipeSnapshot: { name: 'Weather Recipe' } })
      await new Promise(resolve => setTimeout(resolve, 5))
      const copy = await plugins.duplicate(imported.id)

      const { recipe, createdAt } = await readDetail(imported.id)

      expect(recipe).toEqual({ id: 'recipe-7', name: 'Weather Recipe', importedAt: createdAt, snapshotTakenAt: expect.stringMatching(ISO_TIME) })
      expect((await readDetail(copy.id)).recipe?.snapshotTakenAt).toBe(recipe!.snapshotTakenAt)
      expect((await readDetail((await createPollPlugin()).id)).recipe).toBeNull()
    })
  })
})
