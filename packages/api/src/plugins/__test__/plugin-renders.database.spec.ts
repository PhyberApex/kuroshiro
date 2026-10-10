import type { ConfigService } from '@nestjs/config'
import type { ApiError, PluginDetail, PreviewData, PreviewDataInput } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { NotificationSenderService } from '../../alerts/notification-sender.service.js'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { FallbackScreensService } from '../../device-models/fallback-screens.service.js'
import type { FirmwareService } from '../../firmware/firmware.service.js'
import type { InstanceSettingsService } from '../../settings/instance-settings.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertSweepService } from '../../alerts/alert-sweep.service.js'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { DeviceDisplayService } from '../../devices/display.service.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { MashupRendererService } from '../../mashup/services/mashup-renderer.service.js'
import { ScreenRenderService } from '../../mashup/services/screen-render.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { stubFetch } from '../../test/fetch.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createMockDeviceModelsService, createMockFallbackScreensService, primeMockDeviceModelsService, primeMockFallbackScreensService } from '../../test/mockDeviceModelsService.js'
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
import { PluginPreviewDataService } from '../services/plugin-preview-data.service.js'
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

vi.mock('../../device-models/render-html-to-png.js', () => ({ renderHtmlToPng: vi.fn().mockResolvedValue(undefined) }))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const TEMPERATURE_READING = 'make=Sensirion;model=SHT4x;kind=temperature;value=21.5;unit=C;created_at=1'

// The spec's own requests go to the test server through the real fetch; only
// a Data Source's fetch is answered by `dataSourceAnswer`.
const realFetch = globalThis.fetch
const mockFetch = stubFetch()
let dataSourceAnswer: (url: string, init?: RequestInit) => Response | Promise<Response>

function isOwnRequest(input: Parameters<typeof fetch>[0]): boolean {
  return String(input).startsWith('http://127.0.0.1')
}

describe('what a Plugin renders from, and with which Template, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let plugins: PluginsService
  let assignments: PluginAssignmentsService
  let scheduler: PluginSchedulerService
  let webhookIngest: WebhookIngestService
  let display: DeviceDisplayService
  let mashupRenderer: MashupRendererService
  let deviceSensors: DeviceSensorsService
  let deviceCount = 0
  const renderer = new PluginRendererService()

  beforeAll(async () => {
    database = await createTestDatabase()

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
    webhookIngest = new WebhookIngestService(database.getRepository(Plugin), refresh)

    deviceSensors = new DeviceSensorsService(database.getRepository(DeviceSensor))
    const deviceModels = createMockDeviceModelsService()
    const fallbackScreens = createMockFallbackScreensService()
    primeMockDeviceModelsService(deviceModels)
    primeMockFallbackScreensService(fallbackScreens)
    mashupRenderer = new MashupRendererService(renderer, deviceSensors, templateContext)
    const screenRender = new ScreenRenderService(
      database.getRepository(Screen),
      config,
      asService<DeviceModelsService>(deviceModels),
      mashupRenderer,
    )
    display = new DeviceDisplayService(
      database.getRepository(Device),
      database.getRepository(Screen),
      config,
      asService<DeviceModelsService>(deviceModels),
      asService<FallbackScreensService>(fallbackScreens),
      asService<FirmwareService>({}),
      renderer,
      deviceSensors,
      templateContext,
      screenRender,
    )

    http = await createHttpTestApp({
      controllers: [PluginsController, WebhookIngestController],
      providers: [
        { provide: getRepositoryToken(Plugin), useValue: database.getRepository(Plugin) },
        { provide: WebhookIngestService, useValue: webhookIngest },
        WebhookPluginGuard,
        { provide: PluginsService, useValue: plugins },
        { provide: PluginReadsService, useValue: new PluginReadsService(database.getRepository(Plugin), database.getRepository(Screen), database.getRepository(Alert), fieldValues, config) },
        { provide: PluginPreviewDataService, useValue: new PluginPreviewDataService(database.getRepository(Plugin), database.getRepository(Device), deviceSensors, templateContext) },
        { provide: PluginAssignmentsService, useValue: assignments },
        { provide: PluginImporterService, useValue: asService<PluginImporterService>({}) },
        { provide: PluginExporterService, useValue: asService<PluginExporterService>({}) },
        { provide: RecipeUpdateService, useValue: asService<RecipeUpdateService>({}) },
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    dataSourceAnswer = () => new Response(JSON.stringify({ temperature: 21 }))
    mockFetch.mockImplementation(async (input, init) => isOwnRequest(input) ? realFetch(input, init) : dataSourceAnswer(String(input), init))
    await database.getRepository(Plugin).createQueryBuilder().delete().execute()
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    await database.getRepository(Alert).createQueryBuilder().delete().execute()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
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

  async function addMashup(device: Device, pluginId: string, slotSizes: string[]): Promise<MashupConfiguration> {
    const screen = await database.getRepository(Screen).save({ type: 'mashup', filename: 'Morning', order: 99, isActive: false, fetchManual: false, generatedAt: new Date(), device })
    const configuration = await database.getRepository(MashupConfiguration).save({ layout: '2x2', screen })
    await database.getRepository(MashupSlot).save(slotSizes.map((size, order) => ({ position: `slot-${order}`, size, order, plugin: { id: pluginId }, mashupConfiguration: configuration })))
    return database.getRepository(MashupConfiguration).findOneOrFail({
      where: { id: configuration.id },
      relations: { slots: { plugin: { dataSources: true, templates: true } } },
    })
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

  function createWebhookPlugin(overrides: Partial<Parameters<PluginsService['create']>[0]> = {}) {
    return plugins.create({ name: 'Sensor Feed', kind: 'Webhook', mergeStrategy: 'standard', templates: [{ layout: 'full', liquidMarkup: '<p>{{ reading }}</p>' }], ...overrides })
  }

  function loadForRender(pluginId: string): Promise<Plugin> {
    return database.getRepository(Plugin).findOneOrFail({ where: { id: pluginId }, relations: { dataSources: true, templates: true, fields: true } })
  }

  async function schedulerTick(pluginId: string): Promise<void> {
    await scheduler.runTick(await loadForRender(pluginId))
  }

  async function cachedOutput(pluginId: string): Promise<string | null | undefined> {
    const screen = await database.getRepository(Screen).findOneOrFail({ where: { plugin: { id: pluginId } } })
    return screen.cachedPluginOutput
  }

  async function read(pluginId: string): Promise<PluginDetail> {
    const response = await http.request(`/api/plugins/${pluginId}`)
    expect(response.status).toBe(200)
    return response.json()
  }

  function requestPreviewData(pluginId: string, body: PreviewDataInput | Record<string, unknown>): Promise<Response> {
    return http.postJson(`/api/plugins/${pluginId}/preview-data`, body)
  }

  async function previewData(pluginId: string, body: PreviewDataInput = { deviceId: null }): Promise<PreviewData> {
    const response = await requestPreviewData(pluginId, body)
    expect(response.status).toBe(200)
    return response.json()
  }

  function dataSourceFetches(): Array<[string, RequestInit | undefined]> {
    return mockFetch.mock.calls.filter(([input]) => !isOwnRequest(input)).map(([input, init]) => [String(input), init])
  }

  describe('one context for every render', () => {
    it('gives the scheduler tick and the on-demand render the same Sensor-less context a Mashup slot and the preview keep the polling Device\'s own Sensors for', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-01T10:00:00.000Z') })
      const plugin = await createPollPlugin({ fields: [{ keyname: 'city', name: 'City' }], fieldValues: { city: 'Berlin' } })
      const device = await addDevice('Kitchen')
      await assignments.assign(plugin.id, device.id)
      await addMashup(device, plugin.id, ['view--quadrant'])
      const render = vi.spyOn(renderer, 'render')
      const contextsGivenToTheTemplate = () => render.mock.calls.filter(([markup]) => markup === '<p>{{ weather.temperature }}</p>').map(([, context]) => context)

      const poll = () => display.getCurrentImage({ 'id': device.mac, 'access-token': device.apikey, 'sensors': TEMPERATURE_READING })
      await poll()
      await poll()
      const [onDemand, mashupSlot] = contextsGivenToTheTemplate()
      render.mockClear()
      await schedulerTick(plugin.id)
      const [tick] = contextsGivenToTheTemplate()
      const preview = await previewData(plugin.id, { deviceId: device.id })

      const sharedRenderExpected = {
        city: 'Berlin',
        weather: { temperature: 21 },
        sensors: {},
        trmnl: {
          system: { timestamp_utc: 1790848800 },
          plugin_settings: { instance_name: 'Weather', strategy: 'polling', dark_mode: 'no', no_screen_padding: 'no', custom_fields_values: { city: 'Berlin' } },
          user: { id: 'kuroshiro-user', locale: 'en' },
        },
      }
      // A Mashup slot and the device-scoped preview are each rendered for one specific
      // Device and stored (or returned) only for that Device, so they keep its Sensors
      // — unlike the shared Plugin Screen cache this issue (#1121) is scoped to.
      const deviceScopedExpected = { ...sharedRenderExpected, sensors: { temperature: { value: 21.5, unit: 'C' } } }
      expect(onDemand).toEqual(sharedRenderExpected)
      expect(mashupSlot).toEqual(deviceScopedExpected)
      expect(preview.context).toEqual(deviceScopedExpected)
      expect(tick).toEqual(sharedRenderExpected)
    })

    it('lets a Webhook-kind Plugin\'s render read trmnl beside its Webhook Payload', async () => {
      const plugin = await createWebhookPlugin({ templates: [{ layout: 'full', liquidMarkup: '{{ trmnl.plugin_settings.instance_name }}: {{ reading }}' }] })
      await assignments.assign(plugin.id, (await addDevice('Kitchen')).id)

      await webhookIngest.ingest(await loadForRender(plugin.id), { reading: 4 })

      expect(await cachedOutput(plugin.id)).toBe('Sensor Feed: 4')
    })
  })

  describe('the Template a render picks, by size', () => {
    const QUADRANT_THEN_FULL = [{ layout: 'quadrant', liquidMarkup: 'quadrant' }, { layout: 'full', liquidMarkup: 'full' }]

    async function slotOutputs(pluginId: string, slotSizes: string[]): Promise<string[]> {
      const device = await addDevice('Hallway')
      const html = await mashupRenderer.renderMashup(await addMashup(device, pluginId, slotSizes), device)
      return [...html.matchAll(/<div class="view [^"]+">([^<]*)<\/div>/g)].map(match => match[1])
    }

    it('renders full on the scheduler tick, though another Template is stored first', async () => {
      const plugin = await createPollPlugin({ templates: QUADRANT_THEN_FULL })
      await assignments.assign(plugin.id, (await addDevice('Kitchen')).id)

      await schedulerTick(plugin.id)

      expect(await cachedOutput(plugin.id)).toBe('full')
    })

    it('renders full on a Webhook render, though another Template is stored first', async () => {
      const plugin = await createWebhookPlugin({ templates: QUADRANT_THEN_FULL })
      await assignments.assign(plugin.id, (await addDevice('Kitchen')).id)

      await webhookIngest.ingest(await loadForRender(plugin.id), { reading: 4 })

      expect(await cachedOutput(plugin.id)).toBe('full')
    })

    it('renders the Template of the slot\'s own size in a Mashup slot, and full in a slot it has no Template for', async () => {
      const plugin = await createPollPlugin({ templates: QUADRANT_THEN_FULL })

      expect(await slotOutputs(plugin.id, ['view--quadrant', 'view--half_vertical', 'view--full'])).toEqual(['quadrant', 'full', 'full'])
    })

    it('renders full in every slot for a Plugin with only that Template', async () => {
      const plugin = await createPollPlugin({ templates: [{ layout: 'full', liquidMarkup: 'full' }] })

      expect(await slotOutputs(plugin.id, ['view--quadrant', 'view--half_vertical', 'view--half_horizontal'])).toEqual(['full', 'full', 'full'])
    })
  })

  // A `strategy: none` Recipe imports as exactly this shape: a Poll-kind
  // Plugin with no Data Sources, tied to the Recipe (issue #1261).
  describe('a Plugin with no Data Sources, as a "none" strategy Recipe imports', () => {
    it('renders on a scheduler tick and on /display from its Template, Fields and trmnl alone', async () => {
      const plugin = await createPollPlugin({
        dataSources: [],
        sourceRecipeId: '490885',
        fields: [{ keyname: 'station', name: 'Station' }],
        fieldValues: { station: 'Hamburg' },
        templates: [{ layout: 'full', liquidMarkup: '{{ station }} ({{ trmnl.plugin_settings.instance_name }})' }],
      })
      const device = await addDevice('Kitchen')
      await assignments.assign(plugin.id, device.id)

      await schedulerTick(plugin.id)

      expect(await cachedOutput(plugin.id)).toBe('Hamburg (Weather)')

      const answer = await display.getCurrentImage({ 'id': device.mac, 'access-token': device.apikey })

      expect(answer.image_url).not.toMatch(/^http:\/\/api\/screens\//)
      expect(dataSourceFetches()).toEqual([])
    })
  })

  describe('a scheduled render that fails', () => {
    // Liquid parses a `render` of a partial no Plugin has, and fails on it only when rendering.
    const FAILS_ON_LINE_2 = '<p>Weather</p>\n{% render "header" %}'
    const FAILURE = { message: 'A template cannot render "header": Kuroshiro has no partials.', line: 2, size: 'full' }

    it('is stored with its time, Liquid\'s message, its line and the Template\'s size, until a scheduled render succeeds', async () => {
      const plugin = await createPollPlugin({ templates: [{ layout: 'full', liquidMarkup: FAILS_ON_LINE_2 }] })

      await schedulerTick(plugin.id)
      const failed = (await read(plugin.id)).lastScheduledRender

      expect(failed).toEqual({ at: expect.any(String), error: FAILURE })

      await database.getRepository(PluginTemplate).update({ plugin: { id: plugin.id } }, { liquidMarkup: '<p>{{ weather.temperature }}</p>' })
      await schedulerTick(plugin.id)
      const succeeded = (await read(plugin.id)).lastScheduledRender

      expect(succeeded).toEqual({ at: expect.any(String), error: null })
      expect(Date.parse(succeeded!.at)).toBeGreaterThan(Date.parse(failed!.at))
    })

    it('is stored for the tick a save starts', async () => {
      const plugin = await createPollPlugin()
      const ticks: Promise<void>[] = []
      const runTick = scheduler.runTick.bind(scheduler)
      vi.spyOn(scheduler, 'runTick').mockImplementation((tickedPlugin) => {
        ticks.push(runTick(tickedPlugin))
        return ticks.at(-1)!
      })

      await plugins.update(plugin.id, { templates: [{ size: 'full', liquidMarkup: FAILS_ON_LINE_2 }] })
      await Promise.all(ticks)

      expect((await read(plugin.id)).lastScheduledRender?.error).toEqual(FAILURE)
    })

    it('still moves the Fetch Failure Streak of the tick, and leaves the Plugin\'s updatedAt alone', async () => {
      const plugin = await createPollPlugin({ templates: [{ layout: 'full', liquidMarkup: FAILS_ON_LINE_2 }] })
      dataSourceAnswer = () => new Response('down', { status: 503 })
      const before = await read(plugin.id)

      await schedulerTick(plugin.id)

      const after = await read(plugin.id)
      expect(after.dataSources[0].fetchFailureStreak).toBe(1)
      expect(after.updatedAt).toBe(before.updatedAt)
    })

    it('hides a password Field Value a scheduled fetch\'s failure quotes from the URL, both at the database and from GET /api/plugins/:id, while fetching with the real one', async () => {
      const plugin = await createPollPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/v1?key={{ api_key }}' }],
        fields: [{ keyname: 'api_key', name: 'API key', fieldType: 'password' }],
        fieldValues: { api_key: 'hunter2' },
      })
      dataSourceAnswer = (url) => {
        throw new TypeError(`Failed to parse URL from ${url}`)
      }

      await schedulerTick(plugin.id)

      const [source] = (await read(plugin.id)).dataSources
      expect(source.lastFetchError).toBe('Failed to parse URL from https://api.example.com/v1?key=••••••••')
      const stored = await database.getRepository(PluginDataSource).findOneByOrFail({ id: source.id })
      expect(stored.lastFetchError).toBe('Failed to parse URL from https://api.example.com/v1?key=••••••••')
      expect(dataSourceFetches()[0][0]).toBe('https://api.example.com/v1?key=hunter2')
    })

    it('hides a password Field Value a scheduled fetch\'s failure quotes from a header value', async () => {
      const plugin = await createPollPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', headers: { 'X-Key': '{{ api_key }}' } }],
        fields: [{ keyname: 'api_key', name: 'API key', fieldType: 'password' }],
        fieldValues: { api_key: 'hunter2' },
      })
      dataSourceAnswer = (_url, init) => {
        const sent = (init?.headers as Record<string, string> | undefined)?.['X-Key']
        throw new TypeError(`Headers.append: "${sent}" is an invalid header value.`)
      }

      await schedulerTick(plugin.id)

      const [source] = (await read(plugin.id)).dataSources
      expect(source.lastFetchError).toBe('Headers.append: "••••••••" is an invalid header value.')
    })

    it('hides a password Field Value from the data-source-fetch-failing Alert\'s details and its Notification, once the Fetch Failure Streak opens it', async () => {
      const plugin = await createPollPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/v1?key={{ api_key }}' }],
        fields: [{ keyname: 'api_key', name: 'API key', fieldType: 'password' }],
        fieldValues: { api_key: 'hunter2' },
      })
      dataSourceAnswer = (url) => {
        throw new TypeError(`Failed to parse URL from ${url}`)
      }

      await schedulerTick(plugin.id)

      const send = vi.fn<NotificationSenderService['send']>(async () => true)
      const sender = { send, isConfigured: () => true } as unknown as NotificationSenderService
      const settings = { resolveThresholds: async () => ({ lowBatteryPercent: 20, offlineMultiplier: 3, fetchFailureThreshold: 1 }) } as unknown as InstanceSettingsService
      const sweepConfig = asService<ConfigService>({ get: (key: string) => (key === 'alerts' ? { sweepCron: '*/5 * * * *' } : undefined) })
      const sweep = new AlertSweepService(database.getRepository(Alert), database.getRepository(Device), database.getRepository(PluginDataSource), sender, settings, sweepConfig)

      await sweep.sweep()

      const alert = await database.getRepository(Alert).findOneByOrFail({ kind: 'data-source-fetch-failing' })
      expect(alert.details).toEqual({ streak: 1, lastError: 'Failed to parse URL from https://api.example.com/v1?key=••••••••' })

      expect(send).toHaveBeenCalledTimes(1)
      const [notification] = send.mock.calls[0]
      expect(notification.body).toContain('••••••••')
      expect(notification.body).not.toContain('hunter2')
    })

    it('leaves a Field Value that is not password-type visible in the stored error', async () => {
      const plugin = await createPollPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/v1?city={{ city }}' }],
        fields: [{ keyname: 'city', name: 'City', fieldType: 'string' }],
        fieldValues: { city: 'Berlin' },
      })
      dataSourceAnswer = (url) => {
        throw new TypeError(`Failed to parse URL from ${url}`)
      }

      await schedulerTick(plugin.id)

      expect((await read(plugin.id)).dataSources[0].lastFetchError).toBe('Failed to parse URL from https://api.example.com/v1?city=Berlin')
    })
  })

  describe('the preview\'s data, POST /api/plugins/:id/preview-data', () => {
    it('answers the context built from the unsaved name, Data Sources and Field Values, and changes nothing stored', async () => {
      const plugin = await createPollPlugin({ fields: [{ keyname: 'city', name: 'City' }], fieldValues: { city: 'Berlin' } })
      const before = await read(plugin.id)
      dataSourceAnswer = url => new Response(JSON.stringify({ from: url }))

      const preview = await previewData(plugin.id, {
        deviceId: null,
        name: 'Forecast',
        dataSources: [{ name: 'air', mode: 'fetch', url: 'https://api.example.com/air/{{ city }}', transformJs: 'function transform(input) { return { via: input.from } }' }],
        fieldValues: { city: 'Paris' },
      })

      expect(preview.context).toEqual({
        city: 'Paris',
        air: { via: 'https://api.example.com/air/Paris' },
        sensors: {},
        trmnl: expect.objectContaining({ plugin_settings: expect.objectContaining({ instance_name: 'Forecast', custom_fields_values: { city: 'Paris' } }) }),
      })
      expect(preview.names).toEqual([
        { name: 'city', origin: 'fieldValue', error: null },
        { name: 'air', origin: 'dataSource', error: null },
        { name: 'sensors', origin: 'sensors', error: null },
        { name: 'trmnl', origin: 'trmnl', error: null },
      ])
      expect(Date.parse(preview.fetchedAt)).not.toBeNaN()
      expect(preview.webhookPayloadReceivedAt).toBeNull()
      expect(await read(plugin.id)).toEqual(before)
    })

    it('uses what is stored for everything the request leaves out', async () => {
      const plugin = await createPollPlugin({ fields: [{ keyname: 'city', name: 'City' }], fieldValues: { city: 'Berlin' } })

      const preview = await previewData(plugin.id)

      expect(preview.context).toMatchObject({ city: 'Berlin', weather: { temperature: 21 }, trmnl: { plugin_settings: { instance_name: 'Weather' } } })
      expect(preview.names.map(row => row.name)).toEqual(['city', 'weather', 'sensors', 'trmnl'])
    })

    it('lists the names in the order Field Values, Data Sources, sensors, trmnl, each set in its own order', async () => {
      const plugin = await createPollPlugin({
        dataSources: [{ name: 'second', mode: 'literal', literalValue: { n: 2 }, order: 2 }, { name: 'first', mode: 'literal', literalValue: { n: 1 }, order: 1 }],
        fields: [{ keyname: 'unit', name: 'Unit', order: 2 }, { keyname: 'city', name: 'City', order: 1 }],
      })

      expect((await previewData(plugin.id)).names.map(row => row.name)).toEqual(['city', 'unit', 'first', 'second', 'sensors', 'trmnl'])
    })

    it('answers 200 with the error marker and the row\'s error for a failing Data Source, and moves no Fetch Failure Streak', async () => {
      const plugin = await createPollPlugin()
      const before = await read(plugin.id)
      dataSourceAnswer = () => new Response('down', { status: 503 })

      const preview = await previewData(plugin.id)

      expect(preview.context).toMatchObject({ weather: { error: true, message: 'HTTP error! status: 503' } })
      expect(preview.names).toContainEqual({ name: 'weather', origin: 'dataSource', error: 'HTTP error! status: 503' })
      expect((await read(plugin.id)).dataSources).toEqual(before.dataSources)
      expect(before.dataSources[0]).toMatchObject({ fetchFailureStreak: 0, lastFetchAttemptAt: null, lastFetchError: null })
      expect(await database.getRepository(Alert).count()).toBe(0)
      expect((await read(plugin.id)).lastScheduledRender).toBeNull()
    })

    it('answers a half-typed Data Source, which a save would refuse, as a failed one instead of refusing the preview', async () => {
      const plugin = await createPollPlugin()
      dataSourceAnswer = (url) => {
        throw new TypeError(`Failed to parse URL from ${url}`)
      }

      const preview = await previewData(plugin.id, { deviceId: null, dataSources: [{ name: 'air', mode: 'fetch', url: 'api.example' }] })

      expect(preview.names).toContainEqual({ name: 'air', origin: 'dataSource', error: 'Failed to parse URL from api.example' })
    })

    it('never answers a password Field Value, and fetches a Data Source whose header names it with the real one', async () => {
      const plugin = await createPollPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather', headers: { Authorization: 'Bearer {{ api_key }}' } }],
        fields: [{ keyname: 'api_key', name: 'API key', fieldType: 'password' }],
        fieldValues: { api_key: 'hunter2' },
      })

      const response = await requestPreviewData(plugin.id, { deviceId: null })
      const answer = await response.text()

      expect(answer).not.toContain('hunter2')
      const preview: PreviewData = JSON.parse(answer)
      expect(preview.context).toMatchObject({ api_key: '••••••••', trmnl: { plugin_settings: { custom_fields_values: { api_key: '••••••••' } } } })
      expect(dataSourceFetches()).toEqual([['https://api.example.com/weather', expect.objectContaining({ headers: { Authorization: 'Bearer hunter2' } })]])
    })

    it('hides a password where a failed fetch quotes it and where the Data Source\'s answer repeats it', async () => {
      const plugin = await createPollPlugin({
        dataSources: [
          { name: 'half_typed', mode: 'fetch', url: 'https://api.example.com/v1?key={{ api_key }}' },
          { name: 'echo', mode: 'fetch', url: 'https://api.example.com/echo', headers: { 'X-Key': '{{ api_key }}' } },
        ],
        fields: [{ keyname: 'api_key', name: 'API key', fieldType: 'password' }],
        fieldValues: { api_key: 'hunter2' },
      })
      dataSourceAnswer = (url, init) => {
        if (url.includes('/v1'))
          throw new TypeError(`Failed to parse URL from ${url}`)
        return new Response(JSON.stringify({ sent: { headers: init?.headers } }))
      }

      const answer = await (await requestPreviewData(plugin.id, { deviceId: null })).text()

      expect(answer).not.toContain('hunter2')
      const preview: PreviewData = JSON.parse(answer)
      expect(preview.names).toContainEqual({ name: 'half_typed', origin: 'dataSource', error: 'Failed to parse URL from https://api.example.com/v1?key=••••••••' })
      expect(preview.context).toMatchObject({ echo: { sent: { headers: { 'X-Key': '••••••••' } } } })
    })

    it('hides a password the request itself sends, and fetches with it', async () => {
      const plugin = await createPollPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/weather?key={{ api_key }}' }],
        fields: [{ keyname: 'api_key', name: 'API key', fieldType: 'password' }],
        fieldValues: { api_key: 'hunter2' },
      })

      const answer = await (await requestPreviewData(plugin.id, { deviceId: null, fieldValues: { api_key: 'typed-just-now' } })).text()

      expect(answer).not.toContain('typed-just-now')
      expect(dataSourceFetches().map(([url]) => url)).toEqual(['https://api.example.com/weather?key=typed-just-now'])
    })

    it('answers a Webhook-kind Plugin\'s stored Webhook Payload keys and when it was received, with a sensors row and no readings for no Device', async () => {
      const plugin = await createWebhookPlugin({ fields: [{ keyname: 'city', name: 'City' }, { keyname: 'reading', name: 'Reading' }], fieldValues: { city: 'Berlin', reading: 'from the Field Value' } })
      await webhookIngest.ingest(await loadForRender(plugin.id), { level: 4, reading: 4 })

      const preview = await previewData(plugin.id, { deviceId: null })

      expect(preview.context).toMatchObject({ level: 4, reading: 4, city: 'Berlin', sensors: {}, trmnl: { plugin_settings: { instance_name: 'Sensor Feed' } } })
      expect(preview.names).toEqual([
        { name: 'city', origin: 'fieldValue', error: null },
        { name: 'level', origin: 'webhookPayload', error: null },
        { name: 'reading', origin: 'webhookPayload', error: null },
        { name: 'sensors', origin: 'sensors', error: null },
        { name: 'trmnl', origin: 'trmnl', error: null },
      ])
      expect(preview.webhookPayloadReceivedAt).toBe((await read(plugin.id)).webhook?.payloadReceivedAt)
      expect(preview.webhookPayloadReceivedAt).toEqual(expect.any(String))
      expect(dataSourceFetches()).toEqual([])
    })

    it('answers a Webhook-kind Plugin that has received nothing with trmnl, its Field Values and sensors', async () => {
      const plugin = await createWebhookPlugin()

      const preview = await previewData(plugin.id)

      expect(preview.names.map(row => row.name)).toEqual(['sensors', 'trmnl'])
      expect(preview.webhookPayloadReceivedAt).toBeNull()
    })

    it('answers the readings of the Device it is for', async () => {
      const plugin = await createPollPlugin()
      const device = await addDevice('Kitchen')
      await database.getRepository(DeviceSensor).save({ kind: 'humidity', value: 45, unit: '%', device })

      const preview = await previewData(plugin.id, { deviceId: device.id })

      expect(preview.context).toMatchObject({ sensors: { humidity: { value: 45, unit: '%' } } })
    })

    it('keeps the public-address rule for a Data Source in demo mode', async () => {
      const demoConfig = asService<ConfigService>({ get: (key: string) => key === 'demo_mode' })
      const demoResolver = new PluginDataResolverService(new PluginDataFetcherService(renderer, demoConfig), new PluginTransformService())
      const demoFieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
      const demoPreview = new PluginPreviewDataService(database.getRepository(Plugin), database.getRepository(Device), deviceSensors, new PluginTemplateContextService(demoFieldValues, demoResolver))
      const plugin = await createPollPlugin()

      const preview = await demoPreview.previewData(plugin.id, { deviceId: null, dataSources: [{ name: 'internal', mode: 'fetch', url: 'http://127.0.0.1:9/secrets' }] })

      expect(preview.names).toContainEqual({ name: 'internal', origin: 'dataSource', error: expect.any(String) })
      expect(dataSourceFetches()).toEqual([])
    })

    it('answers 404 plugin-not-found for an id no Plugin has, and for one that is no id at all', async () => {
      for (const id of [UNKNOWN_ID, 'nonsense']) {
        const response = await requestPreviewData(id, { deviceId: null })

        expect(response.status).toBe(404)
        expect((await response.json() as ApiError).code).toBe('plugin-not-found')
      }
    })

    it('answers 404 device-not-found for a Device that does not exist', async () => {
      const plugin = await createPollPlugin()

      const response = await requestPreviewData(plugin.id, { deviceId: UNKNOWN_ID })

      expect(response.status).toBe(404)
      expect((await response.json() as ApiError).code).toBe('device-not-found')
      expect(dataSourceFetches()).toEqual([])
    })

    it.each([
      ['no deviceId', {}],
      ['a deviceId that is no id', { deviceId: 'kitchen' }],
      ['a Template, which the preview does not render', { deviceId: null, template: '<p></p>' }],
    ])('refuses a request with %s', async (_case, body) => {
      const plugin = await createPollPlugin()

      const response = await requestPreviewData(plugin.id, body)

      expect(response.status).toBe(400)
      expect((await response.json() as ApiError).code).toBe('validation')
    })
  })

  describe('a Webhook-kind Plugin\'s Webhook Payload and Webhook Token', () => {
    async function refusalOf(response: Response): Promise<{ status: number, code: string }> {
      return { status: response.status, code: (await response.json() as ApiError).code }
    }

    it('clears the Webhook Payload and when it was received, answers the Plugin and renders it again without data', async () => {
      const plugin = await createWebhookPlugin({ mergeStrategy: 'stream', streamLimit: 3, templates: [{ layout: 'full', liquidMarkup: '<p>Reading: {{ reading }}</p>' }] })
      await assignments.assign(plugin.id, (await addDevice('Kitchen')).id)
      await webhookIngest.ingest(await loadForRender(plugin.id), { reading: 4 })
      expect(await cachedOutput(plugin.id)).toBe('<p>Reading: 4</p>')
      const before = await read(plugin.id)

      const response = await http.request(`/api/plugins/${plugin.id}/webhook-payload`, { method: 'DELETE' })

      expect(response.status).toBe(200)
      const answered = await response.json() as PluginDetail
      expect(answered).toEqual(await read(plugin.id))
      expect(answered.webhook).toEqual({ ...before.webhook, payload: null, payloadReceivedAt: null })
      expect(await cachedOutput(plugin.id)).toBe('<p>Reading: </p>')
    })

    it('regenerates the Webhook Token, answers the Plugin with the new URL, and refuses a POST to the old one', async () => {
      const plugin = await createWebhookPlugin()
      const before = await read(plugin.id)

      const response = await http.request(`/api/plugins/${plugin.id}/webhook-token`, { method: 'POST' })

      expect(response.status).toBe(200)
      const answered = await response.json() as PluginDetail
      expect(answered).toEqual(await read(plugin.id))
      expect(answered.webhook?.token).not.toBe(before.webhook?.token)
      expect(answered.webhook?.url).toBe(`https://kuroshiro.example/api/webhook/${answered.webhook?.token}`)
      expect((await http.postJson(`/api/webhook/${before.webhook?.token}`, { reading: 1 })).status).toBe(401)
      expect((await http.postJson(`/api/webhook/${answered.webhook?.token}`, { reading: 2 })).status).toBe(201)
      expect((await read(plugin.id)).webhook?.payload).toEqual({ reading: 2 })
    })

    it.each([
      ['DELETE', 'webhook-payload'],
      ['POST', 'webhook-token'],
    ])('answers %s %s with 400 plugin-not-webhook for a Poll-kind Plugin, and 404 plugin-not-found for a Plugin that does not exist', async (method, path) => {
      const poll = await createPollPlugin()

      expect(await refusalOf(await http.request(`/api/plugins/${poll.id}/${path}`, { method }))).toEqual({ status: 400, code: 'plugin-not-webhook' })
      for (const id of [UNKNOWN_ID, 'nonsense'])
        expect(await refusalOf(await http.request(`/api/plugins/${id}/${path}`, { method }))).toEqual({ status: 404, code: 'plugin-not-found' })
    })

    it('serves a new Webhook-kind Plugin, assigned before its first POST, its Template rendered without data', async () => {
      const plugin = await createWebhookPlugin({ templates: [{ layout: 'full', liquidMarkup: '<p>Reading: {{ reading }}</p>' }] })
      const device = await addDevice('Kitchen')
      await assignments.assign(plugin.id, device.id)

      const answer = await display.getCurrentImage({ 'id': device.mac, 'access-token': device.apikey })

      expect(answer.image_url).not.toMatch(/^http:\/\/api\/screens\//)
      expect(await cachedOutput(plugin.id)).toBe('<p>Reading: </p>')
    })
  })

  it('no longer has POST /api/plugins/preview', async () => {
    const response = await http.postJson('/api/plugins/preview', { sources: [], template: '<p></p>' })

    expect(response.status).toBe(404)
  })
})
