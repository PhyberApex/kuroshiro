import type { Response } from 'express'
import type { Plugin } from '../entities/plugin.entity'
import type { PluginsService } from '../plugins.service'
import type { PluginExporterService } from '../services/plugin-exporter.service'
import type { PluginImporterService } from '../services/plugin-importer.service'
import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginsController } from '../plugins.controller'

describe('pluginsController', () => {
  let controller: PluginsController
  let mockService: PluginsService
  let mockImporter: PluginImporterService
  let mockExporter: PluginExporterService

  beforeEach(() => {
    mockService = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByDevice: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      assignToDevice: vi.fn(),
      unassignFromDevice: vi.fn(),
      updateDeviceAssignment: vi.fn(),
      preview: vi.fn(),
    } as any

    mockImporter = {
      importFromFile: vi.fn(),
      importFromGithubUrl: vi.fn(),
    } as any

    mockExporter = {
      exportToZip: vi.fn(),
    } as any

    controller = new PluginsController(mockService, mockImporter, mockExporter)
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

  it('preview returns preview data', async () => {
    const previewData = {
      url: 'https://api.example.com',
      method: 'GET',
      template: '<div>{{ data }}</div>',
    }
    const previewResult = { html: '<div>test</div>', data: { test: true } }
    ;(mockService.preview as any).mockResolvedValue(previewResult)

    const result = await controller.preview(previewData)

    expect(result).toBe(previewResult)
    expect(mockService.preview).toHaveBeenCalledWith(
      previewData.url,
      previewData.method,
      undefined,
      undefined,
      previewData.template,
      undefined,
      undefined,
    )
  })

  it('importPlugin imports from file without device assignment', async () => {
    const file = { path: '/tmp/plugin.zip' } as Express.Multer.File
    const parsedPlugin = {
      name: 'Imported Plugin',
      dataSource: { url: 'https://api.com', method: 'GET', headers: {}, body: {} },
    }
    const createdPlugin = { id: 'plugin-1', name: 'Imported Plugin' }
    ;(mockImporter.importFromFile as any).mockResolvedValue(parsedPlugin)
    ;(mockService.create as any).mockResolvedValue(createdPlugin)

    const result = await controller.importPlugin(file)

    expect(mockImporter.importFromFile).toHaveBeenCalledWith('/tmp/plugin.zip')
    expect(mockService.create).toHaveBeenCalled()
    expect(mockService.assignToDevice).not.toHaveBeenCalled()
    expect(result).toMatchObject(createdPlugin)
    expect(result._hasTransform).toBe(false)
  })

  it('importPlugin imports from file with device assignment', async () => {
    const file = { path: '/tmp/plugin.zip' } as Express.Multer.File
    const parsedPlugin = {
      name: 'Imported Plugin',
      dataSource: {
        url: 'https://api.com',
        method: 'GET',
        headers: {},
        body: {},
        transformJs: 'module.exports = (d) => d',
      },
    }
    const createdPlugin = { id: 'plugin-1', name: 'Imported Plugin' }
    ;(mockImporter.importFromFile as any).mockResolvedValue(parsedPlugin)
    ;(mockService.create as any).mockResolvedValue(createdPlugin)
    ;(mockService.assignToDevice as any).mockResolvedValue({})

    const result = await controller.importPlugin(file, 'device-1')

    expect(mockService.assignToDevice).toHaveBeenCalledWith('plugin-1', {
      deviceId: 'device-1',
      isActive: true,
      order: 0,
    })
    expect(result._hasTransform).toBe(true)
  })

  it('importPlugin throws error if no file uploaded', async () => {
    await expect(controller.importPlugin(undefined as any)).rejects.toThrow('No file uploaded')
  })

  it('importFromGithub imports from GitHub URL without device assignment', async () => {
    const body = { githubUrl: 'https://github.com/user/plugin' }
    const parsedPlugin = {
      name: 'GitHub Plugin',
      dataSource: { url: 'https://api.com', method: 'GET', headers: {}, body: {} },
    }
    const createdPlugin = { id: 'plugin-2', name: 'GitHub Plugin' }
    ;(mockImporter.importFromGithubUrl as any).mockResolvedValue(parsedPlugin)
    ;(mockService.create as any).mockResolvedValue(createdPlugin)

    const result = await controller.importFromGithub(body)

    expect(mockImporter.importFromGithubUrl).toHaveBeenCalledWith(body.githubUrl)
    expect(mockService.create).toHaveBeenCalled()
    expect(mockService.assignToDevice).not.toHaveBeenCalled()
    expect(result).toMatchObject(createdPlugin)
  })

  it('importFromGithub imports from GitHub URL with device assignment', async () => {
    const body = { githubUrl: 'https://github.com/user/plugin', deviceId: 'device-1' }
    const parsedPlugin = {
      name: 'GitHub Plugin',
      dataSource: { url: 'https://api.com', method: 'GET', headers: {}, body: {} },
    }
    const createdPlugin = { id: 'plugin-2', name: 'GitHub Plugin' }
    ;(mockImporter.importFromGithubUrl as any).mockResolvedValue(parsedPlugin)
    ;(mockService.create as any).mockResolvedValue(createdPlugin)
    ;(mockService.assignToDevice as any).mockResolvedValue({})

    await controller.importFromGithub(body)

    expect(mockService.assignToDevice).toHaveBeenCalledWith('plugin-2', {
      deviceId: 'device-1',
      isActive: true,
      order: 0,
    })
  })

  it('importFromGithub throws error if no URL provided', async () => {
    await expect(controller.importFromGithub({ githubUrl: '' })).rejects.toThrow('GitHub URL is required')
  })

  it('exportPlugin exports plugin as ZIP', async () => {
    const plugin = { id: '1', name: 'Test Plugin' }
    const zipBuffer = Buffer.from('zip-content')
    ;(mockService.findById as any).mockResolvedValue(plugin)
    ;(mockExporter.exportToZip as any).mockResolvedValue(zipBuffer)

    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    } as unknown as Response

    await controller.exportPlugin('1', res)

    expect(mockService.findById).toHaveBeenCalledWith('1')
    expect(mockExporter.exportToZip).toHaveBeenCalledWith(plugin)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip')
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="Test Plugin.trmnlp.zip"')
    expect(res.send).toHaveBeenCalledWith(zipBuffer)
  })

  it('exportPlugin returns 404 if plugin not found', async () => {
    ;(mockService.findById as any).mockResolvedValue(null)

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response

    await controller.exportPlugin('1', res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: 'Plugin not found' })
  })

  it('assignToDevice assigns plugin to device', async () => {
    const assignData = { deviceId: 'device-1', isActive: true, order: 0 }
    const devicePlugin = { id: 'dp-1' }
    ;(mockService.assignToDevice as any).mockResolvedValue(devicePlugin)

    const result = await controller.assignToDevice('plugin-1', assignData as any)

    expect(result).toBe(devicePlugin)
    expect(mockService.assignToDevice).toHaveBeenCalledWith('plugin-1', assignData)
  })

  it('unassignFromDevice removes plugin from device', async () => {
    ;(mockService.unassignFromDevice as any).mockResolvedValue(true)

    const result = await controller.unassignFromDevice('plugin-1', 'device-1')

    expect(result).toEqual({ success: true })
    expect(mockService.unassignFromDevice).toHaveBeenCalledWith('plugin-1', 'device-1')
  })

  it('updateDeviceAssignment updates device assignment', async () => {
    const updates = { isActive: false }
    const devicePlugin = { id: 'dp-1', isActive: false }
    ;(mockService.updateDeviceAssignment as any).mockResolvedValue(devicePlugin)

    const result = await controller.updateDeviceAssignment('dp-1', updates)

    expect(result).toBe(devicePlugin)
    expect(mockService.updateDeviceAssignment).toHaveBeenCalledWith('dp-1', updates)
  })
})
