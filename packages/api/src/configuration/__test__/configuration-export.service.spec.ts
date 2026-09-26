import type { Palette } from '../../device-models/entities/palette.entity.js'
import type { Device } from '../../devices/devices.entity.js'
import type { Firmware } from '../../firmware/entities/firmware.entity.js'
import type { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import type { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import {
  makeDevice,
  makeDevicePlugin,
  makeFirmware,
  makePalette,
  makePlugin,
  makePluginDataSource,
  makePluginTemplate,
  makeSchedule,
  makeScreen,
} from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { CONFIG_SCHEMA_VERSION } from '../schema-version.js'
import { ConfigurationExportService } from '../services/configuration-export.service.js'

const { existsSyncMock, readFileSyncMock, realFs } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  realFs: {} as { existsSync: typeof import('node:fs').existsSync, readFileSync: typeof import('node:fs').readFileSync },
}))

// Delegates to the real `node:fs` by default (so `getApiVersion`'s package.json read keeps working,
// and so a fake screen-image path naturally reports missing, same as before this file mocked `node:fs`
// at all). Tests that need a screen image "on disk" override one call at a time with `mockReturnValueOnce`.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  realFs.existsSync = actual.existsSync
  realFs.readFileSync = actual.readFileSync
  existsSyncMock.mockImplementation((...args: Parameters<typeof actual.existsSync>) => realFs.existsSync(...args))
  readFileSyncMock.mockImplementation((...args: Parameters<typeof actual.readFileSync>) => realFs.readFileSync(...args))
  return { ...actual, existsSync: existsSyncMock, readFileSync: readFileSyncMock }
})

describe('configurationExportService', () => {
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let devicePluginRepo: ReturnType<typeof createMockRepository<DevicePlugin>>
  let fieldValueRepo: ReturnType<typeof createMockRepository<PluginFieldValue>>
  let paletteRepo: ReturnType<typeof createMockRepository<Palette>>
  let firmwareRepo: ReturnType<typeof createMockRepository<Firmware>>
  let service: ConfigurationExportService

  beforeEach(() => {
    pluginRepo = createMockRepository()
    deviceRepo = createMockRepository()
    screenRepo = createMockRepository()
    devicePluginRepo = createMockRepository()
    fieldValueRepo = createMockRepository()
    paletteRepo = createMockRepository()
    firmwareRepo = createMockRepository()

    pluginRepo.find.mockResolvedValue([])
    deviceRepo.find.mockResolvedValue([])
    screenRepo.find.mockResolvedValue([])
    devicePluginRepo.find.mockResolvedValue([])
    fieldValueRepo.find.mockResolvedValue([])
    paletteRepo.find.mockResolvedValue([])
    firmwareRepo.find.mockResolvedValue([])

    service = new ConfigurationExportService(
      asRepository(pluginRepo),
      asRepository(deviceRepo),
      asRepository(screenRepo),
      asRepository(devicePluginRepo),
      asRepository(fieldValueRepo),
      asRepository(paletteRepo),
      asRepository(firmwareRepo),
      new PluginExporterService(),
    )
  })

  it('writes a manifest.json with schemaVersion, exportedAt, and containsSecrets', async () => {
    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const manifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf8'))

    expect(manifest.schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
    expect(manifest.containsSecrets).toBe(true)
    expect(typeof manifest.kuroshiroVersion).toBe('string')
    expect(typeof manifest.exportedAt).toBe('string')
  })

  it('nests each Plugin as a .trmnlp folder, reusing the per-Plugin exporter, and records its ids in plugins.json', async () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      dataSources: [makePluginDataSource({ id: 'ds-1', name: 'source' })],
      templates: [makePluginTemplate({ id: 'tpl-1', layout: 'full' })],
    })
    pluginRepo.find.mockResolvedValue([plugin])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)

    expect(zip.getEntry('plugins/plugin-1/.trmnlp.yml')).toBeTruthy()
    expect(zip.getEntry('plugins/plugin-1/src/settings.yml')).toBeTruthy()
    expect(zip.getEntry('plugins/plugin-1/src/full.liquid')).toBeTruthy()

    const pluginsJson = JSON.parse(zip.getEntry('plugins.json')!.getData().toString('utf8'))
    expect(pluginsJson).toHaveLength(1)
    expect(pluginsJson[0].id).toBe('plugin-1')
    expect(pluginsJson[0].dataSources).toEqual([{ id: 'ds-1', name: 'source' }])
    expect(pluginsJson[0].templates).toEqual([{ id: 'tpl-1', layout: 'full' }])
  })

  it('only includes custom Palettes and custom Firmware, never official ones', async () => {
    paletteRepo.find.mockResolvedValue([makePalette({ id: 'custom-1', kind: 'custom' })])
    firmwareRepo.find.mockResolvedValue([makeFirmware({ id: 'fw-1', kind: 'custom' })])

    await service.exportToZip()

    expect(paletteRepo.find).toHaveBeenCalledWith({ where: { kind: 'custom' } })
    expect(firmwareRepo.find).toHaveBeenCalledWith({ where: { kind: 'custom' } })
  })

  it('carries Device fields but excludes telemetry, keying Device Model and Palette by name/id', async () => {
    const device = makeDevice({
      id: 'device-1',
      deviceModel: { name: 'og_plus' } as Device['deviceModel'],
      palette: { id: 'bw' } as Device['palette'],
      batteryVoltage: '4.1',
      rssi: '-40',
    })
    deviceRepo.find.mockResolvedValue([device])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const devicesJson = JSON.parse(zip.getEntry('devices.json')!.getData().toString('utf8'))

    expect(devicesJson).toHaveLength(1)
    expect(devicesJson[0].deviceModelName).toBe('og_plus')
    expect(devicesJson[0].paletteId).toBe('bw')
    expect(devicesJson[0]).not.toHaveProperty('batteryVoltage')
    expect(devicesJson[0]).not.toHaveProperty('rssi')
  })

  it('nests a Screen\'s Schedule and Mashup configuration inside screens.json', async () => {
    const device = makeDevice({ id: 'device-1' })
    const screen = makeScreen({
      id: 'screen-1',
      device,
      schedule: makeSchedule({ id: 'schedule-1' }),
    })
    screenRepo.find.mockResolvedValue([screen])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const screensJson = JSON.parse(zip.getEntry('screens.json')!.getData().toString('utf8'))

    expect(screensJson[0].deviceId).toBe('device-1')
    expect(screensJson[0].schedule.id).toBe('schedule-1')
  })

  it('builds an assignments.json entry per DevicePlugin with its field values scoped to that device+plugin pair', async () => {
    const device = makeDevice({ id: 'device-1' })
    const plugin = makePlugin({ id: 'plugin-1' })
    devicePluginRepo.find.mockResolvedValue([makeDevicePlugin({ id: 'dp-1', device, plugin, order: 0, isActive: true })])
    fieldValueRepo.find.mockResolvedValue([
      { id: 'fv-1', value: 'hello', plugin: { id: 'plugin-1' }, field: { id: 'field-1' }, device: { id: 'device-1' } },
      { id: 'fv-2', value: 'other-device', plugin: { id: 'plugin-1' }, field: { id: 'field-1' }, device: { id: 'device-2' } },
    ] as PluginFieldValue[])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const assignmentsJson = JSON.parse(zip.getEntry('assignments.json')!.getData().toString('utf8'))

    expect(assignmentsJson).toHaveLength(1)
    expect(assignmentsJson[0].fieldValues).toEqual([{ id: 'fv-1', fieldId: 'field-1', value: 'hello' }])
  })

  it('includes a file-type Screen\'s rendered image when it exists on disk', async () => {
    // Call order within exportToZip: buildManifest's getApiVersion() reads package.json first
    // (delegated to the real fs), then addScreenImage reads this Screen's image second.
    existsSyncMock.mockReturnValueOnce(true)
    readFileSyncMock.mockImplementationOnce((...args: Parameters<typeof realFs.readFileSync>) => realFs.readFileSync(...args))
    readFileSyncMock.mockReturnValueOnce(Buffer.from('png-bytes'))
    const device = makeDevice({ id: 'device-1' })
    const screen = makeScreen({ id: 'screen-1', device, type: 'file', filename: 'sunset.png' })
    screenRepo.find.mockResolvedValue([screen])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)

    expect(zip.getEntry('screens/screen-1/sunset.png')?.getData().toString('utf8')).toBe('png-bytes')
  })

  it('omits the image for a file-type Screen when nothing is on disk, and for non-file Screen types', async () => {
    const device = makeDevice({ id: 'device-1' })
    const fileScreen = makeScreen({ id: 'screen-1', device, type: 'file' })
    const htmlScreen = makeScreen({ id: 'screen-2', device, type: 'html' })
    screenRepo.find.mockResolvedValue([fileScreen, htmlScreen])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)

    expect(zip.getEntries().some(entry => entry.entryName.startsWith('screens/'))).toBe(false)
  })
})
