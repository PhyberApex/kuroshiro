import type { ConfigService } from '@nestjs/config'
import type { ApiError, PluginDetail, PluginImportResult, RecipeUpdatePreview } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
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
const API_URL = 'https://kuroshiro.example'

const realFetch = globalThis.fetch
const mockFetch = stubFetch()

/** What TRMNL answers, and what a Data Source fetch answers; the spec's own requests to the app under test go through. */
function upstreamAnswers(answer: (url: string) => Response | Promise<Response>): void {
  mockFetch.mockImplementation(async (input, init) => {
    if (String(input).startsWith('http://127.0.0.1'))
      return realFetch(input, init)
    if (!String(input).includes('trmnl.com'))
      return new Response(JSON.stringify({ phase: 'full' }))
    return answer(String(input))
  })
}

function recipeZip(settings: Record<string, unknown>, markup = '<p>{{ phase }}</p>'): Response {
  const zip = new AdmZip()
  zip.addFile('settings.yml', Buffer.from(yaml.dump({
    name: 'Moon Phase',
    description: 'Tonight\'s moon',
    strategy: 'polling',
    refresh_interval: 60,
    polling_url: 'https://api.example.com/moon',
    polling_verb: 'get',
    ...settings,
  }), 'utf8'))
  zip.addFile('full.liquid', Buffer.from(markup, 'utf8'))
  return new Response(new Uint8Array(zip.toBuffer()), { status: 200 })
}

const CITY_REQUIRED = { custom_fields: [{ keyname: 'city', field_type: 'string', name: 'City' }] }

describe('the Recipe Update Check, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let scheduler: PluginSchedulerService
  let backgroundTicks: Array<Promise<unknown>>
  let assignments: PluginAssignmentsService

  beforeAll(async () => {
    upstreamAnswers(() => new Response(null, { status: 404 }))
    database = await createTestDatabase()

    const renderer = new PluginRendererService()
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const config = asService<ConfigService>({ get: () => false, getOrThrow: () => API_URL })
    const resolver = new PluginDataResolverService(new PluginDataFetcherService(renderer, config), new PluginTransformService())
    const renderCache = new PluginRenderCacheService(renderer, database.getRepository(Screen))
    const refresh = new PluginRefreshService(renderCache, new PluginTemplateContextService(fieldValues, resolver), new DataSourceFetchOutcomeService(database.getRepository(PluginDataSource)), database.getRepository(Plugin))
    scheduler = new PluginSchedulerService(refresh)
    assignments = new PluginAssignmentsService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DevicePlugin))
    const plugins = new PluginsService(
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
    const importer = new PluginImporterService()

    http = await createHttpTestApp({
      controllers: [PluginsController],
      providers: [
        { provide: PluginsService, useValue: plugins },
        { provide: PluginReadsService, useValue: new PluginReadsService(database.getRepository(Plugin), database.getRepository(Screen), database.getRepository(Alert), fieldValues, config) },
        { provide: PluginPreviewDataService, useValue: asService<PluginPreviewDataService>({}) },
        { provide: PluginAssignmentsService, useValue: assignments },
        { provide: PluginImporterService, useValue: importer },
        { provide: PluginExporterService, useValue: new PluginExporterService() },
        {
          provide: RecipeUpdateService,
          useValue: new RecipeUpdateService(
            database.getRepository(Plugin),
            database.getRepository(PluginDataSource),
            database.getRepository(PluginTemplate),
            database.getRepository(PluginField),
            importer,
            plugins,
            fieldValues,
          ),
        },
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    upstreamAnswers(() => recipeZip({}))
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()

    backgroundTicks = []
    const runTick = scheduler.runTick.bind(scheduler)
    vi.spyOn(scheduler, 'runTick').mockImplementation((plugin) => {
      const tick = runTick(plugin)
      backgroundTicks.push(tick)
      return tick
    })
  })

  afterEach(async () => {
    await Promise.allSettled(backgroundTicks)
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    scheduler.onModuleDestroy()
    await http.app.close()
    await database.destroy()
  })

  async function importMoonPhase(deviceId?: string): Promise<PluginDetail> {
    const response = await http.postJson('/api/plugins/import-recipe', { recipe: '41120', deviceId })
    expect(response.status).toBe(201)
    return ((await response.json()) as PluginImportResult).plugin
  }

  async function addDevice(name: string, mac: string): Promise<Device> {
    return database.getRepository(Device).save({ name, friendlyId: name.toUpperCase().slice(0, 6), mac, apikey: `${name}-secret`, refreshRate: 300 })
  }

  async function check(id: string): Promise<RecipeUpdatePreview> {
    const response = await http.request(`/api/plugins/${id}/recipe-update`)
    expect(response.status).toBe(200)
    return response.json()
  }

  async function refused(response: Response, status: number): Promise<ApiError> {
    expect(response.status).toBe(status)
    return response.json()
  }

  async function read(id: string): Promise<PluginDetail> {
    return (await http.request(`/api/plugins/${id}`)).json()
  }

  /** What the background tick moves, which a read may or may not see yet. */
  function withoutRenderFacts(plugin: PluginDetail): PluginDetail {
    return {
      ...plugin,
      lastScheduledRender: null,
      dataSources: plugin.dataSources.map(source => ({ ...source, lastFetchAttemptAt: null, lastFetchSucceededAt: null, lastFetchError: null, fetchFailureStreak: 0 })),
    }
  }

  async function backdateSnapshot(id: string): Promise<string> {
    const longAgo = new Date('2026-01-01T00:00:00.000Z')
    await database.getRepository(Plugin).update(id, { snapshotTakenAt: longAgo })
    return longAgo.toISOString()
  }

  describe('the check, GET /api/plugins/:id/recipe-update', () => {
    it('names the Recipe and the Recipe Snapshot\'s date and lists each Update Item with every value side present', async () => {
      const plugin = await importMoonPhase()
      upstreamAnswers(() => recipeZip({ refresh_interval: 30 }, '<p>{{ phase }} tonight</p>'))

      const preview = await check(plugin.id)

      expect(preview).toMatchObject({
        recipe: { id: '41120', name: 'Moon Phase' },
        snapshotTakenAt: plugin.recipe!.snapshotTakenAt,
        mode: 'three-way',
        requiredFieldsLeftEmpty: [],
      })
      expect(preview.contentHash).toEqual(expect.any(String))
      expect(preview.items).toEqual([
        { itemType: 'refreshInterval', key: 'refreshInterval', kind: 'changed', conflict: false, snapshot: 60, local: 60, upstream: 30 },
        { itemType: 'template', key: 'full', kind: 'changed', conflict: false, snapshot: '<p>{{ phase }}</p>', local: '<p>{{ phase }}</p>', upstream: '<p>{{ phase }} tonight</p>' },
      ])
    })

    it('reads a Plugin Field and a Data Source in the words of a Plugin read', async () => {
      const plugin = await importMoonPhase()
      upstreamAnswers(() => recipeZip({ polling_url: 'https://api.example.com/moon/v2', ...CITY_REQUIRED }))

      const { items } = await check(plugin.id)

      expect(items).toContainEqual({
        itemType: 'dataSource',
        key: expect.any(String),
        kind: 'changed',
        conflict: false,
        snapshot: expect.objectContaining({ mode: 'fetch', url: 'https://api.example.com/moon' }),
        local: expect.objectContaining({ mode: 'fetch', url: 'https://api.example.com/moon' }),
        upstream: { mode: 'fetch', method: 'GET', url: 'https://api.example.com/moon/v2', headers: {}, body: {}, transformJs: null },
      })
      expect(items).toContainEqual({
        itemType: 'field',
        key: 'city',
        kind: 'added',
        conflict: false,
        snapshot: null,
        local: null,
        upstream: { keyname: 'city', label: 'City', type: 'string', helpText: null, default: null, required: true, order: 1, options: null },
      })
    })

    it('reports a required Plugin Field the Recipe adds without a default once for the Plugin, whatever the number of Devices', async () => {
      const kitchen = await addDevice('Kitchen', 'AA:BB:CC:DD:EE:01')
      const hallway = await addDevice('Hallway', 'AA:BB:CC:DD:EE:02')
      const plugin = await importMoonPhase(kitchen.id)
      await assignments.assign(plugin.id, hallway.id)
      upstreamAnswers(() => recipeZip(CITY_REQUIRED))

      const preview = await check(plugin.id)

      expect(preview.requiredFieldsLeftEmpty).toEqual(['city'])
    })

    it('does not report a required Plugin Field that brings a default', async () => {
      const plugin = await importMoonPhase()
      upstreamAnswers(() => recipeZip({ custom_fields: [{ keyname: 'city', field_type: 'string', name: 'City', default: 'Berlin' }] }))

      expect((await check(plugin.id)).requiredFieldsLeftEmpty).toEqual([])
    })

    it('answers the two-way comparison of a Plugin without a Recipe Snapshot, with no snapshot side', async () => {
      const plugin = await importMoonPhase()
      await database.getRepository(Plugin).update(plugin.id, { sourceRecipeSnapshot: null, snapshotTakenAt: null })
      upstreamAnswers(() => recipeZip({ refresh_interval: 30 }))

      const preview = await check(plugin.id)

      expect(preview).toMatchObject({ mode: 'two-way', snapshotTakenAt: null })
      expect(preview.items).toEqual([
        { itemType: 'refreshInterval', key: 'refreshInterval', kind: 'changed', conflict: false, snapshot: null, local: 60, upstream: 30 },
      ])
    })

    it('answers 422 recipe-not-found, naming the id, when TRMNL no longer has the Recipe', async () => {
      const plugin = await importMoonPhase()
      upstreamAnswers(() => new Response(null, { status: 404 }))

      const refusal = await refused(await http.request(`/api/plugins/${plugin.id}/recipe-update`), 422)

      expect(refusal).toMatchObject({ code: 'recipe-not-found', details: { id: '41120' } })
    })

    it('answers 502 upstream-unreachable with the reason when TRMNL does not answer', async () => {
      const plugin = await importMoonPhase()
      upstreamAnswers(() => Promise.reject(new TypeError('fetch failed')))

      const refusal = await refused(await http.request(`/api/plugins/${plugin.id}/recipe-update`), 502)

      expect(refusal).toMatchObject({ code: 'upstream-unreachable', details: { reason: 'fetch failed' } })
    })

    it('answers 404 plugin-not-from-recipe for a Plugin that was not imported from a Recipe', async () => {
      const built = await (await http.postJson('/api/plugins', { kind: 'Poll', name: 'Hand-built' })).json() as PluginDetail

      const refusal = await refused(await http.request(`/api/plugins/${built.id}/recipe-update`), 404)

      expect(refusal.code).toBe('plugin-not-from-recipe')
    })

    it.each([UNKNOWN_ID, 'weather'])('answers 404 plugin-not-found for a Plugin that does not exist (%s)', async (id) => {
      const refusal = await refused(await http.request(`/api/plugins/${id}/recipe-update`), 404)

      expect(refusal.code).toBe('plugin-not-found')
    })
  })

  describe('applying, POST /api/plugins/:id/recipe-update/apply', () => {
    async function apply(id: string, body: unknown): Promise<Response> {
      return http.postJson(`/api/plugins/${id}/recipe-update/apply`, body)
    }

    it('answers the Plugin as a read right after gives it, with the Recipe Snapshot taken now, and fetches and renders again in the background', async () => {
      const plugin = await importMoonPhase()
      const before = await backdateSnapshot(plugin.id)
      upstreamAnswers(() => recipeZip({ refresh_interval: 30 }, '<p>{{ phase }} tonight</p>'))
      const { contentHash } = await check(plugin.id)

      const response = await apply(plugin.id, { contentHash, apply: [{ itemType: 'template', key: 'full' }] })

      expect(response.status).toBe(201)
      const answered = await response.json() as PluginDetail
      await Promise.all(backgroundTicks)
      expect(withoutRenderFacts(answered)).toEqual(withoutRenderFacts(await read(plugin.id)))
      expect(answered.templates).toEqual([{ size: 'full', liquidMarkup: '<p>{{ phase }} tonight</p>' }])
      expect(answered.refreshInterval).toBe(60)
      expect(answered.recipe!.snapshotTakenAt).not.toBe(before)
      expect(scheduler.runTick).toHaveBeenCalledTimes(1)
    })

    it('moves only the Recipe Snapshot when nothing is applied', async () => {
      const plugin = await importMoonPhase()
      const before = await backdateSnapshot(plugin.id)
      const unchanged = await read(plugin.id)
      upstreamAnswers(() => recipeZip({ refresh_interval: 30 }))
      const { contentHash } = await check(plugin.id)

      const answered = await (await apply(plugin.id, { contentHash, apply: [] })).json() as PluginDetail

      expect(answered.recipe!.snapshotTakenAt).not.toBe(before)
      expect(withoutRenderFacts({ ...answered, recipe: null, updatedAt: '' })).toEqual(withoutRenderFacts({ ...unchanged, recipe: null, updatedAt: '' }))
      expect(scheduler.runTick).not.toHaveBeenCalled()
      expect((await check(plugin.id)).items).toEqual([])
    })

    it('answers 409 recipe-changed and changes nothing when the Recipe moved since the check', async () => {
      const plugin = await importMoonPhase()
      upstreamAnswers(() => recipeZip({ refresh_interval: 30 }))
      const { contentHash } = await check(plugin.id)
      upstreamAnswers(() => recipeZip({ refresh_interval: 45 }))

      const refusal = await refused(await apply(plugin.id, { contentHash, apply: [{ itemType: 'refreshInterval', key: 'refreshInterval' }] }), 409)

      expect(refusal.code).toBe('recipe-changed')
      expect((await read(plugin.id)).refreshInterval).toBe(60)
    })

    it('answers 404 plugin-not-from-recipe for a Plugin that was not imported from a Recipe', async () => {
      const built = await (await http.postJson('/api/plugins', { kind: 'Poll', name: 'Hand-built' })).json() as PluginDetail

      const refusal = await refused(await apply(built.id, { contentHash: 'x', apply: [] }), 404)

      expect(refusal.code).toBe('plugin-not-from-recipe')
    })
  })
})
