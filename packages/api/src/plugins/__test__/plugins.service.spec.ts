import type { Screen } from '../../screens/screens.entity.js'
import type { MockPluginRenderCacheService } from '../../test/mockPluginCollaborators.js'
import type { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import type { PluginField } from '../entities/plugin-field.entity.js'
import type { PluginTemplate } from '../entities/plugin-template.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { PluginAssignmentsService } from '../services/plugin-assignments.service.js'
import type { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
import type { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import type { PluginSchedulerService } from '../services/plugin-scheduler.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlugin, makePluginDataSource, makePluginField, makePluginTemplate } from '../../test/fixtures.js'
import { createMockPluginFieldValuesService, createMockPluginRenderCacheService } from '../../test/mockPluginCollaborators.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { PluginsService } from '../plugins.service.js'

describe('pluginsService', () => {
  let service: PluginsService
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let templateRepo: ReturnType<typeof createMockRepository<PluginTemplate>>
  let fieldRepo: ReturnType<typeof createMockRepository<PluginField>>
  let mockFieldValues: ReturnType<typeof createMockPluginFieldValuesService>
  let mockScheduler: { schedulePlugin: ReturnType<typeof vi.fn>, scheduleAtBoot: ReturnType<typeof vi.fn>, removeScheduledJob: ReturnType<typeof vi.fn>, hasScheduledJob: ReturnType<typeof vi.fn> }
  let mockRenderCache: MockPluginRenderCacheService

  beforeEach(() => {
    pluginRepo = createMockRepository<Plugin>()
    screenRepo = createMockRepository<Screen>()
    dataSourceRepo = createMockRepository<PluginDataSource>()
    templateRepo = createMockRepository<PluginTemplate>()
    fieldRepo = createMockRepository<PluginField>()
    mockFieldValues = createMockPluginFieldValuesService()

    mockScheduler = {
      schedulePlugin: vi.fn(),
      scheduleAtBoot: vi.fn(),
      removeScheduledJob: vi.fn(),
      hasScheduledJob: vi.fn(),
    }
    mockRenderCache = createMockPluginRenderCacheService()

    service = new PluginsService(
      asRepository(pluginRepo),
      asRepository(screenRepo),
      asRepository(dataSourceRepo),
      asRepository(templateRepo),
      asRepository(fieldRepo),
      asService<PluginSchedulerService>(mockScheduler),
      asService<PluginRenderCacheService>(mockRenderCache),
      asService<PluginFieldValuesService>(mockFieldValues),
      asService<PluginAssignmentsService>({}),
    )
  })

  const basePlugin: Plugin = makePlugin({
    id: '1',
    name: 'Weather Plugin',
    description: 'Shows weather',
    kind: 'Poll',
    refreshInterval: 15,
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
    })).rejects.toMatchObject({ fields: [{ path: 'dataSources.0.name', message: expect.stringContaining('reserved') }] })

    expect(pluginRepo.save).not.toHaveBeenCalled()
  })

  it('create rejects a data source colliding with a sibling field keyname', async () => {
    pluginRepo.save.mockResolvedValue(basePlugin)

    await expect(service.create({
      name: 'Plugin',
      kind: 'Poll',
      dataSources: [{ name: 'weather', mode: 'fetch', url: 'https://api.com', method: 'GET' }],
      fields: [{ keyname: 'weather', fieldType: 'string', name: 'Weather' }],
    })).rejects.toMatchObject({ fields: [{ path: 'dataSources.0.name', message: expect.stringContaining('collides') }] })
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

    it('create issues a webhook token', async () => {
      pluginRepo.save.mockImplementation(async plugin => makePlugin({ ...plugin, id: '1' }))
      pluginRepo.findOne.mockResolvedValue(webhookPlugin)

      await service.create({ name: 'Sensor Feed', kind: 'Webhook', mergeStrategy: 'standard' })

      expect(pluginRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'Webhook',
        mergeStrategy: 'standard',
        webhookToken: expect.any(String),
      }))
    })

    it('create rejects a data source on a webhook-kind plugin', async () => {
      await expect(service.create({
        name: 'Sensor Feed',
        kind: 'Webhook',
        mergeStrategy: 'standard',
        dataSources: [{ name: 'source', mode: 'fetch', url: 'https://api.example.com' }],
      })).rejects.toThrow('A Webhook-kind Plugin cannot have Data Sources')
    })
  })

  describe('onModuleInit', () => {
    it('schedules every loaded Plugin at boot, deciding whether each one is due', async () => {
      const poll = makePlugin({ id: '1', name: 'Weather' })
      const webhook = makePlugin({ id: '2', name: 'Sensor Feed', kind: 'Webhook' })
      pluginRepo.find.mockResolvedValue([poll, webhook])
      mockScheduler.hasScheduledJob.mockImplementation((id: string) => id === '1')

      await service.onModuleInit()

      expect(pluginRepo.find).toHaveBeenCalledWith({ relations: { dataSources: true, templates: true } })
      expect(mockScheduler.scheduleAtBoot).toHaveBeenCalledWith(poll)
      expect(mockScheduler.scheduleAtBoot).toHaveBeenCalledWith(webhook)
      expect(mockScheduler.schedulePlugin).not.toHaveBeenCalled()
    })
  })
})
