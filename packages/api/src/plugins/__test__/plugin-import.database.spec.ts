import type { ConfigService } from '@nestjs/config'
import type { ApiError, PluginDetail, PluginImportResult } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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

/** What TRMNL or GitHub answers; the spec's own requests to the app under test go through. */
function upstreamAnswers(answer: (url: string) => Response | Promise<Response>): string[] {
  const asked: string[] = []
  mockFetch.mockImplementation(async (input, init) => {
    if (String(input).startsWith('http://127.0.0.1'))
      return realFetch(input, init)
    asked.push(String(input))
    return answer(String(input))
  })
  return asked
}

type Files = Record<string, string>

function zipOf(files: Files): Buffer {
  const zip = new AdmZip()
  Object.entries(files).forEach(([path, content]) => zip.addFile(path, Buffer.from(content, 'utf8')))
  return zip.toBuffer()
}

const zipResponse = (files: Files) => new Response(new Uint8Array(zipOf(files)), { status: 200 })

const WEATHER_FILES: Files = {
  '.trmnlp.yml': yaml.dump({ name: 'Weather', description: 'The forecast', custom_fields: [{ keyname: 'city', field_type: 'string', name: 'City', default_value: 'Berlin' }] }),
  'src/settings.yml': yaml.dump({ strategy: 'polling', refresh_interval: 30, data_sources: [{ name: 'weather', endpoint: 'https://api.example.com/weather', method: 'GET' }] }),
  'src/full.liquid': '<p>{{ weather.temperature }}</p>',
}

const RECIPE_FILES: Files = {
  'settings.yml': yaml.dump({ name: 'Moon Phase', description: 'Tonight\'s moon', strategy: 'polling', refresh_interval: 60, polling_url: 'https://api.example.com/moon', polling_verb: 'get' }),
  'full.liquid': '<p>{{ phase }}</p>',
}

describe('importing a Plugin, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let scheduler: PluginSchedulerService

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
    const assignments = new PluginAssignmentsService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DevicePlugin))
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

    http = await createHttpTestApp({
      controllers: [PluginsController],
      providers: [
        { provide: PluginsService, useValue: plugins },
        { provide: PluginReadsService, useValue: new PluginReadsService(database.getRepository(Plugin), database.getRepository(Screen), database.getRepository(Alert), fieldValues, config) },
        { provide: PluginPreviewDataService, useValue: asService<PluginPreviewDataService>({}) },
        { provide: PluginAssignmentsService, useValue: assignments },
        { provide: PluginImporterService, useValue: new PluginImporterService() },
        { provide: PluginExporterService, useValue: new PluginExporterService() },
        { provide: RecipeUpdateService, useValue: asService<RecipeUpdateService>({}) },
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    upstreamAnswers(() => new Response(null, { status: 404 }))
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
  })

  afterAll(async () => {
    scheduler.onModuleDestroy()
    await http.app.close()
    await database.destroy()
  })

  function upload(content: Buffer, fileName: string, fields: Record<string, string> = {}): Promise<Response> {
    const form = new FormData()
    Object.entries(fields).forEach(([name, value]) => form.append(name, value))
    form.append('file', new Blob([new Uint8Array(content)]), fileName)
    return http.request('/api/plugins/import', { method: 'POST', body: form })
  }

  async function imported(response: Response): Promise<PluginImportResult> {
    expect(response.status).toBe(201)
    return response.json()
  }

  async function refused(response: Response, status: number): Promise<ApiError> {
    expect(response.status).toBe(status)
    return response.json()
  }

  async function listed(): Promise<Array<{ name: string }>> {
    return (await http.request('/api/plugins')).json()
  }

  async function addKitchenWithTwoScreens(): Promise<Device> {
    const kitchen = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'KITCHN', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
    const screen = { type: 'html' as const, html: '<p>Hi</p>', fetchManual: false, generatedAt: new Date(), device: kitchen }
    await database.getRepository(Screen).save([
      { ...screen, filename: 'Welcome', order: 1, isActive: true },
      { ...screen, filename: 'Notes', order: 2, isActive: false },
    ])
    return kitchen
  }

  async function screensOf(device: Device): Promise<Array<{ id: string, isActive: boolean }>> {
    const screens = await database.getRepository(Screen).find({ where: { device: { id: device.id } }, order: { order: 'ASC' } })
    return screens.map(({ id, isActive }) => ({ id, isActive }))
  }

  describe('from a file, POST /api/plugins/import', () => {
    it('imports a .zip and answers the Plugin as a read gives it, with where it came from', async () => {
      const result = await imported(await upload(zipOf(WEATHER_FILES), 'weather.trmnlp.zip'))

      expect(result.origin).toEqual({ type: 'file', fileName: 'weather.trmnlp.zip' })
      expect(result.hasTransform).toBe(false)
      expect(result.plugin).toMatchObject({
        name: 'Weather',
        description: 'The forecast',
        kind: 'Poll',
        refreshInterval: 30,
        templates: [{ size: 'full', liquidMarkup: '<p>{{ weather.temperature }}</p>' }],
        dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com/weather' }],
        fields: [{ keyname: 'city', label: 'City', default: 'Berlin' }],
        recipe: null,
        webhook: null,
        assignments: [],
      })
      expect(await (await http.request(`/api/plugins/${result.plugin.id}`)).json()).toEqual(result.plugin)
      expect(scheduler.hasScheduledJob(result.plugin.id)).toBe(true)
    })

    it('keeps the upload in memory: nothing is written to ./uploads', async () => {
      const before = fs.existsSync('uploads') ? fs.readdirSync('uploads') : null

      await imported(await upload(zipOf(WEATHER_FILES), 'weather.zip'))

      expect(fs.existsSync('uploads') ? fs.readdirSync('uploads') : null).toEqual(before)
    })

    it('names the Plugin after the file when neither the manifest nor the settings name it', async () => {
      const result = await imported(await upload(zipOf({ ...WEATHER_FILES, '.trmnlp.yml': yaml.dump({ custom_fields: [] }) }), 'bus_times.trmnlp.zip'))

      expect(result.plugin.name).toBe('bus times')
    })

    it('says that the import brings a transform', async () => {
      const settings = yaml.dump({ strategy: 'polling', data_sources: [{ name: 'weather', endpoint: 'https://api.example.com/weather', transform_js: 'function transform(input) { return input }' }] })

      const result = await imported(await upload(zipOf({ ...WEATHER_FILES, 'src/settings.yml': settings }), 'weather.zip'))

      expect(result.hasTransform).toBe(true)
      expect(result.plugin.dataSources[0].transformJs).toBe('function transform(input) { return input }')
    })

    it.each([
      ['a bare manifest', Buffer.from(WEATHER_FILES['.trmnlp.yml']), 'weather.trmnlp.yml'],
      ['a .zip by name only', Buffer.from('not a zip at all'), 'weather.zip'],
      ['a .zip under another name', zipOf(WEATHER_FILES), 'weather.tar'],
    ])('refuses %s with 400 import-not-zip', async (_what, content, fileName) => {
      const refusal = await refused(await upload(content, fileName), 400)

      expect(refusal.code).toBe('import-not-zip')
      expect(await listed()).toEqual([])
    })

    it('refuses a request without a file', async () => {
      const refusal = await refused(await http.request('/api/plugins/import', { method: 'POST', body: new FormData() }), 400)

      expect(refusal.code).toBe('import-not-zip')
    })

    it.each([
      ['no .trmnlp.yml', { 'src/settings.yml': WEATHER_FILES['src/settings.yml'], 'src/full.liquid': '<p>Hi</p>' }],
      ['no .liquid Template', { '.trmnlp.yml': WEATHER_FILES['.trmnlp.yml'], 'src/settings.yml': WEATHER_FILES['src/settings.yml'] }],
      ['a manifest that is not YAML', { ...WEATHER_FILES, '.trmnlp.yml': 'name: [unclosed' }],
      ['a manifest that is a list', { ...WEATHER_FILES, '.trmnlp.yml': '- a\n- b' }],
      ['settings that are not YAML', { ...WEATHER_FILES, 'src/settings.yml': 'strategy: {unclosed' }],
    ])('refuses a .zip with %s with 422 import-no-plugin', async (_what, files) => {
      const refusal = await refused(await upload(zipOf(files), 'weather.zip'), 422)

      expect(refusal.code).toBe('import-no-plugin')
      expect(await listed()).toEqual([])
    })

    it('refuses the legacy single-source format with 422 import-legacy-format', async () => {
      const settings = yaml.dump({ data_source: { endpoint: 'https://api.example.com/weather' } })

      const refusal = await refused(await upload(zipOf({ ...WEATHER_FILES, 'src/settings.yml': settings }), 'weather.zip'), 422)

      expect(refusal.code).toBe('import-legacy-format')
    })

    it('refuses a Data Source without an address with 422, not a server error', async () => {
      const settings = yaml.dump({ data_sources: [{ name: 'weather' }] })

      const refusal = await refused(await upload(zipOf({ ...WEATHER_FILES, 'src/settings.yml': settings }), 'weather.zip'), 422)

      expect(refusal.code).toBe('unprocessable')
      expect(refusal.message).toContain('"weather"')
    })

    it('imports a Template that does not parse as it is', async () => {
      const broken = '{% if weather %}<p>{{ weather.temperature'

      const result = await imported(await upload(zipOf({ ...WEATHER_FILES, 'src/full.liquid': broken }), 'weather.zip'))

      expect(result.plugin.templates).toEqual([{ size: 'full', liquidMarkup: broken }])
    })

    it('makes the first Template full when the .zip holds none of that size', async () => {
      const { 'src/full.liquid': _full, ...withoutFull } = WEATHER_FILES

      const result = await imported(await upload(zipOf({ ...withoutFull, 'src/half_vertical.liquid': '<p>half</p>', 'src/quadrant.liquid': '<p>quadrant</p>' }), 'weather.zip'))

      expect(result.plugin.templates).toEqual([
        { size: 'full', liquidMarkup: '<p>half</p>' },
        { size: 'quadrant', liquidMarkup: '<p>quadrant</p>' },
      ])
    })

    it('imports a Poll-kind Plugin without Data Sources, as its export writes it', async () => {
      const settings = yaml.dump({ strategy: 'polling', refresh_interval: 45, data_sources: [] })

      const result = await imported(await upload(zipOf({ ...WEATHER_FILES, 'src/settings.yml': settings }), 'weather.zip'))

      expect(result.plugin).toMatchObject({ kind: 'Poll', refreshInterval: 45, dataSources: [] })
    })

    it('imports a Plugin whose settings name no address as a Poll-kind Plugin without Data Sources', async () => {
      const result = await imported(await upload(zipOf({ ...WEATHER_FILES, 'src/settings.yml': yaml.dump({ refresh_interval: 45 }) }), 'weather.zip'))

      expect(result.plugin).toMatchObject({ kind: 'Poll', dataSources: [] })
    })

    it('gives back a Webhook-kind Plugin with its Merge Strategy and Stream Limit from its own export, under a new Webhook Token', async () => {
      const original: PluginDetail = await (await http.postJson('/api/plugins', { kind: 'Webhook', name: 'Sensor Feed', mergeStrategy: 'stream', streamLimit: 12 })).json()
      const exported = await http.request(`/api/plugins/${original.id}/export`)

      const result = await imported(await upload(Buffer.from(await exported.arrayBuffer()), 'Sensor Feed.trmnlp.zip'))

      expect(result.plugin).toMatchObject({
        name: 'Sensor Feed',
        kind: 'Webhook',
        refreshInterval: null,
        dataSources: [],
        templates: original.templates,
        webhook: { mergeStrategy: 'stream', streamLimit: 12, payload: null },
      })
      expect(result.plugin.id).not.toBe(original.id)
      expect(result.plugin.webhook!.token).toEqual(expect.stringMatching(/\S{16,}/))
      expect(result.plugin.webhook!.token).not.toBe(original.webhook!.token)
    })

    it('gives back a Webhook-kind Plugin without a Stream Limit from its own export', async () => {
      const original: PluginDetail = await (await http.postJson('/api/plugins', { kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'deep_merge' })).json()
      const exported = await http.request(`/api/plugins/${original.id}/export`)

      const result = await imported(await upload(Buffer.from(await exported.arrayBuffer()), 'Doorbell note.trmnlp.zip'))

      expect(result.plugin).toMatchObject({ kind: 'Webhook', webhook: { mergeStrategy: 'deep_merge', streamLimit: null } })
    })

    it.each([undefined, null, 0, 2.5, 'twelve'])('refuses a stream whose Stream Limit is %s with 422, not a server error', async (stream_limit) => {
      const settings = yaml.dump({ strategy: 'webhook', merge_strategy: 'stream', stream_limit })

      const refusal = await refused(await upload(zipOf({ ...WEATHER_FILES, 'src/settings.yml': settings }), 'feed.zip'), 422)

      expect(refusal.code).toBe('unprocessable')
      expect(await listed()).toEqual([])
    })

    it('imports a Plugin that TRMNL exported with a webhook strategy as a Webhook-kind Plugin that replaces its payload', async () => {
      const result = await imported(await upload(zipOf({ ...WEATHER_FILES, 'src/settings.yml': yaml.dump({ strategy: 'webhook' }) }), 'feed.zip'))

      expect(result.plugin).toMatchObject({ kind: 'Webhook', dataSources: [], webhook: { mergeStrategy: 'standard', streamLimit: null } })
    })

    it('assigns the Plugin to the Device it carries, as its last Screen, and leaves the Active Screen alone', async () => {
      const kitchen = await addKitchenWithTwoScreens()
      const [welcome, notes] = await screensOf(kitchen)

      const result = await imported(await upload(zipOf(WEATHER_FILES), 'weather.zip', { deviceId: kitchen.id }))

      expect(result.plugin.assignments).toMatchObject([{ deviceId: kitchen.id, deviceName: 'Kitchen', order: 3, screenCount: 3 }])
      expect(await screensOf(kitchen)).toEqual([welcome, notes, { id: result.plugin.assignments[0].screenId, isActive: false }])
      expect(welcome.isActive).toBe(true)
    })

    it.each([UNKNOWN_ID, 'attic'])('answers 404 for the Device "%s", which does not exist, and imports nothing', async (deviceId) => {
      const refusal = await refused(await upload(zipOf(WEATHER_FILES), 'weather.zip', { deviceId }), 404)

      expect(refusal.code).toBe('device-not-found')
      expect(await listed()).toEqual([])
    })
  })

  describe('from a GitHub repository, POST /api/plugins/import-github', () => {
    const inRepository = (files: Files) => Object.fromEntries(Object.entries(files).map(([path, content]) => [`weather-plugin-main/${path}`, content]))

    it.each([
      'https://github.com/usetrmnl/weather-plugin',
      'https://github.com/usetrmnl/weather-plugin/',
      ' https://github.com/usetrmnl/weather-plugin.git ',
    ])('imports the Plugin at the root of the branch main of %s', async (githubUrl) => {
      const asked = upstreamAnswers(() => zipResponse(inRepository(WEATHER_FILES)))

      const result = await imported(await http.postJson('/api/plugins/import-github', { githubUrl }))

      expect(asked).toEqual(['https://github.com/usetrmnl/weather-plugin/archive/refs/heads/main.zip'])
      expect(result.origin).toEqual({ type: 'github', repository: 'usetrmnl/weather-plugin' })
      expect(result.hasTransform).toBe(false)
      expect(result.plugin).toMatchObject({ name: 'Weather', kind: 'Poll', recipe: null, dataSources: [{ name: 'weather' }], assignments: [] })
    })

    it('names the Plugin after the repository when nothing in it does', async () => {
      upstreamAnswers(() => zipResponse(inRepository({ ...WEATHER_FILES, '.trmnlp.yml': yaml.dump({ custom_fields: [] }) })))

      const result = await imported(await http.postJson('/api/plugins/import-github', { githubUrl: 'https://github.com/usetrmnl/weather-plugin' }))

      expect(result.plugin.name).toBe('weather plugin')
    })

    it.each([
      '',
      'usetrmnl/weather-plugin',
      'https://gitlab.com/usetrmnl/weather-plugin',
      'https://github.com/usetrmnl',
      'https://github.com/usetrmnl/weather-plugin/tree/develop/plugins/weather',
    ])('refuses the address "%s" with 400 github-url-invalid, without asking GitHub', async (githubUrl) => {
      const asked = upstreamAnswers(() => zipResponse(inRepository(WEATHER_FILES)))

      const refusal = await refused(await http.postJson('/api/plugins/import-github', { githubUrl }), 400)

      expect(refusal.code).toBe('github-url-invalid')
      expect(asked).toEqual([])
    })

    it.each([
      ['no address', {}],
      ['an address that is not text', { githubUrl: 7 }],
      ['a key the route does not know', { githubUrl: 'https://github.com/usetrmnl/weather-plugin', branch: 'develop' }],
    ])('refuses a body with %s as not valid', async (_what, body) => {
      const refusal = await refused(await http.postJson('/api/plugins/import-github', body), 400)

      expect(refusal.code).toBe('validation')
    })

    it('answers 422 github-repo-not-found for a repository GitHub does not have, or not publicly', async () => {
      upstreamAnswers(() => new Response('Not Found', { status: 404 }))

      const refusal = await refused(await http.postJson('/api/plugins/import-github', { githubUrl: 'https://github.com/usetrmnl/private-plugin' }), 422)

      expect(refusal).toMatchObject({ code: 'github-repo-not-found', details: { repository: 'usetrmnl/private-plugin' } })
    })

    it('answers 422 import-no-plugin for a repository without a Plugin', async () => {
      upstreamAnswers(() => zipResponse({ 'weather-plugin-main/README.md': '# Weather' }))

      const refusal = await refused(await http.postJson('/api/plugins/import-github', { githubUrl: 'https://github.com/usetrmnl/weather-plugin' }), 422)

      expect(refusal.code).toBe('import-no-plugin')
      expect(await listed()).toEqual([])
    })

    it.each([
      ['does not answer', () => Promise.reject(new TypeError('fetch failed')), 'fetch failed'],
      ['answers 503', () => new Response(null, { status: 503 }), 'it answered 503'],
      ['answers something that is not a .zip', () => new Response('<html>'), 'what it answered is not a .zip'],
    ])('answers 502 upstream-unreachable with the reason when GitHub %s', async (_what, answer, reason) => {
      upstreamAnswers(answer)

      const refusal = await refused(await http.postJson('/api/plugins/import-github', { githubUrl: 'https://github.com/usetrmnl/weather-plugin' }), 502)

      expect(refusal).toMatchObject({ code: 'upstream-unreachable', details: { reason } })
    })

    it('assigns the Plugin to the Device it carries, as its last Screen, and leaves the Active Screen alone', async () => {
      upstreamAnswers(() => zipResponse(inRepository(WEATHER_FILES)))
      const kitchen = await addKitchenWithTwoScreens()
      const [welcome, notes] = await screensOf(kitchen)

      const result = await imported(await http.postJson('/api/plugins/import-github', { githubUrl: 'https://github.com/usetrmnl/weather-plugin', deviceId: kitchen.id }))

      expect(result.plugin.assignments).toMatchObject([{ deviceId: kitchen.id, order: 3, screenCount: 3 }])
      expect(await screensOf(kitchen)).toEqual([welcome, notes, { id: result.plugin.assignments[0].screenId, isActive: false }])
    })

    it('answers 404 for a Device that does not exist, and imports nothing', async () => {
      upstreamAnswers(() => zipResponse(inRepository(WEATHER_FILES)))

      const refusal = await refused(await http.postJson('/api/plugins/import-github', { githubUrl: 'https://github.com/usetrmnl/weather-plugin', deviceId: UNKNOWN_ID }), 404)

      expect(refusal.code).toBe('device-not-found')
      expect(await listed()).toEqual([])
    })
  })

  describe('from a Recipe, POST /api/plugins/import-recipe', () => {
    const recipeSettings = (settings: Record<string, unknown>) => ({ ...RECIPE_FILES, 'settings.yml': yaml.dump({ name: 'Moon Phase', ...settings }) })

    it.each(['41120', 'https://trmnl.com/recipes/41120'])('imports the Recipe named by "%s" as a Poll-kind Plugin tied to it, with its Recipe Snapshot taken now', async (recipe) => {
      const asked = upstreamAnswers(() => zipResponse(RECIPE_FILES))
      const before = Date.now()

      const result = await imported(await http.postJson('/api/plugins/import-recipe', { recipe }))

      expect(asked).toEqual(['https://trmnl.com/api/plugin_settings/41120/archive'])
      expect(result.origin).toEqual({ type: 'recipe', id: '41120', name: 'Moon Phase' })
      expect(result.hasTransform).toBe(false)
      expect(result.plugin).toMatchObject({
        name: 'Moon Phase',
        description: 'Tonight\'s moon',
        kind: 'Poll',
        refreshInterval: 60,
        templates: [{ size: 'full', liquidMarkup: '<p>{{ phase }}</p>' }],
        dataSources: [{ name: 'source', mode: 'fetch', method: 'GET', url: 'https://api.example.com/moon' }],
        recipe: { id: '41120', name: 'Moon Phase' },
        assignments: [],
      })
      const snapshotTakenAt = Date.parse(result.plugin.recipe!.snapshotTakenAt!)
      expect(snapshotTakenAt).toBeGreaterThanOrEqual(before - 1000)
      expect(snapshotTakenAt).toBeLessThanOrEqual(Date.now() + 1000)
      expect(await listed()).toMatchObject([{ name: 'Moon Phase', sourceRecipeId: '41120' }])
    })

    it('reads a Plugin Field\'s default as TRMNL writes it, whatever its type', async () => {
      upstreamAnswers(() => zipResponse(recipeSettings({
        strategy: 'polling',
        polling_url: 'https://api.example.com/moon',
        custom_fields: [
          { keyname: 'units', field_type: 'select', name: 'Units', options: ['metric', 'imperial'], default: 'metric' },
          { keyname: 'time_format', field_type: 'number', name: 'Time format', default: 12 },
          { keyname: 'fill_screen', field_type: 'boolean', name: 'Fill the screen', default: false },
          { keyname: 'city', field_type: 'string', name: 'City' },
        ],
      })))

      const result = await imported(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }))

      expect(result.plugin.fields.map(field => [field.keyname, field.default])).toEqual([['units', 'metric'], ['time_format', '12'], ['fill_screen', 'false'], ['city', null]])
    })

    it('imports a Recipe that holds fixed data, and one whose Template does not parse', async () => {
      upstreamAnswers(() => zipResponse({ ...recipeSettings({ strategy: 'static', static_data: { phase: 'full' } }), 'full.liquid': '{% if phase' }))

      const result = await imported(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }))

      expect(result.plugin).toMatchObject({
        templates: [{ size: 'full', liquidMarkup: '{% if phase' }],
        dataSources: [{ name: 'source', mode: 'literal', literalValue: { phase: 'full' } }],
      })
    })

    it('says that the Recipe brings a transform', async () => {
      upstreamAnswers(() => zipResponse({ ...RECIPE_FILES, 'transform.js': 'function transform(input) { return input }' }))

      const result = await imported(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }))

      expect(result.hasTransform).toBe(true)
    })

    it.each(['', 'weather', 'https://trmnl.com/plugins/41120'])('refuses "%s" with 400 recipe-id-invalid, without asking TRMNL', async (recipe) => {
      const asked = upstreamAnswers(() => zipResponse(RECIPE_FILES))

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe }), 400)

      expect(refusal.code).toBe('recipe-id-invalid')
      expect(asked).toEqual([])
    })

    it.each([
      ['no Recipe', {}],
      ['the key of the old route', { recipeId: '41120' }],
    ])('refuses a body with %s as not valid', async (_what, body) => {
      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', body), 400)

      expect(refusal.code).toBe('validation')
    })

    it('answers 422 recipe-not-found, naming the id, for a Recipe TRMNL does not have', async () => {
      upstreamAnswers(() => new Response('{}', { status: 404 }))

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe: '999' }), 422)

      expect(refusal).toMatchObject({ code: 'recipe-not-found', details: { id: '999' } })
    })

    it('answers 422 recipe-oauth for a Recipe that signs in to another service', async () => {
      upstreamAnswers(() => zipResponse(recipeSettings({ strategy: 'polling', polling_url: 'https://api.example.com/moon', oauth_enabled: true })))

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }), 422)

      expect(refusal.code).toBe('recipe-oauth')
    })

    it.each(['webhook', 'plugin_merge', undefined])('answers 422 recipe-strategy-unsupported for a Recipe of strategy "%s"', async (strategy) => {
      upstreamAnswers(() => zipResponse(recipeSettings({ strategy })))

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }), 422)

      expect(refusal).toMatchObject({ code: 'recipe-strategy-unsupported', details: { strategy: strategy ?? 'unknown' } })
      expect(await listed()).toEqual([])
    })

    it('imports a "none" strategy Recipe as a Poll-kind Plugin with zero Data Sources, scheduled like any other', async () => {
      upstreamAnswers(() => zipResponse(recipeSettings({ strategy: 'none', polling_url: '', static_data: '' })))

      const result = await imported(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }))

      expect(result.plugin).toMatchObject({ kind: 'Poll', dataSources: [], recipe: { id: '41120', name: 'Moon Phase' } })
      expect(scheduler.hasScheduledJob(result.plugin.id)).toBe(true)
    })

    it('answers 422 recipe-static-transform for fixed data with a transform', async () => {
      upstreamAnswers(() => zipResponse({ ...recipeSettings({ strategy: 'static', static_data: {} }), 'transform.js': 'function transform(input) { return input }' }))

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }), 422)

      expect(refusal.code).toBe('recipe-static-transform')
      expect(refusal.message).toEqual(expect.stringContaining('transform'))
    })

    it('answers 422 recipe-none-transform for no data source with a transform', async () => {
      upstreamAnswers(() => zipResponse({ ...recipeSettings({ strategy: 'none' }), 'transform.js': 'function transform(input) { return input }' }))

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }), 422)

      expect(refusal.code).toBe('recipe-none-transform')
      expect(refusal.message).toEqual(expect.stringContaining('transform'))
    })

    it.each([
      ['does not answer', () => Promise.reject(new TypeError('fetch failed')), 'fetch failed'],
      ['answers 500', () => new Response(null, { status: 500 }), 'it answered 500'],
      ['answers something that is not a Recipe archive', () => new Response('<html>'), 'what it answered is not a Recipe archive'],
    ])('answers 502 upstream-unreachable with the reason when TRMNL %s', async (_what, answer, reason) => {
      upstreamAnswers(answer)

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe: '41120' }), 502)

      expect(refusal).toMatchObject({ code: 'upstream-unreachable', details: { reason } })
      expect(await listed()).toEqual([])
    })

    it('assigns the Plugin to the Device it carries, as its last Screen, and leaves the Active Screen alone', async () => {
      upstreamAnswers(() => zipResponse(RECIPE_FILES))
      const kitchen = await addKitchenWithTwoScreens()
      const [welcome, notes] = await screensOf(kitchen)

      const result = await imported(await http.postJson('/api/plugins/import-recipe', { recipe: '41120', deviceId: kitchen.id }))

      expect(result.plugin.assignments).toMatchObject([{ deviceId: kitchen.id, order: 3, screenCount: 3 }])
      expect(await screensOf(kitchen)).toEqual([welcome, notes, { id: result.plugin.assignments[0].screenId, isActive: false }])
    })

    it('answers 404 for a Device that does not exist, and imports nothing', async () => {
      upstreamAnswers(() => zipResponse(RECIPE_FILES))

      const refusal = await refused(await http.postJson('/api/plugins/import-recipe', { recipe: '41120', deviceId: UNKNOWN_ID }), 404)

      expect(refusal.code).toBe('device-not-found')
      expect(await listed()).toEqual([])
    })
  })
})
