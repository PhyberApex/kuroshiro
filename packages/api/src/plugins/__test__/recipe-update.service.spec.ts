import type { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import type { PluginField } from '../entities/plugin-field.entity.js'
import type { PluginTemplate } from '../entities/plugin-template.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { PluginsService } from '../plugins.service.js'
import type { PluginFieldValuesService } from '../services/plugin-field-values.service.js'
import type { ParsedPlugin, PluginImporterService } from '../services/plugin-importer.service.js'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiException } from '../../errors/api.exception.js'
import { makePlugin, makePluginDataSource, makePluginField, makePluginTemplate } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { computeRecipeContentHash } from '../services/recipe-update-diff.js'
import { RecipeUpdateService } from '../services/recipe-update.service.js'

const PLUGIN_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'

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
  let mockPluginsService: { refreshRendersAfterSave: ReturnType<typeof vi.fn> }
  let mockFieldValues: { storedFor: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    pluginRepo = createMockRepository<Plugin>()
    dataSourceRepo = createMockRepository<PluginDataSource>()
    templateRepo = createMockRepository<PluginTemplate>()
    fieldRepo = createMockRepository<PluginField>()
    mockImporter = { importFromRecipe: vi.fn() }
    mockPluginsService = { refreshRendersAfterSave: vi.fn() }
    mockFieldValues = { storedFor: vi.fn(async () => ({})) }

    service = new RecipeUpdateService(
      asRepository(pluginRepo),
      asRepository(dataSourceRepo),
      asRepository(templateRepo),
      asRepository(fieldRepo),
      asService<PluginImporterService>(mockImporter),
      asService<PluginsService>(mockPluginsService),
      asService<PluginFieldValuesService>(mockFieldValues),
    )
  })

  describe('checkForUpdate', () => {
    it.each([PLUGIN_ID, 'missing'])('refuses with plugin-not-found when the plugin %s does not exist', async (id) => {
      pluginRepo.findOne.mockResolvedValue(null)

      await expect(service.checkForUpdate(id)).rejects.toMatchObject({ code: 'plugin-not-found' })
    })

    it('refuses with plugin-not-from-recipe when the plugin was not imported from a Recipe', async () => {
      pluginRepo.findOne.mockResolvedValue(makePlugin({ sourceRecipeId: undefined }))

      await expect(service.checkForUpdate(PLUGIN_ID)).rejects.toMatchObject({ code: 'plugin-not-from-recipe' })
    })

    it('answers the importer\'s refusal as it is', async () => {
      const refusal = new ApiException(422, 'recipe-not-found', 'TRMNL has no Recipe 150460.', { id: '150460' })
      pluginRepo.findOne.mockResolvedValue(makePlugin({ sourceRecipeId: '150460' }))
      mockImporter.importFromRecipe.mockRejectedValue(refusal)

      await expect(service.checkForUpdate(PLUGIN_ID)).rejects.toBe(refusal)
    })

    it('returns a two-way diff when the plugin has no snapshot', async () => {
      const plugin = makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: undefined, name: 'Old Name' })
      pluginRepo.findOne.mockResolvedValue(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({ name: 'New Name' }))

      const result = await service.checkForUpdate(PLUGIN_ID)

      expect(result.mode).toBe('two-way')
      expect(result.items).toContainEqual(expect.objectContaining({ itemType: 'name', kind: 'changed', conflict: false }))
      expect(result.contentHash).toBe(computeRecipeContentHash(baseParsedPlugin({ name: 'New Name' })))
    })

    it('returns a three-way diff against the stored snapshot', async () => {
      const snapshot = baseParsedPlugin({ name: 'Old Name' })
      const plugin = makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), name: 'Old Name' })
      pluginRepo.findOne.mockResolvedValue(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({ name: 'New Name' }))

      const result = await service.checkForUpdate(PLUGIN_ID)

      expect(result.mode).toBe('three-way')
      expect(result.items).toEqual([
        { itemType: 'name', key: 'name', kind: 'changed', conflict: false, snapshot: 'Old Name', local: 'Old Name', upstream: 'New Name' },
      ])
    })

    it('reports a newly added required field without a default as left empty', async () => {
      pluginRepo.findOne.mockResolvedValue(makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) }))
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({
        fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }],
      }))

      expect((await service.checkForUpdate(PLUGIN_ID)).requiredFieldsLeftEmpty).toEqual(['api_key'])
    })

    it.each([
      ['is not required', { required: false }, {}],
      ['brings a default', { required: true, defaultValue: 'abc' }, {}],
      ['already has a Field Value', { required: true }, { api_key: 'stored' }],
    ])('does not report a field that %s', async (_what, field, stored) => {
      pluginRepo.findOne.mockResolvedValue(makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) }))
      mockFieldValues.storedFor.mockResolvedValue(stored)
      mockImporter.importFromRecipe.mockResolvedValue(baseParsedPlugin({
        fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', order: 1, ...field }],
      }))

      expect((await service.checkForUpdate(PLUGIN_ID)).requiredFieldsLeftEmpty).toEqual([])
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

      await expect(service.applyUpdate(PLUGIN_ID, { contentHash: 'stale-hash', apply: [] }))
        .rejects
        .toMatchObject({ code: 'recipe-changed' })

      expect(pluginRepo.update).not.toHaveBeenCalled()
      expect(dataSourceRepo.save).not.toHaveBeenCalled()
    })

    it('400s when a selection does not match a pending update item', async () => {
      const upstream = baseParsedPlugin({ name: 'New Name' })
      const plugin = makePlugin({ sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await expect(service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'field', key: 'does-not-exist' }] }))
        .rejects
        .toThrow(BadRequestException)
    })

    it('applies a scalar change and always replaces the snapshot, even with an empty selection', async () => {
      const upstream = baseParsedPlugin({ name: 'New Name' })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [] })

      expect(pluginRepo.update).toHaveBeenCalledWith(PLUGIN_ID, { sourceRecipeSnapshot: { ...upstream }, snapshotTakenAt: expect.any(Date) })
      expect(mockPluginsService.refreshRendersAfterSave).not.toHaveBeenCalled()
    })

    it('applies a selected name change and refreshes the renders', async () => {
      const upstream = baseParsedPlugin({ name: 'New Name' })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'name', key: 'name' }] })

      expect(pluginRepo.update).toHaveBeenCalledWith(PLUGIN_ID, { name: 'New Name', sourceRecipeSnapshot: { ...upstream }, snapshotTakenAt: expect.any(Date) })
      expect(mockPluginsService.refreshRendersAfterSave).toHaveBeenCalledWith(PLUGIN_ID)
    })

    it('refreshes the renders when applying a refreshInterval change', async () => {
      const upstream = baseParsedPlugin({ refreshInterval: 30 })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(baseParsedPlugin()) })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'refreshInterval', key: 'refreshInterval' }] })

      expect(pluginRepo.update).toHaveBeenCalledWith(PLUGIN_ID, { refreshInterval: 30, sourceRecipeSnapshot: { ...upstream }, snapshotTakenAt: expect.any(Date) })
      expect(mockPluginsService.refreshRendersAfterSave).toHaveBeenCalledWith(PLUGIN_ID)
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
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), dataSources: [localDataSource] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'dataSource', key: 'weather' }] })

      expect(dataSourceRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'ds-1',
        url: 'https://new.example.com',
        headers: { 'X-Local-Secret': 'keep-me', 'X-Shared': 'new-value' },
      }))
      expect(mockPluginsService.refreshRendersAfterSave).toHaveBeenCalledWith(PLUGIN_ID)
    })

    it('creates a new row when applying an added Data Source', async () => {
      const snapshot = baseParsedPlugin({ dataSources: [] })
      const upstream = baseParsedPlugin({
        dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com', headers: {} }],
      })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), dataSources: [] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'dataSource', key: 'weather' }] })

      expect(dataSourceRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'weather', url: 'https://api.example.com' }))
      expect(dataSourceRepo.save).toHaveBeenCalled()
    })

    it('removes the row when applying a removed Data Source', async () => {
      const localDataSource = makePluginDataSource({ id: 'ds-1', name: 'weather' })
      const snapshot = baseParsedPlugin({ dataSources: [{ name: 'weather', mode: 'fetch', method: 'GET', url: 'https://api.example.com' }] })
      const upstream = baseParsedPlugin({ dataSources: [] })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), dataSources: [localDataSource] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'dataSource', key: 'weather' }] })

      expect(dataSourceRepo.remove).toHaveBeenCalledWith(localDataSource)
    })

    it('updates a template in place when applying a changed template', async () => {
      const localTemplate = makePluginTemplate({ id: 'tpl-1', layout: 'full', liquidMarkup: 'old' })
      const snapshot = baseParsedPlugin({ templates: [{ layout: 'full', liquidMarkup: 'old' }] })
      const upstream = baseParsedPlugin({ templates: [{ layout: 'full', liquidMarkup: 'new' }] })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), templates: [localTemplate] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'template', key: 'full' }] })

      expect(templateRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'tpl-1', liquidMarkup: 'new' }))
      expect(mockPluginsService.refreshRendersAfterSave).toHaveBeenCalledWith(PLUGIN_ID)
    })

    it('removes a field (and, via FK cascade, its Field Value) when applying a removed field', async () => {
      const localField = makePluginField({ id: 'field-1', keyname: 'api_key' })
      const snapshot = baseParsedPlugin({ fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }] })
      const upstream = baseParsedPlugin({ fields: [] })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), fields: [localField] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'field', key: 'api_key' }] })

      expect(fieldRepo.remove).toHaveBeenCalledWith(localField)
      expect(mockPluginsService.refreshRendersAfterSave).toHaveBeenCalledWith(PLUGIN_ID)
    })

    it('leaves assignments as-is (no field value writes) when applying a newly added required field', async () => {
      const snapshot = baseParsedPlugin({ fields: [] })
      const upstream = baseParsedPlugin({ fields: [{ keyname: 'api_key', fieldType: 'string', name: 'API Key', required: true, order: 1 }] })
      const plugin = makePlugin({ id: PLUGIN_ID, sourceRecipeId: '150460', sourceRecipeSnapshot: toSnapshot(snapshot), fields: [] })
      stubReload(plugin)
      mockImporter.importFromRecipe.mockResolvedValue(upstream)
      const contentHash = computeRecipeContentHash(upstream)

      await service.applyUpdate(PLUGIN_ID, { contentHash, apply: [{ itemType: 'field', key: 'api_key' }] })

      expect(fieldRepo.create).toHaveBeenCalledWith(expect.objectContaining({ keyname: 'api_key', required: true }))
      expect(mockPluginsService.refreshRendersAfterSave).toHaveBeenCalledWith(PLUGIN_ID)
    })
  })
})
