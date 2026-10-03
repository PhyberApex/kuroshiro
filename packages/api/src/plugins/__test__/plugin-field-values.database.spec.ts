import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import type { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import type { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import type { PreviewDataDto } from '../dto/preview-data.dto.js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { MashupRendererService } from '../../mashup/services/mashup-renderer.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { stubFetch } from '../../test/fetch.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { DevicePlugin } from '../entities/device-plugin.entity.js'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../entities/plugin-field-value.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { Plugin } from '../entities/plugin.entity.js'
import { PluginsService } from '../plugins.service.js'
import { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'
import { PluginAssignmentsService } from '../services/plugin-assignments.service.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'
import { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
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

const BOTH_ADDRESS_FORMS = '{{ city }}|{{ trmnl.plugin_settings.custom_fields_values.city }}|{{ weather.url }}'

// Every fetched Data Source answers with the url it was asked for, so a
// template can show which url the Field Values resolved to.
const mockFetch = stubFetch()

describe('field values against a real database', () => {
  let database: DataSource
  let plugins: PluginsService
  let scheduler: PluginSchedulerService
  let pluginReads: PluginReadsService
  let assignments: PluginAssignmentsService
  let fieldValues: PluginFieldValuesService
  let mashupRenderer: MashupRendererService
  let webhookIngest: WebhookIngestService
  let previewData: PluginPreviewDataService
  const renderer = new PluginRendererService()
  let recipeUpdate: RecipeUpdateService
  let mockImporter: { importFromRecipe: ReturnType<typeof vi.fn> }
  let device: Device
  let backgroundTicks: Promise<void>[] = []

  beforeAll(async () => {
    database = await createTestDatabase()

    fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    const config = asService<ConfigService>({ get: () => false })
    const resolver = new PluginDataResolverService(new PluginDataFetcherService(renderer, config), new PluginTransformService())
    const templateContext = new PluginTemplateContextService(fieldValues, resolver)
    const renderCache = new PluginRenderCacheService(renderer, database.getRepository(Screen))
    const refresh = new PluginRefreshService(renderCache, templateContext, new DataSourceFetchOutcomeService(database.getRepository(PluginDataSource)), database.getRepository(Plugin))

    scheduler = new PluginSchedulerService(refresh)
    plugins = new PluginsService(
      database.getRepository(Plugin),
      database.getRepository(Screen),
      database.getRepository(PluginDataSource),
      database.getRepository(PluginTemplate),
      database.getRepository(PluginField),
      scheduler,
      renderCache,
      fieldValues,
    )
    pluginReads = new PluginReadsService(database.getRepository(Plugin), database.getRepository(Screen), database.getRepository(Alert), fieldValues, asService<ConfigService>({ getOrThrow: () => 'https://kuroshiro.example' }))
    assignments = new PluginAssignmentsService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DevicePlugin))
    mashupRenderer = new MashupRendererService(renderer, config, asService<DeviceSensorsService>({ findForDevice: async () => [] }), templateContext)
    previewData = new PluginPreviewDataService(database.getRepository(Plugin), database.getRepository(Device), database.getRepository(DeviceSensor), templateContext)
    webhookIngest = new WebhookIngestService(database.getRepository(Plugin), refresh)
    mockImporter = { importFromRecipe: vi.fn() }
    recipeUpdate = new RecipeUpdateService(
      database.getRepository(Plugin),
      database.getRepository(PluginDataSource),
      database.getRepository(PluginTemplate),
      database.getRepository(PluginField),
      asService(mockImporter),
      plugins,
    )

    // PluginRenderCacheService and PluginsService look the MashupSlot repository up on a timer.
    await new Promise(resolve => setTimeout(resolve, 10))

    device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:FF', apikey: 'key', refreshRate: 300 })
  }, 120_000)

  beforeEach(() => {
    backgroundTicks = []
    const runTick = scheduler.runTick.bind(scheduler)
    vi.spyOn(scheduler, 'runTick').mockImplementation((plugin) => {
      const tick = runTick(plugin)
      backgroundTicks.push(tick)
      return tick
    })
    mockFetch.mockReset()
    mockFetch.mockImplementation(async url => new Response(JSON.stringify({ url: String(url) })))
  })

  afterEach(async () => {
    await Promise.all(backgroundTicks)
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    scheduler.onModuleDestroy()
    await database.destroy()
  })

  function createWeatherPlugin(overrides: Partial<Parameters<PluginsService['create']>[0]> = {}) {
    return plugins.create({
      name: 'Weather',
      kind: 'Poll',
      refreshInterval: 15,
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.example.com/{{ city }}/{{ trmnl.plugin_settings.custom_fields_values.city }}' }],
      templates: [{ layout: 'full', liquidMarkup: BOTH_ADDRESS_FORMS }],
      fields: [
        { keyname: 'city', name: 'City', fieldType: 'string', required: true, order: 1 },
        { keyname: 'api_key', name: 'API key', fieldType: 'password', order: 2 },
      ],
      ...overrides,
    })
  }

  /** What the browser's preview draws: the Template rendered against the preview's data. */
  async function preview({ sources, template, pluginId, fieldValues }: { sources: PreviewDataDto['dataSources'], template: string, pluginId: string, fieldValues?: Record<string, string> }): Promise<{ html: string }> {
    const { context } = await previewData.previewData(pluginId, { deviceId: null, dataSources: sources, fieldValues })
    return { html: await renderer.render(template, context) }
  }

  async function scheduledTick(pluginId: string): Promise<void> {
    await scheduler.runTick(await loadForRender(pluginId))
  }

  /** Saves, lets the tick the save started finish, and reads the Plugin back. */
  async function save(pluginId: string, input: Parameters<PluginsService['update']>[1]) {
    await plugins.update(pluginId, input)
    await Promise.all(backgroundTicks)
    return (await plugins.findById(pluginId))!
  }

  async function cachedOutput(pluginId: string): Promise<string | null | undefined> {
    const screen = await database.getRepository(Screen).findOneOrFail({ where: { plugin: { id: pluginId } } })
    return screen.cachedPluginOutput
  }

  async function loadForRender(pluginId: string): Promise<Plugin> {
    return database.getRepository(Plugin).findOneOrFail({ where: { id: pluginId }, relations: { dataSources: true, templates: true } })
  }

  const BERLIN = 'Berlin|Berlin|https://api.example.com/Berlin/Berlin'

  describe('reaching every render', () => {
    it('renders the saved value for both address forms, in the template and the Data Source url, on the scheduler tick', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin' } })
      await assignments.assign(plugin.id, device.id)

      await scheduledTick(plugin.id)

      expect(await cachedOutput(plugin.id)).toBe(BERLIN)
    })

    it('renders it in a Mashup slot', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin' } })
      const slot = { id: 'slot-1', position: 'top', size: 'half_horizontal', order: 0, plugin: await loadForRender(plugin.id) } as MashupSlot
      const mashup = { id: 'mashup-1', layout: '1Tx1B', slots: [slot] } as MashupConfiguration

      const html = await mashupRenderer.renderMashup(mashup, device)

      expect(html).toContain(BERLIN)
    })

    it('renders it in the preview, where an unsaved value overrides the saved one', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin' } })
      const sources = [{ name: 'weather', mode: 'fetch' as const, url: 'https://api.example.com/{{ city }}/{{ trmnl.plugin_settings.custom_fields_values.city }}' }]

      const saved = await preview({ sources, template: BOTH_ADDRESS_FORMS, pluginId: plugin.id })
      const unsaved = await preview({ sources, template: BOTH_ADDRESS_FORMS, pluginId: plugin.id, fieldValues: { city: 'Paris' } })

      expect(saved.html).toBe(BERLIN)
      expect(unsaved.html).toBe('Paris|Paris|https://api.example.com/Paris/Paris')
    })

    it('previews an unsaved empty value the way a save would render it: with the Plugin Field\'s default', async () => {
      const plugin = await createWeatherPlugin({
        fields: [{ keyname: 'city', name: 'City', defaultValue: 'Tokyo' }],
        fieldValues: { city: 'Berlin' },
      })

      const { html } = await preview({ sources: [], template: '[{{ city }}]', pluginId: plugin.id, fieldValues: { city: '' } })

      expect(html).toBe('[Tokyo]')
    })

    it('renders it for a Webhook-kind Plugin, where the Webhook Payload wins a bare-key collision', async () => {
      const created = await plugins.create({
        name: 'Feed',
        kind: 'Webhook',
        mergeStrategy: 'standard',
        templates: [{ layout: 'full', liquidMarkup: '{{ city }}|{{ trmnl.plugin_settings.custom_fields_values.city }}|{{ title }}' }],
        fields: [{ keyname: 'city', name: 'City' }, { keyname: 'title', name: 'Title' }],
        fieldValues: { city: 'Berlin', title: 'from the field' },
      })
      await assignments.assign(created.id, device.id)

      await webhookIngest.ingest(await loadForRender(created.id), { title: 'from the payload' })

      expect(await cachedOutput(created.id)).toBe('Berlin|Berlin|from the payload')
    })

    it('lets a Data Source\'s data win over a bare Field Value key of the same name', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin' } })
      // The admin API refuses this collision, so the row is renamed underneath it.
      await database.getRepository(PluginField).update({ plugin: { id: plugin.id }, keyname: 'city' }, { keyname: 'weather' })

      const { html } = await preview({
        sources: [{ name: 'weather', mode: 'literal', literalValue: { url: 'from the Data Source' } }],
        template: '{{ weather.url }}|{{ trmnl.plugin_settings.custom_fields_values.weather }}',
        pluginId: plugin.id,
      })

      expect(html).toBe('from the Data Source|Berlin')
    })

    it('falls back to the Plugin Field\'s default, then to empty, and reports that a required field needs a value', async () => {
      const withDefault = await createWeatherPlugin({
        fields: [{ keyname: 'city', name: 'City', defaultValue: 'Tokyo', required: true }],
      })
      const withNeither = await createWeatherPlugin()

      const defaulted = await preview({ sources: [], template: '[{{ city }}]', pluginId: withDefault.id })
      const empty = await preview({ sources: [], template: '[{{ city }}]', pluginId: withNeither.id })

      expect(defaulted.html).toBe('[Tokyo]')
      expect(withDefault.needsValues).toBe(false)
      expect(empty.html).toBe('[]')
      expect(withNeither.needsValues).toBe(true)
      expect((await pluginReads.list()).find(plugin => plugin.id === withNeither.id)!.needsValues).toBe(true)
    })
  })

  describe('saving', () => {
    it('re-fetches and re-renders into the cache, in the background, when a Field Value changes', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin' } })
      await assignments.assign(plugin.id, device.id)
      await scheduledTick(plugin.id)

      const updated = await save(plugin.id, { fieldValues: { city: 'Paris' } })

      expect(await cachedOutput(plugin.id)).toBe('Paris|Paris|https://api.example.com/Paris/Paris')
      expect(updated.fieldValues.city).toEqual({ value: 'Paris', isSet: true })
      expect(updated.needsValues).toBe(false)
    })

    it('clears a Plugin Field\'s default and help text when an update leaves them out', async () => {
      const plugin = await createWeatherPlugin({
        fields: [{ keyname: 'city', name: 'City', description: 'Where you live', defaultValue: 'Tokyo' }],
      })

      await save(plugin.id, { fields: [{ keyname: 'city', name: 'City' }] })

      const [field] = (await plugins.findById(plugin.id))!.fields
      expect(field.description).toBeNull()
      expect(field.defaultValue).toBeNull()
    })

    it('clears a Field Value sent as null or empty, so the default applies again', async () => {
      const plugin = await createWeatherPlugin({
        fields: [{ keyname: 'city', name: 'City', defaultValue: 'Tokyo' }, { keyname: 'units', name: 'Units' }],
        fieldValues: { city: 'Berlin', units: 'metric' },
      })

      const updated = await save(plugin.id, { fieldValues: { city: null, units: '' } })

      expect(updated.fieldValues).toEqual({ city: { value: null, isSet: false }, units: { value: null, isSet: false } })
      expect(await fieldValues.resolveFor(plugin.id)).toEqual({ city: 'Tokyo', units: '' })
    })

    it('refuses a Field Value for a keyname the Plugin has no Plugin Field for', async () => {
      const plugin = await createWeatherPlugin()

      await expect(plugins.update(plugin.id, { fieldValues: { town: 'Berlin' } })).rejects.toThrow('no Plugin Field')
    })

    it('never returns a password-type Field Value on any read, and keeps it when an update omits it', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin', api_key: 's3cret' } })
      await assignments.assign(plugin.id, device.id)

      const updated = await save(plugin.id, { fieldValues: { city: 'Paris' } })
      const reads = [
        plugin,
        updated,
        await plugins.findById(plugin.id),
      ]
      const detail = await pluginReads.detail(plugin.id)

      expect(JSON.stringify([detail, await pluginReads.list()])).not.toContain('s3cret')
      expect(detail.fieldValues.api_key).toEqual({ secret: true, set: true })

      for (const read of reads) {
        expect(JSON.stringify(read)).not.toContain('s3cret')
        expect(read!.fieldValues.api_key).toEqual({ value: null, isSet: true })
      }
      expect(await fieldValues.storedFor(plugin.id)).toEqual({ city: 'Paris', api_key: 's3cret' })
    })

    it('keeps the value of a Plugin Field whose label changed and drops the value of a removed one', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin', api_key: 's3cret' } })
      const cityFieldId = plugin.fields.find(field => field.keyname === 'city')!.id

      await save(plugin.id, {
        fields: [{ keyname: 'city', name: 'Town', fieldType: 'string', required: true, order: 1 }],
      })

      const reloaded = await plugins.findById(plugin.id)
      expect(reloaded!.fields).toEqual([expect.objectContaining({ id: cityFieldId, keyname: 'city', name: 'Town' })])
      expect(await fieldValues.storedFor(plugin.id)).toEqual({ city: 'Berlin' })
      expect(await database.getRepository(PluginFieldValue).count({ where: { plugin: { id: plugin.id } } })).toBe(1)
    })

    it('leaves every Plugin Field attached to its Plugin after an update that carries fields', async () => {
      const plugin = await createWeatherPlugin()

      await save(plugin.id, {
        name: 'Weather, renamed',
        fields: [
          { keyname: 'city', name: 'City' },
          { keyname: 'units', name: 'Units', fieldType: 'select', options: [{ label: 'Metric', value: 'metric' }] },
        ],
      })

      const reloaded = await plugins.findById(plugin.id)
      expect(reloaded!.fields.map(field => field.keyname).sort()).toEqual(['city', 'units'])
      expect(reloaded!.fields.find(field => field.keyname === 'units')!.options).toEqual([{ label: 'Metric', value: 'metric' }])
      expect(await database.getRepository(PluginField).createQueryBuilder('field').where('field."pluginId" IS NULL').getCount()).toBe(0)
    })

    it('copies Plugin Fields and Field Values, password-type ones included, when duplicating', async () => {
      const plugin = await createWeatherPlugin({ fieldValues: { city: 'Berlin', api_key: 's3cret' } })

      const copy = await plugins.duplicate(plugin.id)

      expect(copy.id).not.toBe(plugin.id)
      expect(copy.fields.map(field => field.keyname).sort()).toEqual(['api_key', 'city'])
      expect(copy.fieldValues).toEqual({ city: { value: 'Berlin', isSet: true }, api_key: { value: null, isSet: true } })
      expect(await fieldValues.storedFor(copy.id)).toEqual({ city: 'Berlin', api_key: 's3cret' })
    })
  })

  describe('a Recipe Update Check applying field Update Items', () => {
    it('keeps the value of a changed Plugin Field and drops the value of a removed one', async () => {
      const recipe = {
        name: 'Weather',
        kind: 'Poll' as const,
        refreshInterval: 15,
        dataSources: [],
        templates: [{ layout: 'full', liquidMarkup: '{{ city }}' }],
        fields: [
          { keyname: 'city', fieldType: 'string', name: 'City', required: true, order: 1 },
          { keyname: 'api_key', fieldType: 'password', name: 'API key', required: false, order: 2 },
        ],
        sourceRecipeId: '150460',
      }
      const plugin = await plugins.create({ ...recipe, sourceRecipeSnapshot: { ...recipe }, fieldValues: { city: 'Berlin', api_key: 's3cret' } })
      mockImporter.importFromRecipe.mockResolvedValue({ ...recipe, fields: [{ ...recipe.fields[0], name: 'Town' }] })

      const { contentHash } = await recipeUpdate.checkForUpdate(plugin.id)
      const updated = await recipeUpdate.applyUpdate(plugin.id, {
        contentHash,
        apply: [{ itemType: 'field', key: 'city' }, { itemType: 'field', key: 'api_key' }],
      })

      expect(updated.fields).toEqual([expect.objectContaining({ keyname: 'city', name: 'Town' })])
      expect(updated.fieldValues).toEqual({ city: { value: 'Berlin', isSet: true } })
      expect(await fieldValues.storedFor(plugin.id)).toEqual({ city: 'Berlin' })
    })
  })
})
