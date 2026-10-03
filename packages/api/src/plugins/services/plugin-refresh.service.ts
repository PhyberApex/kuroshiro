import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable } from '@nestjs/common'
import { isPlainObject } from '../../utils/json.js'
import { DataSourceFetchOutcomeService } from './data-source-fetch-outcome.service.js'
import { PluginDataResolverService } from './plugin-data-resolver.service.js'
import { PluginRenderCacheService } from './plugin-render-cache.service.js'
import { PluginTemplateContextService } from './plugin-template-context.service.js'

/**
 * Re-renders a Plugin into the cache shared by every Screen it is assigned
 * to: a Poll-kind Plugin from freshly fetched Data Sources, a Webhook-kind
 * Plugin from its stored Webhook Payload. The scheduler tick, a Webhook
 * ingest and a save that changes Field Values all go through here.
 */
@Injectable()
export class PluginRefreshService {
  constructor(
    private readonly pluginDataResolver: PluginDataResolverService,
    private readonly renderCache: PluginRenderCacheService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
    private readonly fetchOutcome: DataSourceFetchOutcomeService,
  ) {}

  async refresh(plugin: Plugin): Promise<void> {
    // The cache entry is shared across Devices, so there is no single Device
    // to scope sensors to here.
    const templateContext = await this.pluginTemplateContext.build(plugin, [])

    if (plugin.kind === 'Webhook') {
      const payload = plugin.webhookPayload
      await this.renderCache.renderAndCache(plugin, isPlainObject(payload) ? { ...templateContext, ...payload } : templateContext)
      return
    }

    const sourceData = await this.pluginDataResolver.resolveAll(plugin.dataSources ?? [], templateContext)

    // Recorded before the render so a render failure below can never
    // lose the fetch outcome this refresh just observed (ADR-0025).
    await this.fetchOutcome.recordOutcomes(plugin.dataSources ?? [], sourceData)

    await this.renderCache.renderAndCache(plugin, { ...templateContext, ...sourceData })
  }
}
