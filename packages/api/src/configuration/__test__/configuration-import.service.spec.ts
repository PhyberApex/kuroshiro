import type { Repository } from 'typeorm'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import * as yaml from 'js-yaml'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'

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
  'PluginVariable',
  'Device',
  'DeviceModel',
  'DevicePlugin',
  'PluginFieldValue',
  'Screen',
  'Schedule',
  'MashupConfiguration',
  'MashupSlot',
] as const

/**
 * A fake `EntityManager` good enough to exercise the whole-transaction upsert logic:
 * each entity gets its own in-memory table (so `findOneBy` sees rows an earlier
 * `save` in the same test made), and `transaction()` snapshots every table before
 * running the callback and restores the snapshot if the callback throws — mirroring
 * the real rollback a Postgres transaction gives `manager.transaction()` in production.
 */
type FakeRow = Record<string, unknown> & { id?: string }

function createFakeManager() {
  const backing = new Map<string, Map<string, FakeRow>>()
  for (const name of ENTITY_NAMES) backing.set(name, new Map())

  let idCounter = 0

  function makeRepo(name: string) {
    const table = backing.get(name)!
    return {
      findOneBy: vi.fn(async (where: Record<string, unknown>) => {
        for (const row of table.values()) {
          if (Object.entries(where).every(([key, value]) => row[key] === value)) {
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

interface PluginFolder {
  manifest: Record<string, unknown>
  settings?: Record<string, unknown>
  templates: Record<string, string>
}

function buildArchive(options: {
  manifest?: Record<string, unknown> | null
  plugins?: unknown[]
  devices?: unknown[]
  screens?: unknown[]
  assignments?: unknown[]
  palettes?: unknown[]
  firmware?: unknown[]
  pluginFolders?: Record<string, PluginFolder>
  screenImages?: Record<string, string>
} = {}): Buffer {
  const zip = new AdmZip()

  if (options.manifest !== null) {
    const manifest = options.manifest ?? {
      kuroshiroVersion: '0.13.0',
      schemaVersion: CONFIG_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      containsSecrets: true,
    }
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
  }

  zip.addFile('plugins.json', Buffer.from(JSON.stringify(options.plugins ?? [])))
  zip.addFile('devices.json', Buffer.from(JSON.stringify(options.devices ?? [])))
  zip.addFile('screens.json', Buffer.from(JSON.stringify(options.screens ?? [])))
  zip.addFile('assignments.json', Buffer.from(JSON.stringify(options.assignments ?? [])))
  zip.addFile('palettes.json', Buffer.from(JSON.stringify(options.palettes ?? [])))
  zip.addFile('firmware.json', Buffer.from(JSON.stringify(options.firmware ?? [])))

  for (const [pluginId, folder] of Object.entries(options.pluginFolders ?? {})) {
    zip.addFile(`plugins/${pluginId}/.trmnlp.yml`, Buffer.from(yaml.dump(folder.manifest)))
    if (folder.settings) {
      zip.addFile(`plugins/${pluginId}/src/settings.yml`, Buffer.from(yaml.dump(folder.settings)))
    }
    for (const [layout, content] of Object.entries(folder.templates)) {
      zip.addFile(`plugins/${pluginId}/src/${layout}.liquid`, Buffer.from(content))
    }
  }

  for (const [screenId, content] of Object.entries(options.screenImages ?? {})) {
    zip.addFile(`screens/${screenId}/${screenId}.png`, Buffer.from(content))
  }

  return zip.toBuffer()
}

function makeDeviceEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'device-1',
    name: 'Device 1',
    friendlyId: 'ABC123',
    mac: 'AA:BB:CC:DD:EE:FF',
    apikey: 'key1',
    refreshRate: 300,
    deviceModelName: null,
    paletteId: null,
    mirrorEnabled: null,
    mirrorMac: null,
    mirrorApikey: null,
    sleepModeEnabled: false,
    sleepStartTime: null,
    sleepEndTime: null,
    sleepScreenEnabled: false,
    targetFirmwareId: null,
    ...overrides,
  }
}

describe('configurationImportService', () => {
  let manager: ReturnType<typeof createFakeManager>['manager']
  let backing: ReturnType<typeof createFakeManager>['backing']
  let service: ConfigurationImportService

  beforeEach(() => {
    fsMock.mkdir.mockReset().mockResolvedValue(undefined)
    fsMock.writeFile.mockReset().mockResolvedValue(undefined)

    const fake = createFakeManager()
    manager = fake.manager
    backing = fake.backing
    const pluginRepository = { manager } as unknown as Repository<Plugin>
    service = new ConfigurationImportService(pluginRepository, new PluginImporterService())
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
        variables: [],
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
      assignments: [{ id: 'dp-1', deviceId: 'device-1', pluginId: 'plugin-1', order: 0, isActive: true, fieldValues: [] }],
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
          variables: [],
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
          variables: [],
        },
      ],
      pluginFolders: {
        'plugin-A': { manifest: { name: 'A', custom_fields: [] }, templates: { full: 'A content' } },
        'plugin-B': { manifest: { name: 'B', custom_fields: [] }, templates: { full: 'B content' } },
      },
    })

    await expect(service.importFromZip(buffer)).rejects.toThrow(/webhookToken/)

    const pluginIds = [...backing.get('Plugin')!.values()].map(row => row.id).sort()
    expect(pluginIds).toEqual(['existing-plugin'])
  })

  it('resolves an unknown Device Model, Palette, or Firmware reference to null with a warning instead of failing', async () => {
    const buffer = buildArchive({
      devices: [makeDeviceEntry({ deviceModelName: 'missing_model', paletteId: 'missing-palette', targetFirmwareId: 'missing-firmware' })],
    })

    const summary = await service.importFromZip(buffer)

    expect(summary.warnings.some(w => w.includes('missing_model'))).toBe(true)
    expect(summary.warnings.some(w => w.includes('missing-palette'))).toBe(true)
    expect(summary.warnings.some(w => w.includes('missing-firmware'))).toBe(true)

    const deviceRows = [...backing.get('Device')!.values()]
    expect(deviceRows[0].deviceModel).toBeNull()
    expect(deviceRows[0].palette).toBeNull()
    expect(deviceRows[0].targetFirmware).toBeNull()
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
})
