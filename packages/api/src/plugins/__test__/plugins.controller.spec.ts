import type { Plugin } from '../entities/plugin.entity'
import type { PluginsService } from '../plugins.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginsController } from '../plugins.controller'

describe('pluginsController', () => {
  let controller: PluginsController
  let mockService: PluginsService

  beforeEach(() => {
    mockService = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByDevice: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    } as any

    controller = new PluginsController(mockService)
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

  it('findAll returns all plugins', async () => {
    const plugins = [basePlugin]
    ;(mockService.findAll as any).mockResolvedValue(plugins)

    const result = await controller.findAll()

    expect(mockService.findAll).toHaveBeenCalled()
    expect(result).toBe(plugins)
  })

  it('findById returns a plugin by id', async () => {
    ;(mockService.findById as any).mockResolvedValue(basePlugin)

    const result = await controller.findById('1')

    expect(mockService.findById).toHaveBeenCalledWith('1')
    expect(result).toBe(basePlugin)
  })

  it('findByDevice returns plugins for a device', async () => {
    const plugins = [basePlugin]
    ;(mockService.findByDevice as any).mockResolvedValue(plugins)

    const result = await controller.findByDevice('device-1')

    expect(mockService.findByDevice).toHaveBeenCalledWith('device-1')
    expect(result).toBe(plugins)
  })

  it('create creates a new plugin', async () => {
    const createDto = { name: 'Weather Plugin', deviceId: 'device-1' }
    ;(mockService.create as any).mockResolvedValue(basePlugin)

    const result = await controller.create(createDto)

    expect(mockService.create).toHaveBeenCalledWith(createDto)
    expect(result).toBe(basePlugin)
  })

  it('update updates a plugin', async () => {
    const updateDto = { name: 'Updated Weather' }
    const updated = { ...basePlugin, name: 'Updated Weather' } as unknown as Plugin
    ;(mockService.update as any).mockResolvedValue(updated)

    const result = await controller.update('1', updateDto)

    expect(mockService.update).toHaveBeenCalledWith('1', updateDto)
    expect(result).toBe(updated)
  })

  it('remove deletes a plugin', async () => {
    ;(mockService.remove as any).mockResolvedValue(true)

    const result = await controller.remove('1')

    expect(mockService.remove).toHaveBeenCalledWith('1')
    expect(result).toEqual({ success: true })
  })
})
