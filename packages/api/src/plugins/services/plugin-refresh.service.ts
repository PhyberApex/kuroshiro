import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Plugin } from '../entities/plugin.entity.js'
import { DataSourceFetchOutcomeService } from './data-source-fetch-outcome.service.js'
import { PluginRenderCacheService, TemplateRenderError } from './plugin-render-cache.service.js'
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
    private readonly renderCache: PluginRenderCacheService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
    private readonly fetchOutcome: DataSourceFetchOutcomeService,
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
  ) {}

  async refresh(plugin: Plugin, { scheduled }: { scheduled: boolean } = { scheduled: false }): Promise<void> {
    // The cache entry is shared across Devices, so there is no single Device
    // to scope sensors to here.
    const { context, sourceData } = await this.pluginTemplateContext.contextFor(plugin, [])

    if (plugin.kind === 'Webhook') {
      await this.renderCache.renderAndCache(plugin, context)
      return
    }

    // Only a scheduled render moves a Fetch Failure Streak (ADR-0025). Recorded
    // before the render so a render failure below can never lose the outcome.
    if (scheduled) {
      await this.fetchOutcome.recordOutcomes(plugin.dataSources ?? [], sourceData)
    }

    try {
      await this.renderCache.renderAndCache(plugin, context)
    }
    catch (error) {
      if (scheduled && error instanceof TemplateRenderError) {
        await this.recordScheduledRender(plugin.id, error)
      }
      throw error
    }

    if (scheduled) {
      await this.recordScheduledRender(plugin.id, null)
    }
  }

  /**
   * `updatedAt` is set to itself because TypeORM otherwise stamps it on every
   * update, and a scheduler tick is not a change to the Plugin.
   */
  private async recordScheduledRender(pluginId: string, failure: TemplateRenderError | null): Promise<void> {
    await this.pluginRepository.update(pluginId, {
      lastScheduledRenderAt: new Date(),
      lastScheduledRenderError: failure?.problem.message ?? null,
      lastScheduledRenderErrorLine: failure?.problem.line ?? null,
      lastScheduledRenderErrorSize: failure?.size ?? null,
      updatedAt: () => '"updatedAt"',
    })
  }
}
