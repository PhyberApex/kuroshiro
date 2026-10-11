import type { DataSource } from 'typeorm'
import type { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import type { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import type { PluginSchedulerService } from '../../plugins/services/plugin-scheduler.service.js'
import * as fs from 'node:fs'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { sleepImageOriginalPath, sleepImagePath } from '../../devices/device-sleep-image.service.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { ConfigurationExportService } from '../services/configuration-export.service.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'
import { buildArchive, makeDeviceEntry } from './archive.js'

vi.mock('../../utils/imageUtils.js', () => ({
  convertToPng: vi.fn(),
}))

async function writeStandInFile(destination: string, content: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.writeFile(destination, content)
}

describe('a Device\'s own sleep image, through Configuration Export and Import, against a real database', () => {
  let database: DataSource
  let exportService: ConfigurationExportService
  let importService: ConfigurationImportService
  let createdDeviceIds: string[]

  async function createDevice(overrides: Partial<Device> = {}): Promise<Device> {
    const device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300, ...overrides })
    createdDeviceIds.push(device.id)
    return device
  }

  beforeAll(async () => {
    database = await createTestDatabase()
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)

    const pluginExporter = { buildEntries: () => [] } as unknown as PluginExporterService
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
      pluginExporter,
      fieldValues,
    )
    importService = new ConfigurationImportService(
      database.getRepository(Plugin),
      new PluginImporterService(),
      scheduler,
      asService(deviceModels),
    )
  })

  beforeEach(async () => {
    const { convertToPng } = await import('../../utils/imageUtils.js')
    vi.mocked(convertToPng).mockImplementation(async (_input, output) => writeStandInFile(output, 'converted-stand-in'))
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    createdDeviceIds = []
  })

  afterEach(async () => {
    for (const id of createdDeviceIds) {
      await fs.promises.rm(resolveAppPath('public', 'screens', 'devices', id), { recursive: true, force: true })
    }
  })

  afterAll(async () => {
    await database.destroy()
  })

  async function seedSleepImage(deviceId: string): Promise<void> {
    await writeStandInFile(sleepImageOriginalPath(deviceId), 'kitchen-original')
    await writeStandInFile(sleepImagePath(deviceId), 'kitchen-converted')
    await database.getRepository(Device).update({ id: deviceId }, { sleepImageGeneratedAt: new Date('2026-01-01T00:00:00.000Z') })
  }

  it('round-trips a Device\'s own sleep image through export and import onto a fresh instance', async () => {
    const device = await createDevice()
    await seedSleepImage(device.id)

    const archive = await exportService.exportToZip()

    // A fresh instance has none of this Device's files or rows.
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    await fs.promises.rm(resolveAppPath('public', 'screens', 'devices', device.id), { recursive: true, force: true })

    const summary = await importService.importFromZip(archive)

    expect(summary.warnings).toEqual([])
    await expect(fs.promises.readFile(sleepImageOriginalPath(device.id), 'utf8')).resolves.toBe('kitchen-original')
    await expect(fs.promises.readFile(sleepImagePath(device.id), 'utf8')).resolves.toBe('converted-stand-in')
    const restored = await database.getRepository(Device).findOneByOrFail({ id: device.id })
    expect(restored.sleepImageGeneratedAt).toBeInstanceOf(Date)
  })

  it('replaces a Device\'s existing sleep image with the archive\'s', async () => {
    const device = await createDevice()
    await seedSleepImage(device.id)

    const archive = buildArchive({
      devices: [makeDeviceEntry({ id: device.id, name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret' })],
      deviceSleepImages: { [device.id]: { original: 'new-original' } },
    })

    await importService.importFromZip(archive)

    await expect(fs.promises.readFile(sleepImageOriginalPath(device.id), 'utf8')).resolves.toBe('new-original')
    await expect(fs.promises.readFile(sleepImagePath(device.id), 'utf8')).resolves.toBe('converted-stand-in')
  })

  it('removes a Device\'s existing sleep image when the archive holds none for it', async () => {
    const device = await createDevice()
    await seedSleepImage(device.id)

    const archive = buildArchive({
      devices: [makeDeviceEntry({ id: device.id, name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret' })],
    })

    await importService.importFromZip(archive)

    await expect(fs.promises.access(sleepImageOriginalPath(device.id))).rejects.toThrow()
    await expect(fs.promises.access(sleepImagePath(device.id))).rejects.toThrow()
    const restored = await database.getRepository(Device).findOneByOrFail({ id: device.id })
    expect(restored.sleepImageGeneratedAt).toBeNull()
  })

  it('warns about a corrupt image in the archive and leaves the Device without one, without failing the rest of the import', async () => {
    const device = await createDevice()
    const { convertToPng } = await import('../../utils/imageUtils.js')
    vi.mocked(convertToPng).mockRejectedValueOnce(new Error('unreadable'))

    const archive = buildArchive({
      devices: [makeDeviceEntry({ id: device.id, name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret' })],
      deviceSleepImages: { [device.id]: { original: 'corrupt-bytes' } },
    })

    const summary = await importService.importFromZip(archive)

    expect(summary.warnings).toEqual([{ kind: 'sleep-image-failed', device: { id: device.id, name: 'Kitchen' } }, { kind: 'device-apikeys-kept' }])
    const restored = await database.getRepository(Device).findOneByOrFail({ id: device.id })
    expect(restored.name).toBe('Kitchen')
    expect(restored.sleepImageGeneratedAt).toBeNull()
    await expect(fs.promises.access(sleepImageOriginalPath(device.id))).rejects.toThrow()
  })
})
