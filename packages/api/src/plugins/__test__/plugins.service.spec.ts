import type { Repository } from 'typeorm'
import type { Plugin } from '../entities/plugin.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginsService } from '../plugins.service'

interface MockRepository {
  find: ReturnType<typeof vi.fn>
  findOne: ReturnType<typeof vi.fn>
  findOneBy: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

function createMockRepository(): MockRepository {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  }
}

describe('pluginsService', () => {
  let service: PluginsService
  let repo: MockRepository

  beforeEach(() => {
    repo = createMockRepository()
    service = new PluginsService(repo as unknown as Repository<Plugin>)
  })

  const basePlugin = {
    id: '1',
    name: 'Weather Plugin',
    description: 'Shows weather',
    kind: 'Poll',
    refreshInterval: 15,
    isActive: true,
    order: 1,
    device: { id: 'device-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Plugin

  it('findAll returns all plugins ordered by name', async () => {
    const plugins = [basePlugin]
    repo.find.mockResolvedValue(plugins)
    const result = await service.findAll()
    expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } })
    expect(result).toBe(plugins)
  })

  it('findById returns a plugin by id with relations', async () => {
    repo.findOne.mockResolvedValue(basePlugin)
    const result = await service.findById('1')
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
      relations: ['device', 'dataSource', 'templates', 'fields'],
    })
    expect(result).toBe(basePlugin)
  })

  it('findByDevice returns plugins for a specific device', async () => {
    const plugins = [basePlugin]
    repo.find.mockResolvedValue(plugins)
    const result = await service.findByDevice('device-1')
    expect(repo.find).toHaveBeenCalledWith({
      where: { device: { id: 'device-1' } },
      relations: ['dataSource', 'templates', 'fields'],
      order: { order: 'ASC' },
    })
    expect(result).toBe(plugins)
  })

  it('create creates and saves a new plugin', async () => {
    const pluginData = { name: 'Weather Plugin', device: { id: 'device-1' } }
    repo.create.mockReturnValue(basePlugin)
    repo.save.mockResolvedValue(basePlugin)
    const result = await service.create(pluginData)
    expect(repo.create).toHaveBeenCalledWith(pluginData)
    expect(repo.save).toHaveBeenCalledWith(basePlugin)
    expect(result).toBe(basePlugin)
  })

  it('update updates and saves an existing plugin', async () => {
    repo.findOneBy.mockResolvedValue(basePlugin)
    const updated = { ...basePlugin, name: 'Updated Weather' } as unknown as Plugin
    repo.save.mockResolvedValue(updated)
    const result = await service.update('1', { name: 'Updated Weather' })
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(repo.save).toHaveBeenCalledWith({ ...basePlugin, name: 'Updated Weather' })
    expect(result).toEqual(updated)
  })

  it('update returns null if plugin not found', async () => {
    repo.findOneBy.mockResolvedValue(null)
    const result = await service.update('1', { name: 'Updated' })
    expect(result).toBeNull()
  })

  it('remove deletes a plugin and returns true', async () => {
    repo.findOneBy.mockResolvedValue(basePlugin)
    repo.remove.mockResolvedValue(undefined)
    const result = await service.remove('1')
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(repo.remove).toHaveBeenCalledWith(basePlugin)
    expect(result).toBe(true)
  })

  it('remove returns false if plugin not found', async () => {
    repo.findOneBy.mockResolvedValue(null)
    const result = await service.remove('1')
    expect(result).toBe(false)
  })
})
