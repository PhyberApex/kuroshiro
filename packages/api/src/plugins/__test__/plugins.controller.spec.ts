import type { PluginsService } from '../plugins.service.js'
import type { PluginAssignmentsService } from '../services/plugin-assignments.service.js'
import type { PluginExporterService } from '../services/plugin-exporter.service.js'
import type { PluginImporterService } from '../services/plugin-importer.service.js'
import type { PluginPreviewDataService } from '../services/plugin-preview-data.service.js'
import type { PluginReadsService } from '../services/plugin-reads.service.js'
import type { RecipeUpdateService } from '../services/recipe-update.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlugin } from '../../test/fixtures.js'
import { asService } from '../../test/mockService.js'
import { PluginsController } from '../plugins.controller.js'

describe('pluginsController', () => {
  let controller: PluginsController
  let mockReads: { list: ReturnType<typeof vi.fn>, detail: ReturnType<typeof vi.fn> }
  let mockService: {
    findById: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    build: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    duplicate: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    preview: ReturnType<typeof vi.fn>
  }
  let mockAssignments: { assign: ReturnType<typeof vi.fn> }
  let mockImporter: {
    importFromFile: ReturnType<typeof vi.fn>
    importFromGithubUrl: ReturnType<typeof vi.fn>
    importFromRecipe: ReturnType<typeof vi.fn>
  }
  let mockExporter: { exportToZip: ReturnType<typeof vi.fn> }
  let mockRecipeUpdateService: {
    checkForUpdate: ReturnType<typeof vi.fn>
    applyUpdate: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockReads = { list: vi.fn(), detail: vi.fn() }
    mockService = {
      findById: vi.fn(),
      create: vi.fn(),
      build: vi.fn(),
      update: vi.fn(),
      duplicate: vi.fn(),
      remove: vi.fn(),
      preview: vi.fn(),
    }

    mockAssignments = { assign: vi.fn() }

    mockImporter = {
      importFromFile: vi.fn(),
      importFromGithubUrl: vi.fn(),
      importFromRecipe: vi.fn(),
    }

    mockExporter = {
      exportToZip: vi.fn(),
    }

    mockRecipeUpdateService = {
      checkForUpdate: vi.fn(),
      applyUpdate: vi.fn(),
    }

    controller = new PluginsController(
      asService<PluginsService>(mockService),
      asService<PluginReadsService>(mockReads),
      asService<PluginPreviewDataService>({}),
      asService<PluginAssignmentsService>(mockAssignments),
      asService<PluginImporterService>(mockImporter),
      asService<PluginExporterService>(mockExporter),
      asService<RecipeUpdateService>(mockRecipeUpdateService),
    )
  })

  const basePlugin = makePlugin({
    id: '1',
    name: 'Weather Plugin',
    description: 'Shows weather',
    kind: 'Poll',
    refreshInterval: 15,
  })

  it('create builds the Plugin, then answers it as a read gives it', async () => {
    const createDto = { name: 'Weather Plugin', kind: 'Poll' as const }
    const detail = { id: '1', name: 'Weather Plugin' }
    mockService.build.mockResolvedValue('1')
    mockReads.detail.mockResolvedValue(detail)

    const result = await controller.create(createDto)

    expect(mockService.build).toHaveBeenCalledWith(createDto)
    expect(mockReads.detail).toHaveBeenCalledWith('1')
    expect(result).toBe(detail)
  })

  it('update saves the Plugin, then answers it as a read gives it', async () => {
    const updateDto = { name: 'Updated Weather' }
    const detail = { id: '1', name: 'Updated Weather' }
    mockService.update.mockResolvedValue(undefined)
    mockReads.detail.mockResolvedValue(detail)

    const result = await controller.update('1', updateDto)

    expect(mockService.update).toHaveBeenCalledWith('1', updateDto)
    expect(result).toBe(detail)
  })

  it('checkRecipeUpdate delegates to the recipe update service', async () => {
    const preview = { contentHash: 'abc', mode: 'three-way' as const, items: [], assignmentsMissingRequiredField: [] }
    mockRecipeUpdateService.checkForUpdate.mockResolvedValue(preview)

    const result = await controller.checkRecipeUpdate('1')

    expect(mockRecipeUpdateService.checkForUpdate).toHaveBeenCalledWith('1')
    expect(result).toBe(preview)
  })

  it('applyRecipeUpdate delegates to the recipe update service', async () => {
    const applyDto = { contentHash: 'abc', apply: [{ itemType: 'name' as const, key: 'name' }] }
    mockRecipeUpdateService.applyUpdate.mockResolvedValue(basePlugin)

    const result = await controller.applyRecipeUpdate('1', applyDto)

    expect(mockRecipeUpdateService.applyUpdate).toHaveBeenCalledWith('1', applyDto)
    expect(result).toBe(basePlugin)
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
    expect(mockAssignments.assign).not.toHaveBeenCalled()
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
    mockAssignments.assign.mockResolvedValue('screen-1')

    const result = await controller.importPlugin(file, 'device-1')

    expect(mockAssignments.assign).toHaveBeenCalledWith('plugin-1', 'device-1')
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
    expect(mockAssignments.assign).not.toHaveBeenCalled()
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
    mockAssignments.assign.mockResolvedValue('screen-1')

    await controller.importFromGithub(body)

    expect(mockAssignments.assign).toHaveBeenCalledWith('plugin-2', 'device-1')
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
    expect(mockAssignments.assign).not.toHaveBeenCalled()
    expect(result).toMatchObject(createdPlugin)
    expect(result._hasTransform).toBe(false)
  })

  it('importFromRecipe sets sourceRecipeSnapshot to the importer\'s parsed output', async () => {
    const body = { recipeId: '150460' }
    const parsedPlugin = {
      name: 'Daily Weather',
      kind: 'Poll',
      refreshInterval: 30,
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET', headers: {}, body: {} }],
      templates: [{ layout: 'full', liquidMarkup: 'Hello' }],
      fields: [],
      sourceRecipeId: '150460',
    }
    mockImporter.importFromRecipe.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue({ id: 'plugin-3', name: 'Daily Weather' })

    await controller.importFromRecipe(body)

    expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining({ sourceRecipeSnapshot: parsedPlugin }))
  })

  it('importPlugin (file) and importFromGithub never set sourceRecipeSnapshot', async () => {
    const parsedPlugin = {
      name: 'Plain Plugin',
      dataSources: [{ name: 'source', url: 'https://api.com', method: 'GET', headers: {}, body: {} }],
    }
    mockImporter.importFromFile.mockResolvedValue(parsedPlugin)
    mockImporter.importFromGithubUrl.mockResolvedValue(parsedPlugin)
    mockService.create.mockResolvedValue({ id: 'plugin-x', name: 'Plain Plugin' })

    await controller.importPlugin({ path: '/tmp/plugin.zip' } as Express.Multer.File)
    await controller.importFromGithub({ githubUrl: 'https://github.com/user/plugin' })

    expect(mockService.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ sourceRecipeSnapshot: undefined }))
    expect(mockService.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ sourceRecipeSnapshot: undefined }))
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
    mockAssignments.assign.mockResolvedValue('screen-1')

    const result = await controller.importFromRecipe(body)

    expect(mockAssignments.assign).toHaveBeenCalledWith('plugin-3', 'device-1')
    expect(result._hasTransform).toBe(true)
  })

  it('importFromRecipe throws error if no Recipe id/URL provided', async () => {
    await expect(controller.importFromRecipe({ recipeId: '' })).rejects.toThrow('Recipe id or URL is required')
  })
})
