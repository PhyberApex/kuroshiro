import type { WebhookPayload } from '../entities/plugin.entity'
import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { isPlainObject } from '../../utils/json'
import { Plugin } from '../entities/plugin.entity'
import { PluginRenderCacheService } from './plugin-render-cache.service'

function isWebhookPayload(value: unknown): value is WebhookPayload {
  return value === null || Array.isArray(value) || isPlainObject(value)
}

// `incoming`/`value` are only ever reached here once `isWebhookPayload` has
// confirmed the root body is JSON-object/array/null shaped, so recursing
// through it with `unknown` and handing leaf values back as-is is safe.
function deepMerge(stored: unknown, incoming: unknown): unknown {
  if (!isPlainObject(stored) || !isPlainObject(incoming)) {
    return incoming
  }

  return Object.entries(incoming).reduce<Record<string, unknown>>(
    (merged, [key, value]) => ({
      ...merged,
      [key]: isPlainObject(value) && isPlainObject(stored[key]) ? deepMerge(stored[key], value) : value,
    }),
    { ...stored },
  )
}

function appendStream(stored: unknown, incoming: unknown, streamLimit: number): unknown {
  if (!isPlainObject(incoming)) {
    return incoming
  }

  const base: Record<string, unknown> = isPlainObject(stored) ? { ...stored } : {}

  return Object.entries(incoming).reduce<Record<string, unknown>>((merged, [key, value]) => {
    if (!Array.isArray(value)) {
      return { ...merged, [key]: value }
    }

    const existing = Array.isArray(merged[key]) ? merged[key] : []
    const appended = [...existing, ...value]

    return { ...merged, [key]: appended.slice(-streamLimit) }
  }, base)
}

@Injectable()
export class WebhookIngestService {
  private readonly logger = new Logger(WebhookIngestService.name)

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    private readonly renderCache: PluginRenderCacheService,
  ) {}

  async ingest(plugin: Plugin, body: unknown): Promise<{ success: boolean }> {
    if (!plugin.templates || plugin.templates.length === 0) {
      throw new UnprocessableEntityException(`Plugin "${plugin.name}" has no template configured`)
    }

    if (!isWebhookPayload(body)) {
      throw new UnprocessableEntityException('Webhook body must be a JSON object or array')
    }

    const merged = this.merge(plugin, body)

    // TypeORM's QueryDeepPartialEntity can't distribute over the WebhookPayload
    // union against a union-typed value, even though `merged`'s type already
    // matches the column exactly — hence the assertion rather than a real gap.
    await this.pluginRepository.update(plugin.id, { webhookPayload: merged } as Parameters<typeof this.pluginRepository.update>[1])
    await this.renderCache.renderAndCache(plugin, merged)

    this.logger.debug(`Ingested webhook payload for plugin ${plugin.id} using ${plugin.mergeStrategy} merge strategy`)

    return { success: true }
  }

  readPayload(plugin: Plugin): WebhookPayload {
    return plugin.webhookPayload ?? null
  }

  private merge(plugin: Plugin, body: WebhookPayload): WebhookPayload {
    switch (plugin.mergeStrategy) {
      case 'deep_merge':
        return deepMerge(plugin.webhookPayload, body) as WebhookPayload
      case 'stream':
        if (!plugin.streamLimit || plugin.streamLimit < 1) {
          throw new UnprocessableEntityException(`Plugin "${plugin.name}" has a stream Merge Strategy without a Stream Limit`)
        }
        return appendStream(plugin.webhookPayload, body, plugin.streamLimit) as WebhookPayload
      default:
        return body
    }
  }
}
