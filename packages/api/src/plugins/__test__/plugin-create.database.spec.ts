import type { ConfigService } from '@nestjs/config'
import type { ApiError, PluginDetail } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
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

// Written out from docs/ui/template-editor.md, "The starter template", whose markup is binding.
const STARTER_MARKUP = `<div class="layout layout--col layout--center">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`

describe('building a Plugin, POST /api/plugins, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let scheduler: PluginSchedulerService

  beforeAll(async () => {
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
        { provide: PluginImporterService, useValue: asService<PluginImporterService>({}) },
        { provide: PluginExporterService, useValue: asService<PluginExporterService>({}) },
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

  async function built(body: Record<string, unknown>): Promise<PluginDetail> {
    const response = await http.postJson('/api/plugins', body)
    expect(response.status).toBe(201)
    return response.json()
  }

  async function refused(body: Record<string, unknown>, status = 400): Promise<ApiError> {
    const response = await http.postJson('/api/plugins', body)
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

  it('builds a Poll-kind Plugin from a name alone: the starter Template, 15 minutes, and scheduled', async () => {
    const plugin = await built({ kind: 'Poll', name: '  Weather ' })

    expect(plugin).toMatchObject({
      name: 'Weather',
      kind: 'Poll',
      refreshInterval: 15,
      templates: [{ size: 'full', liquidMarkup: STARTER_MARKUP }],
      dataSources: [],
      webhook: null,
      assignments: [],
    })
    expect(scheduler.hasScheduledJob(plugin.id)).toBe(true)
    expect(await (await http.request(`/api/plugins/${plugin.id}`)).json()).toEqual(plugin)
  })

  it('builds a Webhook-kind Plugin with its Webhook Token and URL from the first moment', async () => {
    const plugin = await built({ kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'stream', streamLimit: 20 })

    expect(plugin).toMatchObject({
      name: 'Doorbell note',
      kind: 'Webhook',
      refreshInterval: null,
      templates: [{ size: 'full', liquidMarkup: STARTER_MARKUP }],
      webhook: { mergeStrategy: 'stream', streamLimit: 20, payload: null, payloadReceivedAt: null },
    })
    expect(plugin.webhook!.token).toEqual(expect.stringMatching(/\S{16,}/))
    expect(plugin.webhook!.url).toBe(`${API_URL}/api/webhook/${plugin.webhook!.token}`)
  })

  it.each([
    ['a name of nothing but spaces', { kind: 'Poll', name: '   ' }],
    ['no Plugin Kind', { name: 'Weather' }],
    ['Data Sources', { kind: 'Poll', name: 'Weather', dataSources: [] }],
    ['Templates', { kind: 'Poll', name: 'Weather', templates: [{ size: 'full', liquidMarkup: '<p>Hi</p>' }] }],
    ['a refresh interval', { kind: 'Poll', name: 'Weather', refreshInterval: 30 }],
    ['a Merge Strategy on a Poll-kind Plugin', { kind: 'Poll', name: 'Weather', mergeStrategy: 'standard' }],
    ['a Webhook-kind Plugin without a Merge Strategy', { kind: 'Webhook', name: 'Doorbell note' }],
    ['stream without a Stream Limit', { kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'stream' }],
    ['a Stream Limit without stream', { kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'standard', streamLimit: 20 }],
    ['a Stream Limit below 1', { kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'stream', streamLimit: 0 }],
    ['a Stream Limit that is not whole', { kind: 'Webhook', name: 'Doorbell note', mergeStrategy: 'stream', streamLimit: 2.5 }],
  ])('refuses %s and builds nothing', async (_what, body) => {
    await refused(body)

    expect(await listed()).toEqual([])
  })

  it('assigns the new Plugin to the Device it carries, as its last Screen, and leaves the Active Screen alone', async () => {
    const kitchen = await addKitchenWithTwoScreens()
    const [welcome, notes] = await screensOf(kitchen)

    const plugin = await built({ kind: 'Poll', name: 'Weather', deviceId: kitchen.id })

    expect(plugin.assignments).toMatchObject([{ deviceId: kitchen.id, deviceName: 'Kitchen', order: 3, screenCount: 3 }])
    expect(await screensOf(kitchen)).toEqual([welcome, notes, { id: plugin.assignments[0].screenId, isActive: false }])
    expect(welcome.isActive).toBe(true)
  })

  it.each([UNKNOWN_ID, 'attic'])('answers 404 for the Device "%s", which does not exist, and builds nothing', async (deviceId) => {
    const refusal = await refused({ kind: 'Poll', name: 'Weather', deviceId }, 404)

    expect(refusal.code).toBe('device-not-found')
    expect(await listed()).toEqual([])
  })
})
