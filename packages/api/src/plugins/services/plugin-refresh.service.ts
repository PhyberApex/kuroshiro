import type { PluginRenderContext } from './plugin-template-context.service.js'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Plugin } from '../entities/plugin.entity.js'
import { hideSecretsIn, secretValues } from '../plugin-field-values.js'
import { DataSourceFetchOutcomeService } from './data-source-fetch-outcome.service.js'
import { PluginRenderCacheService, TemplateRenderError } from './plugin-render-cache.service.js'
import { PluginTemplateContextService } from './plugin-template-context.service.js'

export interface RefreshOptions {
  scheduled: boolean
  /**
   * Answers whether a tick for a newer state of the Plugin has since started, checked just
   * before each write a scheduled render makes. Left unset (the preview, a Webhook ingest) by
   * every caller that never runs two renders of the same Plugin concurrently.
   */
  isSuperseded?: () => boolean
}

/**
 * Re-renders a Plugin into the cache shared by every Screen it is assigned
 * to: a Poll-kind Plugin from freshly fetched Data Sources, a Webhook-kind
 * Plugin from its stored Webhook Payload. The scheduler tick, the tick a
 * save starts and a Webhook ingest all go through here.
 */
@Injectable()
export class PluginRefreshService {
  private readonly logger = new Logger(PluginRefreshService.name)

  constructor(
    private readonly renderCache: PluginRenderCacheService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
    private readonly fetchOutcome: DataSourceFetchOutcomeService,
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
  ) {}

  async refresh(plugin: Plugin, { scheduled, isSuperseded }: RefreshOptions = { scheduled: false }): Promise<void> {
    // The cache entry is shared across Devices, so there is no single Device
    // to scope sensors to here.
    const { context, sourceData, resolvedFieldValues } = await this.pluginTemplateContext.contextFor(plugin, [])

    if (plugin.kind === 'Webhook') {
      await this.renderCache.renderAndCache(plugin, context)
      return
    }

    // Only a scheduled render moves a Fetch Failure Streak (ADR-0025). Recorded
    // before the render so a render failure below can never lose the outcome.
    // A fetch error can quote a password Field Value (the request itself still
    // used the real one); hidden here, so the one writer of lastFetchError never
    // stores it (unlike `context`, which keeps the real value for the render).
    // Every scheduled tick records its own fetch attempt, superseded or not: each was a real fetch.
    if (scheduled)
      await this.recordFetchOutcome(plugin, sourceData, resolvedFieldValues)

    await this.renderPoll(plugin, context, { scheduled, isSuperseded })
  }

  private async recordFetchOutcome(plugin: Plugin, sourceData: Record<string, unknown>, resolvedFieldValues: Record<string, string>): Promise<void> {
    const hiddenSourceData = hideSecretsIn(sourceData, secretValues(plugin.fields ?? [], resolvedFieldValues))
    await this.fetchOutcome.recordOutcomes(plugin.dataSources ?? [], hiddenSourceData)
  }

  private async renderPoll(plugin: Plugin, context: PluginRenderContext['context'], { scheduled, isSuperseded }: RefreshOptions): Promise<void> {
    if (this.dropAsSuperseded(plugin.id, isSuperseded, 'render'))
      return

    try {
      await this.renderCache.renderAndCache(plugin, context)
    }
    catch (error) {
      if (scheduled && error instanceof TemplateRenderError && !this.dropAsSuperseded(plugin.id, isSuperseded, 'failed-render record'))
        await this.recordScheduledRender(plugin.id, error)
      throw error
    }

    if (scheduled && !this.dropAsSuperseded(plugin.id, isSuperseded, 'successful-render record'))
      await this.recordScheduledRender(plugin.id, null)
  }

  /** Whether a later tick for the Plugin has since started, logged where it drops a write this one would otherwise make. */
  private dropAsSuperseded(pluginId: string, isSuperseded: (() => boolean) | undefined, whatThisDrops: string): boolean {
    if (!isSuperseded?.())
      return false
    this.logger.debug(`Dropping ${whatThisDrops} for plugin ${pluginId}: a newer tick has since started`)
    return true
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
