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
      asService<PluginImporterService>({}),
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
})
