import type { DataSource } from 'typeorm'
import type { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import type { PluginSchedulerService } from '../../plugins/services/plugin-scheduler.service.js'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { PluginTemplate } from '../../plugins/entities/plugin-template.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { ConfigurationExportService } from '../services/configuration-export.service.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'

const SNAPSHOT_TAKEN_AT = new Date('2026-09-12T08:00:00.000Z')
const UPLOADED_AT = new Date('2026-09-20T17:30:00.000Z')
const FILE_FACTS = { fileOriginalName: 'Sunset at the lake.jpg', fileWidth: 4032, fileHeight: 3024, fileBytes: 2_481_337, fileUploadedAt: UPLOADED_AT }
const NO_FILE_FACTS = { fileOriginalName: null, fileWidth: null, fileHeight: null, fileBytes: null, fileUploadedAt: null }

describe('a Recipe Snapshot\'s age and a File Screen\'s upload facts, through Configuration Export and Import, against a real database', () => {
  let database: DataSource
  let exportService: ConfigurationExportService
  let importService: ConfigurationImportService

  beforeAll(async () => {
    database = await createTestDatabase()
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    const fieldValues = { storedByPlugin: async () => new Map() } as unknown as PluginFieldValuesService
    const scheduler = { schedulePlugin: vi.fn() } as unknown as PluginSchedulerService

    exportService = new ConfigurationExportService(
      database.getRepository(Plugin),
      database.getRepository(Device),
      database.getRepository(Screen),
      database.getRepository(DevicePlugin),
      database.getRepository(Palette),
      database.getRepository(Firmware),
      database.getRepository(InstanceSettings),
      new PluginExporterService(),
      fieldValues,
    )
    importService = new ConfigurationImportService(database.getRepository(Plugin), new PluginImporterService(), scheduler, asService(deviceModels))
  })

  beforeEach(async () => {
    await database.synchronize(true)
  })

  afterAll(async () => {
    await database.destroy()
  })

  async function seedRecipePlugin(): Promise<Plugin> {
    const plugin = await database.getRepository(Plugin).save({
      name: 'Weather',
      kind: 'Poll',
      sourceRecipeId: '150460',
      sourceRecipeSnapshot: { name: 'Weather', templates: [], dataSources: [], fields: [] },
      snapshotTakenAt: SNAPSHOT_TAKEN_AT,
    })
    await database.getRepository(PluginTemplate).save({ plugin, layout: 'full', liquidMarkup: 'Hello' })
    return plugin
  }

  async function seedFileScreen(): Promise<Screen> {
    const device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
    return database.getRepository(Screen).save({ device, type: 'file', filename: 'sunset.png', order: 1, generatedAt: new Date(), ...FILE_FACTS })
  }

  async function storedFileFacts(screenId: string) {
    const { fileOriginalName, fileWidth, fileHeight, fileBytes, fileUploadedAt } = await database.getRepository(Screen).findOneByOrFail({ id: screenId })
    return { fileOriginalName, fileWidth, fileHeight, fileBytes, fileUploadedAt }
  }

  async function storedSnapshotTakenAt(pluginId: string): Promise<Date | null | undefined> {
    return (await database.getRepository(Plugin).findOneByOrFail({ id: pluginId })).snapshotTakenAt
  }

  /** The archive as an instance exporting the previous schemaVersion wrote it: neither entry has the facts. */
  function withoutReadFacts(archive: Buffer): Buffer {
    const zip = new AdmZip(archive)
    const rewrite = (name: string, strip: (entry: Record<string, unknown>) => Record<string, unknown>) => {
      const entries = JSON.parse(zip.readAsText(name)) as Record<string, unknown>[]
      zip.updateFile(name, Buffer.from(JSON.stringify(entries.map(strip))))
    }
    rewrite('plugins.json', ({ snapshotTakenAt: _snapshotTakenAt, ...entry }) => entry)
    rewrite('screens.json', ({ fileOriginalName: _name, fileWidth: _width, fileHeight: _height, fileBytes: _bytes, fileUploadedAt: _uploadedAt, ...entry }) => entry)
    const manifest = JSON.parse(zip.readAsText('manifest.json'))
    zip.updateFile('manifest.json', Buffer.from(JSON.stringify({ ...manifest, schemaVersion: 6 })))
    return zip.toBuffer()
  }

  it('restores when a Recipe Plugin\'s Snapshot was taken and a File Screen\'s upload facts onto a fresh instance', async () => {
    const plugin = await seedRecipePlugin()
    const screen = await seedFileScreen()
    const archive = await exportService.exportToZip()

    // A fresh instance has none of the rows.
    await database.synchronize(true)
    await importService.importFromZip(archive)

    expect(await storedSnapshotTakenAt(plugin.id)).toEqual(SNAPSHOT_TAKEN_AT)
    expect(await storedFileFacts(screen.id)).toEqual(FILE_FACTS)
  })

  it('writes the archive\'s snapshotTakenAt next to the archive\'s Snapshot, over a Snapshot taken since the export', async () => {
    const plugin = await seedRecipePlugin()
    const archive = await exportService.exportToZip()
    await database.getRepository(Plugin).update(plugin.id, { sourceRecipeSnapshot: { name: 'Weather v2' }, snapshotTakenAt: new Date('2026-10-01T00:00:00.000Z') })

    await importService.importFromZip(archive)

    const restored = await database.getRepository(Plugin).findOneByOrFail({ id: plugin.id })
    expect(restored.sourceRecipeSnapshot).toMatchObject({ name: 'Weather' })
    expect(restored.snapshotTakenAt).toEqual(SNAPSHOT_TAKEN_AT)
  })

  it('reads an archive from before schemaVersion 7 as not knowing when a Snapshot was taken or what a File Screen\'s upload was', async () => {
    const plugin = await seedRecipePlugin()
    const screen = await seedFileScreen()
    const archive = withoutReadFacts(await exportService.exportToZip())

    await importService.importFromZip(archive)

    expect(await storedSnapshotTakenAt(plugin.id)).toBeNull()
    expect(await storedFileFacts(screen.id)).toEqual(NO_FILE_FACTS)
  })
})
