import type { ConfigService } from '@nestjs/config'
import type { ApiError, PluginDetail } from 'kuroshiro-shared'
import type { DataSource, DeepPartial } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { Screen } from '../../screens/screens.entity.js'
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

describe('deleting, duplicating and exporting a Plugin, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let plugins: PluginsService
  let scheduler: PluginSchedulerService
  let assignments: PluginAssignmentsService
  let deviceCount = 0

  beforeAll(async () => {
    database = await createTestDatabase()

    const renderer = new PluginRendererService()
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const config = asService<ConfigService>({ get: () => false, getOrThrow: () => API_URL })
    const resolver = new PluginDataResolverService(new PluginDataFetcherService(renderer, config), new PluginTransformService())
    const renderCache = new PluginRenderCacheService(renderer, database.getRepository(Screen))
    const refresh = new PluginRefreshService(renderCache, new PluginTemplateContextService(fieldValues, resolver), new DataSourceFetchOutcomeService(database.getRepository(PluginDataSource)), database.getRepository(Plugin))
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
        { provide: PluginExporterService, useValue: new PluginExporterService() },
        { provide: RecipeUpdateService, useValue: asService<RecipeUpdateService>({}) },
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
  })

  afterAll(async () => {
    scheduler.onModuleDestroy()
    await http.app.close()
    await database.destroy()
  })

  async function addDevice(name: string): Promise<Device> {
    deviceCount += 1
    return database.getRepository(Device).save({ name, friendlyId: `DEV${deviceCount}`, mac: `AA:BB:CC:DD:EE:${String(deviceCount).padStart(2, '0')}`, apikey: `device-secret-${deviceCount}`, refreshRate: 300 })
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
      refreshInterval: 30,
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', headers: { Authorization: 'Bearer abc' } }],
      templates: [{ layout: 'full', liquidMarkup: '<p>{{ weather.temperature }}</p>' }],
      ...overrides,
    })
  }

  function createWebhookPlugin(overrides: Partial<Parameters<PluginsService['create']>[0]> = {}) {
    return plugins.create({
      name: 'Sensor Feed',
      kind: 'Webhook',
      mergeStrategy: 'stream',
      streamLimit: 12,
      templates: [{ layout: 'full', liquidMarkup: '<p>{{ reading }}</p>' }],
      ...overrides,
    })
  }

  function send(method: 'DELETE' | 'POST', path: string): Promise<Response> {
    return http.request(path, { method })
  }

  async function ordersOf(device: Device): Promise<Array<[string | null | undefined, number]>> {
    const screens = await database.getRepository(Screen).find({ where: { device: { id: device.id } }, order: { order: 'ASC' } })
    return screens.map(screen => [screen.filename, screen.order])
  }

  async function exportedSettings(pluginId: string): Promise<Record<string, unknown>> {
    const response = await http.request(`/api/plugins/${pluginId}/export`)
    expect(response.status).toBe(200)
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()))
    return yaml.load(zip.readAsText('src/settings.yml')) as Record<string, unknown>
  }

  describe('dELETE /api/plugins/:id', () => {
    it('answers 204 with no body, and the Plugin, its assignments and its Screens are gone', async () => {
      const kitchen = await addDevice('Kitchen')
      const plugin = await createPollPlugin()
      await assignments.assign(plugin.id, kitchen.id)

      const response = await send('DELETE', `/api/plugins/${plugin.id}`)

      expect(response.status).toBe(204)
      expect(await response.text()).toBe('')
      expect(await database.getRepository(Plugin).countBy({ id: plugin.id })).toBe(0)
      expect(await database.getRepository(DevicePlugin).count()).toBe(0)
      expect(await database.getRepository(Screen).count()).toBe(0)
      expect(scheduler.hasScheduledJob(plugin.id)).toBe(false)
    })

    it('closes the gap its Screen leaves in the Order of every Device it was on', async () => {
      const [kitchen, hall] = [await addDevice('Kitchen'), await addDevice('Hall')]
      const plugin = await createPollPlugin()
      await addScreen(kitchen, 1)
      await assignments.assign(plugin.id, kitchen.id)
      await addScreen(kitchen, 3)
      await assignments.assign(plugin.id, hall.id)
      await addScreen(hall, 2)
      await addScreen(hall, 3)

      await send('DELETE', `/api/plugins/${plugin.id}`)

      expect(await ordersOf(kitchen)).toEqual([['Screen 1', 1], ['Screen 3', 2]])
      expect(await ordersOf(hall)).toEqual([['Screen 2', 1], ['Screen 3', 2]])
    })

    it('answers 404 plugin-not-found for an id no Plugin has, and for one that is no id at all', async () => {
      for (const id of [UNKNOWN_ID, 'not-an-id']) {
        const response = await send('DELETE', `/api/plugins/${id}`)
        const envelope: ApiError = await response.json()

        expect(response.status).toBe(404)
        expect(envelope.code).toBe('plugin-not-found')
      }
    })

    it('answers 409 plugin-in-mashup naming every Mashup the Plugin fills a slot in, and deletes nothing', async () => {
      const [kitchen, hall] = [await addDevice('Kitchen'), await addDevice('Hall')]
      const plugin = await createPollPlugin()
      const other = await createPollPlugin({ name: 'Other' })
      const morning = await addMashup(kitchen, 'Morning', 1, [plugin.id, other.id])
      const evening = await addMashup(hall, 'Evening', 1, [other.id, plugin.id])

      const response = await send('DELETE', `/api/plugins/${plugin.id}`)
      const envelope: ApiError = await response.json()

      expect(response.status).toBe(409)
      expect(envelope.code).toBe('plugin-in-mashup')
      expect(envelope.details).toEqual({
        mashups: [
          { screenId: evening.id, name: 'Evening', deviceId: hall.id, deviceName: 'Hall' },
          { screenId: morning.id, name: 'Morning', deviceId: kitchen.id, deviceName: 'Kitchen' },
        ],
      })
      expect(await database.getRepository(Plugin).countBy({ id: plugin.id })).toBe(1)
      expect(scheduler.hasScheduledJob(plugin.id)).toBe(true)
    })
  })

  describe('pOST /api/plugins/:id/duplicate', () => {
    it('answers 201 with the copy as a PluginDetail: named "(copy)", on no Device, with the template, Data Sources, Plugin Fields and Field Values', async () => {
      const kitchen = await addDevice('Kitchen')
      const source = await createPollPlugin({
        description: 'Shows the weather',
        fields: [
          { keyname: 'city', name: 'City', fieldType: 'string', required: true },
          { keyname: 'token', name: 'Token', fieldType: 'password' },
        ],
        fieldValues: { city: 'Berlin', token: 'hunter2' },
      })
      await assignments.assign(source.id, kitchen.id)

      const response = await send('POST', `/api/plugins/${source.id}/duplicate`)
      const copy: PluginDetail = await response.json()

      expect(response.status).toBe(201)
      expect(copy.id).not.toBe(source.id)
      expect(copy).toMatchObject({
        name: 'Weather (copy)',
        description: 'Shows the weather',
        kind: 'Poll',
        refreshInterval: 30,
        templates: [{ size: 'full', liquidMarkup: '<p>{{ weather.temperature }}</p>' }],
        fieldValues: { city: { secret: false, value: 'Berlin' }, token: { secret: true, set: true } },
        assignments: [],
        mashups: [],
        webhook: null,
        recipe: null,
      })
      expect(copy.dataSources).toMatchObject([{ name: 'weather', url: 'https://api.example.com/weather', headers: { Authorization: 'Bearer abc' } }])
      expect(copy.fields.map(field => field.keyname)).toEqual(['city', 'token'])
      expect(await database.getRepository(Plugin).count()).toBe(2)
    })

    it('gives the copy of a Webhook-kind Plugin its own Webhook Token and an empty Webhook Payload, and keeps the Merge Strategy', async () => {
      const source = await createWebhookPlugin()
      await database.getRepository(Plugin).update(source.id, { webhookPayload: { reading: 4 } })

      const response = await send('POST', `/api/plugins/${source.id}/duplicate`)
      const copy: PluginDetail = await response.json()

      expect(copy.webhook).toMatchObject({ mergeStrategy: 'stream', streamLimit: 12, payload: null, payloadReceivedAt: null })
      expect(copy.webhook!.token).toBeTruthy()
      expect(copy.webhook!.token).not.toBe(source.webhookToken)
    })

    it('keeps the copy of a Recipe\'s Plugin tied to that Recipe, with the Recipe Snapshot as old as its source\'s', async () => {
      const source = await createPollPlugin({ sourceRecipeId: '41120', sourceRecipeSnapshot: { name: 'Weather Recipe' } })
      const snapshotTakenAt = new Date('2026-09-01T10:00:00.000Z')
      await database.getRepository(Plugin).update(source.id, { snapshotTakenAt })

      const response = await send('POST', `/api/plugins/${source.id}/duplicate`)
      const copy: PluginDetail = await response.json()

      expect(copy.recipe).toMatchObject({ id: '41120', name: 'Weather Recipe', snapshotTakenAt: snapshotTakenAt.toISOString() })
    })

    it('answers 404 plugin-not-found for an id no Plugin has, and for one that is no id at all', async () => {
      for (const id of [UNKNOWN_ID, 'not-an-id']) {
        const response = await send('POST', `/api/plugins/${id}/duplicate`)
        const envelope: ApiError = await response.json()

        expect(response.status).toBe(404)
        expect(envelope.code).toBe('plugin-not-found')
      }
    })
  })

  describe('gET /api/plugins/:id/export', () => {
    it('writes the Plugin Kind, the Merge Strategy and the Stream Limit of a Webhook-kind Plugin into src/settings.yml', async () => {
      const plugin = await createWebhookPlugin()

      expect(await exportedSettings(plugin.id)).toEqual({ strategy: 'webhook', merge_strategy: 'stream', stream_limit: 12 })
    })

    it('writes src/settings.yml for a Poll-kind Plugin as polling, also when it has no Data Source', async () => {
      const withSource = await createPollPlugin()
      const without = await createPollPlugin({ name: 'Clock', dataSources: [] })

      expect(await exportedSettings(withSource.id)).toMatchObject({ strategy: 'polling', refresh_interval: 30, data_sources: [{ name: 'weather' }] })
      expect(await exportedSettings(without.id)).toEqual({ strategy: 'polling', refresh_interval: 30, data_sources: [] })
    })

    it('names the file after the Plugin in a header that a quote or a letter outside ASCII in the name cannot break', async () => {
      const plugin = await createPollPlugin({ name: 'The "Wetter" Übersicht' })

      const response = await http.request(`/api/plugins/${plugin.id}/export`)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/zip')
      expect(response.headers.get('content-disposition')).toBe(
        'attachment; filename="The _Wetter_ _bersicht.trmnlp.zip"; filename*=UTF-8\'\'The%20_Wetter_%20%C3%9Cbersicht.trmnlp.zip',
      )
    })

    it('answers 404 plugin-not-found in the error envelope for an id no Plugin has, and for one that is no id at all', async () => {
      for (const id of [UNKNOWN_ID, 'not-an-id']) {
        const response = await http.request(`/api/plugins/${id}/export`)
        const envelope: ApiError = await response.json()

        expect(response.status).toBe(404)
        expect(envelope.code).toBe('plugin-not-found')
      }
    })
  })
})
