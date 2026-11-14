import type { HttpTestApp, TestRequestInit } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConfigurationController } from '../../configuration/configuration.controller.js'
import { ConfigurationExportService } from '../../configuration/services/configuration-export.service.js'
import { ConfigurationImportService } from '../../configuration/services/configuration-import.service.js'
import { FirmwareAutoUpdateService } from '../../firmware/firmware-auto-update.service.js'
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

const BOUNDARY = 'kuroshiro-upload-limits'
const PADDING = new Uint8Array(64 * 1024)
const encoder = new TextEncoder()

function* multipartParts(bytes: number, fields: Record<string, string>, filename: string): Generator<Uint8Array> {
  for (const [name, value] of Object.entries(fields))
    yield encoder.encode(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
  yield encoder.encode(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`)
  for (let left = bytes; left > 0; left -= PADDING.length)
    yield left < PADDING.length ? PADDING.subarray(0, left) : PADDING
  yield encoder.encode(`\r\n--${BOUNDARY}--\r\n`)
}

/**
 * The ceilings reach a quarter of a gigabyte, and a `FormData` carrying a `Blob` that
 * size costs several times the body in memory to build and to post, which on a loaded
 * runner is enough to lose the connection mid-upload. The padding is generated as the
 * request goes out, so the body never exists all at once.
 */
function multipart(bytes: number, fields: Record<string, string> = {}, filename = 'upload.bin'): TestRequestInit {
  const parts = multipartParts(bytes, fields, filename)
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    body: new ReadableStream({
      pull(controller) {
        const part = parts.next()
        if (part.done)
          controller.close()
        else
          controller.enqueue(part.value)
      },
    }),
    duplex: 'half',
  }
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
        { provide: ScreensService, useValue: { add: async () => 'screen-id', replaceImage: async () => 'screen-id', previewImage: async () => Buffer.from('png') } },
        { provide: ScreenReadsService, useValue: { forScreen: async () => answered } },
        { provide: FirmwareService, useValue: { upload: async () => ({ id: 'firmware-id' }) } },
        { provide: FirmwareReadsService, useValue: { readById: async () => answered } },
        { provide: FirmwareSyncService, useValue: {} },
        { provide: FirmwareAutoUpdateService, useValue: {} },
        { provide: ConfigurationExportService, useValue: {} },
        { provide: ConfigurationImportService, useValue: { importFromZip: async () => answered, checkZip: async () => answered } },
        { provide: PluginsService, useValue: { createOnDevice: async () => 'plugin-id' } },
        { provide: PluginReadsService, useValue: { detail: async () => answered } },
        { provide: PluginPreviewDataService, useValue: {} },
        { provide: PluginAssignmentsService, useValue: {} },
        { provide: PluginImporterService, useValue: { importFromUpload: () => ({ plugin: { name: 'Imported', dataSources: [] }, fileName: 'plugin.zip' }) } },
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

  const uploads: { name: string, path: string, method?: string, status?: number, limit: number, fields: Record<string, string>, filename: string }[] = [
    { name: 'image upload', path: '/api/screens', limit: UPLOAD_LIMITS.imageUploadBytes, fields: { deviceId: DEVICE_ID, kind: 'file', name: 'Photo' }, filename: 'photo.png' },
    { name: 'image replacement', path: '/api/screens/screen-id/image', method: 'PUT', status: 200, limit: UPLOAD_LIMITS.imageUploadBytes, fields: {}, filename: 'photo.png' },
    { name: 'image preview', path: '/api/screens/screen-id/image-preview', status: 200, limit: UPLOAD_LIMITS.imageUploadBytes, fields: {}, filename: 'photo.png' },
    { name: 'firmware upload', path: '/api/firmware/upload', limit: UPLOAD_LIMITS.firmwareUploadBytes, fields: { version: '1.0.0' }, filename: 'firmware.bin' },
    { name: 'archive upload', path: '/api/config/import', limit: UPLOAD_LIMITS.archiveUploadBytes, fields: {}, filename: 'archive.zip' },
    { name: 'archive check', path: '/api/config/import/check', status: 200, limit: UPLOAD_LIMITS.archiveUploadBytes, fields: {}, filename: 'archive.zip' },
    { name: 'plugin import', path: '/api/plugins/import', limit: UPLOAD_LIMITS.pluginImportBytes, fields: {}, filename: 'plugin.zip' },
  ]

  describe.each(uploads)('the $name', ({ path, method = 'POST', status = 201, limit, fields, filename }) => {
    it('succeeds at the limit', async () => {
      const response = await http.request(path, { method, ...multipart(limit, fields, filename) })
      expect(response.status).toBe(status)
    })

    it('answers 413 upload-too-large with the limit one byte over', async () => {
      const response = await http.request(path, { method, ...multipart(limit + 1, fields, filename) })
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
