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

describe('webhook POSTs that arrive together, against a real database (ADR-0004)', () => {
  let database: DataSource
  let ingest: WebhookIngestService
  const rendered: WebhookPayload[] = []
  const renderedReceivedAt: (Date | null)[] = []

  beforeAll(async () => {
    database = await createTestDatabase()
    // A render that takes a moment, as a real one does, so the second POST lands while the first is still in flight.
    const refresh = asService<PluginRefreshService>({
      refresh: async (plugin: Plugin) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        rendered.push(plugin.webhookPayload ?? null)
        renderedReceivedAt.push(plugin.payloadReceivedAt ?? null)
      },
    })
    ingest = new WebhookIngestService(database.getRepository(Plugin), refresh)
  })

  afterEach(async () => {
    rendered.length = 0
    renderedReceivedAt.length = 0
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

  /** The Plugin as the webhook guard loads it when a request comes in. */
  function loadedByGuard(plugin: Plugin): Promise<Plugin> {
    return database.getRepository(Plugin).findOneOrFail({ where: { id: plugin.id }, relations: { templates: true } })
  }

  /** POSTs whose guards all loaded the Plugin before any of them stored a payload. */
  async function postTogether(plugin: Plugin, ...bodies: unknown[]): Promise<void> {
    const loaded = await Promise.all(bodies.map(() => loadedByGuard(plugin)))
    await Promise.all(bodies.map((body, index) => ingest.ingest(loaded[index], body)))
  }

  async function storedPayload(plugin: Plugin): Promise<WebhookPayload> {
    return (await database.getRepository(Plugin).findOneByOrFail({ id: plugin.id })).webhookPayload ?? null
  }

  async function storedReceivedAt(plugin: Plugin): Promise<Date | null> {
    return (await database.getRepository(Plugin).findOneByOrFail({ id: plugin.id })).payloadReceivedAt ?? null
  }

  it('keeps both POSTs\' events under the stream Merge Strategy', async () => {
    const plugin = await createWebhookPlugin('stream', { events: ['a'] })
    await postTogether(plugin, { events: ['b'] }, { events: ['c'] })

    expect(await storedPayload(plugin)).toEqual({ events: ['a', 'b', 'c'] })
    expect(rendered.at(-1)).toEqual({ events: ['a', 'b', 'c'] })
  })

  it('keeps both POSTs\' keys under the deep_merge Merge Strategy', async () => {
    const plugin = await createWebhookPlugin('deep_merge', { sensor: { name: 'attic' } })
    await postTogether(plugin, { sensor: { temp: 21 } }, { status: 'ok' })

    expect(await storedPayload(plugin)).toEqual({ sensor: { name: 'attic', temp: 21 }, status: 'ok' })
    expect(rendered.at(-1)).toEqual({ sensor: { name: 'attic', temp: 21 }, status: 'ok' })
  })

  it('renders with the time of the POST that triggered the render, not the one the guard loaded', async () => {
    const plugin = await createWebhookPlugin('standard', null)

    await ingest.ingest(await loadedByGuard(plugin), { status: 'ok' })
    const first = await storedReceivedAt(plugin)
    // So the second POST's time differs from the first's at the millisecond.
    await new Promise(resolve => setTimeout(resolve, 5))
    await ingest.ingest(await loadedByGuard(plugin), { status: 'degraded' })
    const second = await storedReceivedAt(plugin)

    expect(first).toBeInstanceOf(Date)
    expect(second).not.toEqual(first)
    expect(renderedReceivedAt).toEqual([first, second])
  })

  it('stores and renders nothing for a Plugin deleted after the guard loaded it', async () => {
    const plugin = await createWebhookPlugin('deep_merge', { sensor: { name: 'attic' } })
    const loaded = await loadedByGuard(plugin)
    await database.getRepository(Plugin).delete(plugin.id)

    await expect(ingest.ingest(loaded, { status: 'ok' })).rejects.toThrow('Invalid webhook token')
    expect(rendered).toEqual([])
  })
})
