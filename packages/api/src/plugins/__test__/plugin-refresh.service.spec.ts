import type { Plugin } from '../entities/plugin.entity.js'
import type { DataSourceFetchOutcomeService } from '../services/data-source-fetch-outcome.service.js'
import type { PluginRenderCacheService } from '../services/plugin-render-cache.service.js'
import type { PluginTemplateContextService } from '../services/plugin-template-context.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlugin, makePluginDataSource, makePluginField } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { PluginRefreshService } from '../services/plugin-refresh.service.js'

describe('pluginRefreshService', () => {
  let renderCache: { renderAndCache: ReturnType<typeof vi.fn> }
  let templateContext: { contextFor: ReturnType<typeof vi.fn> }
  let fetchOutcome: { recordOutcomes: ReturnType<typeof vi.fn> }
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let service: PluginRefreshService

  beforeEach(() => {
    renderCache = { renderAndCache: vi.fn() }
    templateContext = { contextFor: vi.fn() }
    fetchOutcome = { recordOutcomes: vi.fn() }
    pluginRepo = createMockRepository<Plugin>()
    service = new PluginRefreshService(
      asService<PluginRenderCacheService>(renderCache),
      asService<PluginTemplateContextService>(templateContext),
      asService<DataSourceFetchOutcomeService>(fetchOutcome),
      asRepository(pluginRepo),
    )
  })

  it('hides every password Field Value in the sourceData a scheduled tick records, while rendering from the real one', async () => {
    const apiKey = makePluginField({ keyname: 'api_key', fieldType: 'password' })
    const plugin = makePlugin({ fields: [apiKey], dataSources: [makePluginDataSource({ name: 'weather' })] })
    const sourceData = { weather: { error: true, message: 'Failed to parse URL from not a url/hunter2' } }
    templateContext.contextFor.mockResolvedValue({
      context: { weather: sourceData.weather },
      fieldValues: { api_key: 'hunter2' },
      resolvedFieldValues: { api_key: 'hunter2' },
      sourceData,
    })

    await service.refresh(plugin, { scheduled: true })

    expect(fetchOutcome.recordOutcomes).toHaveBeenCalledWith(plugin.dataSources, {
      weather: { error: true, message: 'Failed to parse URL from not a url/••••••••' },
    })
    expect(renderCache.renderAndCache).toHaveBeenCalledWith(plugin, { weather: sourceData.weather })
  })

  it('leaves a Field Value that is not password-type alone', async () => {
    const city = makePluginField({ keyname: 'city', fieldType: 'string' })
    const plugin = makePlugin({ fields: [city], dataSources: [makePluginDataSource({ name: 'weather' })] })
    const sourceData = { weather: { error: true, message: 'Failed to parse URL from not a url/Berlin' } }
    templateContext.contextFor.mockResolvedValue({
      context: {},
      fieldValues: { city: 'Berlin' },
      resolvedFieldValues: { city: 'Berlin' },
      sourceData,
    })

    await service.refresh(plugin, { scheduled: true })

    expect(fetchOutcome.recordOutcomes).toHaveBeenCalledWith(plugin.dataSources, sourceData)
  })

  it('does not move the Fetch Failure Streak for an on-demand (non-scheduled) render', async () => {
    const plugin = makePlugin({ dataSources: [makePluginDataSource({ name: 'weather' })] })
    templateContext.contextFor.mockResolvedValue({
      context: {},
      fieldValues: {},
      resolvedFieldValues: {},
      sourceData: { weather: { error: true, message: 'boom' } },
    })

    await service.refresh(plugin)

    expect(fetchOutcome.recordOutcomes).not.toHaveBeenCalled()
  })

  it('never calls recordOutcomes for a Webhook-kind Plugin', async () => {
    const plugin = makePlugin({ kind: 'Webhook' })
    templateContext.contextFor.mockResolvedValue({
      context: { reading: 4 },
      fieldValues: {},
      resolvedFieldValues: {},
      sourceData: {},
    })

    await service.refresh(plugin, { scheduled: true })

    expect(fetchOutcome.recordOutcomes).not.toHaveBeenCalled()
    expect(renderCache.renderAndCache).toHaveBeenCalledWith(plugin, { reading: 4 })
  })

  it('tolerates a Plugin loaded with no fields relation', async () => {
    const plugin = { ...makePlugin({ dataSources: [makePluginDataSource({ name: 'weather' })] }), fields: undefined as unknown as Plugin['fields'] }
    const sourceData = { weather: { error: true, message: 'boom' } }
    templateContext.contextFor.mockResolvedValue({ context: {}, fieldValues: {}, resolvedFieldValues: {}, sourceData })

    await expect(service.refresh(plugin, { scheduled: true })).resolves.toBeUndefined()

    expect(fetchOutcome.recordOutcomes).toHaveBeenCalledWith(plugin.dataSources, sourceData)
  })
})
