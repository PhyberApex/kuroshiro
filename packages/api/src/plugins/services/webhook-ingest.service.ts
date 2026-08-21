import type { MergeStrategy, WebhookPayload } from '../entities/plugin.entity'
import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Plugin } from '../entities/plugin.entity'
import { PluginRenderCacheService } from './plugin-render-cache.service'

type JsonObject = Record<string, any>

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge(stored: unknown, incoming: unknown): unknown {
  if (!isPlainObject(stored) || !isPlainObject(incoming)) {
    return incoming
  }

  return Object.entries(incoming).reduce<JsonObject>(
    (merged, [key, value]) => ({
      ...merged,
      [key]: isPlainObject(value) && isPlainObject(stored[key]) ? deepMerge(stored[key], value) : value,
    }),
    { ...stored },
  )
}

function appendStream(stored: unknown, incoming: unknown, streamLimit?: number | null): unknown {
  if (!isPlainObject(incoming)) {
    return incoming
  }

  const base: JsonObject = isPlainObject(stored) ? { ...stored } : {}

  return Object.entries(incoming).reduce<JsonObject>((merged, [key, value]) => {
    if (!Array.isArray(value)) {
      return { ...merged, [key]: value }
    }

    const existing = Array.isArray(merged[key]) ? merged[key] : []
    const appended = [...existing, ...value]

    return { ...merged, [key]: streamLimit && streamLimit > 0 ? appended.slice(-streamLimit) : appended }
  }, base)
}

function merge(strategy: MergeStrategy | null | undefined, stored: unknown, incoming: unknown, streamLimit?: number | null): unknown {
  switch (strategy) {
    case 'deep_merge':
      return deepMerge(stored, incoming)
    case 'stream':
      return appendStream(stored, incoming, streamLimit)
    default:
      return incoming
  }
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

    const merged = merge(plugin.mergeStrategy, plugin.webhookPayload, body, plugin.streamLimit) as WebhookPayload

    await this.pluginRepository.update(plugin.id, { webhookPayload: merged })
    await this.renderCache.renderAndCache(plugin, merged)

    this.logger.debug(`Ingested webhook payload for plugin ${plugin.id} using ${plugin.mergeStrategy} merge strategy`)

    return { success: true }
  }

  readPayload(plugin: Plugin): WebhookPayload {
    return plugin.webhookPayload ?? null
  }
}
