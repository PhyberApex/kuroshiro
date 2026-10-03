import type { HttpTestApp } from '../../test/httpApp.js'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConfigurationController } from '../../configuration/configuration.controller.js'
import { ConfigurationExportService } from '../../configuration/services/configuration-export.service.js'
import { ConfigurationImportService } from '../../configuration/services/configuration-import.service.js'
import { FirmwareReadsService } from '../../firmware/firmware-reads.service.js'
import { FirmwareSyncService } from '../../firmware/firmware-sync.service.js'
import { FirmwareController } from '../../firmware/firmware.controller.js'
import { FirmwareService } from '../../firmware/firmware.service.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginsController } from '../../plugins/plugins.controller.js'
import { PluginsService } from '../../plugins/plugins.service.js'
import { PluginAssignmentsService } from '../../plugins/services/plugin-assignments.service.js'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { PluginPreviewDataService } from '../../plugins/services/plugin-preview-data.service.js'
import { PluginReadsService } from '../../plugins/services/plugin-reads.service.js'
import { RecipeUpdateService } from '../../plugins/services/recipe-update.service.js'
import { WebhookIngestService } from '../../plugins/services/webhook-ingest.service.js'
import { WebhookIngestController } from '../../plugins/webhook-ingest.controller.js'
import { ScreenReadsService } from '../../screens/screen-reads.service.js'
import { ScreensController } from '../../screens/screens.controller.js'
import { ScreensService } from '../../screens/screens.service.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { UPLOAD_LIMITS } from '../upload-limits.js'

const DEVICE_ID = '0b0f5c1e-6c40-4c3e-8f7e-0d4c1f9b7a10'

const answered = { id: 'x' }

function multipart(bytes: number, fields: Record<string, string> = {}, filename = 'upload.bin'): FormData {
  const form = new FormData()
  Object.entries(fields).forEach(([name, value]) => form.append(name, value))
  form.append('file', new Blob([new Uint8Array(bytes)]), filename)
  return form
}

function jsonBody(bytes: number): string {
  const overhead = JSON.stringify({ pad: '' }).length
  return JSON.stringify({ pad: 'x'.repeat(bytes - overhead) })
}

describe('the upload limits', () => {
  let http: HttpTestApp

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [ScreensController, FirmwareController, ConfigurationController, PluginsController, WebhookIngestController],
      providers: [
        { provide: ScreensService, useValue: { add: async () => 'screen-id' } },
        { provide: ScreenReadsService, useValue: { forScreen: async () => answered } },
        { provide: FirmwareService, useValue: { upload: async () => ({ id: 'firmware-id' }) } },
        { provide: FirmwareReadsService, useValue: { readById: async () => answered } },
        { provide: FirmwareSyncService, useValue: {} },
        { provide: ConfigurationExportService, useValue: {} },
        { provide: ConfigurationImportService, useValue: { importFromZip: async () => answered } },
        { provide: PluginsService, useValue: { create: async () => answered } },
        { provide: PluginReadsService, useValue: {} },
        { provide: PluginPreviewDataService, useValue: {} },
        { provide: PluginAssignmentsService, useValue: {} },
        { provide: PluginImporterService, useValue: { importFromFile: async () => ({ name: 'Imported' }) } },
        { provide: PluginExporterService, useValue: {} },
        { provide: RecipeUpdateService, useValue: {} },
        { provide: WebhookIngestService, useValue: { ingest: async () => ({ success: true }) } },
        { provide: getRepositoryToken(Plugin), useValue: { findOne: async () => ({ id: 'plugin' }) } },
      ],
    })
  })

  afterAll(async () => {
    await http.app.close()
  })

  const uploads: { name: string, path: string, limit: number, fields: Record<string, string>, filename: string }[] = [
    { name: 'image upload', path: '/api/screens', limit: UPLOAD_LIMITS.imageUploadBytes, fields: { deviceId: DEVICE_ID, kind: 'file', name: 'Photo' }, filename: 'photo.png' },
    { name: 'firmware upload', path: '/api/firmware/upload', limit: UPLOAD_LIMITS.firmwareUploadBytes, fields: { version: '1.0.0' }, filename: 'firmware.bin' },
    { name: 'archive upload', path: '/api/config/import', limit: UPLOAD_LIMITS.archiveUploadBytes, fields: {}, filename: 'archive.zip' },
    { name: 'plugin import', path: '/api/plugins/import', limit: UPLOAD_LIMITS.pluginImportBytes, fields: {}, filename: 'plugin.zip' },
  ]

  describe.each(uploads)('the $name', ({ path, limit, fields, filename }) => {
    it('succeeds at the limit', async () => {
      const response = await http.request(path, { method: 'POST', body: multipart(limit, fields, filename) })
      expect(response.status).toBe(201)
    })

    it('answers 413 upload-too-large with the limit one byte over', async () => {
      const response = await http.request(path, { method: 'POST', body: multipart(limit + 1, fields, filename) })
      expect(response.status).toBe(413)
      expect(await response.json()).toEqual({
        statusCode: 413,
        code: 'upload-too-large',
        message: expect.any(String),
        details: { limitBytes: limit },
      })
    })
  })

  describe('the Webhook body', () => {
    const limit = UPLOAD_LIMITS.webhookBodyBytes
    const post = (body: string) => http.request('/api/webhook/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body })

    it('succeeds at the limit', async () => {
      expect((await post(jsonBody(limit))).status).toBe(201)
    })

    it('answers 413 one byte over, naming the limit', async () => {
      const response = await post(jsonBody(limit + 1))
      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({ statusCode: 413 })
    })
  })

  it('keeps the JSON limit of every other route at 100 KiB', async () => {
    const post = (bytes: number) => http.request('/api/plugins/import-github', { method: 'POST', headers: { 'content-type': 'application/json' }, body: jsonBody(bytes) })
    expect((await post(100 * 1024 + 1)).status).toBe(413)
  })
})
