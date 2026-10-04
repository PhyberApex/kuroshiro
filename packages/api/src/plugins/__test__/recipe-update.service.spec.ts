import type { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import type { PluginField } from '../entities/plugin-field.entity.js'
import type { PluginTemplate } from '../entities/plugin-template.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { PluginsService } from '../plugins.service.js'
import type { ParsedPlugin, PluginImporterService } from '../services/plugin-importer.service.js'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiException } from '../../errors/api.exception.js'
import { makeDevice, makeDevicePlugin, makePlugin, makePluginDataSource, makePluginField, makePluginTemplate } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { computeRecipeContentHash } from '../services/recipe-update-diff.js'
import { RecipeUpdateService } from '../services/recipe-update.service.js'

function toSnapshot(parsed: ParsedPlugin): Record<string, unknown> {
  return { ...parsed }
}

function baseParsedPlugin(overrides: Partial<ParsedPlugin> = {}): ParsedPlugin {
  return {
    name: 'Daily Weather',
    description: 'Shows the forecast',
    kind: 'Poll',
    refreshInterval: 15,
    dataSources: [],
    templates: [],
    fields: [],
    sourceRecipeId: '150460',
    ...overrides,
  }
}

describe('recipeUpdateService', () => {
  let service: RecipeUpdateService
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let templateRepo: ReturnType<typeof createMockRepository<PluginTemplate>>
  let fieldRepo: ReturnType<typeof createMockRepository<PluginField>>
  let mockImporter: { importFromRecipe: ReturnType<typeof vi.fn> }
  let mockPluginsService: { invalidateRenderCaches: ReturnType<typeof vi.fn>, rescheduleAfterUpdate: ReturnType<typeof vi.fn>, findById: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    pluginRepo = createMockRepository<Plugin>()
    dataSourceRepo = createMockRepository<PluginDataSource>()
    templateRepo = createMockRepository<PluginTemplate>()
    fieldRepo = createMockRepository<PluginField>()
    mockImporter = { importFromRecipe: vi.fn() }
    mockPluginsService = { invalidateRenderCaches: vi.fn(), rescheduleAfterUpdate: vi.fn(), findById: vi.fn(async (id: string) => makePlugin({ id })) }

    service = new RecipeUpdateService(
      asRepository(pluginRepo),
      asRepository(dataSourceRepo),
      asRepository(templateRepo),
      asRepository(fieldRepo),
      asService<PluginImporterService>(mockImporter),
      asService<PluginsService>(mockPluginsService),
    )
  })

  describe('checkForUpdate', () => {
    it('404s when the plugin does not exist', async () => {
      pluginRepo.findOne.mockResolvedValue(null)

      await expect(service.checkForUpdate('missing')).rejects.toThrow(NotFoundException)
    })

    it('404s when the plugin was not imported from a Recipe', async () => {
      pluginRepo.findOne.mockResolvedValue(makePlugin({ sourceRecipeId: undefined }))

      await expect(service.checkForUpdate('1')).rejects.toThrow(NotFoundException)
    })

    it('answers the importer\'s refusal as it is', async () => {
      const refusal = new ApiException(422, 'recipe-not-found', 'TRMNL has no Recipe 150460.', { id: '150460' })
      pluginRepo.findOne.mockResolvedValue(makePlugin({ sourceRecipeId: '150460' }))
      mockImporter.importFromRecipe.mockRejectedValue(refusal)

      await expect(service.checkForUpdate('1')).rejects.toBe(refusal)
    })

    it('returns a two-way diff when the plugin has no snapshot', async () => {
      const plugin = makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: undefined, name: 'Old Name' })
      pluginRepo.findOne.mockResolvedValue(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({ name: 'New Name' }))

      const result = await service.checkForUpdate('1')

      expect(result.mode).toBe('two-way')
      expect(result.items).toContainEqual(expect.objectContaining({ itemType: 'name', kind: 'changed', conflict: false }))
      expect(result.contentHash).toBe(computeRecipeContentHash(baseParsedPlugin({ name: 'New Name' })))
    })

    it('returns a three-way diff against the stored snapshot', async () => {
      const snapshot = baseParsedPlugin({ name: 'Old Name' })
      const plugin = makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), name: 'Old Name' })
      pluginRepo.findOne.mockResolvedValue(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({ name: 'New Name' }))

      const result = await service.checkForUpdate('1')

      expect(result.mode).toBe('three-way')
      expect(result.items).toEqual([
        { kind: 'changed', conflict: false, itemType: 'name', key: 'name', local: 'Old Name', upstream: 'New Name', snapshot: 'Old Name' },
      ])
    })

    it('lists every current assignment under a newly added required field', async () => {
      const snapshot = baseParsedPlugin({ fields: [] })
      const plugin = makePlugin({
        sourceRecipeId: '150460',
        sourceRecipeSnapshot: toSnapshot(snapshot),
        deviceAssignments: [
          makeDevicePlugin({ device: makeDevice({ id: 'device-1', name: 'Kitchen' }) }),
          makeDevicePlugin({ device: makeDevice({ id: 'device-2', name: 'Office' }) }),
        ],
      })
      pluginRepo.findOne.mockResolvedValue(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({
        fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }],
      }))

      const result = await service.checkForUpdate('1')

      expect(result.assignmentsMissingRequiredField).toEqual([
        {
          key: 'api_key',
          assignments: [
            { deviceId: 'device-1', deviceName: 'Kitchen' },
            { deviceId: 'device-2', deviceName: 'Office' },
          ],
        },
      ])
    })

    it('does not list a newly added field that is not required', async () => {
      const snapshot = baseParsedPlugin({ fields: [] })
      const plugin = makePlugin({
        sourceRecipeId: '150460',
        sourceRecipeSnapshot: toSnapshot(snapshot),
        deviceAssignments: [makeDevicePlugin({ device: makeDevice({ id: 'device-1', name: 'Kitchen' }) })],
      })
      pluginRepo.findOne.mockResolvedValue(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({
        fields: [{ keyname: 'nickname', fieldType: 'string', name: 'Nickname', required: false, order: 1 }],
      }))

      const result = await service.checkForUpdate('1')

      expect(result.assignmentsMissingRequiredField).toEqual([])
    })
  })

  describe('applyUpdate', () => {
    function stubReload(plugin: Plugin) {
      pluginRepo.findOne.mockImplementation(async () => plugin)
    }

    it('409s and changes nothing when the content hash is stale', async () => {
      const plugin = makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({ name: 'New Name' }))

      await expect(service.applyUpdate('1', { contentHash: 'stale-hash', apply: [] }))
        .rejects
        .toThrow(ConflictException)

      expect(pluginRepo.update).not.toHaveBeenCalled()
      expect(dataSourceRepo.save).not.toHaveBeenCalled()
    })

    it('400s when a selection does not match a pending update item', async () => {
      const upstream = baseParsedPlugin({ name: 'New Name' })
      const plugin = makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await expect(service.applyUpdate('1', { contentHash, apply: [{ itemType: 'field', key: 'does-not-exist' }] }))
        .rejects
        .toThrow(BadRequestException)
    })

    it('applies a scalar change and always replaces the snapshot, even with an empty selection', async () => {
      const upstream = baseParsedPlugin({ name: 'New Name' })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [] })

      expect(pluginRepo.update).toHaveBeenCalledWith('plugin-1', { sourceRecipeSnapshot: { ...upstream }, snapshotTakenAt: expect.any(Date) })
      expect(mockPluginsService.invalidateRenderCaches).not.toHaveBeenCalled()
      expect(mockPluginsService.rescheduleAfterUpdate).not.toHaveBeenCalled()
    })

    it('applies a selected name change and invalidates caches', async () => {
      const upstream = baseParsedPlugin({ name: 'New Name' })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'name', key: 'name' }] })

      expect(pluginRepo.update).toHaveBeenCalledWith('plugin-1', { name: 'New Name', sourceRecipeSnapshot: { ...upstream }, snapshotTakenAt: expect.any(Date) })
      expect(mockPluginsService.invalidateRenderCaches).toHaveBeenCalledWith('plugin-1')
      expect(mockPluginsService.rescheduleAfterUpdate).not.toHaveBeenCalled()
    })

    it('reschedules when applying a refreshInterval change', async () => {
      const upstream = baseParsedPlugin({ refreshInterval: 30 })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'refreshInterval', key: 'refreshInterval' }] })

      expect(pluginRepo.update).toHaveBeenCalledWith('plugin-1', { refreshInterval: 30, sourceRecipeSnapshot: { ...upstream }, snapshotTakenAt: expect.any(Date) })
      expect(mockPluginsService.rescheduleAfterUpdate).toHaveBeenCalledWith('plugin-1')
    })

    it('keeps a local-only header and replaces an upstream-set one when applying a changed Data Source', async () => {
      const localDataSource = makePluginDataSource({
        id: 'ds-1',
        name: 'weather',
        mode: 'fetch',
        url: 'https://old.example.com',
        headers: { 'X-Local-Secret': 'keep-me', 'X-Shared': 'old-value' },
      })
      const snapshot = baseParsedPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://old.example.com', headers: { 'X-Shared': 'old-value' } }],
      })
      const upstream = baseParsedPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://new.example.com', headers: { 'X-Shared': 'new-value' } }],
      })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), dataSources: [localDataSource] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'dataSource', key: 'weather' }] })

      expect(dataSourceRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'ds-1',
        url: 'https://new.example.com',
        headers: { 'X-Local-Secret': 'keep-me', 'X-Shared': 'new-value' },
      }))
      expect(mockPluginsService.rescheduleAfterUpdate).toHaveBeenCalledWith('plugin-1')
    })

    it('creates a new row when applying an added Data Source', async () => {
      const snapshot = baseParsedPlugin({ dataSources: [] })
      const upstream = baseParsedPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com', headers: {} }],
      })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), dataSources: [] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'dataSource', key: 'weather' }] })

      expect(dataSourceRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'weather', url: 'https://api.example.com' }))
      expect(dataSourceRepo.save).toHaveBeenCalled()
    })

    it('removes the row when applying a removed Data Source', async () => {
      const localDataSource = makePluginDataSource({ id: 'ds-1', name: 'weather' })
      const snapshot = baseParsedPlugin({ dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com' }] })
      const upstream = baseParsedPlugin({ dataSources: [] })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), dataSources: [localDataSource] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'dataSource', key: 'weather' }] })

      expect(dataSourceRepo.remove).toHaveBeenCalledWith(localDataSource)
    })

    it('updates a template in place when applying a changed template', async () => {
      const localTemplate = makePluginTemplate({ id: 'tpl-1', layout: 'full', liquidMarkup: 'old' })
      const snapshot = baseParsedPlugin({ templates: [{ layout: 'full', liquidMarkup: 'old' }] })
      const upstream = baseParsedPlugin({ templates: [{ layout: 'full', liquidMarkup: 'new' }] })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), templates: [localTemplate] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'template', key: 'full' }] })

      expect(templateRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'tpl-1', liquidMarkup: 'new' }))
      expect(mockPluginsService.rescheduleAfterUpdate).toHaveBeenCalledWith('plugin-1')
    })

    it('removes a field (and, via FK cascade, its Field Value) when applying a removed field', async () => {
      const localField = makePluginField({ id: 'field-1', keyname: 'api_key' })
      const snapshot = baseParsedPlugin({ fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }] })
      const upstream = baseParsedPlugin({ fields: [] })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), fields: [localField] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'field', key: 'api_key' }] })

      expect(fieldRepo.remove).toHaveBeenCalledWith(localField)
      expect(mockPluginsService.rescheduleAfterUpdate).not.toHaveBeenCalled()
    })

    it('leaves assignments as-is (no field value writes) when applying a newly added required field', async () => {
      const snapshot = baseParsedPlugin({ fields: [] })
      const upstream = baseParsedPlugin({ fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }] })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), fields: [] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'field', key: 'api_key' }] })

      expect(fieldRepo.create).toHaveBeenCalledWith(expect.objectContaining({ keyname: 'api_key', required: true }))
      expect(mockPluginsService.rescheduleAfterUpdate).not.toHaveBeenCalled()
    })

    it('returns the reloaded plugin', async () => {
      const upstream = baseParsedPlugin({ name: 'New Name' })
      const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      const reloaded = makePlugin({ id: 'plugin-1', name: 'New Name' })
      pluginRepo.findOne.mockResolvedValueOnce(plugin)
      mockPluginsService.findById.mockResolvedValue(reloaded)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      const result = await service.applyUpdate('plugin-1', { contentHash, apply: [{ itemType: 'name', key: 'name' }] })

      expect(result).toBe(reloaded)
    })
  })
})
