import type { Repository } from 'typeorm'
import type { DevicePlugin } from '../entities/device-plugin.entity'
import type { Plugin } from '../entities/plugin.entity'
import type { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import type { PluginRendererService } from '../services/plugin-renderer.service'
import type { PluginSchedulerService } from '../services/plugin-scheduler.service'
import type { PluginTransformService } from '../services/plugin-transform.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginsService } from '../plugins.service'

interface MockRepository {
  find: ReturnType<typeof vi.fn>
  findOne: ReturnType<typeof vi.fn>
  findOneBy: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  maximum?: ReturnType<typeof vi.fn>
}

function createMockRepository(): MockRepository {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    maximum: vi.fn(),
  }
}

describe('pluginsService', () => {
  let service: PluginsService
  let pluginRepo: MockRepository
  let devicePluginRepo: MockRepository
  let screenRepo: MockRepository
  let dataSourceRepo: MockRepository
  let templateRepo: MockRepository
  let fieldRepo: MockRepository
  let mockDataFetcher: PluginDataFetcherService
  let mockRenderer: PluginRendererService
  let mockScheduler: PluginSchedulerService
  let mockTransformer: PluginTransformService

  beforeEach(() => {
    pluginRepo = createMockRepository()
    devicePluginRepo = createMockRepository()
    screenRepo = createMockRepository()
    dataSourceRepo = createMockRepository()
    templateRepo = createMockRepository()
    fieldRepo = createMockRepository()

    mockDataFetcher = { fetchData: vi.fn() } as any
    mockRenderer = { render: vi.fn(), renderForDisplay: vi.fn() } as any
    mockScheduler = {
      schedulePlugin: vi.fn(),
      removeScheduledJob: vi.fn(),
      hasScheduledJob: vi.fn(),
    } as any
    mockTransformer = { transform: vi.fn() } as any

    service = new PluginsService(
      pluginRepo as unknown as Repository<Plugin>,
      devicePluginRepo as unknown as Repository<DevicePlugin>,
      screenRepo as unknown as Repository<any>,
      dataSourceRepo as unknown as Repository<any>,
      templateRepo as unknown as Repository<any>,
      fieldRepo as unknown as Repository<any>,
      mockDataFetcher,
      mockRenderer,
      mockScheduler,
      mockTransformer,
    )
  })

  const basePlugin = {
    id: '1',
    name: 'Weather Plugin',
    description: 'Shows weather',
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Plugin

  it('findAll returns all plugins ordered by name', async () => {
    const plugins = [basePlugin]
    pluginRepo.find.mockResolvedValue(plugins)
    const result = await service.findAll()
    expect(pluginRepo.find).toHaveBeenCalledWith({
      relations: ['dataSource', 'templates', 'fields'],
      order: { name: 'ASC' },
    })
    expect(result).toBe(plugins)
  })

  it('findById returns a plugin by id with relations', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    const result = await service.findById('1')
    expect(pluginRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: ['dataSource', 'templates', 'fields', 'deviceAssignments', 'deviceAssignments.device'],
    })
    expect(result).toBe(basePlugin)
  })

  it('findByDevice returns plugins for a specific device', async () => {
    const devicePlugins = [{
      id: 'dp-1',
      isActive: true,
      order: 1,
      plugin: basePlugin,
    }]
    devicePluginRepo.find.mockResolvedValue(devicePlugins)
    const result = await service.findByDevice('device-1')
    expect(devicePluginRepo.find).toHaveBeenCalledWith({
      where: { device: { id: 'device-1' } },
      relations: ['plugin', 'plugin.dataSource', 'plugin.templates', 'plugin.fields'],
      order: { order: 'ASC' },
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject(basePlugin)
  })

  it('create creates and saves a new plugin', async () => {
    const pluginData = { name: 'Weather Plugin' }
    pluginRepo.save.mockResolvedValue(basePlugin)
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    const result = await service.create(pluginData as any)
    expect(pluginRepo.save).toHaveBeenCalled()
    expect(pluginRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: ['dataSource', 'templates', 'fields'],
    })
    expect(result).toBe(basePlugin)
  })

  it('update updates and saves an existing plugin', async () => {
    pluginRepo.findOne.mockResolvedValue(basePlugin)
    const updated = { ...basePlugin, name: 'Updated Weather' } as unknown as Plugin
    pluginRepo.save.mockResolvedValue(updated)
    const result = await service.update('1', { name: 'Updated Weather' } as any)
    expect(pluginRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: ['dataSource', 'templates', 'fields'],
    })
    expect(pluginRepo.save).toHaveBeenCalled()
    expect(result).toEqual(updated)
  })

  it('update returns null if plugin not found', async () => {
    pluginRepo.findOne.mockResolvedValue(null)
    const result = await service.update('1', { name: 'Updated' } as any)
    expect(result).toBeNull()
  })

  it('remove deletes a plugin and returns true', async () => {
    pluginRepo.findOneBy.mockResolvedValue(basePlugin)
    pluginRepo.remove.mockResolvedValue(undefined)
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

  it('create saves plugin with dataSource, templates, and fields', async () => {
    const pluginData = {
      name: 'Complete Plugin',
      dataSource: {
        url: 'https://api.example.com',
        method: 'GET',
        headers: {},
        body: {},
        transformJs: 'module.exports = (data) => data',
      },
      templates: [
        { layout: 'full', liquidMarkup: 'Template' },
      ],
      fields: [
        { keyname: 'api_key', fieldType: 'password', name: 'API Key', required: true },
      ],
    }

    const savedPlugin = { ...basePlugin, id: '2' } as Plugin
    pluginRepo.save.mockResolvedValue(savedPlugin)
    dataSourceRepo.create.mockReturnValue({})
    dataSourceRepo.save.mockResolvedValue({})
    templateRepo.create.mockReturnValue({})
    templateRepo.save.mockResolvedValue({})
    fieldRepo.create.mockReturnValue({})
    fieldRepo.save.mockResolvedValue({})
    pluginRepo.findOne.mockResolvedValue(savedPlugin)

    const result = await service.create(pluginData as any)

    expect(dataSourceRepo.create).toHaveBeenCalled()
    expect(dataSourceRepo.save).toHaveBeenCalled()
    expect(templateRepo.create).toHaveBeenCalled()
    expect(templateRepo.save).toHaveBeenCalled()
    expect(fieldRepo.create).toHaveBeenCalled()
    expect(fieldRepo.save).toHaveBeenCalled()
    expect(result).toBe(savedPlugin)
  })

  it('assignToDevice creates device plugin and screen', async () => {
    const devicePlugin = { id: 'dp-1', isActive: true, order: 0 }
    devicePluginRepo.create.mockReturnValue(devicePlugin)
    devicePluginRepo.save.mockResolvedValue(devicePlugin)
    screenRepo.maximum.mockResolvedValue(5)
    screenRepo.create.mockReturnValue({})
    screenRepo.save.mockResolvedValue({})

    const result = await service.assignToDevice('plugin-1', {
      deviceId: 'device-1',
      isActive: true,
      order: 1,
    } as any)

    expect(devicePluginRepo.create).toHaveBeenCalled()
    expect(devicePluginRepo.save).toHaveBeenCalled()
    expect(screenRepo.create).toHaveBeenCalled()
    expect(screenRepo.save).toHaveBeenCalled()
    expect(result).toBe(devicePlugin)
  })

  it('unassignFromDevice removes device plugin and screen', async () => {
    const devicePlugin = { id: 'dp-1' }
    devicePluginRepo.findOne.mockResolvedValue(devicePlugin)
    devicePluginRepo.remove.mockResolvedValue(undefined)
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
    const devicePlugin = { id: 'dp-1', isActive: true }
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

  it('update creates new dataSource if none exists', async () => {
    const pluginWithoutDataSource = { ...basePlugin, dataSource: null }
    pluginRepo.findOne.mockResolvedValue(pluginWithoutDataSource)
    dataSourceRepo.create.mockReturnValue({ id: 'ds-1' })
    dataSourceRepo.save.mockResolvedValue({ id: 'ds-1' })
    pluginRepo.save.mockResolvedValue(pluginWithoutDataSource)

    await service.update('1', {
      dataSource: { url: 'https://new-api.com', method: 'GET', headers: {}, body: {} },
    } as any)

    expect(dataSourceRepo.create).toHaveBeenCalled()
    expect(dataSourceRepo.save).toHaveBeenCalled()
  })

  it('update creates new template if none exists', async () => {
    const pluginWithoutTemplates = { ...basePlugin, templates: [] }
    pluginRepo.findOne.mockResolvedValue(pluginWithoutTemplates)
    templateRepo.create.mockReturnValue({ id: 't-1' })
    templateRepo.save.mockResolvedValue({ id: 't-1' })
    pluginRepo.save.mockResolvedValue(pluginWithoutTemplates)

    await service.update('1', {
      templates: [{ layout: 'full', liquidMarkup: 'New template' }],
    } as any)

    expect(templateRepo.create).toHaveBeenCalled()
    expect(templateRepo.save).toHaveBeenCalled()
  })

  it('update replaces existing fields', async () => {
    const pluginWithFields = {
      ...basePlugin,
      fields: [{ id: 'field-1', keyname: 'old_field' }],
    }
    pluginRepo.findOne.mockResolvedValue(pluginWithFields)
    fieldRepo.remove.mockResolvedValue(undefined)
    fieldRepo.create.mockReturnValue({ id: 'field-2' })
    fieldRepo.save.mockResolvedValue({ id: 'field-2' })
    pluginRepo.save.mockResolvedValue(pluginWithFields)

    await service.update('1', {
      fields: [{ keyname: 'new_field', fieldType: 'string', name: 'New Field', required: false }],
    } as any)

    expect(fieldRepo.remove).toHaveBeenCalledWith(pluginWithFields.fields)
    expect(fieldRepo.create).toHaveBeenCalled()
    expect(fieldRepo.save).toHaveBeenCalled()
  })

  it('update removes fields when empty array provided', async () => {
    const pluginWithFields = {
      ...basePlugin,
      fields: [{ id: 'field-1', keyname: 'old_field' }],
    }
    pluginRepo.findOne.mockResolvedValue(pluginWithFields)
    fieldRepo.remove.mockResolvedValue(undefined)
    pluginRepo.save.mockResolvedValue(pluginWithFields)

    await service.update('1', { fields: [] } as any)

    expect(fieldRepo.remove).toHaveBeenCalledWith(pluginWithFields.fields)
    expect(fieldRepo.create).not.toHaveBeenCalled()
  })

  it('update reschedules plugin when dataSource or templates change', async () => {
    const pluginWithDataSource = {
      ...basePlugin,
      dataSource: { id: 'ds-1', url: 'https://api.com' },
      templates: [{ id: 't-1', layout: 'full' }],
    }
    pluginRepo.findOne.mockResolvedValueOnce(pluginWithDataSource)
    pluginRepo.findOne.mockResolvedValueOnce(pluginWithDataSource)
    dataSourceRepo.save.mockResolvedValue(pluginWithDataSource.dataSource)
    pluginRepo.save.mockResolvedValue(pluginWithDataSource)

    await service.update('1', {
      dataSource: { url: 'https://new-api.com' },
    } as any)

    expect(mockScheduler.removeScheduledJob).toHaveBeenCalledWith('1')
    expect(mockScheduler.schedulePlugin).toHaveBeenCalledWith(pluginWithDataSource)
  })

  it('create schedules plugin when it has dataSource and templates', async () => {
    const createdPlugin = {
      ...basePlugin,
      dataSource: { id: 'ds-1' },
      templates: [{ id: 't-1' }],
    }
    pluginRepo.save.mockResolvedValue(basePlugin)
    dataSourceRepo.create.mockReturnValue({})
    dataSourceRepo.save.mockResolvedValue({})
    templateRepo.create.mockReturnValue({})
    templateRepo.save.mockResolvedValue({})
    pluginRepo.findOne.mockResolvedValue(createdPlugin)

    await service.create({
      name: 'Plugin',
      dataSource: { url: 'https://api.com', method: 'GET', headers: {}, body: {} },
      templates: [{ layout: 'full', liquidMarkup: 'Template' }],
    } as any)

    expect(mockScheduler.schedulePlugin).toHaveBeenCalledWith(createdPlugin)
  })

  it('create does not schedule plugin without dataSource', async () => {
    const createdPlugin = {
      ...basePlugin,
      dataSource: null,
      templates: [{ id: 't-1' }],
    }
    pluginRepo.save.mockResolvedValue(basePlugin)
    templateRepo.create.mockReturnValue({})
    templateRepo.save.mockResolvedValue({})
    pluginRepo.findOne.mockResolvedValue(createdPlugin)

    await service.create({
      name: 'Plugin',
      templates: [{ layout: 'full', liquidMarkup: 'Template' }],
    } as any)

    expect(mockScheduler.schedulePlugin).not.toHaveBeenCalled()
  })
})
