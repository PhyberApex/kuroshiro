import type { ApiError, ConfigurationImportSummary, ImportCheck } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { PluginSchedulerService } from '../../plugins/services/plugin-scheduler.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import { CONFIGURATION_REDACTION_SENTINEL } from 'kuroshiro-shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Device } from '../../devices/devices.entity.js'
import { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { ConfigurationController } from '../configuration.controller.js'
import { CONFIG_SCHEMA_VERSION, PREVIOUS_CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { ConfigurationExportService } from '../services/configuration-export.service.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'
import { buildArchive, makeDeviceEntry } from './archive.js'

const KITCHEN = '11111111-1111-4111-8111-111111111111'
const HALLWAY = '22222222-2222-4222-8222-222222222222'
const WEATHER = '33333333-3333-4333-8333-333333333333'
const DOORBELL = '44444444-4444-4444-8444-444444444444'
const PHOTO_SCREEN = '55555555-5555-4555-8555-555555555555'
const FIRMWARE = '66666666-6666-4666-8666-666666666666'
const PALETTE = '77777777-7777-4777-8777-777777777777'
const UNKNOWN_PALETTE = '88888888-8888-4888-8888-888888888888'
const UNKNOWN_FIRMWARE = '99999999-9999-4999-8999-999999999999'
const NO_DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WEATHER_SOURCE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WEATHER_TEMPLATE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const DOORBELL_TEMPLATE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const WEATHER_KEY_FIELD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const WEATHER_ASSIGNMENT = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const EXPORTED_AT = '2026-09-28T19:14:00.000Z'

function manifest(overrides: Record<string, unknown> = {}) {
  return { kuroshiroVersion: '0.17.1', schemaVersion: CONFIG_SCHEMA_VERSION, exportedAt: EXPORTED_AT, containsSecrets: false, redacted: true, ...overrides }
}

function weatherEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: WEATHER,
    kind: 'Poll',
    mergeStrategy: null,
    streamLimit: null,
    webhookToken: null,
    sourceRecipeId: null,
    sourceRecipeSnapshot: null,
    dataSources: [{ id: WEATHER_SOURCE, name: 'forecast' }],
    templates: [{ id: WEATHER_TEMPLATE, layout: 'full' }],
    fields: [{ id: WEATHER_KEY_FIELD, keyname: 'api_key' }],
    fieldValues: { api_key: CONFIGURATION_REDACTION_SENTINEL, town: 'Berlin' },
    ...overrides,
  }
}

const WEATHER_FOLDER = {
  manifest: { name: 'Weather', description: '', custom_fields: [{ keyname: 'api_key', field_type: 'password', name: 'API key' }] },
  settings: { refresh_interval: 15, data_sources: [{ name: 'forecast', endpoint: 'https://api.example.com', method: 'GET', headers: { Authorization: CONFIGURATION_REDACTION_SENTINEL }, body: {} }] },
  templates: { full: 'Hello' },
}

const DOORBELL_ENTRY = {
  id: DOORBELL,
  kind: 'Webhook',
  mergeStrategy: 'deep_merge',
  streamLimit: null,
  webhookToken: CONFIGURATION_REDACTION_SENTINEL,
  sourceRecipeId: null,
  sourceRecipeSnapshot: null,
  dataSources: [],
  templates: [{ id: DOORBELL_TEMPLATE, layout: 'full' }],
  fields: [],
  fieldValues: {},
}

const DOORBELL_FOLDER = {
  manifest: { name: 'Doorbell note', description: '', custom_fields: [] },
  settings: { strategy: 'webhook' },
  templates: { full: 'Ring' },
}

/** A Redacted Archive that adds Hallway and two Plugins, overwrites Kitchen, and gives every warning a current archive can. */
function redactedArchive(): Buffer {
  return buildArchive({
    manifest: manifest(),
    palettes: [{ id: PALETTE, name: 'Warm red', kind: 'custom', grays: 2, colors: ['#000000', '#ffffff'], frameworkClass: 'screen--1bit', grayscaleBitDepth: 1, deprecated: false }],
    firmware: [{ id: FIRMWARE, version: '2.0.3', checksum: 'abc', compatibleModels: [], label: null, deprecated: false, uploadedAt: null }],
    plugins: [weatherEntry(), DOORBELL_ENTRY],
    pluginFolders: { [WEATHER]: WEATHER_FOLDER, [DOORBELL]: DOORBELL_FOLDER },
    devices: [
      makeDeviceEntry({ id: KITCHEN, name: 'Kitchen', friendlyId: 'KITCHN', mac: 'AA:BB:CC:00:00:01', apikey: CONFIGURATION_REDACTION_SENTINEL }),
      makeDeviceEntry({
        id: HALLWAY,
        name: 'Hallway',
        friendlyId: 'HALLWY',
        mac: 'AA:BB:CC:00:00:02',
        apikey: CONFIGURATION_REDACTION_SENTINEL,
        mirrorEnabled: true,
        mirrorMac: 'AA:BB:CC:00:00:03',
        mirrorApikey: CONFIGURATION_REDACTION_SENTINEL,
        deviceModelName: 'inky_impression_99',
        paletteId: UNKNOWN_PALETTE,
        targetFirmwareId: UNKNOWN_FIRMWARE,
      }),
    ],
    assignments: [{ id: WEATHER_ASSIGNMENT, deviceId: HALLWAY, pluginId: WEATHER, order: 1, isActive: true }],
    screens: [{
      id: PHOTO_SCREEN,
      deviceId: HALLWAY,
      type: 'file',
      order: 1,
      filename: 'Photo',
      externalLink: null,
      html: null,
      fetchManual: false,
      pluginId: null,
      devicePluginId: null,
      schedule: null,
      mashupConfiguration: null,
    }],
    screenImages: { [PHOTO_SCREEN]: 'png-bytes' },
    settings: { lowBatteryPercent: 15, firmwareAutoUpdate: true },
  })
}

const hallway = { id: HALLWAY, name: 'Hallway' }
const weather = { id: WEATHER, name: 'Weather' }

const REDACTED_ARCHIVE_WARNINGS = [
  { kind: 'firmware-file-missing', firmware: { id: FIRMWARE, version: '2.0.3' } },
  { kind: 'header-redacted', plugin: weather, dataSource: 'forecast', header: 'Authorization' },
  { kind: 'field-value-redacted', plugin: weather, keyname: 'api_key', label: 'API key' },
  { kind: 'field-value-without-field', plugin: weather, keyname: 'town' },
  { kind: 'webhook-token-redacted', plugin: { id: DOORBELL, name: 'Doorbell note' } },
  { kind: 'device-apikey-redacted', device: hallway },
  { kind: 'device-model-unknown', device: hallway, deviceModel: 'inky_impression_99' },
  { kind: 'palette-unknown', device: hallway, paletteId: UNKNOWN_PALETTE },
  { kind: 'mirror-apikey-redacted', device: hallway },
  { kind: 'firmware-unknown', device: hallway, firmwareId: UNKNOWN_FIRMWARE },
]

function upload(bytes: Buffer, filename = 'kuroshiro-config.zip'): RequestInit {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(bytes)]), filename)
  return { method: 'POST', body: form }
}

describe('reading and importing a Configuration Archive, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  const writeFile = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined)
  const mkdir = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined)
  const scheduler = { schedulePlugin: vi.fn() }

  beforeAll(async () => {
    database = await createTestDatabase()
    http = await createHttpTestApp({
      controllers: [ConfigurationController],
      providers: [
        { provide: ConfigurationExportService, useValue: {} },
        { provide: ConfigurationImportService, useValue: new ConfigurationImportService(database.getRepository(Plugin), new PluginImporterService(), scheduler as unknown as PluginSchedulerService) },
      ],
    })
  })

  beforeEach(async () => {
    await database.synchronize(true)
    writeFile.mockClear()
    mkdir.mockClear()
    scheduler.schedulePlugin.mockClear()
    await database.getRepository(Device).save({ id: KITCHEN, name: 'Kitchen', friendlyId: 'KITCHN', mac: 'AA:BB:CC:00:00:01', apikey: 'kitchen-key' })
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
    vi.restoreAllMocks()
  })

  /** Every row of every table, so that two readings are equal only when nothing at all changed. */
  async function everyRow(): Promise<Record<string, unknown[]>> {
    const tables = database.entityMetadatas.map(metadata => metadata.tableName).sort()
    const rows = await Promise.all(tables.map(table => database.query(`SELECT * FROM "${table}" ORDER BY 1`)))
    return Object.fromEntries(tables.map((table, index) => [table, rows[index]]))
  }

  it('reads what an archive would do without changing the database or the storage folder, and the import then answers the same counts and warnings', async () => {
    const before = await everyRow()

    const checked = await http.request('/api/config/import/check', upload(redactedArchive()))

    expect(checked.status).toBe(200)
    const check = await checked.json() as ImportCheck
    expect(check).toEqual({
      archive: { kuroshiroVersion: '0.17.1', exportedAt: EXPORTED_AT, schemaVersion: CONFIG_SCHEMA_VERSION, redacted: true },
      adds: { palettes: 1, firmware: 1, plugins: 2, dataSources: 1, templates: 2, fields: 1, devices: 1, assignments: 1, screens: 1 },
      overwrites: { devices: 1 },
      devices: { added: [hallway], overwritten: [{ id: KITCHEN, name: 'Kitchen' }] },
      settings: { overridden: 2 },
      warnings: REDACTED_ARCHIVE_WARNINGS,
    })
    expect(await everyRow()).toEqual(before)
    expect(writeFile).not.toHaveBeenCalled()
    expect(mkdir).not.toHaveBeenCalled()

    const imported = await http.request('/api/config/import', upload(redactedArchive()))

    expect(imported.status).toBe(201)
    expect(await imported.json() as ConfigurationImportSummary).toEqual({ created: check.adds, updated: check.overwrites, warnings: check.warnings })
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining(`${PHOTO_SCREEN}.png`), Buffer.from('png-bytes'))
    expect(await database.getRepository(Device).countBy({})).toBe(2)
  })

  it('counts a Device re-attached by its MAC address as overwritten, under the id it has here', async () => {
    const archive = buildArchive({ manifest: manifest(), devices: [makeDeviceEntry({ id: HALLWAY, name: 'Kitchen restored', friendlyId: 'KITCHN', mac: 'AA:BB:CC:00:00:01' })] })

    const check = await (await http.request('/api/config/import/check', upload(archive))).json() as ImportCheck

    expect(check.devices).toEqual({ added: [], overwritten: [{ id: KITCHEN, name: 'Kitchen restored' }] })
    expect(check.archive.redacted).toBe(true)
  })

  it('names a Plugin of a previous-version archive whose Plugin Variables or per-Assignment Field Values are dropped', async () => {
    const archive = buildArchive({
      manifest: manifest({ schemaVersion: PREVIOUS_CONFIG_SCHEMA_VERSION, redacted: undefined, containsSecrets: true }),
      plugins: [
        weatherEntry({ fieldValues: undefined, variables: [{ key: 'unit', value: 'metric' }] }),
        { ...DOORBELL_ENTRY, webhookToken: 'doorbell-token', fieldValues: undefined },
      ],
      pluginFolders: { [WEATHER]: { ...WEATHER_FOLDER, settings: { refresh_interval: 15, data_sources: [] } }, [DOORBELL]: DOORBELL_FOLDER },
      devices: [makeDeviceEntry({ id: KITCHEN, name: 'Kitchen', friendlyId: 'KITCHN', mac: 'AA:BB:CC:00:00:01' })],
      assignments: [{ id: WEATHER_ASSIGNMENT, deviceId: KITCHEN, pluginId: DOORBELL, order: 1, isActive: true, fieldValues: [{ fieldId: 'x', value: 'y' }] }],
    })

    const imported = await http.request('/api/config/import', upload(archive))

    expect(imported.status).toBe(201)
    expect((await imported.json() as ConfigurationImportSummary).warnings).toEqual([
      { kind: 'previous-version-values-dropped', plugin: weather },
      { kind: 'previous-version-values-dropped', plugin: { id: DOORBELL, name: 'Doorbell note' } },
    ])
  })

  describe.each(['/api/config/import', '/api/config/import/check'])('%s refuses', (path) => {
    async function refused(bytes: Buffer): Promise<ApiError> {
      const before = await everyRow()
      const response = await http.request(path, upload(bytes))
      const refusal = await response.json() as ApiError
      expect(refusal.statusCode).toBe(response.status)
      expect(await everyRow()).toEqual(before)
      expect(writeFile).not.toHaveBeenCalled()
      return refusal
    }

    it('a file that is not a zip', async () => {
      expect(await refused(Buffer.from('just some text'))).toMatchObject({ statusCode: 400, code: 'archive-not-zip' })
    })

    it('a zip without a manifest', async () => {
      expect(await refused(buildArchive({ manifest: null }))).toMatchObject({ statusCode: 400, code: 'archive-not-configuration' })
    })

    it('a zip whose manifest or lists cannot be read', async () => {
      expect(await refused(buildArchive({ manifest: manifest(), devices: 'none' as unknown as unknown[] }))).toMatchObject({ statusCode: 400, code: 'archive-not-configuration' })
      expect(await refused(buildArchive({ manifest: manifest(), settings: null }))).toMatchObject({ statusCode: 400, code: 'archive-not-configuration' })
    })

    it('another archive version, naming both', async () => {
      expect(await refused(buildArchive({ manifest: manifest({ schemaVersion: 1 }) }))).toMatchObject({
        statusCode: 400,
        code: 'archive-schema-version',
        details: { archive: 1, expected: CONFIG_SCHEMA_VERSION },
      })
    })

    it('a record the database refuses, naming it', async () => {
      const archive = buildArchive({
        manifest: manifest(),
        screens: [{ id: PHOTO_SCREEN, deviceId: NO_DEVICE, type: 'html', order: 1, filename: 'Note', externalLink: null, html: '<p>Hi</p>', fetchManual: false, pluginId: null, devicePluginId: null, schedule: null, mashupConfiguration: null }],
      })

      const refusal = await refused(archive)

      expect(refusal).toMatchObject({ statusCode: 422, code: 'archive-record-refused', details: { entity: 'Screen', id: PHOTO_SCREEN } })
      expect(refusal.details?.reason).toEqual(expect.any(String))
    })

    it('a Webhook Token another Plugin here already has', async () => {
      await database.getRepository(Plugin).save({ name: 'Other', kind: 'Webhook', webhookToken: 'taken-token' })
      const archive = buildArchive({
        manifest: manifest(),
        plugins: [{ ...DOORBELL_ENTRY, webhookToken: 'taken-token' }],
        pluginFolders: { [DOORBELL]: DOORBELL_FOLDER },
      })

      expect(await refused(archive)).toMatchObject({ statusCode: 422, code: 'archive-record-refused', details: { entity: 'Plugin', id: DOORBELL } })
    })

    it('a list that holds something other than records', async () => {
      expect(await refused(buildArchive({ manifest: manifest(), devices: [null] }))).toMatchObject({ statusCode: 400, code: 'archive-not-configuration' })
    })

    it('an upload without a file', async () => {
      const response = await http.request(path, { method: 'POST', body: new FormData() })

      expect(response.status).toBe(400)
    })
  })

  it('keeps what is here when a redacted secret already has a value, without a warning', async () => {
    await http.request('/api/config/import', upload(redactedArchive()))
    await database.getRepository(PluginDataSource).update({ id: WEATHER_SOURCE }, { headers: { Authorization: 'Bearer kept' } })

    const check = await (await http.request('/api/config/import/check', upload(redactedArchive()))).json() as ImportCheck

    expect(check.warnings.map(warning => warning.kind)).not.toContain('header-redacted')
    expect(check.warnings.map(warning => warning.kind)).not.toContain('device-apikey-redacted')
    expect(check.adds).toEqual({})
  })

  it('hands every Plugin an import creates or updates to the scheduler once it commits, but never on a check', async () => {
    const checked = await http.request('/api/config/import/check', upload(redactedArchive()))
    expect(checked.status).toBe(200)
    expect(scheduler.schedulePlugin).not.toHaveBeenCalled()

    const imported = await http.request('/api/config/import', upload(redactedArchive()))

    expect(imported.status).toBe(201)
    expect(scheduler.schedulePlugin).toHaveBeenCalledTimes(2)
    const scheduledById = new Map(scheduler.schedulePlugin.mock.calls.map(call => [(call[0] as { id: string }).id, call[0] as { dataSources: unknown[] }]))
    expect([...scheduledById.keys()].sort()).toEqual([DOORBELL, WEATHER].sort())
    // The scheduler's timer closes over this exact object for every future tick, so it must carry the relations a tick reads, not just the bare row `save` returns.
    expect(scheduledById.get(WEATHER)?.dataSources).toEqual([expect.objectContaining({ id: WEATHER_SOURCE, name: 'forecast' })])
  })
})
