import type { MergeStrategy } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { WebhookPayload } from '../entities/plugin.entity.js'
import type { PluginRefreshService } from '../services/plugin-refresh.service.js'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { Plugin } from '../entities/plugin.entity.js'
import { WebhookIngestService } from '../services/webhook-ingest.service.js'

describe('webhook POSTs that arrive together, against a real database', () => {
  let database: DataSource
  let ingest: WebhookIngestService
  const rendered: WebhookPayload[] = []

  beforeAll(async () => {
    database = await createTestDatabase()
    // A render that takes a moment, as a real one does, so the second POST lands while the first is still in flight.
    const refresh = asService<PluginRefreshService>({
      refresh: async (plugin: Plugin) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        rendered.push(plugin.webhookPayload ?? null)
      },
    })
    ingest = new WebhookIngestService(database.getRepository(Plugin), refresh)
  })

  afterEach(async () => {
    rendered.length = 0
    await database.query('TRUNCATE "plugin" CASCADE')
  })

  afterAll(async () => {
    await database.destroy()
  })

  async function createWebhookPlugin(mergeStrategy: MergeStrategy, webhookPayload: WebhookPayload): Promise<Plugin> {
    const plugin = await database.getRepository(Plugin).save({
      name: 'Sensor Feed',
      kind: 'Webhook',
      webhookToken: `token-${mergeStrategy}`,
      mergeStrategy,
      streamLimit: mergeStrategy === 'stream' ? 10 : null,
      webhookPayload,
    })
    await database.getRepository(PluginTemplate).save({ plugin: { id: plugin.id }, layout: 'full', liquidMarkup: '<p></p>' })
    return plugin
  }

  /** The Plugin as the webhook guard loads it at the start of a request. */
  function loadedByGuard(plugin: Plugin): Promise<Plugin> {
    return database.getRepository(Plugin).findOneOrFail({ where: { id: plugin.id }, relations: { templates: true } })
  }

  async function storedPayload(plugin: Plugin): Promise<WebhookPayload> {
    return (await database.getRepository(Plugin).findOneByOrFail({ id: plugin.id })).webhookPayload ?? null
  }

  it('keeps both POSTs\' events under the stream Merge Strategy', async () => {
    const plugin = await createWebhookPlugin('stream', { events: ['a'] })
    const [first, second] = await Promise.all([loadedByGuard(plugin), loadedByGuard(plugin)])

    await Promise.all([ingest.ingest(first, { events: ['b'] }), ingest.ingest(second, { events: ['c'] })])

    expect(await storedPayload(plugin)).toEqual({ events: ['a', 'b', 'c'] })
    expect(rendered.at(-1)).toEqual({ events: ['a', 'b', 'c'] })
  })

  it('keeps both POSTs\' keys under the deep_merge Merge Strategy', async () => {
    const plugin = await createWebhookPlugin('deep_merge', { sensor: { name: 'attic' } })
    const [first, second] = await Promise.all([loadedByGuard(plugin), loadedByGuard(plugin)])

    await Promise.all([ingest.ingest(first, { sensor: { temp: 21 } }), ingest.ingest(second, { status: 'ok' })])

    expect(await storedPayload(plugin)).toEqual({ sensor: { name: 'attic', temp: 21 }, status: 'ok' })
    expect(rendered.at(-1)).toEqual({ sensor: { name: 'attic', temp: 21 }, status: 'ok' })
  })
})
