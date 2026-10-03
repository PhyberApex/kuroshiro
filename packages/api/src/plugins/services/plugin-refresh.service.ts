import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Plugin } from '../entities/plugin.entity.js'
import { DataSourceFetchOutcomeService } from './data-source-fetch-outcome.service.js'
import { PluginDataResolverService } from './plugin-data-resolver.service.js'
import { PluginRenderCacheService } from './plugin-render-cache.service.js'
import { PluginTemplateContextService } from './plugin-template-context.service.js'

/**
 * Re-renders a Plugin into the cache shared by every Screen it is assigned
 * to: a Poll-kind Plugin from freshly fetched Data Sources, a Webhook-kind
 * Plugin from its stored Webhook Payload. The scheduler tick, the tick a
 * save starts and a Webhook ingest all go through here.
 */
@Injectable()
export class PluginRefreshService {
  constructor(
    private readonly pluginDataResolver: PluginDataResolverService,
    private readonly renderCache: PluginRenderCacheService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
    private readonly fetchOutcome: DataSourceFetchOutcomeService,
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
  ) {}

  async refresh(plugin: Plugin, { scheduled }: { scheduled: boolean } = { scheduled: false }): Promise<void> {
    // The cache entry is shared across Devices, so there is no single Device
    // to scope sensors to here.
    const templateContext = await this.pluginTemplateContext.build(plugin, [])

    if (plugin.kind === 'Webhook') {
      const payload = plugin.webhookPayload
      // An array payload has no keys to merge into, so it stays the whole render context.
      await this.renderCache.renderAndCache(plugin, Array.isArray(payload) ? payload : { ...templateContext, ...payload })
      return
    }

    const sourceData = await this.pluginDataResolver.resolveAll(plugin.dataSources ?? [], templateContext)

    // Only a scheduled render moves a Fetch Failure Streak (ADR-0025). Recorded
    // before the render so a render failure below can never lose the outcome.
    if (scheduled) {
      await this.fetchOutcome.recordOutcomes(plugin.dataSources ?? [], sourceData)
    }

    await this.renderCache.renderAndCache(plugin, { ...templateContext, ...sourceData })

    if (scheduled) {
      await this.recordScheduledRender(plugin.id)
    }
  }

  /**
   * `updatedAt` is set to itself because TypeORM otherwise stamps it on every
   * update, and a scheduler tick is not a change to the Plugin.
   */
  private async recordScheduledRender(pluginId: string): Promise<void> {
    await this.pluginRepository.update(pluginId, {
      lastScheduledRenderAt: new Date(),
      lastScheduledRenderError: null,
      lastScheduledRenderErrorLine: null,
      lastScheduledRenderErrorSize: null,
      updatedAt: () => '"updatedAt"',
    })
  }
}
