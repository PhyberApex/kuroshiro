import type { Screen } from '../../screens/screens.entity.js'
import type { MockPluginDataFetcherService, MockPluginRenderCacheService, MockPluginRendererService, MockPluginTransformService } from '../../test/mockPluginCollaborators.js'
import type { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import type { PluginField } from '../entities/plugin-field.entity.js'
import type { PluginTemplate } from '../entities/plugin-template.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import type { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
import type { PluginRefreshService } from '../services/plugin-refresh.service.js'
import type { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import type { PluginRendererService } from '../services/plugin-renderer.service.js'
import type { PluginSchedulerService } from '../services/plugin-scheduler.service.js'
import type { PluginTransformService } from '../services/plugin-transform.service.js'
import { plainToInstance } from 'class-transformer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevicePlugin, makePlugin, makePluginDataSource, makePluginField, makePluginTemplate } from '../../test/fixtures.js'
import { createMockPluginDataFetcherService, createMockPluginFieldValuesService, createMockPluginRenderCacheService, createMockPluginRendererService, createMockPluginTransformService, createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService, injectPrivate } from '../../test/mockService.js'
import { UpdatePluginDto } from '../dto/update-plugin.dto.js'
import { PluginsService } from '../plugins.service.js'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service.js'

describe('pluginsService', () => {
  let service: PluginsService
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let templateRepo: ReturnType<typeof createMockRepository<PluginTemplate>>
  let fieldRepo: ReturnType<typeof createMockRepository<PluginField>>
  let mockFieldValues: ReturnType<typeof createMockPluginFieldValuesService>
  let mockRefresh: { refresh: ReturnType<typeof vi.fn> }
  let mockDataFetcher: MockPluginDataFetcherService
  let mockRenderer: MockPluginRendererService
  let mockScheduler: { schedulePlugin: ReturnType<typeof vi.fn>, removeScheduledJob: ReturnType<typeof vi.fn>, hasScheduledJob: ReturnType<typeof vi.fn> }
  let mockTransformer: MockPluginTransformService
  let mockRenderCache: MockPluginRenderCacheService

  beforeEach(() => {
    pluginRepo = createMockRepository<Plugin>()
    screenRepo = createMockRepository<Screen>()
    dataSourceRepo = createMockRepository<PluginDataSource>()
    templateRepo = createMockRepository<PluginTemplate>()
    fieldRepo = createMockRepository<PluginField>()
    mockFieldValues = createMockPluginFieldValuesService()
    mockRefresh = { refresh: vi.fn() }

    mockDataFetcher = createMockPluginDataFetcherService()
    mockRenderer = createMockPluginRendererService()
    mockScheduler = {
      schedulePlugin: vi.fn(),
      removeScheduledJob: vi.fn(),
      hasScheduledJob: vi.fn(),
    }
    mockTransformer = createMockPluginTransformService()
    mockRenderCache = createMockPluginRenderCacheService()

    service = new PluginsService(
      asRepository(pluginRepo),
      asRepository(screenRepo),
      asRepository(dataSourceRepo),
      asRepository(templateRepo),
      asRepository(fieldRepo),
      new PluginDataResolverService(asService<PluginDataFetcherService>(mockDataFetcher), asService<PluginTransformService>(mockTransformer)),
      asService<PluginRendererService>(mockRenderer),
      asService<PluginSchedulerService>(mockScheduler),
      asService<PluginRenderCacheService>(mockRenderCache),
      asService<PluginFieldValuesService>(mockFieldValues),
      asService<PluginRefreshService>(mockRefresh),
      createPluginTemplateContextService(),
    )
  })

  const basePlugin: Plugin = makePlugin({
    id: '1',
    name: 'Weather Plugin',
    description: 'Shows weather',
    kind: 'Poll',
    refreshInterval: 15,
  })

  it('findAll returns all plugins ordered by name', async () => {
    const plugins = [basePlugin]
    pluginRepo.find.mockResolvedValue(plugins)
    const result = await service.findAll()
    expect(pluginRepo.find).toHaveBeenCalledWith({
      relations: { dataSources: true, templates: true, fields: true, deviceAssignments: { device: true } },
      order: { name: 'ASC' },
    })
    expect(result).toEqual([{ ...basePlugin, fieldValues: {}, needsValues: false }])
  })

  it('findById returns a plugin by id with relations', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    const result = await service.findById('1')
    expect(pluginRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: { dataSources: true, templates: true, fields: true, deviceAssignments: { device: true } },
    })
    expect(result).toEqual({ ...basePlugin, fieldValues: {}, needsValues: false })
  })

  it('create creates and saves a new plugin', async () => {
    const pluginData = { name: 'Weather Plugin', kind: 'Poll' as const }
    pluginRepo.save.mockResolvedValue(basePlugin)
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    const result = await service.create(pluginData)
    expect(pluginRepo.save).toHaveBeenCalled()
    expect(pluginRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: { dataSources: true, templates: true, fields: true },
    })
    expect(result).toEqual({ ...basePlugin, fieldValues: {}, needsValues: false })
  })

  it('create persists the source Recipe id when provided', async () => {
    const pluginData = { name: 'Daily Weather', kind: 'Poll' as const, sourceRecipeId: '150460' }
    pluginRepo.save.mockResolvedValue(basePlugin)
    pluginRepo.findOne.mockResolvedValue(basePlugin)

    await service.create(pluginData)

    expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({ sourceRecipeId: '150460' }))
  })

  it('create persists the source Recipe snapshot when provided', async () => {
    const snapshot = { name: 'Daily Weather', kind: 'Poll', refreshInterval: 30, dataSources: [], templates: [], fields: [] }
    const pluginData = { name: 'Daily Weather', kind: 'Poll' as const, sourceRecipeId: '150460', sourceRecipeSnapshot: snapshot }
    pluginRepo.save.mockResolvedValue(basePlugin)
    pluginRepo.findOne.mockResolvedValue(basePlugin)

    await service.create(pluginData)

    expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({ sourceRecipeSnapshot: snapshot }))
  })

  it('update updates and saves an existing plugin', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    const updated = { ...basePlugin, name: 'Updated Weather' }
    pluginRepo.save.mockResolvedValue(updated)
    const result = await service.update('1', { name: 'Updated Weather' })
    expect(pluginRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: { dataSources: true, templates: true, fields: true },
    })
    expect(pluginRepo.save).toHaveBeenCalled()
    expect(result).toEqual({ ...updated, fieldValues: {}, needsValues: false })
  })

  it('update returns null if plugin not found', async () => {
    pluginRepo.findOne.mockResolvedValue(null)
    const result = await service.update('1', { name: 'Updated' })
    expect(result).toBeNull()
  })

  it('update clears the cached render output on every Screen assigned the plugin', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    pluginRepo.save.mockResolvedValue(basePlugin)

    await service.update('1', { name: 'Updated Weather' })

    expect(screenRepo.update).toHaveBeenCalledWith(
      { plugin: { id: '1' } },
      { cachedPluginOutput: null },
    )
  })

  it('update invalidates mashup caches referencing the plugin', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    pluginRepo.save.mockResolvedValue(basePlugin)

    await service.update('1', { name: 'Updated Weather' })

    expect(mockRenderCache.invalidateMashupCaches).toHaveBeenCalledWith('1')
  })

  it('update clears the cache even when only a cosmetic field like name changes', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    pluginRepo.save.mockResolvedValue({ ...basePlugin, name: 'Renamed' })

    await service.update('1', { name: 'Renamed' })

    expect(screenRepo.update).toHaveBeenCalledWith(
      { plugin: { id: '1' } },
      { cachedPluginOutput: null },
    )
    expect(mockRenderCache.invalidateMashupCaches).toHaveBeenCalledWith('1')
  })

  it('remove deletes a plugin and returns true', async () => {
    pluginRepo.findOneBy.mockResolvedValue(basePlugin)
    pluginRepo.remove.mockResolvedValue(basePlugin)
    const result = await service.remove('1')
    expect(pluginRepo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(pluginRepo.remove).toHaveBeenCalledWith(basePlugin)
    expect(mockScheduler.removeScheduledJob).toHaveBeenCalledWith('1')
    expect(result).toBe(true)
  })

  it('remove returns false if plugin not found', async () => {
    pluginRepo.findOneBy.mockResolvedValue(null)
    const result = await service.remove('1')
    expect(result).toBe(false)
  })

  it('checkPluginUsage returns empty array when not used in mashups', async () => {
    const mashupSlotRepo = { find: vi.fn().mockResolvedValue([]) }
    injectPrivate(service, 'mashupSlotRepository', mashupSlotRepo)

    const result = await service.checkPluginUsage('plugin-1')

    expect(result.inMashups).toEqual([])
    expect(mashupSlotRepo.find).toHaveBeenCalledWith({
      where: { plugin: { id: 'plugin-1' } },
      relations: { mashupConfiguration: { screen: true } },
    })
  })

  it('checkPluginUsage returns mashup info when plugin used', async () => {
    const mashupSlotRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: 'slot-1',
          mashupConfiguration: {
            id: 'config-1',
            screen: { id: 'screen-1', filename: 'Dashboard 1' },
          },
        },
        {
          id: 'slot-2',
          mashupConfiguration: {
            id: 'config-2',
            screen: { id: 'screen-2', filename: 'Dashboard 2' },
          },
        },
      ]),
    }
    injectPrivate(service, 'mashupSlotRepository', mashupSlotRepo)

    const result = await service.checkPluginUsage('plugin-1')

    expect(result.inMashups).toHaveLength(2)
    expect(result.inMashups[0]).toEqual({ screenId: 'screen-1', screenName: 'Dashboard 1' })
    expect(result.inMashups[1]).toEqual({ screenId: 'screen-2', screenName: 'Dashboard 2' })
  })

  it('remove without force throws error if plugin used in mashups', async () => {
    pluginRepo.findOneBy.mockResolvedValue(basePlugin)

    const mashupSlotRepo = {
      find: vi.fn().mockResolvedValue([
        {
          mashupConfiguration: {
            screen: { id: 'screen-1', filename: 'My Dashboard' },
          },
        },
      ]),
    }
    injectPrivate(service, 'mashupSlotRepository', mashupSlotRepo)

    await expect(service.remove('1', false)).rejects.toThrow('Plugin is used in 1 mashup(s)')
    expect(pluginRepo.remove).not.toHaveBeenCalled()
  })

  it('remove with force=true deletes plugin even if used in mashups', async () => {
    pluginRepo.findOneBy.mockResolvedValue(basePlugin)
    pluginRepo.remove.mockResolvedValue(basePlugin)

    const mashupSlotRepo = {
      find: vi.fn().mockResolvedValue([
        {
          mashupConfiguration: {
            screen: { id: 'screen-1', filename: 'My Dashboard' },
          },
        },
      ]),
    }
    injectPrivate(service, 'mashupSlotRepository', mashupSlotRepo)

    const result = await service.remove('1', true)

    expect(result).toBe(true)
    expect(pluginRepo.remove).toHaveBeenCalledWith(basePlugin)
    expect(mockScheduler.removeScheduledJob).toHaveBeenCalledWith('1')
  })

  it('create saves plugin with dataSources, templates, and fields', async () => {
    const pluginData = {
      name: 'Complete Plugin',
      kind: 'Poll' as const,
      dataSources: [
        {
          name: 'weather',
          mode: 'fetch' as const,
          url: 'https://api.example.com',
          method: 'GET',
          headers: {},
          body: {},
          transformJs: 'module.exports = (data) => data',
        },
      ],
      templates: [
        { layout: 'full', liquidMarkup: 'Template' },
      ],
      fields: [
        { keyname: 'api_key', fieldType: 'password', name: 'API Key', required: true },
      ],
    }

    const savedPlugin = { ...basePlugin, id: '2' }
    pluginRepo.save.mockResolvedValue(savedPlugin)
    dataSourceRepo.create.mockReturnValue(makePluginDataSource())
    dataSourceRepo.save.mockResolvedValue(makePluginDataSource())
    templateRepo.create.mockReturnValue(makePluginTemplate())
    templateRepo.save.mockResolvedValue(makePluginTemplate())
    fieldRepo.create.mockReturnValue(makePluginField())
    fieldRepo.save.mockResolvedValue(makePluginField())
    pluginRepo.findOne.mockResolvedValue(savedPlugin)

    const result = await service.create(pluginData)

    expect(dataSourceRepo.create).toHaveBeenCalled()
    expect(dataSourceRepo.save).toHaveBeenCalled()
    expect(templateRepo.create).toHaveBeenCalled()
    expect(templateRepo.save).toHaveBeenCalled()
    expect(fieldRepo.create).toHaveBeenCalled()
    expect(fieldRepo.save).toHaveBeenCalled()
    expect(result).toMatchObject(savedPlugin)
  })

  it('create builds a literal-mode data source with its literalValue and no fetch fields', async () => {
    const pluginData = {
      name: 'Static Plugin',
      kind: 'Poll' as const,
      dataSources: [
        { name: 'title', mode: 'literal' as const, literalValue: { text: 'Hello' } },
      ],
    }

    const savedPlugin = { ...basePlugin, id: '2' }
    pluginRepo.save.mockResolvedValue(savedPlugin)
    dataSourceRepo.create.mockReturnValue(makePluginDataSource())
    dataSourceRepo.save.mockResolvedValue(makePluginDataSource())
    pluginRepo.findOne.mockResolvedValue(savedPlugin)

    await service.create(pluginData)

    expect(dataSourceRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'title',
      mode: 'literal',
      literalValue: { text: 'Hello' },
    }))
    expect(dataSourceRepo.create).not.toHaveBeenCalledWith(expect.objectContaining({ url: expect.anything() }))
  })

  it('create tolerates a literal-mode data source carrying method "GET", the entity column\'s non-nullable default rather than a real fetch field', async () => {
    const pluginData = {
      name: 'Round-tripped Static Plugin',
      kind: 'Poll' as const,
      dataSources: [
        { name: 'title', mode: 'literal' as const, literalValue: { text: 'Hello' }, method: 'GET' },
      ],
    }

    const savedPlugin = { ...basePlugin, id: '2' }
    pluginRepo.save.mockResolvedValue(savedPlugin)
    dataSourceRepo.create.mockReturnValue(makePluginDataSource())
    dataSourceRepo.save.mockResolvedValue(makePluginDataSource())
    pluginRepo.findOne.mockResolvedValue(savedPlugin)

    await expect(service.create(pluginData)).resolves.toMatchObject(savedPlugin)
  })

  it('create rejects a literal-mode data source that also carries a URL', async () => {
    const pluginData = {
      name: 'Bad Static Plugin',
      kind: 'Poll' as const,
      dataSources: [
        { name: 'title', mode: 'literal' as const, literalValue: { text: 'Hello' }, url: 'https://api.example.com' },
      ],
    }

    await expect(service.create(pluginData)).rejects.toThrow('A literal-mode Data Source cannot have a URL')
    expect(pluginRepo.save).not.toHaveBeenCalled()
  })

  it('update creates new data sources if none exist', async () => {
    const pluginWithoutDataSources = { ...basePlugin, dataSources: [] }
    pluginRepo.findOne.mockResolvedValue(pluginWithoutDataSources)
    dataSourceRepo.create.mockReturnValue(makePluginDataSource({ id: 'ds-1' }))
    dataSourceRepo.save.mockResolvedValue(makePluginDataSource({ id: 'ds-1' }))
    pluginRepo.save.mockResolvedValue(pluginWithoutDataSources)

    await service.update('1', {
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://new-api.com', method: 'GET', headers: {}, body: {} }],
    })

    expect(dataSourceRepo.create).toHaveBeenCalled()
    expect(dataSourceRepo.save).toHaveBeenCalled()
  })

  it('update removes existing data sources and creates the replacement set', async () => {
    const oldDataSources = [makePluginDataSource({ id: 'ds-old', name: 'old' })]
    const pluginWithDataSources = {
      ...basePlugin,
      dataSources: oldDataSources,
    }
    pluginRepo.findOne.mockResolvedValue(pluginWithDataSources)
    dataSourceRepo.create.mockReturnValue(makePluginDataSource({ id: 'ds-new' }))
    dataSourceRepo.save.mockResolvedValue(makePluginDataSource({ id: 'ds-new' }))
    pluginRepo.save.mockResolvedValue(pluginWithDataSources)

    const result = await service.update('1', {
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://new-api.com', method: 'GET' }],
    })

    expect(dataSourceRepo.remove).toHaveBeenCalledWith(oldDataSources)
    expect(dataSourceRepo.create).toHaveBeenCalled()
    // The returned plugin reflects the new data sources, not the removed ones
    expect(result?.dataSources).toEqual([makePluginDataSource({ id: 'ds-new' })])
  })

  it('update rejects a data source named "trmnl"', async () => {
    pluginRepo.findOne.mockResolvedValue({ ...basePlugin, dataSources: [], fields: [] })

    await expect(service.update('1', {
      dataSources: [{ name: 'trmnl', mode: 'fetch', url: 'https://api.com', method: 'GET' }],
    })).rejects.toThrow('reserved')

    expect(dataSourceRepo.save).not.toHaveBeenCalled()
  })

  it('update rejects two data sources sharing a name', async () => {
    pluginRepo.findOne.mockResolvedValue({ ...basePlugin, dataSources: [], fields: [] })

    await expect(service.update('1', {
      dataSources: [
        { name: 'weather', mode: 'fetch', url: 'https://api.com/1', method: 'GET' },
        { name: 'weather', mode: 'fetch', url: 'https://api.com/2', method: 'GET' },
      ],
    })).rejects.toThrow('more than one data source')
  })

  it('update rejects a data source name colliding with a plugin field keyname', async () => {
    pluginRepo.findOne.mockResolvedValue({
      ...basePlugin,
      dataSources: [],
      fields: [makePluginField({ id: 'field-1', keyname: 'weather' })],
    })

    await expect(service.update('1', {
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.com', method: 'GET' }],
    })).rejects.toThrow('collides')
  })

  it('update creates new template if none exists', async () => {
    const pluginWithoutTemplates = { ...basePlugin, templates: [] }
    pluginRepo.findOne.mockResolvedValue(pluginWithoutTemplates)
    templateRepo.create.mockReturnValue(makePluginTemplate({ id: 't-1' }))
    templateRepo.save.mockResolvedValue(makePluginTemplate({ id: 't-1' }))
    pluginRepo.save.mockResolvedValue(pluginWithoutTemplates)

    await service.update('1', {
      templates: [{ layout: 'full', liquidMarkup: 'New template' }],
    })

    expect(templateRepo.create).toHaveBeenCalled()
    expect(templateRepo.save).toHaveBeenCalled()
  })

  it('update removes a field whose keyname is gone and creates one for a new keyname', async () => {
    const oldField = makePluginField({ id: 'field-1', keyname: 'old_field' })
    const pluginWithFields = { ...basePlugin, fields: [oldField] }
    pluginRepo.findOne.mockResolvedValue(pluginWithFields)
    fieldRepo.create.mockReturnValue(makePluginField({ id: 'field-2' }))
    fieldRepo.save.mockResolvedValue(makePluginField({ id: 'field-2' }))
    pluginRepo.save.mockImplementation(async plugin => plugin as Plugin)

    await service.update('1', {
      fields: [{ keyname: 'new_field', fieldType: 'string', name: 'New Field', required: false }],
    })

    expect(fieldRepo.remove).toHaveBeenCalledWith([oldField])
    expect(fieldRepo.create).toHaveBeenCalled()
    expect(fieldRepo.save).toHaveBeenCalled()
  })

  it('update keeps a field of the same keyname in place rather than recreating it', async () => {
    const cityField = makePluginField({ id: 'field-1', keyname: 'city', name: 'City' })
    pluginRepo.findOne.mockResolvedValue({ ...basePlugin, fields: [cityField] })
    fieldRepo.save.mockImplementation(async field => field as PluginField)
    pluginRepo.save.mockImplementation(async plugin => plugin as Plugin)

    await service.update('1', {
      fields: [{ keyname: 'city', fieldType: 'string', name: 'Town', required: false }],
    })

    expect(fieldRepo.remove).not.toHaveBeenCalled()
    expect(fieldRepo.create).not.toHaveBeenCalled()
    expect(fieldRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'field-1', keyname: 'city', name: 'Town' }))
  })

  it('update refuses a Field Value for a keyname the Plugin has no field for', async () => {
    pluginRepo.findOne.mockResolvedValue({ ...basePlugin, fields: [makePluginField({ keyname: 'city' })] })
    mockFieldValues.assertWritable.mockImplementation(() => {
      throw new Error('no Plugin Field')
    })

    await expect(service.update('1', { fieldValues: { town: 'Berlin' } })).rejects.toThrow('no Plugin Field')
    expect(pluginRepo.save).not.toHaveBeenCalled()
  })

  it('update re-renders at once when a Field Value changed', async () => {
    const schedulable = makePlugin({
      ...basePlugin,
      fields: [makePluginField({ keyname: 'city' })],
      dataSources: [makePluginDataSource({ name: 'weather' })],
      templates: [makePluginTemplate()],
    })
    pluginRepo.findOne.mockResolvedValue(schedulable)
    pluginRepo.save.mockResolvedValue(schedulable)
    mockFieldValues.write.mockResolvedValue(true)

    await service.update('1', { fieldValues: { city: 'Berlin' } })

    expect(mockFieldValues.write).toHaveBeenCalledWith(schedulable, { city: 'Berlin' })
    expect(mockRefresh.refresh).toHaveBeenCalledWith(schedulable)
  })

  it('update does not re-render when no Field Value changed', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    pluginRepo.save.mockResolvedValue(basePlugin)

    await service.update('1', { name: 'Renamed' })

    expect(mockRefresh.refresh).not.toHaveBeenCalled()
  })

  it('update still succeeds when the immediate re-render fails', async () => {
    const schedulable = makePlugin({
      ...basePlugin,
      dataSources: [makePluginDataSource({ name: 'weather' })],
      templates: [makePluginTemplate()],
    })
    pluginRepo.findOne.mockResolvedValue(schedulable)
    pluginRepo.save.mockResolvedValue(schedulable)
    mockFieldValues.write.mockResolvedValue(true)
    mockRefresh.refresh.mockRejectedValue(new Error('fetch failed'))

    await expect(service.update('1', { fieldValues: { city: 'Berlin' } })).resolves.toMatchObject({ id: '1' })
  })

  it('update removes fields when empty array provided', async () => {
    const pluginWithFields = {
      ...basePlugin,
      fields: [makePluginField({ id: 'field-1', keyname: 'old_field' })],
    }
    const existingFields = [...pluginWithFields.fields]
    pluginRepo.findOne.mockResolvedValue(pluginWithFields)
    pluginRepo.save.mockResolvedValue(pluginWithFields)

    await service.update('1', { fields: [] })

    expect(fieldRepo.remove).toHaveBeenCalledWith(existingFields)
    expect(fieldRepo.create).not.toHaveBeenCalled()
  })

  it('update reschedules plugin when dataSources or templates change', async () => {
    const pluginWithDataSource = {
      ...basePlugin,
      dataSources: [makePluginDataSource({ id: 'ds-1', name: 'weather', url: 'https://api.com' })],
      templates: [makePluginTemplate({ id: 't-1', layout: 'full' })],
    }
    pluginRepo.findOne.mockResolvedValueOnce(pluginWithDataSource)
    pluginRepo.findOne.mockResolvedValueOnce(pluginWithDataSource)
    dataSourceRepo.save.mockResolvedValue(pluginWithDataSource.dataSources[0])
    pluginRepo.save.mockResolvedValue(pluginWithDataSource)

    await service.update('1', {
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://new-api.com', method: 'GET' }],
    })

    expect(mockScheduler.removeScheduledJob).toHaveBeenCalledWith('1')
    expect(mockScheduler.schedulePlugin).toHaveBeenCalledWith(pluginWithDataSource)
  })

  it('create schedules plugin when it has data sources and templates', async () => {
    const createdPlugin = {
      ...basePlugin,
      dataSources: [makePluginDataSource({ id: 'ds-1', name: 'weather' })],
      templates: [makePluginTemplate({ id: 't-1' })],
    }
    pluginRepo.save.mockResolvedValue(basePlugin)
    dataSourceRepo.create.mockReturnValue(makePluginDataSource())
    dataSourceRepo.save.mockResolvedValue(makePluginDataSource())
    templateRepo.create.mockReturnValue(makePluginTemplate())
    templateRepo.save.mockResolvedValue(makePluginTemplate())
    pluginRepo.findOne.mockResolvedValue(createdPlugin)

    await service.create({
      name: 'Plugin',
      kind: 'Poll',
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.com', method: 'GET', headers: {}, body: {} }],
      templates: [{ layout: 'full', liquidMarkup: 'Template' }],
    })

    expect(mockScheduler.schedulePlugin).toHaveBeenCalledWith(createdPlugin)
  })

  it('create does not schedule plugin without any data sources', async () => {
    const createdPlugin = {
      ...basePlugin,
      dataSources: [],
      templates: [makePluginTemplate({ id: 't-1' })],
    }
    pluginRepo.save.mockResolvedValue(basePlugin)
    templateRepo.create.mockReturnValue(makePluginTemplate())
    templateRepo.save.mockResolvedValue(makePluginTemplate())
    pluginRepo.findOne.mockResolvedValue(createdPlugin)

    await service.create({
      name: 'Plugin',
      kind: 'Poll',
      templates: [{ layout: 'full', liquidMarkup: 'Template' }],
    })

    expect(mockScheduler.schedulePlugin).not.toHaveBeenCalled()
  })

  it('create allows zero data sources as a valid draft state', async () => {
    const createdPlugin = { ...basePlugin, dataSources: [], templates: [] }
    pluginRepo.save.mockResolvedValue(basePlugin)
    pluginRepo.findOne.mockResolvedValue(createdPlugin)

    const result = await service.create({ name: 'Draft Plugin', kind: 'Poll' })

    expect(dataSourceRepo.create).not.toHaveBeenCalled()
    expect(result).toMatchObject(createdPlugin)
  })

  it('create rejects a data source named "trmnl"', async () => {
    pluginRepo.save.mockResolvedValue(basePlugin)

    await expect(service.create({
      name: 'Plugin',
      kind: 'Poll',
      dataSources: [{ name: 'trmnl', mode: 'fetch', url: 'https://api.com', method: 'GET' }],
    })).rejects.toThrow('reserved')

    expect(pluginRepo.save).not.toHaveBeenCalled()
  })

  it('create rejects a data source colliding with a sibling field keyname', async () => {
    pluginRepo.save.mockResolvedValue(basePlugin)

    await expect(service.create({
      name: 'Plugin',
      kind: 'Poll',
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.com', method: 'GET' }],
      fields: [{ keyname: 'weather', fieldType: 'string', name: 'Weather' }],
    })).rejects.toThrow('collides')
  })

  it('preview fetches a single source and renders template under its name', async () => {
    const apiData = { temperature: 25, location: 'Tokyo' }
    mockDataFetcher.fetchData = vi.fn().mockResolvedValue(apiData)
    mockRenderer.render = vi.fn().mockResolvedValue('25°C in Tokyo')

    const result = await service.preview({
      sources: [{ name: 'weather', url: 'https://api.example.com', method: 'GET' }],
      template: '{{ weather.temperature }}°C in {{ weather.location }}',
    })

    expect(mockDataFetcher.fetchData).toHaveBeenCalledWith('GET', 'https://api.example.com', undefined, undefined, expect.any(Object))
    expect(mockRenderer.render).toHaveBeenCalledWith(
      '{{ weather.temperature }}°C in {{ weather.location }}',
      expect.objectContaining({ weather: apiData }),
    )
    expect(result.html).toBe('25°C in Tokyo')
    expect(result.data).toEqual({ weather: apiData })
  })

  it('preview fetches multiple sources in parallel, each keyed by its own name', async () => {
    mockDataFetcher.fetchData = vi.fn()
      .mockImplementation((_method, url) => Promise.resolve(url === 'https://api.example.com/weather' ? { temp: 25 } : { aqi: 42 }))
    mockRenderer.render = vi.fn().mockResolvedValue('rendered')

    const result = await service.preview({
      sources: [
        { name: 'weather', url: 'https://api.example.com/weather', method: 'GET' },
        { name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' },
      ],
      template: '{{ weather.temp }} / {{ air_quality.aqi }}',
    })

    expect(mockDataFetcher.fetchData).toHaveBeenCalledTimes(2)
    expect(result.data).toEqual({ weather: { temp: 25 }, air_quality: { aqi: 42 } })
  })

  it('preview applies each source\'s own transform to its own data', async () => {
    const apiData = { value: 10 }
    const transformedData = { value: 20 }
    mockDataFetcher.fetchData = vi.fn().mockResolvedValue(apiData)
    mockTransformer.transform = vi.fn().mockReturnValue(transformedData)
    mockRenderer.render = vi.fn().mockResolvedValue('20')

    await service.preview({
      sources: [{
        name: 'source',
        url: 'https://api.example.com',
        method: 'GET',
        transformJs: 'module.exports = (d) => ({ value: d.value * 2 })',
      }],
      template: '{{ source.value }}',
    })

    expect(mockTransformer.transform).toHaveBeenCalledWith('module.exports = (d) => ({ value: d.value * 2 })', apiData)
    expect(mockRenderer.render).toHaveBeenCalledWith('{{ source.value }}', expect.objectContaining({ source: transformedData }))
  })

  it('preview gives a failing source an error marker instead of rejecting the whole preview', async () => {
    mockDataFetcher.fetchData = vi.fn()
      .mockResolvedValueOnce({ temp: 25 })
      .mockRejectedValueOnce(new Error('API timeout'))
    mockRenderer.render = vi.fn().mockResolvedValue('rendered')

    const result = await service.preview({
      sources: [
        { name: 'weather', url: 'https://api.example.com/weather', method: 'GET' },
        { name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' },
      ],
      template: '{{ weather.temp }}',
    })

    expect(result.data.weather).toEqual({ temp: 25 })
    expect(result.data.air_quality).toEqual({ error: true, message: 'API timeout' })
  })

  it('preview includes field values in context', async () => {
    const apiData = { temp: 25 }
    mockDataFetcher.fetchData = vi.fn().mockResolvedValue(apiData)
    mockRenderer.render = vi.fn().mockResolvedValue('<html>test</html>')

    await service.preview({
      sources: [{ name: 'source', url: 'https://api.example.com', method: 'GET' }],
      template: '{{ api_key }}',
      fieldValues: { api_key: 'secret-123' },
    })

    expect(mockDataFetcher.fetchData).toHaveBeenCalledWith(
      'GET',
      'https://api.example.com',
      undefined,
      undefined,
      expect.objectContaining({ api_key: 'secret-123' }),
    )
  })

  describe('webhook-kind plugins', () => {
    const webhookPlugin: Plugin = makePlugin({
      id: '1',
      name: 'Sensor Feed',
      kind: 'Webhook',
      refreshInterval: 15,
      webhookToken: 'token-abc',
      mergeStrategy: 'stream',
      streamLimit: 20,
    })

    it('create issues a webhook token and never schedules the plugin', async () => {
      pluginRepo.save.mockImplementation(async plugin => makePlugin({ ...plugin, id: '1' }))
      pluginRepo.findOne.mockResolvedValue(webhookPlugin)

      await service.create({ name: 'Sensor Feed', kind: 'Webhook', mergeStrategy: 'standard' })

      expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'Webhook',
        mergeStrategy: 'standard',
        webhookToken: expect.any(String),
      }))
      expect(mockScheduler.schedulePlugin).not.toHaveBeenCalled()
    })

    it('create rejects a data source on a webhook-kind plugin', async () => {
      await expect(service.create({
        name: 'Sensor Feed',
        kind: 'Webhook',
        mergeStrategy: 'standard',
        dataSources: [{ name: 'source', mode: 'fetch', url: 'https://api.example.com' }],
      })).rejects.toThrow('A Webhook-kind Plugin cannot have Data Sources')
    })

    it('update rejects a change of kind', async () => {
      pluginRepo.findOne.mockResolvedValue({ ...webhookPlugin })

      await expect(service.update('1', { kind: 'Poll' })).rejects.toThrow(
        'A Plugin\'s Kind is fixed at creation and cannot be changed',
      )
    })

    it('update rejects a nulled kind', async () => {
      pluginRepo.findOne.mockResolvedValue({ ...webhookPlugin })

      // @ts-expect-error kind is intentionally invalid (null) to prove the service rejects it
      await expect(service.update('1', { kind: null })).rejects.toThrow(
        'A Plugin\'s Kind is fixed at creation and cannot be changed',
      )
    })

    it('update rejects an explicit stream limit alongside a non-stream merge strategy', async () => {
      pluginRepo.findOne.mockResolvedValue({ ...webhookPlugin })

      await expect(service.update('1', { mergeStrategy: 'deep_merge', streamLimit: 20 })).rejects.toThrow(
        'A Stream Limit is only valid for the stream Merge Strategy',
      )
    })

    it('update accepts an unchanged kind', async () => {
      const stored = { ...webhookPlugin }
      pluginRepo.findOne.mockResolvedValue(stored)
      pluginRepo.save.mockImplementation(async plugin => makePlugin(plugin))

      await expect(service.update('1', { kind: 'Webhook', name: 'Renamed' })).resolves.toMatchObject({ name: 'Renamed' })
    })

    it('update rejects a merge strategy on a poll-kind plugin', async () => {
      pluginRepo.findOne.mockResolvedValue({ ...basePlugin })

      await expect(service.update('1', { mergeStrategy: 'stream' })).rejects.toThrow(
        'A Poll-kind Plugin cannot have a Merge Strategy',
      )
    })

    it('update drops the stream limit when the merge strategy moves off stream', async () => {
      const stored = { ...webhookPlugin }
      pluginRepo.findOne.mockResolvedValue(stored)
      pluginRepo.save.mockImplementation(async plugin => makePlugin(plugin))

      const updated = await service.update('1', { mergeStrategy: 'deep_merge' })

      expect(updated).toMatchObject({ mergeStrategy: 'deep_merge', streamLimit: null })
    })

    it('update rejects a directly supplied webhook token', async () => {
      pluginRepo.findOne.mockResolvedValue({ ...webhookPlugin })

      await expect(service.update('1', { webhookToken: 'stolen' })).rejects.toThrow(
        'The Webhook Token is issued by Kuroshiro and cannot be set directly',
      )
    })

    it('regenerateWebhookToken issues a new token', async () => {
      pluginRepo.findOneBy.mockResolvedValue({ ...webhookPlugin })

      const result = await service.regenerateWebhookToken('1')

      expect(result.webhookToken).not.toBe('token-abc')
      expect(pluginRepo.update).toHaveBeenCalledWith('1', { webhookToken: result.webhookToken })
    })

    it('clearWebhookPayload rejects a poll-kind plugin', async () => {
      pluginRepo.findOneBy.mockResolvedValue({ ...basePlugin })

      await expect(service.clearWebhookPayload('1')).rejects.toThrow('is not a Webhook-kind Plugin')
      expect(pluginRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('update through the real DTO transformation pipeline (regression for #828)', () => {
    // plainToInstance gives every UpdatePluginDto field (incl. `kind`, `mergeStrategy`) an own
    // property set to `undefined` even when the caller never sent it — a plain object literal
    // cast `as any` doesn't reproduce that, so these tests go through the real pipeline instead.
    function transform(body: Record<string, unknown>): UpdatePluginDto {
      return plainToInstance(UpdatePluginDto, body)
    }

    it('update accepts a body that omits kind entirely, and leaves kind and other unset fields untouched', async () => {
      const stored = { ...basePlugin }
      pluginRepo.findOne.mockResolvedValue(stored)
      pluginRepo.save.mockImplementation(plugin => Promise.resolve(makePlugin(plugin)))

      const result = await service.update('1', transform({ description: 'test only' }))

      expect(result).toMatchObject({
        description: 'test only',
        kind: basePlugin.kind,
        name: basePlugin.name,
        refreshInterval: basePlugin.refreshInterval,
      })
      expect(result?.kind).not.toBeUndefined()
      expect(result?.name).not.toBeUndefined()
    })

    it('update accepts a webhook-kind body that omits mergeStrategy entirely, and leaves it untouched', async () => {
      const stored = makePlugin({
        id: '1',
        name: 'Sensor Feed',
        kind: 'Webhook',
        refreshInterval: 15,
        webhookToken: 'token-abc',
        mergeStrategy: 'stream',
        streamLimit: 20,
      })
      pluginRepo.findOne.mockResolvedValue(stored)
      pluginRepo.save.mockImplementation(plugin => Promise.resolve(makePlugin(plugin)))

      const result = await service.update('1', transform({ description: 'test only' }))

      expect(result).toMatchObject({
        description: 'test only',
        kind: 'Webhook',
        mergeStrategy: 'stream',
        streamLimit: 20,
      })
    })

    it('update still rejects an explicit kind change sent through the real pipeline', async () => {
      pluginRepo.findOne.mockResolvedValue({ ...basePlugin })

      await expect(service.update('1', transform({ kind: 'Webhook' }))).rejects.toThrow(
        'A Plugin\'s Kind is fixed at creation and cannot be changed',
      )
    })
  })

  describe('duplicate', () => {
    const sourceDataSources = [
      makePluginDataSource({ id: 'ds-1', name: 'weather', mode: 'fetch', url: 'https://api.com', method: 'GET', headers: { Authorization: 'Bearer x' }, body: {}, order: 0 }),
      makePluginDataSource({ id: 'ds-2', name: 'note', mode: 'literal', url: undefined, method: 'GET', literalValue: 'hello', order: 1 }),
    ]
    const sourceTemplates = [makePluginTemplate({ id: 't-1', layout: 'full', liquidMarkup: '<div>{{ weather }}</div>' })]
    const sourceFields = [makePluginField({ id: 'f-1', keyname: 'unit', name: 'Unit', defaultValue: 'C', order: 0 })]

    const sourcePlugin: Plugin = makePlugin({
      id: 'source-1',
      name: 'Weather Plugin',
      description: 'Shows weather',
      kind: 'Poll',
      refreshInterval: 30,
      dataSources: sourceDataSources,
      templates: sourceTemplates,
      fields: sourceFields,
      deviceAssignments: [makeDevicePlugin({ id: 'dp-1' })],
    })

    function mockCreatePipeline(createdId: string) {
      pluginRepo.save.mockImplementation(async plugin => ({ ...plugin, id: createdId }))
      dataSourceRepo.create.mockImplementation(input => input as PluginDataSource)
      dataSourceRepo.save.mockImplementation(async input => input as PluginDataSource)
      templateRepo.create.mockImplementation(input => input as PluginTemplate)
      templateRepo.save.mockImplementation(async input => input as PluginTemplate)
      fieldRepo.create.mockImplementation(input => input as PluginField)
      fieldRepo.save.mockImplementation(async input => input as PluginField)
    }

    it('clones data sources, templates, fields and Field Values under a new id and "(copy)" name', async () => {
      mockCreatePipeline('new-id')
      pluginRepo.findOne
        .mockResolvedValueOnce(sourcePlugin) // load source with relations
        .mockResolvedValueOnce(makePlugin({ id: 'new-id', dataSources: sourceDataSources, templates: sourceTemplates, fields: sourceFields })) // reload after create()
      mockFieldValues.storedFor.mockResolvedValue({ unit: 'F' })

      const result = await service.duplicate('source-1')

      expect(result.id).toBe('new-id')
      expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Weather Plugin (copy)' }))
      expect(dataSourceRepo.create).toHaveBeenCalledTimes(2)
      expect(templateRepo.create).toHaveBeenCalledTimes(1)
      expect(fieldRepo.create).toHaveBeenCalledTimes(1)
      expect(mockFieldValues.storedFor).toHaveBeenCalledWith('source-1')
      expect(mockFieldValues.write).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id', fields: sourceFields }), { unit: 'F' })
      expect(result.dataSources).toEqual(sourceDataSources)
      expect(result.templates).toEqual(sourceTemplates)
      expect(result.fields).toEqual(sourceFields)
    })

    it('copies the source Recipe id and snapshot when duplicating an imported plugin', async () => {
      const snapshot = { name: 'Weather Plugin', kind: 'Poll', refreshInterval: 30, dataSources: [], templates: [], fields: [] }
      const importedSource = makePlugin({
        ...sourcePlugin,
        id: 'source-3',
        sourceRecipeId: '150460',
        sourceRecipeSnapshot: snapshot,
      })
      mockCreatePipeline('new-id-3')
      pluginRepo.findOne
        .mockResolvedValueOnce(importedSource)
        .mockResolvedValueOnce(makePlugin({ id: 'new-id-3' }))

      await service.duplicate('source-3')

      expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        sourceRecipeId: '150460',
        sourceRecipeSnapshot: snapshot,
      }))
    })

    it('does not carry over device assignments, webhook payload, or the source webhook token', async () => {
      const webhookSource = makePlugin({
        id: 'source-2',
        name: 'Sensor Feed',
        kind: 'Webhook',
        webhookToken: 'source-token',
        webhookPayload: { reading: 1 },
        mergeStrategy: 'standard',
        deviceAssignments: [makeDevicePlugin({ id: 'dp-2' })],
      })
      mockCreatePipeline('new-id-2')
      pluginRepo.findOne
        .mockResolvedValueOnce(webhookSource)
        .mockResolvedValueOnce(makePlugin({ id: 'new-id-2', kind: 'Webhook' }))

      const result = await service.duplicate('source-2')

      expect(result.id).toBe('new-id-2')
      expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'Webhook',
        webhookToken: expect.any(String),
      }))
      const savedArg = pluginRepo.save.mock.calls[0][0]
      expect(savedArg.webhookToken).not.toBe('source-token')
      expect(savedArg).not.toHaveProperty('webhookPayload')
      expect(savedArg).not.toHaveProperty('deviceAssignments')
    })

    it('throws NotFoundException when the source plugin does not exist', async () => {
      pluginRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.duplicate('missing')).rejects.toThrow('not found')
      expect(pluginRepo.save).not.toHaveBeenCalled()
    })
  })
})
