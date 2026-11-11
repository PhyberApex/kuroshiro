import type { AddressInfo } from 'node:net'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigurationController } from '../../configuration/configuration.controller.js'
import { ConfigurationExportService } from '../../configuration/services/configuration-export.service.js'
import { ConfigurationImportService } from '../../configuration/services/configuration-import.service.js'
import { LogsController } from '../../logs/logs.controller.js'
import { LogsService } from '../../logs/logs.service.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { WebhookPluginGuard } from '../../plugins/guards/webhook-plugin.guard.js'
import { WebhookIngestService } from '../../plugins/services/webhook-ingest.service.js'
import { WebhookIngestController } from '../../plugins/webhook-ingest.controller.js'
import { makePlugin } from '../../test/fixtures.js'
import { createHttpTestApp } from '../../test/httpApp.js'

const summary = { created: {}, updated: {}, warnings: [] }

describe('a state-changing admin API request from another site', () => {
  let http: HttpTestApp
  let ownOrigin: string
  const exportService = { exportToZip: vi.fn() }
  const importService = { importFromZip: vi.fn(), checkZip: vi.fn() }
  const logsService = { addLogToDevice: vi.fn() }
  const ingestService = { ingest: vi.fn(), readPayload: vi.fn() }
  const pluginRepository = { findOne: vi.fn() }

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [ConfigurationController, LogsController, WebhookIngestController],
      providers: [
        { provide: ConfigurationExportService, useValue: exportService },
        { provide: ConfigurationImportService, useValue: importService },
        { provide: LogsService, useValue: logsService },
        { provide: WebhookIngestService, useValue: ingestService },
        { provide: getRepositoryToken(Plugin), useValue: pluginRepository },
        WebhookPluginGuard,
      ],
    })
    ownOrigin = `http://127.0.0.1:${(http.app.getHttpServer().address() as AddressInfo).port}`
  })

  beforeEach(() => {
    vi.resetAllMocks()
    importService.importFromZip.mockResolvedValue(summary)
  })

  afterAll(async () => {
    await http.app.close()
  })

  function importArchive(headers: Record<string, string> = {}) {
    const body = new FormData()
    body.append('file', new Blob([new Uint8Array([0x50, 0x4B])]), 'archive.zip')
    return http.request('/api/config/import', { method: 'POST', body, headers })
  }

  // The cases are functions because the own origin is known only once the app listens.
  it.each([
    ['an Origin of another site', () => ({ origin: 'https://evil.example' })],
    ['the opaque Origin null', () => ({ origin: 'null' })],
    ['Sec-Fetch-Site: cross-site', () => ({ 'sec-fetch-site': 'cross-site' })],
    ['Sec-Fetch-Site: same-site', () => ({ 'sec-fetch-site': 'same-site' })],
    ['Sec-Fetch-Site: cross-site, whatever the Origin says', () => ({ 'sec-fetch-site': 'cross-site', 'origin': ownOrigin })],
  ])('is refused with %s, before the upload is read', async (_case, headers) => {
    const response = await importArchive(headers())

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      statusCode: 403,
      code: 'cross-site-request',
      message: 'A state-changing request has to come from the admin UI\'s own origin.',
    })
    expect(importService.importFromZip).not.toHaveBeenCalled()
  })

  it.each([
    ['no Origin, as curl sends', () => ({})],
    ['the request\'s own Origin', () => ({ origin: ownOrigin })],
    ['an Origin whose host differs from the Host only in case', () => ({ 'origin': 'https://kuroshiro.example', 'x-forwarded-host': 'Kuroshiro.Example' })],
    ['the Host a reverse proxy forwarded as its Origin', () => ({ 'origin': 'https://kuroshiro.example', 'x-forwarded-host': 'kuroshiro.example' })],
    ['Sec-Fetch-Site: same-origin', () => ({ 'sec-fetch-site': 'same-origin' })],
    ['Sec-Fetch-Site: same-origin behind a proxy that rewrote the Host', () => ({ 'sec-fetch-site': 'same-origin', 'origin': 'http://localhost:5173' })],
    ['Sec-Fetch-Site: none, as a request the user started', () => ({ 'sec-fetch-site': 'none' })],
  ])('goes through with %s', async (_case, headers) => {
    const response = await importArchive(headers())

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(summary)
  })

  it('leaves a read alone, whatever its Origin', async () => {
    exportService.exportToZip.mockResolvedValue(Buffer.from('zip'))

    const response = await http.request('/api/config/export', { headers: { 'origin': 'https://evil.example', 'sec-fetch-site': 'cross-site' } })

    expect(response.status).toBe(200)
  })

  it('leaves a Device\'s /api/log alone, whatever its Origin', async () => {
    const response = await http.postJson('/api/log', { logs: [] }, {
      headers: { 'id': '2d:34:e2:27:5b:46', 'access-token': 'token', 'origin': 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    })

    expect(response.status).toBe(204)
    expect(logsService.addLogToDevice).toHaveBeenCalled()
  })

  it('leaves a Webhook ingest alone, whatever its Origin', async () => {
    pluginRepository.findOne.mockResolvedValue(makePlugin({ id: 'plugin-1', kind: 'Webhook', webhookToken: 'token-abc' }))
    ingestService.ingest.mockResolvedValue({ ok: true })

    const response = await http.postJson('/api/webhook/token-abc', { merge_variables: {} }, { headers: { 'origin': 'null', 'sec-fetch-site': 'cross-site' } })

    expect(response.status).toBe(201)
    expect(ingestService.ingest).toHaveBeenCalled()
  })
})
