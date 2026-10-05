import type { ConfigService } from '@nestjs/config'
import type { ApiError, PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
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
import { PluginsController } from '../plugins.controller.js'
import { PluginsService } from '../plugins.service.js'
import { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'
import { PluginAssignmentsService } from '../services/plugin-assignments.service.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginExporterService } from '../services/plugin-exporter.service.js'
import { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
import { PluginImporterService } from '../services/plugin-importer.service.js'
import { PluginPreviewDataService } from '../services/plugin-preview-data.service.js'
import { PluginReadsService } from '../services/plugin-reads.service.js'
import { PluginRefreshService } from '../services/plugin-refresh.service.js'
import { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'
import { PluginSchedulerService } from '../services/plugin-scheduler.service.js'
import { PluginTemplateContextService } from '../services/plugin-template-context.service.js'
import { PluginTransformService } from '../services/plugin-transform.service.js'
import { RecipeUpdateService } from '../services/recipe-update.service.js'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

// The spec's own requests go to the test server through the real fetch; only
// a Data Source's fetch is answered by `dataSourceAnswer`.
const realFetch = globalThis.fetch
const mockFetch = stubFetch()
let dataSourceAnswer: (url: string) => Response | Promise<Response>

function isOwnRequest(input: Parameters<typeof fetch>[0]): boolean {
  return String(input).startsWith('http://127.0.0.1')
}

describe('saving a Plugin, PATCH /api/plugins/:id, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let plugins: PluginsService
  let assignments: PluginAssignmentsService
  let scheduler: PluginSchedulerService
  let backgroundTicks: Promise<void>[]
  let deviceCount = 0

  beforeAll(async () => {
    database = await createTestDatabase()

    const renderer = new PluginRendererService()
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const config = asService<ConfigService>({ get: () => false, getOrThrow: () => 'https://kuroshiro.example' })
    const resolver = new PluginDataResolverService(new PluginDataFetcherService(renderer, config), new PluginTransformService())
    const templateContext = new PluginTemplateContextService(fieldValues, resolver)
    const renderCache = new PluginRenderCacheService(renderer, database.getRepository(Screen))
    const refresh = new PluginRefreshService(renderCache, templateContext, new DataSourceFetchOutcomeService(database.getRepository(PluginDataSource)), database.getRepository(Plugin))
    scheduler = new PluginSchedulerService(refresh)
    assignments = new PluginAssignmentsService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DevicePlugin))
    plugins = new PluginsService(
      database.getRepository(Plugin),
      database.getRepository(Screen),
      database.getRepository(PluginDataSource),
      database.getRepository(PluginTemplate),
      database.getRepository(PluginField),
      scheduler,
      renderCache,
      fieldValues,
      assignments,
    )

    http = await createHttpTestApp({
      controllers: [PluginsController],
      providers: [
        { provide: PluginsService, useValue: plugins },
        { provide: PluginReadsService, useValue: new PluginReadsService(database.getRepository(Plugin), database.getRepository(Screen), database.getRepository(Alert), fieldValues, config) },
        { provide: PluginPreviewDataService, useValue: asService<PluginPreviewDataService>({}) },
        { provide: PluginAssignmentsService, useValue: assignments },
        { provide: PluginImporterService, useValue: asService<PluginImporterService>({}) },
        { provide: PluginExporterService, useValue: asService<PluginExporterService>({}) },
        { provide: RecipeUpdateService, useValue: asService<RecipeUpdateService>({}) },
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    dataSourceAnswer = () => new Response(JSON.stringify({ temperature: 21 }))
    mockFetch.mockImplementation(async (input, init) => isOwnRequest(input) ? realFetch(input, init) : dataSourceAnswer(String(input)))
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()

    backgroundTicks = []
    const runTick = scheduler.runTick.bind(scheduler)
    vi.spyOn(scheduler, 'runTick').mockImplementation((plugin) => {
      const tick = runTick(plugin)
      backgroundTicks.push(tick)
      return tick
    })
    vi.spyOn(scheduler, 'schedulePlugin')
  })

  afterEach(async () => {
    await backgroundTicksDone()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    scheduler.onModuleDestroy()
    await http.app.close()
    await database.destroy()
  })

  function backgroundTicksDone(): Promise<void[]> {
    return Promise.all(backgroundTicks)
  }

  async function addDevice(name: string): Promise<Device> {
    deviceCount += 1
    return database.getRepository(Device).save({ name, friendlyId: `DEV${deviceCount}`, mac: `AA:BB:CC:DD:EE:${String(deviceCount).padStart(2, '0')}`, apikey: `device-secret-${deviceCount}`, refreshRate: 300 })
  }

  function createPollPlugin(overrides: Partial<Parameters<PluginsService['create']>[0]> = {}) {
    return plugins.create({
      name: 'Weather',
      kind: 'Poll',
      refreshInterval: 15,
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather' }],
      templates: [{ layout: 'full', liquidMarkup: '<p>{{ weather.temperature }}</p>' }],
      ...overrides,
    })
  }

  function createWebhookPlugin() {
    return plugins.create({ name: 'Sensor Feed', kind: 'Webhook', mergeStrategy: 'standard', templates: [{ layout: 'full', liquidMarkup: '<p>{{ trmnl.plugin_settings.instance_name }}</p>' }] })
  }

  function save(pluginId: string, body: UpdatePluginInput | Record<string, unknown>): Promise<Response> {
    return http.request(`/api/plugins/${pluginId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }

  async function saved(pluginId: string, body: UpdatePluginInput): Promise<PluginDetail> {
    const response = await save(pluginId, body)
    expect(response.status).toBe(200)
    return response.json()
  }

  async function refused(pluginId: string, body: Record<string, unknown>, status = 400): Promise<ApiError> {
    const response = await save(pluginId, body)
    expect(response.status).toBe(status)
    return response.json()
  }

  async function read(pluginId: string): Promise<PluginDetail> {
    const response = await http.request(`/api/plugins/${pluginId}`)
    expect(response.status).toBe(200)
    return response.json()
  }

  async function failingThreeTimesWithAnAlert(pluginId: string) {
    const repository = database.getRepository(PluginDataSource)
    const [source] = await repository.find({ where: { plugin: { id: pluginId } } })
    await repository.update(source.id, { fetchFailureStreak: 3, lastFetchError: 'HTTP 503', lastFetchAttemptAt: new Date('2026-10-01T10:00:00.000Z') })
    await database.getRepository(Alert).save({ kind: 'data-source-fetch-failing', dataSource: source, openedAt: new Date() })
    return source
  }

  function alertCount(): Promise<number> {
    return database.getRepository(Alert).count()
  }

  describe('data Sources, matched by id', () => {
    it('keeps the Fetch Failure Streak, the last error and the firing Alert of a Data Source saved by its id with a changed URL', async () => {
      const plugin = await createPollPlugin()
      const source = await failingThreeTimesWithAnAlert(plugin.id)
      dataSourceAnswer = () => new Promise(() => {})

      const detail = await saved(plugin.id, { dataSources: [{ id: source.id, name: 'weather', mode: 'fetch', url: 'https://api.example.com/v2/weather' }] })

      expect(detail.dataSources).toEqual([expect.objectContaining({
        id: source.id,
        url: 'https://api.example.com/v2/weather',
        fetchFailureStreak: 3,
        lastFetchError: 'HTTP 503',
        lastFetchAttemptAt: '2026-10-01T10:00:00.000Z',
        alertFiring: true,
      })])
      backgroundTicks = []
    })

    it('deletes a Data Source left out, its Alert with it, and creates one for an entry without an id', async () => {
      const plugin = await createPollPlugin()
      const source = await failingThreeTimesWithAnAlert(plugin.id)

      const detail = await saved(plugin.id, { dataSources: [{ name: 'air', mode: 'fetch', url: 'https://api.example.com/air', method: 'POST' }] })

      expect(detail.dataSources).toEqual([expect.objectContaining({ name: 'air', method: 'POST', fetchFailureStreak: 0, alertFiring: false })])
      expect(detail.dataSources[0].id).not.toBe(source.id)
      expect(await alertCount()).toBe(0)
    })

    it('keeps the Data Sources as they are when the save leaves the key out', async () => {
      const plugin = await createPollPlugin()
      const source = await failingThreeTimesWithAnAlert(plugin.id)
      dataSourceAnswer = () => new Promise(() => {})

      const detail = await saved(plugin.id, { name: 'Forecast' })

      expect(detail.dataSources).toEqual([expect.objectContaining({ id: source.id, fetchFailureStreak: 3, alertFiring: true })])
      backgroundTicks = []
    })

    it('reads the Data Sources in the order they were saved in', async () => {
      const plugin = await createPollPlugin()
      const [weather] = (await read(plugin.id)).dataSources

      const detail = await saved(plugin.id, { dataSources: [
        { name: 'air', mode: 'literal', literalValue: { aqi: 4 } },
        { id: weather.id, name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather' },
      ] })

      expect(detail.dataSources.map(source => source.name)).toEqual(['air', 'weather'])
    })

    it('drops the fetch settings and the Fetch Failure Streak of a Data Source that becomes a literal one', async () => {
      const plugin = await createPollPlugin({ dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', headers: { Authorization: 'Bearer abc' }, transformJs: 'return input' }] })
      const weather = await failingThreeTimesWithAnAlert(plugin.id)

      await saved(plugin.id, { dataSources: [{ id: weather.id, name: 'weather', mode: 'literal', literalValue: { temperature: 5 } }] })

      expect(await database.getRepository(PluginDataSource).findOneByOrFail({ id: weather.id })).toMatchObject({ mode: 'literal', url: null, headers: null, body: null, transformJs: null, literalValue: { temperature: 5 }, fetchFailureStreak: 0, lastFetchAttemptAt: null, lastFetchError: null })
    })

    it('refuses the id of another Plugin\'s Data Source, and one no Data Source has', async () => {
      const plugin = await createPollPlugin()
      const other = await createPollPlugin({ name: 'Other' })
      const [foreign] = (await read(other.id)).dataSources

      for (const id of [foreign.id, UNKNOWN_ID]) {
        const envelope = await refused(plugin.id, { dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather' }, { id, name: 'air', mode: 'fetch', url: 'https://api.example.com/air' }] })

        expect(envelope.code).toBe('validation')
        expect(envelope.fields).toEqual([{ path: 'dataSources.1.id', message: expect.any(String) }])
      }
      expect((await read(other.id)).dataSources).toEqual([expect.objectContaining({ id: foreign.id, name: 'weather' })])
    })

    it('refuses a Data Source on a Webhook-kind Plugin', async () => {
      const plugin = await createWebhookPlugin()

      const envelope = await refused(plugin.id, { dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather' }] })

      expect(envelope.fields).toEqual([{ path: 'dataSources', message: expect.any(String) }])
    })
  })

  describe('the Templates, the whole set by size', () => {
    const FULL = { size: 'full', liquidMarkup: '<p>full</p>' } as const
    const QUADRANT = { size: 'quadrant', liquidMarkup: '<p>quadrant</p>' } as const

    function createPluginWithTemplates(...layouts: string[]) {
      return createPollPlugin({ templates: layouts.map(layout => ({ layout, liquidMarkup: `<p>stored ${layout}</p>` })) })
    }

    function storedTemplates(pluginId: string): Promise<PluginTemplate[]> {
      return database.getRepository(PluginTemplate).find({ where: { plugin: { id: pluginId } } })
    }

    it('updates a size sent, adds a new one and deletes one left out', async () => {
      const plugin = await createPluginWithTemplates('full', 'half_vertical')
      const [storedFull] = await storedTemplates(plugin.id)

      const detail = await saved(plugin.id, { templates: [QUADRANT, FULL] })

      expect(detail.templates).toEqual([FULL, QUADRANT])
      const stored = await storedTemplates(plugin.id)
      expect(stored.map(template => template.layout).sort()).toEqual(['full', 'quadrant'])
      expect(stored.find(template => template.layout === 'full')?.id).toBe(storedFull.id)
    })

    it('leaves the Templates alone when the save leaves the key out', async () => {
      const plugin = await createPluginWithTemplates('full', 'quadrant')

      const detail = await saved(plugin.id, { name: 'Forecast' })

      expect(detail.templates).toEqual([
        { size: 'full', liquidMarkup: '<p>stored full</p>' },
        { size: 'quadrant', liquidMarkup: '<p>stored quadrant</p>' },
      ])
    })

    it.each([
      ['no Template of size full', [QUADRANT]],
      ['no Template at all', []],
    ])('refuses a set with %s as template-full-missing, and stores nothing of the save', async (_case, templates) => {
      const plugin = await createPluginWithTemplates('full', 'half_vertical')

      const envelope = await refused(plugin.id, { name: 'Forecast', templates })

      expect(envelope.code).toBe('template-full-missing')
      const detail = await read(plugin.id)
      expect(detail.name).toBe('Weather')
      expect(detail.templates.map(template => template.size)).toEqual(['full', 'half_vertical'])
    })

    it.each([
      ['does not parse', '<p>full</p>\n{% if rain %}\n<p>umbrella</p>', { size: 'quadrant', line: 2, message: 'tag {% if rain %} not closed' }],
      ['is empty', '  \n', { size: 'quadrant', line: null, message: 'A template cannot be empty.' }],
    ])('refuses a Template that %s as template-invalid, naming its size and line, and stores nothing of the save', async (_case, liquidMarkup, details) => {
      const plugin = await createPluginWithTemplates('full', 'half_vertical')

      const envelope = await refused(plugin.id, { name: 'Forecast', templates: [FULL, { size: 'quadrant', liquidMarkup }] })

      expect(envelope.code).toBe('template-invalid')
      expect(envelope.details).toEqual(details)
      const detail = await read(plugin.id)
      expect(detail.name).toBe('Weather')
      expect(detail.templates.map(template => template.size)).toEqual(['full', 'half_vertical'])
    })

    it('saves a Template that parses and would fail only at render', async () => {
      const plugin = await createPluginWithTemplates('full')

      const detail = await saved(plugin.id, { templates: [{ size: 'full', liquidMarkup: '{% render "missing" %}' }] })

      expect(detail.templates).toEqual([{ size: 'full', liquidMarkup: '{% render "missing" %}' }])
    })

    it('refuses a size sent twice, and stores nothing of the save', async () => {
      const plugin = await createPluginWithTemplates('full')

      const envelope = await refused(plugin.id, { name: 'Forecast', templates: [FULL, QUADRANT, { size: 'quadrant', liquidMarkup: '<p>again</p>' }] })

      expect(envelope.code).toBe('validation')
      expect(envelope.fields?.map(field => field.path)).toEqual(['templates.2.size'])
      const detail = await read(plugin.id)
      expect(detail.name).toBe('Weather')
      expect(detail.templates).toEqual([{ size: 'full', liquidMarkup: '<p>stored full</p>' }])
    })

    it('refuses a size that is no Template size', async () => {
      const plugin = await createPluginWithTemplates('full')

      const envelope = await refused(plugin.id, { templates: [FULL, { size: 'third', liquidMarkup: '<p>third</p>' }] })

      expect(envelope.code).toBe('validation')
    })

    it('rolls the Templates back with the rest of the save when a later write fails', async () => {
      const plugin = await createPluginWithTemplates('full', 'half_vertical')
      vi.spyOn(PluginFieldValuesService.prototype, 'write').mockRejectedValue(new Error('the database went away'))

      await refused(plugin.id, { templates: [FULL, QUADRANT] }, 500)

      expect((await read(plugin.id)).templates).toEqual([
        { size: 'full', liquidMarkup: '<p>stored full</p>' },
        { size: 'half_vertical', liquidMarkup: '<p>stored half_vertical</p>' },
      ])
    })

    it('keeps one Template per size in the database', async () => {
      const plugin = await createPluginWithTemplates('full')

      await expect(database.getRepository(PluginTemplate).save({ layout: 'full', liquidMarkup: '<p>second</p>', plugin: { id: plugin.id } })).rejects.toThrow(/unique|duplicate/i)
    })

    it('refuses a new Plugin with two Templates of one size', async () => {
      await expect(createPluginWithTemplates('full', 'full')).rejects.toMatchObject({ code: 'validation', fields: [{ path: 'templates.1.layout' }] })
    })
  })

  describe('one transaction', () => {
    it('changes nothing, the name included, when one Data Source is invalid', async () => {
      const plugin = await createPollPlugin()
      const before = await read(plugin.id)

      const envelope = await refused(plugin.id, {
        name: 'Forecast',
        fields: [{ keyname: 'city', name: 'City' }],
        dataSources: [
          { name: 'air', mode: 'fetch', url: 'https://api.example.com/air' },
          { name: 'pollen', mode: 'fetch', url: 'https://api.example.com/pollen' },
          { name: 'tide', mode: 'fetch', url: 'ftp://example.com/tide' },
        ],
      })

      expect(envelope.code).toBe('validation')
      expect(envelope.fields).toEqual([{ path: 'dataSources.2.url', message: expect.any(String) }])
      expect(await read(plugin.id)).toEqual(before)
    })

    it('rolls back what was already written when a later write fails', async () => {
      const plugin = await createPollPlugin()
      const before = await read(plugin.id)
      vi.spyOn(PluginFieldValuesService.prototype, 'write').mockRejectedValue(new Error('the database went away'))

      const response = await save(plugin.id, {
        name: 'Forecast',
        dataSources: [{ name: 'air', mode: 'fetch', url: 'https://api.example.com/air' }],
        fields: [{ keyname: 'city', name: 'City' }],
        fieldValues: { city: 'Berlin' },
      })

      expect(response.status).toBe(500)
      expect(await read(plugin.id)).toEqual(before)
      expect(backgroundTicks).toEqual([])
    })
  })

  describe('the answer', () => {
    it('equals a read right after: the assignments present and the Plugin Fields as saved', async () => {
      const device = await addDevice('Kitchen')
      const plugin = await createPollPlugin({ fields: [{ keyname: 'old', name: 'Old' }] })
      const screenId = await assignments.assign(plugin.id, device.id)

      const answer = await saved(plugin.id, {
        name: '  Forecast  ',
        description: 'Tomorrow',
        fields: [{ keyname: 'city', name: 'City', required: true }],
        fieldValues: { city: 'Berlin' },
      })
      await backgroundTicksDone()

      expect(answer).toMatchObject({
        name: 'Forecast',
        description: 'Tomorrow',
        assignments: [{ deviceId: device.id, deviceName: 'Kitchen', screenId, order: 1, screenCount: 1 }],
        fields: [expect.objectContaining({ keyname: 'city', label: 'City', required: true })],
        fieldValues: { city: { secret: false, value: 'Berlin' } },
        needsValues: false,
      })
      expect({ ...await read(plugin.id), dataSources: answer.dataSources, lastScheduledRender: answer.lastScheduledRender }).toEqual(answer)
    })

    it('clears the description sent as null and keeps the one left out', async () => {
      const plugin = await createPollPlugin({ description: 'Shows the weather' })

      expect((await saved(plugin.id, { name: 'Forecast' })).description).toBe('Shows the weather')
      expect((await saved(plugin.id, { description: null })).description).toBeNull()
    })

    it('answers 404 plugin-not-found for an id no Plugin has, and for one that is no id at all', async () => {
      for (const id of [UNKNOWN_ID, 'not-an-id']) {
        const envelope = await refused(id, { name: 'Forecast' }, 404)

        expect(envelope.code).toBe('plugin-not-found')
      }
    })
  })

  describe('what a save refuses', () => {
    it.each([
      ['mergeStrategy', { mergeStrategy: 'deep_merge' }],
      ['streamLimit', { streamLimit: 5 }],
      ['kind', { kind: 'Poll' }],
      ['webhookToken', { webhookToken: 'mine' }],
    ])('refuses %s, which is fixed when the Plugin is created', async (path, body) => {
      const plugin = await createWebhookPlugin()

      const envelope = await refused(plugin.id, body)

      expect(envelope.code).toBe('validation')
      expect(envelope.fields?.map(field => field.path)).toEqual([path])
    })

    it.each([0, 1441, 1.5, '15', null])('refuses a refresh interval of %j', async (refreshInterval) => {
      const plugin = await createPollPlugin()

      const envelope = await refused(plugin.id, { refreshInterval })

      expect(envelope.code).toBe('validation')
      expect(envelope.fields?.every(field => field.path === 'refreshInterval')).toBe(true)
      expect((await read(plugin.id)).refreshInterval).toBe(15)
    })

    it('refuses a refresh interval on a Webhook-kind Plugin, which has none', async () => {
      const plugin = await createWebhookPlugin()

      expect((await refused(plugin.id, { refreshInterval: 30 })).fields).toEqual([{ path: 'refreshInterval', message: expect.any(String) }])
    })

    it.each([1, 1440])('saves a refresh interval of %i', async (refreshInterval) => {
      const plugin = await createPollPlugin()

      expect((await saved(plugin.id, { refreshInterval })).refreshInterval).toBe(refreshInterval)
    })

    it('keeps a stored interval above 24 hours when the save leaves the key out', async () => {
      const plugin = await createPollPlugin({ refreshInterval: 2880 })

      const detail = await saved(plugin.id, { name: 'Forecast' })

      expect(detail).toMatchObject({ name: 'Forecast', refreshInterval: 2880 })
    })

    it.each(['', '   ', null, 7])('refuses a name of %j', async (name) => {
      const plugin = await createPollPlugin()

      const envelope = await refused(plugin.id, { name })

      expect(envelope.fields?.every(field => field.path === 'name')).toBe(true)
      expect((await read(plugin.id)).name).toBe('Weather')
    })

    it.each([
      ['a method other than GET and POST', { name: 'air', mode: 'fetch', url: 'https://api.example.com/air', method: 'DELETE' }, 'dataSources.0.method'],
      ['a URL that is neither http nor https', { name: 'air', mode: 'fetch', url: 'file:///etc/passwd' }, 'dataSources.0.url'],
      ['the reserved name trmnl', { name: 'trmnl', mode: 'fetch', url: 'https://api.example.com/air' }, 'dataSources.0.name'],
      ['an empty name', { name: ' ', mode: 'fetch', url: 'https://api.example.com/air' }, 'dataSources.0.name'],
      ['a literal Data Source with a URL', { name: 'air', mode: 'literal', literalValue: 1, url: 'https://api.example.com/air' }, 'dataSources.0.mode'],
    ])('refuses %s', async (_rule, dataSource, path) => {
      const plugin = await createPollPlugin()

      const envelope = await refused(plugin.id, { dataSources: [dataSource] })

      expect(envelope.code).toBe('validation')
      expect(envelope.fields).toEqual([{ path, message: expect.any(String) }])
    })

    it('refuses two Data Sources of one name, and a name a Plugin Field\'s keyname already has', async () => {
      const plugin = await createPollPlugin({ fields: [{ keyname: 'city', name: 'City' }] })
      const air = { name: 'air', mode: 'fetch', url: 'https://api.example.com/air' }

      expect((await refused(plugin.id, { dataSources: [air, air] })).fields).toEqual([{ path: 'dataSources.1.name', message: expect.any(String) }])
      expect((await refused(plugin.id, { dataSources: [air, { ...air, name: 'city' }] })).fields).toEqual([{ path: 'dataSources.1.name', message: expect.any(String) }])
      expect((await refused(plugin.id, { fields: [{ keyname: 'city', name: 'City' }, { keyname: 'weather', name: 'Weather' }] })).fields).toEqual([{ path: 'fields.1.keyname', message: expect.any(String) }])
    })
  })

  describe('after the commit', () => {
    async function cachedOutput(pluginId: string): Promise<string | null | undefined> {
      const screen = await database.getRepository(Screen).findOneOrFail({ where: { plugin: { id: pluginId } } })
      return screen.cachedPluginOutput
    }

    it('answers while a slow Data Source is still being fetched, then renders for the Device in the background', async () => {
      const plugin = await createPollPlugin()
      await assignments.assign(plugin.id, (await addDevice('Kitchen')).id)
      let answerDataSource: (response: Response) => void = () => {}
      dataSourceAnswer = () => new Promise((resolve) => {
        answerDataSource = resolve
      })

      const detail = await saved(plugin.id, { name: 'Forecast' })

      expect(detail.name).toBe('Forecast')
      expect(detail.lastScheduledRender).toBeNull()
      expect(await cachedOutput(plugin.id)).toBeNull()

      answerDataSource(new Response(JSON.stringify({ temperature: 30 })))
      await backgroundTicksDone()

      expect(await cachedOutput(plugin.id)).toBe('<p>30</p>')
      expect((await read(plugin.id)).lastScheduledRender).toEqual({ at: expect.any(String), error: null })
    })

    it('moves the Fetch Failure Streak, being the scheduler\'s own tick', async () => {
      const plugin = await createPollPlugin()
      dataSourceAnswer = () => new Response('down', { status: 503 })

      await saved(plugin.id, { name: 'Forecast' })
      await backgroundTicksDone()

      expect((await read(plugin.id)).dataSources[0].fetchFailureStreak).toBe(1)
    })

    it('starts one tick for every save, whatever it changed', async () => {
      const plugin = await createPollPlugin({ fields: [{ keyname: 'city', name: 'City' }] })

      for (const body of [{ name: 'Forecast' }, { fieldValues: { city: 'Berlin' } }, { refreshInterval: 30 }, {}])
        await saved(plugin.id, body)

      expect(backgroundTicks).toHaveLength(4)
    })

    it('answers the saved Plugin even when its renders cannot be refreshed', async () => {
      const plugin = await createPollPlugin()
      vi.spyOn(plugins, 'invalidateRenderCaches').mockRejectedValue(new Error('the database went away'))

      expect((await saved(plugin.id, { name: 'Forecast' })).name).toBe('Forecast')
    })

    it('starts no tick for a save that was refused', async () => {
      const plugin = await createPollPlugin()

      await refused(plugin.id, { refreshInterval: 0 })

      expect(backgroundTicks).toEqual([])
    })

    it('reschedules a save that changes only the refresh interval', async () => {
      const plugin = await createPollPlugin()
      vi.mocked(scheduler.schedulePlugin).mockClear()

      await saved(plugin.id, { refreshInterval: 90 })

      expect(scheduler.schedulePlugin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: plugin.id, refreshInterval: 90 }))
      expect(scheduler.hasScheduledJob(plugin.id)).toBe(true)
    })

    it('schedules and renders a Poll-kind Plugin whose last Data Source was removed, with trmnl and its Field Values', async () => {
      const plugin = await createPollPlugin({ fields: [{ keyname: 'city', name: 'City' }], fieldValues: { city: 'Berlin' } })
      await assignments.assign(plugin.id, (await addDevice('Kitchen')).id)

      await saved(plugin.id, { dataSources: [], templates: [{ size: 'full', liquidMarkup: '{{ trmnl.plugin_settings.instance_name }} in {{ city }}' }] })
      await backgroundTicksDone()

      expect(scheduler.hasScheduledJob(plugin.id)).toBe(true)
      expect(await cachedOutput(plugin.id)).toBe('Weather in Berlin')
      expect(mockFetch.mock.calls.filter(([input]) => !isOwnRequest(input))).toEqual([])
    })

    it('schedules a Poll-kind Plugin created without Data Sources, and never a Webhook-kind one', async () => {
      const poll = await createPollPlugin({ dataSources: [] })
      const webhook = await createWebhookPlugin()

      expect(scheduler.hasScheduledJob(poll.id)).toBe(true)
      expect(scheduler.hasScheduledJob(webhook.id)).toBe(false)
    })

    it('schedules every Poll-kind Plugin when the Instance starts, and runs each once at start', async () => {
      const poll = await createPollPlugin()
      await createWebhookPlugin()
      scheduler.onModuleDestroy()

      await plugins.onModuleInit()
      await backgroundTicksDone()

      expect(scheduler.hasScheduledJob(poll.id)).toBe(true)
      expect(backgroundTicks).toHaveLength(1)
      expect((await read(poll.id)).lastScheduledRender).toEqual({ at: expect.any(String), error: null })
    })

    it('clears the cached output of a Mashup holding the Plugin in a slot', async () => {
      const plugin = await createPollPlugin()
      const screen = await database.getRepository(Screen).save({ type: 'mashup', filename: 'Morning', order: 1, isActive: false, fetchManual: false, generatedAt: new Date(), cachedPluginOutput: '<div>stale</div>', renderSignal: 'skip', device: await addDevice('Kitchen') })
      const configuration = await database.getRepository(MashupConfiguration).save({ layout: '1Lx1R', screen })
      await database.getRepository(MashupSlot).save({ position: 'left', size: 'view--half_vertical', order: 0, plugin: { id: plugin.id }, mashupConfiguration: configuration })

      await saved(plugin.id, { name: 'Forecast' })

      const stored = await database.getRepository(Screen).findOneByOrFail({ id: screen.id })
      expect(stored.cachedPluginOutput).toBeNull()
      expect(stored.renderSignal).toBeNull()
    })

    it('renders a Webhook-kind Plugin again for its Screen after a rename', async () => {
      const plugin = await createWebhookPlugin()
      await assignments.assign(plugin.id, (await addDevice('Kitchen')).id)

      await saved(plugin.id, { name: 'Feed' })
      await backgroundTicksDone()

      expect(await cachedOutput(plugin.id)).toBe('<p>Feed</p>')
      expect(scheduler.hasScheduledJob(plugin.id)).toBe(false)
    })
  })
})
