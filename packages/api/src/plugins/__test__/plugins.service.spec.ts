import type { Screen } from '../../screens/screens.entity'
import type { MockPluginDataFetcherService, MockPluginRendererService, MockPluginTransformService } from '../../test/mockPluginCollaborators'
import type { DevicePlugin } from '../entities/device-plugin.entity'
import type { PluginDataSource } from '../entities/plugin-data-source.entity'
import type { PluginField } from '../entities/plugin-field.entity'
import type { PluginTemplate } from '../entities/plugin-template.entity'
import type { Plugin } from '../entities/plugin.entity'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../services/plugin-renderer.service'
import type { PluginSchedulerService } from '../services/plugin-scheduler.service'
import type { PluginTransformService } from '../services/plugin-transform.service'
import { plainToInstance } from 'class-transformer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevicePlugin, makePlugin, makePluginDataSource, makePluginField, makePluginTemplate, makeScreen } from '../../test/fixtures'
import { createMockPluginDataFetcherService, createMockPluginRendererService, createMockPluginTransformService } from '../../test/mockPluginCollaborators'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { asService, injectPrivate } from '../../test/mockService'
import { UpdatePluginDto } from '../dto/update-plugin.dto'
import { PluginsService } from '../plugins.service'
import { PluginDataResolverService } from '../services/plugin-data-resolver.service'

describe('pluginsService', () => {
  let service: PluginsService
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let devicePluginRepo: ReturnType<typeof createMockRepository<DevicePlugin>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let templateRepo: ReturnType<typeof createMockRepository<PluginTemplate>>
  let fieldRepo: ReturnType<typeof createMockRepository<PluginField>>
  let mockDataFetcher: MockPluginDataFetcherService
  let mockRenderer: MockPluginRendererService
  let mockScheduler: { schedulePlugin: ReturnType<typeof vi.fn>, removeScheduledJob: ReturnType<typeof vi.fn>, hasScheduledJob: ReturnType<typeof vi.fn> }
  let mockTransformer: MockPluginTransformService

  beforeEach(() => {
    pluginRepo = createMockRepository<Plugin>()
    devicePluginRepo = createMockRepository<DevicePlugin>()
    screenRepo = createMockRepository<Screen>()
    dataSourceRepo = createMockRepository<PluginDataSource>()
    templateRepo = createMockRepository<PluginTemplate>()
    fieldRepo = createMockRepository<PluginField>()

    mockDataFetcher = createMockPluginDataFetcherService()
    mockRenderer = createMockPluginRendererService()
    mockScheduler = {
      schedulePlugin: vi.fn(),
      removeScheduledJob: vi.fn(),
      hasScheduledJob: vi.fn(),
    }
    mockTransformer = createMockPluginTransformService()

    service = new PluginsService(
      asRepository(pluginRepo),
      asRepository(devicePluginRepo),
      asRepository(screenRepo),
      asRepository(dataSourceRepo),
      asRepository(templateRepo),
      asRepository(fieldRepo),
      new PluginDataResolverService(asService<PluginDataFetcherService>(mockDataFetcher), asService<PluginTransformService>(mockTransformer)),
      asService<PluginRendererService>(mockRenderer),
      asService<PluginSchedulerService>(mockScheduler),
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
      relations: { dataSources: true, templates: true, fields: true },
      order: { name: 'ASC' },
    })
    expect(result).toBe(plugins)
  })

  it('findById returns a plugin by id with relations', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    const result = await service.findById('1')
    expect(pluginRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: { dataSources: true, templates: true, fields: true, deviceAssignments: { device: true } },
    })
    expect(result).toBe(basePlugin)
  })

  it('findByDevice returns plugins for a specific device', async () => {
    const devicePlugins = [makeDevicePlugin({
      id: 'dp-1',
      isActive: true,
      order: 1,
      plugin: basePlugin,
    })]
    devicePluginRepo.find.mockResolvedValue(devicePlugins)
    const result = await service.findByDevice('device-1')
    expect(devicePluginRepo.find).toHaveBeenCalledWith({
      where: { device: { id: 'device-1' } },
      relations: { plugin: { dataSources: true, templates: true, fields: true } },
      order: { order: 'ASC' },
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject(basePlugin)
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
    expect(result).toBe(basePlugin)
  })

  it('create persists the source Recipe id when provided', async () => {
    const pluginData = { name: 'Daily Weather', kind: 'Poll' as const, sourceRecipeId: '150460' }
    pluginRepo.save.mockResolvedValue(basePlugin)
    pluginRepo.findOne.mockResolvedValue(basePlugin)

    await service.create(pluginData)

    expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({ sourceRecipeId: '150460' }))
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
    expect(result).toEqual(updated)
  })

  it('update returns null if plugin not found', async () => {
    pluginRepo.findOne.mockResolvedValue(null)
    const result = await service.update('1', { name: 'Updated' })
    expect(result).toBeNull()
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
    expect(result).toBe(savedPlugin)
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

    await expect(service.create(pluginData)).resolves.toBe(savedPlugin)
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

  it('assignToDevice creates device plugin and screen', async () => {
    const devicePlugin = makeDevicePlugin({ id: 'dp-1', isActive: true, order: 0 })
    devicePluginRepo.create.mockReturnValue(devicePlugin)
    devicePluginRepo.save.mockResolvedValue(devicePlugin)
    screenRepo.maximum.mockResolvedValue(5)
    screenRepo.create.mockReturnValue(makeScreen())
    screenRepo.save.mockResolvedValue(makeScreen())

    const result = await service.assignToDevice('plugin-1', {
      deviceId: 'device-1',
      isActive: true,
      order: 1,
    })

    expect(devicePluginRepo.create).toHaveBeenCalled()
    expect(devicePluginRepo.save).toHaveBeenCalled()
    expect(screenRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'plugin' }))
    expect(screenRepo.save).toHaveBeenCalled()
    expect(result).toBe(devicePlugin)
  })

  it('unassignFromDevice removes device plugin and screen', async () => {
    const devicePlugin = makeDevicePlugin({ id: 'dp-1' })
    devicePluginRepo.findOne.mockResolvedValue(devicePlugin)
    devicePluginRepo.remove.mockResolvedValue(devicePlugin)
    screenRepo.delete = vi.fn().mockResolvedValue(undefined)

    const result = await service.unassignFromDevice('plugin-1', 'device-1')

    expect(devicePluginRepo.findOne).toHaveBeenCalled()
    expect(screenRepo.delete).toHaveBeenCalledWith({ devicePluginId: 'dp-1' })
    expect(devicePluginRepo.remove).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('unassignFromDevice returns false if not found', async () => {
    devicePluginRepo.findOne.mockResolvedValue(null)

    const result = await service.unassignFromDevice('plugin-1', 'device-1')

    expect(result).toBe(false)
  })

  it('updateDeviceAssignment updates device plugin and screen', async () => {
    const devicePlugin = makeDevicePlugin({ id: 'dp-1', isActive: true })
    const updated = { ...devicePlugin, isActive: false }
    devicePluginRepo.findOneBy.mockResolvedValue(devicePlugin)
    devicePluginRepo.save.mockResolvedValue(updated)
    screenRepo.update = vi.fn().mockResolvedValue(undefined)

    const result = await service.updateDeviceAssignment('dp-1', { isActive: false })

    expect(devicePluginRepo.save).toHaveBeenCalled()
    expect(screenRepo.update).toHaveBeenCalledWith(
      { devicePluginId: 'dp-1' },
      { isActive: false },
    )
    expect(result).toBe(updated)
  })

  it('updateDeviceAssignment returns null if not found', async () => {
    devicePluginRepo.findOneBy.mockResolvedValue(null)

    const result = await service.updateDeviceAssignment('dp-1', { isActive: false })

    expect(result).toBeNull()
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

  it('update replaces existing fields', async () => {
    const pluginWithFields = {
      ...basePlugin,
      fields: [makePluginField({ id: 'field-1', keyname: 'old_field' })],
    }
    pluginRepo.findOne.mockResolvedValue(pluginWithFields)
    fieldRepo.create.mockReturnValue(makePluginField({ id: 'field-2' }))
    fieldRepo.save.mockResolvedValue(makePluginField({ id: 'field-2' }))
    pluginRepo.save.mockResolvedValue(pluginWithFields)

    await service.update('1', {
      fields: [{ keyname: 'new_field', fieldType: 'string', name: 'New Field', required: false }],
    })

    expect(fieldRepo.remove).toHaveBeenCalledWith(pluginWithFields.fields)
    expect(fieldRepo.create).toHaveBeenCalled()
    expect(fieldRepo.save).toHaveBeenCalled()
  })

  it('update removes fields when empty array provided', async () => {
    const pluginWithFields = {
      ...basePlugin,
      fields: [makePluginField({ id: 'field-1', keyname: 'old_field' })],
    }
    pluginRepo.findOne.mockResolvedValue(pluginWithFields)
    pluginRepo.save.mockResolvedValue(pluginWithFields)

    await service.update('1', { fields: [] })

    expect(fieldRepo.remove).toHaveBeenCalledWith(pluginWithFields.fields)
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
    expect(result).toBe(createdPlugin)
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

    const result = await service.preview(
      [{ name: 'weather', url: 'https://api.example.com', method: 'GET' }],
      '{{ weather.temperature }}°C in {{ weather.location }}',
    )

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

    const result = await service.preview(
      [
        { name: 'weather', url: 'https://api.example.com/weather', method: 'GET' },
        { name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' },
      ],
      '{{ weather.temp }} / {{ air_quality.aqi }}',
    )

    expect(mockDataFetcher.fetchData).toHaveBeenCalledTimes(2)
    expect(result.data).toEqual({ weather: { temp: 25 }, air_quality: { aqi: 42 } })
  })

  it('preview applies each source\'s own transform to its own data', async () => {
    const apiData = { value: 10 }
    const transformedData = { value: 20 }
    mockDataFetcher.fetchData = vi.fn().mockResolvedValue(apiData)
    mockTransformer.transform = vi.fn().mockReturnValue(transformedData)
    mockRenderer.render = vi.fn().mockResolvedValue('20')

    await service.preview(
      [{
        name: 'source',
        url: 'https://api.example.com',
        method: 'GET',
        transformJs: 'module.exports = (d) => ({ value: d.value * 2 })',
      }],
      '{{ source.value }}',
    )

    expect(mockTransformer.transform).toHaveBeenCalledWith('module.exports = (d) => ({ value: d.value * 2 })', apiData)
    expect(mockRenderer.render).toHaveBeenCalledWith('{{ source.value }}', expect.objectContaining({ source: transformedData }))
  })

  it('preview gives a failing source an error marker instead of rejecting the whole preview', async () => {
    mockDataFetcher.fetchData = vi.fn()
      .mockResolvedValueOnce({ temp: 25 })
      .mockRejectedValueOnce(new Error('API timeout'))
    mockRenderer.render = vi.fn().mockResolvedValue('rendered')

    const result = await service.preview(
      [
        { name: 'weather', url: 'https://api.example.com/weather', method: 'GET' },
        { name: 'air_quality', url: 'https://api.example.com/air', method: 'GET' },
      ],
      '{{ weather.temp }}',
    )

    expect(result.data.weather).toEqual({ temp: 25 })
    expect(result.data.air_quality).toEqual({ error: true, message: 'API timeout' })
  })

  it('preview includes field values in context', async () => {
    const apiData = { temp: 25 }
    mockDataFetcher.fetchData = vi.fn().mockResolvedValue(apiData)
    mockRenderer.render = vi.fn().mockResolvedValue('<html>test</html>')

    await service.preview(
      [{ name: 'source', url: 'https://api.example.com', method: 'GET' }],
      '{{ api_key }}',
      { api_key: 'secret-123' },
    )

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
})
