import type { Repository } from 'typeorm'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { PluginSchedulerService } from '../../plugins/services/plugin-scheduler.service.js'
import { Buffer } from 'node:buffer'
import { CONFIGURATION_REDACTION_SENTINEL } from 'kuroshiro-shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'
import { buildArchive, makeDeviceEntry } from './archive.js'

const { fsMock } = vi.hoisted(() => ({
  fsMock: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('node:fs', () => ({
  promises: fsMock,
}))

const ENTITY_NAMES = [
  'Palette',
  'Firmware',
  'Plugin',
  'PluginDataSource',
  'PluginTemplate',
  'PluginField',
  'Device',
  'DeviceModel',
  'DevicePlugin',
  'PluginFieldValue',
  'Screen',
  'Schedule',
  'MashupConfiguration',
  'MashupSlot',
  'InstanceSettings',
] as const

/**
 * A fake `EntityManager` good enough to exercise the whole-transaction upsert logic:
 * each entity gets its own in-memory table (so `findOneBy` sees rows an earlier
 * `save` in the same test made), and `transaction()` snapshots every table before
 * running the callback and restores the snapshot if the callback throws — mirroring
 * the real rollback a Postgres transaction gives `manager.transaction()` in production.
 */
type FakeRow = Record<string, unknown> & { id?: string }

function isRelationReference(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && 'id' in value
}

function createFakeManager() {
  const backing = new Map<string, Map<string, FakeRow>>()
  for (const name of ENTITY_NAMES) backing.set(name, new Map())

  let idCounter = 0

  function makeRepo(name: string) {
    const table = backing.get(name)!
    return {
      findOneBy: vi.fn(async (where: Record<string, unknown>) => {
        for (const row of table.values()) {
          if (Object.entries(where).every(([key, value]) => isRelationReference(value) ? (row[key] as { id?: string } | undefined)?.id === value.id : row[key] === value)) {
            return { ...row }
          }
        }
        return null
      }),
      // Only the `{ relation: { id } }` shape the import looks a Field Value up by.
      findOne: vi.fn(async ({ where }: { where: Record<string, { id: string }> }) => {
        for (const row of table.values()) {
          if (Object.entries(where).every(([key, value]) => (row[key] as { id?: string } | undefined)?.id === value.id)) {
            return { ...row }
          }
        }
        return null
      }),
      create: vi.fn((partial: FakeRow = {}) => ({ ...partial })),
      save: vi.fn(async (entity: FakeRow) => {
        const id = entity.id ?? `generated-${name}-${idCounter++}`
        const saved = { ...entity, id }
        table.set(id, saved)
        return saved
      }),
      // Only the `{ relation: { id } }` shape the import deletes a Field Value by.
      delete: vi.fn(async (where: Record<string, unknown>) => {
        for (const [id, row] of [...table.entries()]) {
          if (Object.entries(where).every(([key, value]) => isRelationReference(value) ? (row[key] as { id?: string } | undefined)?.id === value.id : row[key] === value)) {
            table.delete(id)
          }
        }
      }),
    }
  }

  const repoByName = Object.fromEntries(ENTITY_NAMES.map(name => [name, makeRepo(name)])) as Record<string, ReturnType<typeof makeRepo>>

  const manager: { getRepository: ReturnType<typeof vi.fn>, transaction: ReturnType<typeof vi.fn> } = {
    getRepository: vi.fn((target: { name: string }) => repoByName[target.name]),
    transaction: vi.fn(async (cb: (manager: unknown) => Promise<void>) => {
      const snapshot = new Map([...backing.entries()].map(([key, value]) => [key, new Map(value)]))
      try {
        await cb(manager)
      }
      catch (err) {
        backing.clear()
        for (const [key, value] of snapshot) backing.set(key, value)
        throw err
      }
    }),
  }

  return { manager, backing, repoByName }
}

describe('configurationImportService', () => {
  let manager: ReturnType<typeof createFakeManager>['manager']
  let backing: ReturnType<typeof createFakeManager>['backing']
  let service: ConfigurationImportService
  let scheduler: { schedulePlugin: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    fsMock.mkdir.mockReset().mockResolvedValue(undefined)
    fsMock.writeFile.mockReset().mockResolvedValue(undefined)

    const fake = createFakeManager()
    manager = fake.manager
    backing = fake.backing
    // Mirrors the real Repository#findOne enough to reload a Plugin with its Data Sources and Templates, the way the service does before scheduling it.
    const findOne = vi.fn(async ({ where, relations }: { where: { id: string }, relations?: Record<string, boolean> }) => {
      const row = backing.get('Plugin')!.get(where.id)
      if (!row) {
        return null
      }
      const plugin: FakeRow = { ...row }
      if (relations?.dataSources) {
        plugin.dataSources = [...backing.get('PluginDataSource')!.values()].filter(ds => (ds.plugin as { id?: string } | undefined)?.id === where.id)
      }
      if (relations?.templates) {
        plugin.templates = [...backing.get('PluginTemplate')!.values()].filter(t => (t.plugin as { id?: string } | undefined)?.id === where.id)
      }
      return plugin
    })
    const pluginRepository = { manager, findOne } as unknown as Repository<Plugin>
    scheduler = { schedulePlugin: vi.fn() }
    service = new ConfigurationImportService(pluginRepository, new PluginImporterService(), scheduler as unknown as PluginSchedulerService)
  })

  it('rejects an archive with no manifest.json, without starting a transaction', async () => {
    const buffer = buildArchive({ manifest: null })

    await expect(service.importFromZip(buffer)).rejects.toThrow(/manifest\.json/)
    expect(manager.transaction).not.toHaveBeenCalled()
  })

  it('rejects an archive whose schemaVersion does not match, naming both versions, without starting a transaction', async () => {
    const buffer = buildArchive({
      manifest: { kuroshiroVersion: '0.13.0', schemaVersion: CONFIG_SCHEMA_VERSION + 1, exportedAt: new Date().toISOString(), containsSecrets: true },
    })

    await expect(service.importFromZip(buffer)).rejects.toThrow(
      new RegExp(`${CONFIG_SCHEMA_VERSION + 1}.*${CONFIG_SCHEMA_VERSION}`),
    )
    expect(manager.transaction).not.toHaveBeenCalled()
  })

  it.each([
    ['0', { schemaVersion: 0 }],
    ['missing', {}],
  ])('rejects an archive whose schemaVersion is %s, without starting a transaction', async (_label, version) => {
    const buffer = buildArchive({
      manifest: { kuroshiroVersion: '0.13.0', exportedAt: new Date().toISOString(), containsSecrets: true, ...version },
    })

    await expect(service.importFromZip(buffer)).rejects.toMatchObject({ code: 'archive-schema-version' })
    expect(manager.transaction).not.toHaveBeenCalled()
  })

  it('imports every entity on a fresh instance, then makes no changes on a second import of the same archive', async () => {
    const buffer = buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [{ id: 'ds-1', name: 'source' }],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: {
        'plugin-1': {
          manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
          settings: { refresh_interval: 15, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: {}, body: {} }] },
          templates: { full: 'Hello' },
        },
      },
      devices: [makeDeviceEntry()],
      screens: [{
        id: 'screen-1',
        deviceId: 'device-1',
        type: 'plugin',
        order: 1,
        filename: null,
        externalLink: null,
        html: null,
        fetchManual: false,
        pluginId: 'plugin-1',
        devicePluginId: 'dp-1',
        schedule: null,
        mashupConfiguration: null,
      }],
      assignments: [{ id: 'dp-1', deviceId: 'device-1', pluginId: 'plugin-1', order: 0, isActive: true }],
    })

    const first = await service.importFromZip(buffer)
    expect(first.created).toEqual({ devices: 1, plugins: 1, dataSources: 1, templates: 1, assignments: 1, screens: 1 })
    expect(first.updated).toEqual({})

    const second = await service.importFromZip(buffer)
    expect(second.created).toEqual({})
    expect(second.updated).toEqual({ devices: 1, plugins: 1, dataSources: 1, templates: 1, assignments: 1, screens: 1 })

    expect(backing.get('Device')!.size).toBe(1)
    expect(backing.get('Plugin')!.size).toBe(1)
    expect(backing.get('Screen')!.size).toBe(1)
  })

  it('replaces the stored Template of a size whose id is not the archive\'s, keeping one Template per size', async () => {
    const archiveWithTemplate = (templateId: string, markup: string) => buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [{ id: 'ds-1', name: 'source' }],
        templates: [{ id: templateId, layout: 'full' }],
        fields: [],
      }],
      pluginFolders: {
        'plugin-1': {
          manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
          settings: { refresh_interval: 15, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: {}, body: {} }] },
          templates: { full: markup },
        },
      },
    })
    await service.importFromZip(archiveWithTemplate('tpl-stored', 'Stored'))

    const result = await service.importFromZip(archiveWithTemplate('tpl-archive', 'From the archive'))

    expect(result.updated).toMatchObject({ templates: 1 })
    expect([...backing.get('PluginTemplate')!.values()]).toEqual([expect.objectContaining({ id: 'tpl-stored', layout: 'full', liquidMarkup: 'From the archive' })])
  })

  it('restores the Recipe Snapshot from the manifest entry, and falls back to null when an archive predates it', async () => {
    const snapshot = { name: 'Daily Weather', kind: 'Poll', refreshInterval: 30, dataSources: [], templates: [], fields: [], sourceRecipeId: '150460' }
    const pluginFolders = {
      'plugin-1': {
        manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
        settings: { refresh_interval: 15, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: {}, body: {} }] },
        templates: { full: 'Hello' },
      },
    }

    const withSnapshot = buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: '150460',
        sourceRecipeSnapshot: snapshot,
        dataSources: [{ id: 'ds-1', name: 'source' }],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders,
    })

    await service.importFromZip(withSnapshot)
    expect(backing.get('Plugin')!.get('plugin-1')!.sourceRecipeSnapshot).toEqual(snapshot)

    const withoutSnapshotField = buildArchive({
      plugins: [{
        id: 'plugin-2',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [{ id: 'ds-2', name: 'source' }],
        templates: [{ id: 'tpl-2', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: { 'plugin-2': pluginFolders['plugin-1'] },
    })

    await service.importFromZip(withoutSnapshotField)
    expect(backing.get('Plugin')!.get('plugin-2')!.sourceRecipeSnapshot).toBeNull()
  })

  it('re-attaches to an existing Device by mac instead of creating a duplicate, remapping Screen references onto it, and keeps the existing apikey so the hardware stays authenticated', async () => {
    backing.get('Device')!.set('existing-device-1', {
      id: 'existing-device-1',
      name: 'Old Name',
      friendlyId: 'OLD1',
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'old-key',
      refreshRate: 300,
      sleepModeEnabled: false,
      sleepScreenEnabled: false,
    })

    const buffer = buildArchive({
      devices: [makeDeviceEntry({ id: 'device-2', name: 'New Name', friendlyId: 'NEW1', apikey: 'new-key' })],
      screens: [{
        id: 'screen-1',
        deviceId: 'device-2',
        type: 'html',
        order: 1,
        filename: null,
        externalLink: null,
        html: '<p>hi</p>',
        fetchManual: false,
        pluginId: null,
        devicePluginId: null,
        schedule: null,
        mashupConfiguration: null,
      }],
    })

    const summary = await service.importFromZip(buffer)

    const deviceRows = [...backing.get('Device')!.values()]
    expect(deviceRows).toHaveLength(1)
    expect(deviceRows[0].id).toBe('existing-device-1')
    expect(deviceRows[0].apikey).toBe('old-key')
    expect(summary.updated.devices).toBe(1)

    const screenRows = [...backing.get('Screen')!.values()]
    expect((screenRows[0].device as { id: string }).id).toBe('existing-device-1')
    expect(summary.created.screens).toBe(1)
  })

  it('rolls back the entire import when a later entity fails, leaving previously-processed rows from this import undone', async () => {
    backing.get('Plugin')!.set('existing-plugin', {
      id: 'existing-plugin',
      name: 'Existing',
      kind: 'Webhook',
      webhookToken: 'shared-token',
      refreshInterval: 15,
    })

    const buffer = buildArchive({
      plugins: [
        {
          id: 'plugin-A',
          kind: 'Webhook',
          mergeStrategy: 'standard',
          streamLimit: null,
          webhookToken: 'token-A',
          sourceRecipeId: null,
          dataSources: [],
          templates: [{ id: 'tpl-A', layout: 'full' }],
          fields: [],
        },
        {
          id: 'plugin-B',
          kind: 'Webhook',
          mergeStrategy: 'standard',
          streamLimit: null,
          webhookToken: 'shared-token',
          sourceRecipeId: null,
          dataSources: [],
          templates: [{ id: 'tpl-B', layout: 'full' }],
          fields: [],
        },
      ],
      pluginFolders: {
        'plugin-A': { manifest: { name: 'A', custom_fields: [] }, templates: { full: 'A content' } },
        'plugin-B': { manifest: { name: 'B', custom_fields: [] }, templates: { full: 'B content' } },
      },
    })

    await expect(service.importFromZip(buffer)).rejects.toThrow(/Webhook Token/)

    const pluginIds = [...backing.get('Plugin')!.values()].map(row => row.id).sort()
    expect(pluginIds).toEqual(['existing-plugin'])
  })

  it('imports a Plugin whose src/settings.yml has no Data Sources: a Webhook-kind Plugin, and a Poll-kind Plugin that lists none', async () => {
    const entry = { sourceRecipeId: null, dataSources: [], fields: [] }
    const buffer = buildArchive({
      plugins: [
        { ...entry, id: 'plugin-webhook', kind: 'Webhook', mergeStrategy: 'stream', streamLimit: 12, webhookToken: 'token-A', templates: [{ id: 'tpl-A', layout: 'full' }] },
        { ...entry, id: 'plugin-poll', kind: 'Poll', mergeStrategy: null, streamLimit: null, webhookToken: null, templates: [{ id: 'tpl-B', layout: 'full' }] },
      ],
      pluginFolders: {
        'plugin-webhook': { manifest: { name: 'Doorbell', custom_fields: [] }, settings: { strategy: 'webhook', merge_strategy: 'stream', stream_limit: 12 }, templates: { full: 'A content' } },
        'plugin-poll': { manifest: { name: 'Clock', custom_fields: [] }, settings: { strategy: 'polling', refresh_interval: 30, data_sources: [] }, templates: { full: 'B content' } },
      },
    })

    const summary = await service.importFromZip(buffer)

    expect(summary.created.plugins).toBe(2)
    expect(backing.get('Plugin')!.get('plugin-poll')).toMatchObject({ name: 'Clock', kind: 'Poll', refreshInterval: 30 })
    expect(backing.get('Plugin')!.get('plugin-webhook')).toMatchObject({ name: 'Doorbell', kind: 'Webhook', mergeStrategy: 'stream', streamLimit: 12 })
  })

  it('resolves an unknown Device Model, Palette, or Firmware reference to null with a warning instead of failing', async () => {
    const buffer = buildArchive({
      devices: [makeDeviceEntry({ deviceModelName: 'missing_model', paletteId: 'missing-palette', targetFirmwareId: 'missing-firmware' })],
    })

    const summary = await service.importFromZip(buffer)

    const device = { id: 'device-1', name: 'Device 1' }
    expect(summary.warnings).toEqual([
      { kind: 'device-model-unknown', device, deviceModel: 'missing_model' },
      { kind: 'palette-unknown', device, paletteId: 'missing-palette' },
      { kind: 'firmware-unknown', device, firmwareId: 'missing-firmware' },
    ])

    const deviceRows = [...backing.get('Device')!.values()]
    expect(deviceRows[0].deviceModel).toBeNull()
    expect(deviceRows[0].palette).toBeNull()
    expect(deviceRows[0].targetFirmware).toBeNull()
  })

  it('rejects an archive with no settings.json', async () => {
    const buffer = buildArchive({ settings: null })

    await expect(service.importFromZip(buffer)).rejects.toThrow(/settings\.json/)
  })

  it('imports overridden Settings onto a fresh instance and is idempotent on a second import', async () => {
    const buffer = buildArchive({ settings: { lowBatteryPercent: 15, fetchFailureThreshold: 5 } })

    await service.importFromZip(buffer)
    const settingsRows = [...backing.get('InstanceSettings')!.values()]
    expect(settingsRows).toEqual([{ id: 1, lowBatteryPercent: 15, offlineMultiplier: null, fetchFailureThreshold: 5, alertRetentionDays: null, deviceLogRetentionDays: null, firmwareAutoUpdate: null }])

    await service.importFromZip(buffer)
    expect([...backing.get('InstanceSettings')!.values()]).toEqual([{ id: 1, lowBatteryPercent: 15, offlineMultiplier: null, fetchFailureThreshold: 5, alertRetentionDays: null, deviceLogRetentionDays: null, firmwareAutoUpdate: null }])
  })

  it('clears an existing override for a Setting absent from the archive', async () => {
    backing.get('InstanceSettings')!.set(1 as unknown as string, { id: 1 as unknown as string, lowBatteryPercent: 15, offlineMultiplier: 5, fetchFailureThreshold: 5, firmwareAutoUpdate: true })

    const buffer = buildArchive({ settings: { lowBatteryPercent: 15 } })
    await service.importFromZip(buffer)

    const settingsRows = [...backing.get('InstanceSettings')!.values()]
    expect(settingsRows).toEqual([{ id: 1, lowBatteryPercent: 15, offlineMultiplier: null, fetchFailureThreshold: null, alertRetentionDays: null, deviceLogRetentionDays: null, firmwareAutoUpdate: null }])
  })

  it('imports an overridden firmwareAutoUpdate and clears it when absent from the archive', async () => {
    const buffer = buildArchive({ settings: { firmwareAutoUpdate: true } })

    await service.importFromZip(buffer)
    expect([...backing.get('InstanceSettings')!.values()]).toEqual([{ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, alertRetentionDays: null, deviceLogRetentionDays: null, firmwareAutoUpdate: true }])

    await service.importFromZip(buildArchive({ settings: {} }))
    expect([...backing.get('InstanceSettings')!.values()]).toEqual([{ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, alertRetentionDays: null, deviceLogRetentionDays: null, firmwareAutoUpdate: null }])
  })

  it('imports an overridden Retention age, 0 included, and clears the one absent from the archive', async () => {
    backing.get('InstanceSettings')!.set(1 as unknown as string, { id: 1 as unknown as string, alertRetentionDays: 7, deviceLogRetentionDays: 3 })

    await service.importFromZip(buildArchive({ settings: { alertRetentionDays: 0 } }))

    expect([...backing.get('InstanceSettings')!.values()]).toEqual([{ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, alertRetentionDays: 0, deviceLogRetentionDays: null, firmwareAutoUpdate: null }])
  })

  describe('an Instance Setting that violates SETTING_BOUNDS', () => {
    it('refuses a negative Retention age, naming the key, with nothing written', async () => {
      const buffer = buildArchive({ settings: { alertRetentionDays: -5 } })

      await expect(service.importFromZip(buffer)).rejects.toMatchObject({
        code: 'archive-record-refused',
        details: { entity: 'Instance Settings', id: null, reason: expect.stringContaining('alertRetentionDays') },
      })
      expect(backing.get('InstanceSettings')!.size).toBe(0)
    })

    it.each([
      ['lowBatteryPercent', 101],
      ['offlineMultiplier', 1],
      ['fetchFailureThreshold', 1.5],
      ['deviceLogRetentionDays', '30'],
      ['firmwareAutoUpdate', 'yes'],
    ])('refuses %s of %j, naming the key', async (key, value) => {
      const buffer = buildArchive({ settings: { [key]: value } })

      await expect(service.importFromZip(buffer)).rejects.toMatchObject({
        code: 'archive-record-refused',
        details: { entity: 'Instance Settings', id: null, reason: expect.stringContaining(key) },
      })
    })

    it('rolls back every other record the same import wrote', async () => {
      const buffer = buildArchive({
        palettes: [{ id: 'palette-1', name: 'Warm red', kind: 'custom', grays: 2, colors: ['#000000'], frameworkClass: 'screen--1bit', grayscaleBitDepth: 1, deprecated: false }],
        settings: { alertRetentionDays: -5 },
      })

      await expect(service.importFromZip(buffer)).rejects.toThrow(/alertRetentionDays/)

      expect(backing.get('Palette')!.size).toBe(0)
    })
  })

  it('keeps a Data Source\'s existing header value when the archive holds the sentinel and a value exists, with no warning', async () => {
    backing.get('Plugin')!.set('plugin-1', { id: 'plugin-1', name: 'Test Plugin', kind: 'Poll', refreshInterval: 15 })
    backing.get('PluginDataSource')!.set('ds-1', { id: 'ds-1', name: 'source', headers: { Authorization: 'Bearer real-token' } })

    const buffer = buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [{ id: 'ds-1', name: 'source' }],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: {
        'plugin-1': {
          manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
          settings: { refresh_interval: 15, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: { Authorization: CONFIGURATION_REDACTION_SENTINEL }, body: {} }] },
          templates: { full: 'Hello' },
        },
      },
    })

    const summary = await service.importFromZip(buffer)

    const dataSource = [...backing.get('PluginDataSource')!.values()].find(row => row.id === 'ds-1')
    expect(dataSource!.headers).toEqual({ Authorization: 'Bearer real-token' })
    expect(summary.warnings).toEqual([])
  })

  it('drops a header and warns when the archive holds the sentinel with no existing value to keep, leaving other headers untouched', async () => {
    const buffer = buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [{ id: 'ds-1', name: 'source' }],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: {
        'plugin-1': {
          manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
          settings: { refresh_interval: 15, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: { 'Authorization': CONFIGURATION_REDACTION_SENTINEL, 'X-Keep': 'plain' }, body: {} }] },
          templates: { full: 'Hello' },
        },
      },
    })

    const summary = await service.importFromZip(buffer)

    const dataSource = [...backing.get('PluginDataSource')!.values()][0]
    expect(dataSource.headers).toEqual({ 'X-Keep': 'plain' })
    expect(summary.warnings).toEqual([{ kind: 'header-redacted', plugin: { id: 'plugin-1', name: 'Test Plugin' }, dataSource: 'source', header: 'Authorization' }])
  })

  it('keeps a Data Source\'s existing header when its current value is legitimately empty, with no warning', async () => {
    backing.get('Plugin')!.set('plugin-1', { id: 'plugin-1', name: 'Test Plugin', kind: 'Poll', refreshInterval: 15 })
    backing.get('PluginDataSource')!.set('ds-1', { id: 'ds-1', name: 'source', headers: { 'X-Empty': '' } })

    const buffer = buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [{ id: 'ds-1', name: 'source' }],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: {
        'plugin-1': {
          manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
          settings: { refresh_interval: 15, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: { 'X-Empty': CONFIGURATION_REDACTION_SENTINEL }, body: {} }] },
          templates: { full: 'Hello' },
        },
      },
    })

    const summary = await service.importFromZip(buffer)

    const dataSource = [...backing.get('PluginDataSource')!.values()].find(row => row.id === 'ds-1')
    expect(dataSource!.headers).toEqual({ 'X-Empty': '' })
    expect(summary.warnings).toEqual([])
  })

  function fieldValuePlugin(fieldValues: Record<string, string>, legacy: Record<string, unknown> = {}) {
    return {
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [{ id: 'field-key', keyname: 'api_key' }, { id: 'field-city', keyname: 'city' }],
        fieldValues,
        ...legacy,
      }],
      pluginFolders: {
        'plugin-1': {
          manifest: {
            name: 'Test Plugin',
            custom_fields: [
              { keyname: 'api_key', field_type: 'password', name: 'API key' },
              { keyname: 'city', field_type: 'string', name: 'City' },
            ],
          },
          templates: { full: 'Hello' },
        },
      },
    }
  }

  function storedFieldValues(): Record<string, unknown> {
    return Object.fromEntries([...backing.get('PluginFieldValue')!.values()].map(row => [(row.field as { id: string }).id, row.value]))
  }

  it('imports a Plugin\'s Field Values onto its Plugin Fields, and changes nothing on a second import', async () => {
    const buffer = buildArchive(fieldValuePlugin({ api_key: 'secret', city: 'Berlin' }))

    const first = await service.importFromZip(buffer)
    const second = await service.importFromZip(buffer)

    expect(storedFieldValues()).toEqual({ 'field-key': 'secret', 'field-city': 'Berlin' })
    expect(first.created.fieldValues).toBe(2)
    expect(second.created.fieldValues).toBeUndefined()
    expect(second.updated.fieldValues).toBe(2)
    expect(backing.get('PluginFieldValue')!.size).toBe(2)
    expect(first.warnings).toEqual([])
  })

  it('keeps an existing password Field Value when the archive holds the sentinel, and warns for one that has none', async () => {
    backing.get('Plugin')!.set('plugin-1', { id: 'plugin-1', name: 'Test Plugin', kind: 'Poll', refreshInterval: 15 })
    backing.get('PluginField')!.set('field-key', { id: 'field-key', keyname: 'api_key' })
    backing.get('PluginFieldValue')!.set('value-1', { id: 'value-1', value: 'real-secret', field: { id: 'field-key' }, plugin: { id: 'plugin-1' } })

    const kept = await service.importFromZip(buildArchive(fieldValuePlugin({ api_key: CONFIGURATION_REDACTION_SENTINEL, city: 'Berlin' })))

    expect(storedFieldValues()).toEqual({ 'field-key': 'real-secret', 'field-city': 'Berlin' })
    expect(kept.warnings).toEqual([])

    backing.get('PluginFieldValue')!.clear()
    const dropped = await service.importFromZip(buildArchive(fieldValuePlugin({ api_key: CONFIGURATION_REDACTION_SENTINEL })))

    expect(storedFieldValues()).toEqual({})
    expect(dropped.warnings).toEqual([{ kind: 'field-value-redacted', plugin: { id: 'plugin-1', name: 'Test Plugin' }, keyname: 'api_key', label: 'API key' }])
  })

  it('warns about a Field Value whose keyname the Plugin has no Plugin Field for, and drops it', async () => {
    const summary = await service.importFromZip(buildArchive(fieldValuePlugin({ town: 'Berlin' })))

    expect(storedFieldValues()).toEqual({})
    expect(summary.warnings).toEqual([{ kind: 'field-value-without-field', plugin: { id: 'plugin-1', name: 'Test Plugin' }, keyname: 'town' }])
  })

  // A stale password Field Value must not survive an import that retypes its Plugin Field away from
  // password, even when the archive's own fieldValues has no entry for that keyname to overwrite it with.
  it('drops a stored Field Value when an import retypes its Plugin Field away from password, with no fieldValues entry to replace it', async () => {
    backing.get('Plugin')!.set('plugin-1', { id: 'plugin-1', name: 'Test Plugin', kind: 'Poll', refreshInterval: 15 })
    backing.get('PluginField')!.set('field-key', { id: 'field-key', keyname: 'api_key', fieldType: 'password' })
    backing.get('PluginFieldValue')!.set('value-1', { id: 'value-1', value: 'real-secret', field: { id: 'field-key' }, plugin: { id: 'plugin-1' } })

    const { plugins, pluginFolders } = fieldValuePlugin({ city: 'Berlin' })
    ;(pluginFolders['plugin-1'].manifest.custom_fields as Array<{ keyname: string, field_type: string }>)
      .find(field => field.keyname === 'api_key')!
      .field_type = 'string'

    await service.importFromZip(buildArchive({ plugins, pluginFolders }))

    expect(storedFieldValues()).toEqual({ 'field-city': 'Berlin' })
  })

  describe('a previous-version (schemaVersion 2) archive', () => {
    const previousManifest = { kuroshiroVersion: '0.17.0', schemaVersion: 2, exportedAt: new Date().toISOString(), containsSecrets: true }

    function previousVersionArchive(variables: unknown[], assignmentFieldValues: unknown[]) {
      const { plugins, pluginFolders } = fieldValuePlugin({}, { variables })
      const { fieldValues: _fieldValues, ...pluginEntry } = plugins[0]
      return buildArchive({
        manifest: previousManifest,
        plugins: [pluginEntry],
        pluginFolders,
        devices: [{ id: 'device-1', name: 'Device', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:FF', apikey: 'key', refreshRate: 300, deviceModelName: null, paletteId: null, mirrorEnabled: null, mirrorMac: null, mirrorApikey: null, sleepModeEnabled: false, sleepStartTime: null, sleepEndTime: null, sleepScreenEnabled: false, targetFirmwareId: null }],
        assignments: [{ id: 'dp-1', deviceId: 'device-1', pluginId: 'plugin-1', order: 0, isActive: true, fieldValues: assignmentFieldValues }],
      })
    }

    it('imports without a warning when it held no Plugin Variables and no per-Assignment Field Values', async () => {
      const summary = await service.importFromZip(previousVersionArchive([], []))

      expect(summary.created.plugins).toBe(1)
      expect(summary.created.assignments).toBe(1)
      expect(summary.warnings).toEqual([])
    })

    it('ignores its Plugin Variables and per-Assignment Field Values, with one warning for the Plugin that held them', async () => {
      const summary = await service.importFromZip(previousVersionArchive(
        [{ id: 'var-1', key: 'SECRET', value: 'x', isSecret: true }],
        [{ id: 'fv-1', fieldId: 'field-city', value: 'Tokyo' }],
      ))

      expect(storedFieldValues()).toEqual({})
      expect(summary.created.variables).toBeUndefined()
      expect(summary.warnings).toEqual([{ kind: 'previous-version-values-dropped', plugin: { id: 'plugin-1', name: 'Test Plugin' } }])
    })
  })

  describe('an archive exported by Kuroshiro 0.17.x (schemaVersion 1)', () => {
    const v1Manifest = { kuroshiroVersion: '0.17.1', schemaVersion: 1, exportedAt: new Date().toISOString(), containsSecrets: true }

    function v1Archive(variables: unknown[], assignmentFieldValues: unknown[]) {
      return buildArchive({
        manifest: v1Manifest,
        plugins: [{
          id: 'plugin-1',
          kind: 'Poll',
          mergeStrategy: null,
          streamLimit: null,
          webhookToken: null,
          sourceRecipeId: null,
          dataSources: [{ id: 'ds-1', name: 'forecast' }],
          templates: [{ id: 'tpl-1', layout: 'full' }],
          fields: [{ id: 'field-city', keyname: 'city' }],
          variables,
        }],
        pluginFolders: {
          'plugin-1': {
            manifest: {
              name: 'Test Plugin',
              description: '',
              custom_fields: [{ keyname: 'city', field_type: 'string', name: 'City', description: '', default_value: '', optional: false }],
            },
            settings: { refresh_interval: 15, data_sources: [{ name: 'forecast', endpoint: 'https://api.example.com', method: 'GET', headers: {}, body: {} }] },
            templates: { full: 'Hello' },
          },
        },
        devices: [makeDeviceEntry()],
        assignments: [{ id: 'dp-1', deviceId: 'device-1', pluginId: 'plugin-1', order: 0, isActive: true, fieldValues: assignmentFieldValues }],
        settings: null,
      })
    }

    it('imports without a warning when it held no Plugin Variables and no per-Assignment Field Values', async () => {
      const summary = await service.importFromZip(v1Archive([], []))

      expect(summary.created).toMatchObject({ plugins: 1, dataSources: 1, templates: 1, fields: 1, devices: 1, assignments: 1 })
      expect(summary.warnings).toEqual([])
    })

    it('ignores its Plugin Variables and per-Assignment Field Values, with one warning for the Plugin that held them', async () => {
      const summary = await service.importFromZip(v1Archive(
        [{ id: 'var-1', key: 'SECRET', value: 'x', isSecret: true }],
        [{ id: 'fv-1', fieldId: 'field-city', value: 'Tokyo' }],
      ))

      expect(storedFieldValues()).toEqual({})
      expect(summary.warnings).toEqual([{ kind: 'previous-version-values-dropped', plugin: { id: 'plugin-1', name: 'Test Plugin' } }])
    })

    it('reads its missing settings.json as no overridden Instance Settings, clearing the overrides here', async () => {
      backing.get('InstanceSettings')!.set(1 as unknown as string, { id: 1 as unknown as string, lowBatteryPercent: 15, firmwareAutoUpdate: true })

      await service.importFromZip(v1Archive([], []))

      expect([...backing.get('InstanceSettings')!.values()]).toEqual([{ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, alertRetentionDays: null, deviceLogRetentionDays: null, firmwareAutoUpdate: null }])
    })
  })

  it('keeps an existing Device\'s mirrorApikey when the archive holds the sentinel, with no warning', async () => {
    backing.get('Device')!.set('device-1', {
      id: 'device-1',
      name: 'Old',
      friendlyId: 'OLD1',
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'key1',
      refreshRate: 300,
      sleepModeEnabled: false,
      sleepScreenEnabled: false,
      mirrorApikey: 'real-mirror-key',
    })

    const buffer = buildArchive({ devices: [makeDeviceEntry({ mirrorApikey: CONFIGURATION_REDACTION_SENTINEL })] })

    const summary = await service.importFromZip(buffer)

    const device = [...backing.get('Device')!.values()][0]
    expect(device.mirrorApikey).toBe('real-mirror-key')
    expect(summary.warnings).toEqual([])
  })

  it('unsets a brand-new Device\'s mirrorApikey with a warning when the archive holds the sentinel', async () => {
    const buffer = buildArchive({ devices: [makeDeviceEntry({ mirrorApikey: CONFIGURATION_REDACTION_SENTINEL })] })

    const summary = await service.importFromZip(buffer)

    const device = [...backing.get('Device')!.values()][0]
    expect(device.mirrorApikey).toBeUndefined()
    expect(summary.warnings).toEqual([{ kind: 'mirror-apikey-redacted', device: { id: 'device-1', name: 'Device 1' } }])
  })

  it('keeps an existing Device\'s apikey with no warning when the archive holds the sentinel and the row exists by id', async () => {
    backing.get('Device')!.set('device-1', {
      id: 'device-1',
      name: 'Old',
      friendlyId: 'OLD1',
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'existing-key',
      refreshRate: 300,
      sleepModeEnabled: false,
      sleepScreenEnabled: false,
    })

    const buffer = buildArchive({ devices: [makeDeviceEntry({ apikey: CONFIGURATION_REDACTION_SENTINEL })] })

    const summary = await service.importFromZip(buffer)

    const device = [...backing.get('Device')!.values()][0]
    expect(device.apikey).toBe('existing-key')
    expect(summary.warnings).toEqual([])
  })

  it('generates a fresh apikey with a warning for a brand-new Device when the archive holds the sentinel', async () => {
    const buffer = buildArchive({ devices: [makeDeviceEntry({ apikey: CONFIGURATION_REDACTION_SENTINEL })] })

    const summary = await service.importFromZip(buffer)

    const device = [...backing.get('Device')!.values()][0]
    expect(device.apikey).not.toBe(CONFIGURATION_REDACTION_SENTINEL)
    expect(typeof device.apikey).toBe('string')
    expect((device.apikey as string).length).toBeGreaterThan(0)
    expect(summary.warnings).toEqual([{ kind: 'device-apikey-redacted', device: { id: 'device-1', name: 'Device 1' } }])
  })

  it('keeps an existing Plugin\'s webhookToken with no warning when the archive holds the sentinel', async () => {
    backing.get('Plugin')!.set('plugin-1', { id: 'plugin-1', name: 'Existing', kind: 'Webhook', webhookToken: 'real-token', refreshInterval: 15 })

    const buffer = buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Webhook',
        mergeStrategy: 'standard',
        streamLimit: null,
        webhookToken: CONFIGURATION_REDACTION_SENTINEL,
        sourceRecipeId: null,
        dataSources: [],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: { 'plugin-1': { manifest: { name: 'Existing', custom_fields: [] }, templates: { full: 'Hello' } } },
    })

    const summary = await service.importFromZip(buffer)

    const plugin = [...backing.get('Plugin')!.values()][0]
    expect(plugin.webhookToken).toBe('real-token')
    expect(summary.warnings).toEqual([])
  })

  it('generates a fresh webhookToken with a warning for a brand-new Plugin when the archive holds the sentinel', async () => {
    const buffer = buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Webhook',
        mergeStrategy: 'standard',
        streamLimit: null,
        webhookToken: CONFIGURATION_REDACTION_SENTINEL,
        sourceRecipeId: null,
        dataSources: [],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: { 'plugin-1': { manifest: { name: 'Test', custom_fields: [] }, templates: { full: 'Hello' } } },
    })

    const summary = await service.importFromZip(buffer)

    const plugin = [...backing.get('Plugin')!.values()][0]
    expect(plugin.webhookToken).not.toBe(CONFIGURATION_REDACTION_SENTINEL)
    expect(typeof plugin.webhookToken).toBe('string')
    expect((plugin.webhookToken as string).length).toBeGreaterThan(0)
    expect(summary.warnings).toEqual([{ kind: 'webhook-token-redacted', plugin: { id: 'plugin-1', name: 'Test' } }])
  })

  it('restores a file-type Screen\'s image from the archive onto disk', async () => {
    const buffer = buildArchive({
      devices: [makeDeviceEntry()],
      screens: [{
        id: 'screen-1',
        deviceId: 'device-1',
        type: 'file',
        order: 1,
        filename: 'sunset.png',
        externalLink: null,
        html: null,
        fetchManual: false,
        pluginId: null,
        devicePluginId: null,
        schedule: null,
        mashupConfiguration: null,
      }],
      screenImages: { 'screen-1': 'png-bytes' },
    })

    await service.importFromZip(buffer)

    expect(fsMock.mkdir).toHaveBeenCalledWith(expect.stringContaining('device-1'), { recursive: true })
    expect(fsMock.writeFile).toHaveBeenCalledWith(expect.stringContaining('screen-1.png'), Buffer.from('png-bytes'))
  })

  describe('scheduling a Plugin an import creates or updates', () => {
    const pollArchive = (overrides: Record<string, unknown> = {}) => buildArchive({
      plugins: [{
        id: 'plugin-1',
        kind: 'Poll',
        mergeStrategy: null,
        streamLimit: null,
        webhookToken: null,
        sourceRecipeId: null,
        dataSources: [{ id: 'ds-1', name: 'source' }],
        templates: [{ id: 'tpl-1', layout: 'full' }],
        fields: [],
      }],
      pluginFolders: {
        'plugin-1': {
          manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
          settings: { refresh_interval: 15, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: {}, body: {} }] },
          templates: { full: 'Hello' },
        },
      },
      ...overrides,
    })

    it('hands a newly created Poll-kind Plugin to the scheduler once the import commits, with its Data Sources attached', async () => {
      await service.importFromZip(pollArchive())

      expect(scheduler.schedulePlugin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        id: 'plugin-1',
        kind: 'Poll',
        refreshInterval: 15,
        templates: [expect.objectContaining({ layout: 'full' })],
        dataSources: [expect.objectContaining({ name: 'source' })],
      }))
    })

    it('reschedules an existing Plugin under its new refreshInterval instead of leaving the old schedule running', async () => {
      await service.importFromZip(pollArchive())
      scheduler.schedulePlugin.mockClear()

      const buffer = buildArchive({
        plugins: [{
          id: 'plugin-1',
          kind: 'Poll',
          mergeStrategy: null,
          streamLimit: null,
          webhookToken: null,
          sourceRecipeId: null,
          dataSources: [{ id: 'ds-1', name: 'source' }],
          templates: [{ id: 'tpl-1', layout: 'full' }],
          fields: [],
        }],
        pluginFolders: {
          'plugin-1': {
            manifest: { name: 'Test Plugin', description: '', custom_fields: [] },
            settings: { refresh_interval: 90, data_sources: [{ name: 'source', endpoint: 'https://api.example.com', method: 'GET', headers: {}, body: {} }] },
            templates: { full: 'Hello' },
          },
        },
      })

      await service.importFromZip(buffer)

      expect(scheduler.schedulePlugin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'plugin-1', refreshInterval: 90 }))
    })

    it('hands a Webhook-kind Plugin to the scheduler too, which leaves it unscheduled for polling', async () => {
      const buffer = buildArchive({
        plugins: [{
          id: 'plugin-webhook',
          kind: 'Webhook',
          mergeStrategy: 'standard',
          streamLimit: null,
          webhookToken: 'token-A',
          sourceRecipeId: null,
          dataSources: [],
          templates: [{ id: 'tpl-A', layout: 'full' }],
          fields: [],
        }],
        pluginFolders: {
          'plugin-webhook': { manifest: { name: 'Doorbell', custom_fields: [] }, settings: { strategy: 'webhook' }, templates: { full: 'Ring' } },
        },
      })

      await service.importFromZip(buffer)

      expect(scheduler.schedulePlugin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'plugin-webhook', kind: 'Webhook' }))
    })

    it('never schedules anything while checking an archive, since the check rolls its transaction back in full', async () => {
      await service.checkZip(pollArchive())

      expect(scheduler.schedulePlugin).not.toHaveBeenCalled()
      expect(backing.get('Plugin')!.size).toBe(0)
    })

    it('leaves a Plugin the archive never mentions untouched: the scheduler is not called for it', async () => {
      backing.get('Plugin')!.set('untouched-plugin', { id: 'untouched-plugin', name: 'Untouched', kind: 'Poll', refreshInterval: 15 })

      await service.importFromZip(pollArchive())

      for (const call of scheduler.schedulePlugin.mock.calls) {
        expect((call[0] as { id: string }).id).not.toBe('untouched-plugin')
      }
    })
  })
})
