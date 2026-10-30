import type { WebhookPayload } from '../entities/plugin.entity.js'
import { Injectable, Logger, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { isPlainObject } from '../../utils/json.js'
import { OneAtATime } from '../../utils/oneAtATime.js'
import { Plugin } from '../entities/plugin.entity.js'
import { templateOfSize } from '../plugin-templates.js'
import { PluginRefreshService } from './plugin-refresh.service.js'

function isWebhookPayload(value: unknown): value is WebhookPayload {
  return value === null || Array.isArray(value) || isPlainObject(value)
}

/** The keys TRMNL's webhook API takes beside `merge_variables`; the Merge Strategy stays the Plugin's (ADR-0004). */
const ENVELOPE_KEYS = ['merge_variables', 'merge_strategy', 'deep_merge', 'stream_limit']

/** What a POST is merged with, read again under the Plugin's lock rather than taken from the guard's copy. */
const MERGE_SELECT = { id: true, mergeStrategy: true, streamLimit: true, webhookPayload: true } as const

function parsedObject(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

/**
 * The payload a POST carries: the body itself, or its `merge_variables` when the body is TRMNL's envelope, which
 * every script written for TRMNL sends (ADR-0063). TRMNL also takes `merge_variables` as JSON text.
 */
function payloadOf(body: unknown): unknown {
  if (!isPlainObject(body) || !('merge_variables' in body) || !Object.keys(body).every(key => ENVELOPE_KEYS.includes(key)))
    return body
  const variables = body.merge_variables
  return typeof variables === 'string' ? parsedObject(variables) : variables
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
  private readonly perPlugin = new OneAtATime()

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    private readonly pluginRefresh: PluginRefreshService,
  ) {}

  async ingest(plugin: Plugin, body: unknown): Promise<{ success: boolean }> {
    if (!templateOfSize(plugin.templates, 'full')) {
      throw new UnprocessableEntityException(`Plugin "${plugin.name}" has no template configured`)
    }

    const payload = payloadOf(body)
    if (!isWebhookPayload(payload)) {
      throw new UnprocessableEntityException('Webhook body must be a JSON object or array')
    }

    // The guard loaded the Plugin when the request came in, so a POST that arrived alongside may have stored a payload
    // since. Merging onto the stored one, one POST at a time per Plugin, keeps what every POST sent; the render runs
    // inside too, so the last one drawn is of the last payload stored.
    await this.perPlugin.run(plugin.id, async () => {
      const stored = await this.pluginRepository.findOne({ where: { id: plugin.id }, select: MERGE_SELECT })
      if (!stored)
        throw new UnauthorizedException('Invalid webhook token')
      const merged = this.merge({ ...plugin, ...stored }, payload)

      // TypeORM's QueryDeepPartialEntity can't distribute over the WebhookPayload
      // union against a union-typed value, even though `merged`'s type already
      // matches the column exactly — hence the assertion rather than a real gap.
      const payloadReceivedAt = new Date()
      await this.pluginRepository.update(plugin.id, { webhookPayload: merged, payloadReceivedAt } as Parameters<typeof this.pluginRepository.update>[1])
      // The render's `data_fetched_utc` is the time this POST was stored, not the one the guard loaded (ADR-0057).
      await this.pluginRefresh.refresh({ ...plugin, webhookPayload: merged, payloadReceivedAt })
    })

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
