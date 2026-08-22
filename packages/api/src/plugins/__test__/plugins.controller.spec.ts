import type { Response } from 'express'
import type { PluginsService } from '../plugins.service'
import type { PluginExporterService } from '../services/plugin-exporter.service'
import type { PluginImporterService } from '../services/plugin-importer.service'
import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlugin } from '../../test/fixtures'
import { asService } from '../../test/mockService'
import { PluginsController } from '../plugins.controller'

describe('pluginsController', () => {
  let controller: PluginsController
  let mockService: {
    findAll: ReturnType<typeof vi.fn>
    findById: ReturnType<typeof vi.fn>
    findByDevice: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    assignToDevice: ReturnType<typeof vi.fn>
    unassignFromDevice: ReturnType<typeof vi.fn>
    updateDeviceAssignment: ReturnType<typeof vi.fn>
    preview: ReturnType<typeof vi.fn>
  }
  let mockImporter: {
    importFromFile: ReturnType<typeof vi.fn>
    importFromGithubUrl: ReturnType<typeof vi.fn>
    importFromRecipe: ReturnType<typeof vi.fn>
  }
  let mockExporter: { exportToZip: ReturnType<typeof vi.fn> }

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
    }

    mockImporter = {
      importFromFile: vi.fn(),
      importFromGithubUrl: vi.fn(),
      importFromRecipe: vi.fn(),
    }

    mockExporter = {
      exportToZip: vi.fn(),
    }

    controller = new PluginsController(
      asService<PluginsService>(mockService),
      asService<PluginImporterService>(mockImporter),
      asService<PluginExporterService>(mockExporter),
    )
  })

  const basePlugin = makePlugin({
    id: '1',
    name: 'Weather Plugin',
    description: 'Shows weather',
    kind: 'Poll',
    refreshInterval: 15,
  })

  it('findAll returns all plugins', async () => {
    const plugins = [basePlugin]
    mockService.findAll.mockResolvedValue(plugins)

    const result = await controller.findAll()

    expect(mockService.findAll).toHaveBeenCalled()
    expect(result).toBe(plugins)
  })

  it('findById returns a plugin by id', async () => {
    mockService.findById.mockResolvedValue(basePlugin)

    const result = await controller.findById('1')

    expect(mockService.findById).toHaveBeenCalledWith('1')
    expect(result).toBe(basePlugin)
  })

  it('findByDevice returns plugins for a device', async () => {
    const plugins = [basePlugin]
    mockService.findByDevice.mockResolvedValue(plugins)

    const result = await controller.findByDevice('device-1')

    expect(mockService.findByDevice).toHaveBeenCalledWith('device-1')
    expect(result).toBe(plugins)
  })

  it('create creates a new plugin', async () => {
    const createDto = { name: 'Weather Plugin', kind: 'Poll' as const }
    mockService.create.mockResolvedValue(basePlugin)

    const result = await controller.create(createDto)

    expect(mockService.create).toHaveBeenCalledWith(createDto)
    expect(result).toBe(basePlugin)
  })

  it('update updates a plugin', async () => {
    const updateDto = { name: 'Updated Weather' }
    const updated = { ...basePlugin, name: 'Updated Weather' }
    mockService.update.mockResolvedValue(updated)

    const result = await controller.update('1', updateDto)

    expect(mockService.update).toHaveBeenCalledWith('1', updateDto)
    expect(result).toBe(updated)
  })

  it('remove deletes a plugin', async () => {
    mockService.remove.mockResolvedValue(true)

    const result = await controller.remove('1')

    expect(mockService.remove).toHaveBeenCalledWith('1')
    expect(result).toEqual({ success: true })
  })

  it('preview returns preview data', async () => {
    const previewData = {
      sources: [{ name: 'source', url: 'https://api.example.com', method: 'GET' }],
      template: '<div>{{ source }}</div>',
    }
    const previewResult = { html: '<div>test</div>', data: { source: { test: true } } }
    mockService.preview.mockResolvedValue(previewResult)

    const result = await controller.preview(previewData)

    expect(result).toBe(previewResult)
    expect(mockService.preview).toHaveBeenCalledWith(
      previewData.sources,
      previewData.template,
      undefined,
    )
  })

  it('importPlugin imports from file without device assignment', async () => {
    const file = asService<Express.Multer.File>({ path: '/tmp/plugin.zip' })
    const parsedPlugin = {
      name: 'Imported Plugin',
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET', headers: {}, body: {} }],
    }
    const createdPlugin = { id: 'plugin-1', name: 'Imported Plugin' }
    mockImporter.importFromFile.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue(createdPlugin)

    const result = await controller.importPlugin(file)

    expect(mockImporter.importFromFile).toHaveBeenCalledWith('/tmp/plugin.zip')
    expect(mockService.create).toHaveBeenCalled()
    expect(mockService.assignToDevice).not.toHaveBeenCalled()
    expect(result).toMatchObject(createdPlugin)
    expect(result._hasTransform).toBe(false)
  })

  it('importPlugin imports from file with device assignment', async () => {
    const file = asService<Express.Multer.File>({ path: '/tmp/plugin.zip' })
    const parsedPlugin = {
      name: 'Imported Plugin',
      dataSources: [{
        name: 'source',
        url: 'https://api.com',
        method: 'GET',
        headers: {},
        body: {},
        transformJs: 'module.exports = (d) => d',
      }],
    }
    const createdPlugin = { id: 'plugin-1', name: 'Imported Plugin' }
    mockImporter.importFromFile.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue(createdPlugin)
    mockService.assignToDevice.mockResolvedValue({})

    const result = await controller.importPlugin(file, 'device-1')

    expect(mockService.assignToDevice).toHaveBeenCalledWith('plugin-1', {
      deviceId: 'device-1',
      isActive: true,
      order: 0,
    })
    expect(result._hasTransform).toBe(true)
  })

  it('importPlugin throws error if no file uploaded', async () => {
    // @ts-expect-error file is intentionally omitted to prove the controller rejects a missing upload
    await expect(controller.importPlugin(undefined)).rejects.toThrow('No file uploaded')
  })

  it('importFromGithub imports from GitHub URL without device assignment', async () => {
    const body = { githubUrl: 'https://github.com/user/plugin' }
    const parsedPlugin = {
      name: 'GitHub Plugin',
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET', headers: {}, body: {} }],
    }
    const createdPlugin = { id: 'plugin-2', name: 'GitHub Plugin' }
    mockImporter.importFromGithubUrl.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue(createdPlugin)

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
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET', headers: {}, body: {} }],
    }
    const createdPlugin = { id: 'plugin-2', name: 'GitHub Plugin' }
    mockImporter.importFromGithubUrl.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue(createdPlugin)
    mockService.assignToDevice.mockResolvedValue({})

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

  it('importFromRecipe imports from a Recipe id without device assignment', async () => {
    const body = { recipeId: '150460' }
    const parsedPlugin = {
      name: 'Daily Weather',
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET', headers: {}, body: {} }],
      sourceRecipeId: '150460',
    }
    const createdPlugin = { id: 'plugin-3', name: 'Daily Weather' }
    mockImporter.importFromRecipe.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue(createdPlugin)

    const result = await controller.importFromRecipe(body)

    expect(mockImporter.importFromRecipe).toHaveBeenCalledWith(body.recipeId)
    expect(mockService.create).toHaveBeenCalled()
    expect(mockService.assignToDevice).not.toHaveBeenCalled()
    expect(result).toMatchObject(createdPlugin)
    expect(result._hasTransform).toBe(false)
  })

  it('importFromRecipe imports from a Recipe id with device assignment', async () => {
    const body = { recipeId: '150460', deviceId: 'device-1' }
    const parsedPlugin = {
      name: 'Daily Weather',
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET', headers: {}, body: {}, transformJs: 'module.exports = (d) => d' }],
      sourceRecipeId: '150460',
    }
    const createdPlugin = { id: 'plugin-3', name: 'Daily Weather' }
    mockImporter.importFromRecipe.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue(createdPlugin)
    mockService.assignToDevice.mockResolvedValue({})

    const result = await controller.importFromRecipe(body)

    expect(mockService.assignToDevice).toHaveBeenCalledWith('plugin-3', {
      deviceId: 'device-1',
      isActive: true,
      order: 0,
    })
    expect(result._hasTransform).toBe(true)
  })

  it('importFromRecipe throws error if no Recipe id/URL provided', async () => {
    await expect(controller.importFromRecipe({ recipeId: '' })).rejects.toThrow('Recipe id or URL is required')
  })

  it('exportPlugin exports plugin as ZIP', async () => {
    const plugin = { id: '1', name: 'Test Plugin' }
    const zipBuffer = Buffer.from('zip-content')
    mockService.findById.mockResolvedValue(plugin)
    mockExporter.exportToZip.mockResolvedValue(zipBuffer)

    const res = asService<Response>({
      setHeader: vi.fn(),
      send: vi.fn(),
    })

    await controller.exportPlugin('1', res)

    expect(mockService.findById).toHaveBeenCalledWith('1')
    expect(mockExporter.exportToZip).toHaveBeenCalledWith(plugin)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip')
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="Test Plugin.trmnlp.zip"')
    expect(res.send).toHaveBeenCalledWith(zipBuffer)
  })

  it('exportPlugin returns 404 if plugin not found', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = asService<Response>({
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    })

    await controller.exportPlugin('1', res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: 'Plugin not found' })
  })

  it('assignToDevice assigns plugin to device', async () => {
    const assignData = { deviceId: 'device-1', isActive: true, order: 0 }
    const devicePlugin = { id: 'dp-1' }
    mockService.assignToDevice.mockResolvedValue(devicePlugin)

    const result = await controller.assignToDevice('plugin-1', assignData)

    expect(result).toBe(devicePlugin)
    expect(mockService.assignToDevice).toHaveBeenCalledWith('plugin-1', assignData)
  })

  it('unassignFromDevice removes plugin from device', async () => {
    mockService.unassignFromDevice.mockResolvedValue(true)

    const result = await controller.unassignFromDevice('plugin-1', 'device-1')

    expect(result).toEqual({ success: true })
    expect(mockService.unassignFromDevice).toHaveBeenCalledWith('plugin-1', 'device-1')
  })

  it('updateDeviceAssignment updates device assignment', async () => {
    const updates = { isActive: false }
    const devicePlugin = { id: 'dp-1', isActive: false }
    mockService.updateDeviceAssignment.mockResolvedValue(devicePlugin)

    const result = await controller.updateDeviceAssignment('dp-1', updates)

    expect(result).toBe(devicePlugin)
    expect(mockService.updateDeviceAssignment).toHaveBeenCalledWith('dp-1', updates)
  })
})
