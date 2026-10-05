import type { Palette } from '../../device-models/entities/palette.entity.js'
import type { Device } from '../../devices/devices.entity.js'
import type { Firmware } from '../../firmware/entities/firmware.entity.js'
import type { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { Buffer } from 'node:buffer'
import AdmZip from 'adm-zip'
import { CONFIGURATION_REDACTION_SENTINEL } from 'kuroshiro-shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import {
  makeDevice,
  makeDevicePlugin,
  makeFirmware,
  makePalette,
  makePlugin,
  makePluginDataSource,
  makePluginField,
  makePluginTemplate,
  makeSchedule,
  makeScreen,
} from '../../test/fixtures.js'
import { createMockPluginFieldValuesService } from '../../test/mockPluginCollaborators.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
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
  let mockFieldValues: ReturnType<typeof createMockPluginFieldValuesService>
  let paletteRepo: ReturnType<typeof createMockRepository<Palette>>
  let firmwareRepo: ReturnType<typeof createMockRepository<Firmware>>
  let instanceSettingsRepo: ReturnType<typeof createMockRepository<InstanceSettings>>
  let service: ConfigurationExportService

  beforeEach(() => {
    pluginRepo = createMockRepository()
    deviceRepo = createMockRepository()
    screenRepo = createMockRepository()
    devicePluginRepo = createMockRepository()
    mockFieldValues = createMockPluginFieldValuesService()
    paletteRepo = createMockRepository()
    firmwareRepo = createMockRepository()
    instanceSettingsRepo = createMockRepository()

    pluginRepo.find.mockResolvedValue([])
    deviceRepo.find.mockResolvedValue([])
    screenRepo.find.mockResolvedValue([])
    devicePluginRepo.find.mockResolvedValue([])
    paletteRepo.find.mockResolvedValue([])
    firmwareRepo.find.mockResolvedValue([])
    instanceSettingsRepo.findOneBy.mockResolvedValue(null)

    service = new ConfigurationExportService(
      asRepository(pluginRepo),
      asRepository(deviceRepo),
      asRepository(screenRepo),
      asRepository(devicePluginRepo),
      asRepository(paletteRepo),
      asRepository(firmwareRepo),
      asRepository(instanceSettingsRepo),
      new PluginExporterService(),
      asService<PluginFieldValuesService>(mockFieldValues),
    )
  })

  it('writes a manifest.json with schemaVersion, exportedAt, and containsSecrets', async () => {
    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const manifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf8'))

    expect(manifest.schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
    expect(manifest.containsSecrets).toBe(true)
    expect(manifest.redacted).toBeUndefined()
    expect(typeof manifest.kuroshiroVersion).toBe('string')
    expect(typeof manifest.exportedAt).toBe('string')
  })

  it('writes containsSecrets: false and redacted: true when the redact option is set', async () => {
    const buffer = await service.exportToZip({ redact: true })
    const zip = new AdmZip(buffer)
    const manifest = JSON.parse(zip.getEntry('manifest.json')!.getData().toString('utf8'))

    expect(manifest.containsSecrets).toBe(false)
    expect(manifest.redacted).toBe(true)
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

  it('writes the Recipe Snapshot into the Plugin manifest entry, and null when the Plugin has none', async () => {
    const snapshot = { name: 'Daily Weather', kind: 'Poll', refreshInterval: 30, dataSources: [], templates: [], fields: [], sourceRecipeId: '150460' }
    const importedPlugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: snapshot })
    const handBuiltPlugin = makePlugin({ id: 'plugin-2' })
    pluginRepo.find.mockResolvedValue([importedPlugin, handBuiltPlugin])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const pluginsJson = JSON.parse(zip.getEntry('plugins.json')!.getData().toString('utf8'))

    expect(pluginsJson.find((p: { id: string }) => p.id === 'plugin-1').sourceRecipeSnapshot).toEqual(snapshot)
    expect(pluginsJson.find((p: { id: string }) => p.id === 'plugin-2').sourceRecipeSnapshot).toBeNull()
  })

  it('redacts Data Source header values in the Recipe Snapshot, but not keys or other fields, when redact is set', async () => {
    const snapshot = {
      name: 'Daily Weather',
      kind: 'Poll',
      refreshInterval: 30,
      dataSources: [{ name: 'source', mode: 'fetch', url: 'https://api.example.com', headers: { Authorization: 'Bearer real-token' }, body: {} }],
      templates: [],
      fields: [],
      sourceRecipeId: '150460',
    }
    const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: snapshot })
    pluginRepo.find.mockResolvedValue([plugin])

    const buffer = await service.exportToZip({ redact: true })
    const zip = new AdmZip(buffer)
    const pluginsJson = JSON.parse(zip.getEntry('plugins.json')!.getData().toString('utf8'))
    const entry = pluginsJson.find((p: { id: string }) => p.id === 'plugin-1')

    expect(entry.sourceRecipeSnapshot.dataSources[0].headers).toEqual({ Authorization: CONFIGURATION_REDACTION_SENTINEL })
    expect(entry.sourceRecipeSnapshot.dataSources[0].url).toBe('https://api.example.com')
  })

  it('redacts a Recipe Snapshot with no dataSources field without throwing, when redact is set', async () => {
    const plugin = makePlugin({ id: 'plugin-1', sourceRecipeId: '150460', sourceRecipeSnapshot: { name: 'Daily Weather' } })
    pluginRepo.find.mockResolvedValue([plugin])

    const buffer = await service.exportToZip({ redact: true })
    const zip = new AdmZip(buffer)
    const pluginsJson = JSON.parse(zip.getEntry('plugins.json')!.getData().toString('utf8'))
    const entry = pluginsJson.find((p: { id: string }) => p.id === 'plugin-1')

    expect(entry.sourceRecipeSnapshot).toEqual({ name: 'Daily Weather', dataSources: [] })
  })

  it('redacts Data Source header values but not keys, url, or body, in the nested .trmnlp settings.yml, when redact is set', async () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      dataSources: [makePluginDataSource({
        id: 'ds-1',
        name: 'source',
        url: 'https://example.com/data?key=super-secret',
        headers: { 'Authorization': 'Bearer real-token', 'X-Custom': 'real-value' },
        body: { apiKey: 'real-body-secret' },
      })],
      templates: [makePluginTemplate({ id: 'tpl-1', layout: 'full' })],
    })
    pluginRepo.find.mockResolvedValue([plugin])

    const buffer = await service.exportToZip({ redact: true })
    const zip = new AdmZip(buffer)
    const settings = zip.getEntry('plugins/plugin-1/src/settings.yml')!.getData().toString('utf8')

    expect(settings).toContain(`Authorization: ${CONFIGURATION_REDACTION_SENTINEL}`)
    expect(settings).toContain(`X-Custom: ${CONFIGURATION_REDACTION_SENTINEL}`)
    expect(settings).not.toContain('real-token')
    expect(settings).not.toContain('real-value')
    expect(settings).toContain('key=super-secret')
    expect(settings).toContain('real-body-secret')
  })

  it('does not redact headers in the nested .trmnlp settings.yml without the redact option', async () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      dataSources: [makePluginDataSource({ id: 'ds-1', name: 'source', headers: { Authorization: 'Bearer real-token' } })],
      templates: [makePluginTemplate({ id: 'tpl-1', layout: 'full' })],
    })
    pluginRepo.find.mockResolvedValue([plugin])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const settings = zip.getEntry('plugins/plugin-1/src/settings.yml')!.getData().toString('utf8')

    expect(settings).toContain('Bearer real-token')
  })

  it('redacts password-type Field Values and a set webhookToken in plugins.json, leaving other Field Values and an unset webhookToken alone', async () => {
    const plugin = makePlugin({
      id: 'plugin-1',
      kind: 'Webhook',
      webhookToken: 'real-webhook-token',
      fields: [
        makePluginField({ id: 'field-1', keyname: 'api_key', fieldType: 'password' }),
        makePluginField({ id: 'field-2', keyname: 'city', fieldType: 'string' }),
      ],
    })
    const pluginNoToken = makePlugin({ id: 'plugin-2', webhookToken: null })
    pluginRepo.find.mockResolvedValue([plugin, pluginNoToken])
    mockFieldValues.storedByPlugin.mockResolvedValue(new Map([['plugin-1', { api_key: 'real-secret', city: 'Berlin' }]]))

    const buffer = await service.exportToZip({ redact: true })
    const zip = new AdmZip(buffer)
    const pluginsJson = JSON.parse(zip.getEntry('plugins.json')!.getData().toString('utf8'))

    const entry = pluginsJson.find((p: { id: string }) => p.id === 'plugin-1')
    expect(entry.webhookToken).toBe(CONFIGURATION_REDACTION_SENTINEL)
    expect(entry.fieldValues).toEqual({ api_key: CONFIGURATION_REDACTION_SENTINEL, city: 'Berlin' })
    expect(entry).not.toHaveProperty('variables')

    const entryNoToken = pluginsJson.find((p: { id: string }) => p.id === 'plugin-2')
    expect(entryNoToken.webhookToken).toBeNull()
  })

  it('redacts Device apikey and a set mirrorApikey in devices.json, when redact is set', async () => {
    const device = makeDevice({ id: 'device-1', apikey: 'real-apikey', mirrorApikey: 'real-mirror-key' })
    const deviceNoMirror = makeDevice({ id: 'device-2', apikey: 'real-apikey-2' })
    deviceRepo.find.mockResolvedValue([device, deviceNoMirror])

    const buffer = await service.exportToZip({ redact: true })
    const zip = new AdmZip(buffer)
    const devicesJson = JSON.parse(zip.getEntry('devices.json')!.getData().toString('utf8'))

    const entry = devicesJson.find((d: { id: string }) => d.id === 'device-1')
    expect(entry.apikey).toBe(CONFIGURATION_REDACTION_SENTINEL)
    expect(entry.mirrorApikey).toBe(CONFIGURATION_REDACTION_SENTINEL)

    const entryNoMirror = devicesJson.find((d: { id: string }) => d.id === 'device-2')
    expect(entryNoMirror.apikey).toBe(CONFIGURATION_REDACTION_SENTINEL)
    expect(entryNoMirror.mirrorApikey).toBeNull()
  })

  it('does not send secrets when redact is not set (default unredacted behavior)', async () => {
    const device = makeDevice({ id: 'device-1', apikey: 'real-apikey' })
    deviceRepo.find.mockResolvedValue([device])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const devicesJson = JSON.parse(zip.getEntry('devices.json')!.getData().toString('utf8'))

    expect(devicesJson[0].apikey).toBe('real-apikey')
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

  it('leaves a Screen\'s remembered Render Signal out of screens.json, being runtime state', async () => {
    const device = makeDevice({ id: 'device-1' })
    const screen = makeScreen({ id: 'screen-1', device, renderSignal: 'skip' })
    screenRepo.find.mockResolvedValue([screen])

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const screensJson = JSON.parse(zip.getEntry('screens.json')!.getData().toString('utf8'))

    expect(screensJson[0]).not.toHaveProperty('renderSignal')
  })

  it('writes a Plugin\'s Field Values, secrets included, on its plugins.json entry and none on the assignments.json entry', async () => {
    const device = makeDevice({ id: 'device-1' })
    const plugin = makePlugin({
      id: 'plugin-1',
      fields: [
        makePluginField({ id: 'field-1', keyname: 'api_key', fieldType: 'password' }),
        makePluginField({ id: 'field-2', keyname: 'city', fieldType: 'string' }),
      ],
    })
    pluginRepo.find.mockResolvedValue([plugin])
    devicePluginRepo.find.mockResolvedValue([makeDevicePlugin({ id: 'dp-1', device, plugin, order: 0, isActive: true })])
    mockFieldValues.storedByPlugin.mockResolvedValue(new Map([['plugin-1', { api_key: 'real-secret', city: 'Berlin' }]]))

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const pluginsJson = JSON.parse(zip.getEntry('plugins.json')!.getData().toString('utf8'))
    const assignmentsJson = JSON.parse(zip.getEntry('assignments.json')!.getData().toString('utf8'))

    expect(pluginsJson[0].fieldValues).toEqual({ api_key: 'real-secret', city: 'Berlin' })
    expect(assignmentsJson).toEqual([{ id: 'dp-1', deviceId: 'device-1', pluginId: 'plugin-1', order: 0, isActive: true }])
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

  it('writes an empty settings.json when no Instance Settings row exists', async () => {
    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const settingsJson = JSON.parse(zip.getEntry('settings.json')!.getData().toString('utf8'))

    expect(settingsJson).toEqual({})
  })

  it('writes only the overridden Settings to settings.json, omitting an unset one', async () => {
    instanceSettingsRepo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: 15, offlineMultiplier: null, fetchFailureThreshold: 5 })

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const settingsJson = JSON.parse(zip.getEntry('settings.json')!.getData().toString('utf8'))

    expect(settingsJson).toEqual({ lowBatteryPercent: 15, fetchFailureThreshold: 5 })
  })

  it('writes an overridden firmwareAutoUpdate to settings.json', async () => {
    instanceSettingsRepo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, firmwareAutoUpdate: true })

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const settingsJson = JSON.parse(zip.getEntry('settings.json')!.getData().toString('utf8'))

    expect(settingsJson).toEqual({ firmwareAutoUpdate: true })
  })

  it('writes an overridden Retention age to settings.json, 0 included, and leaves a non-overridden one out', async () => {
    instanceSettingsRepo.findOneBy.mockResolvedValue({ id: 1, alertRetentionDays: 0, deviceLogRetentionDays: null })

    const buffer = await service.exportToZip()
    const zip = new AdmZip(buffer)
    const settingsJson = JSON.parse(zip.getEntry('settings.json')!.getData().toString('utf8'))

    expect(settingsJson).toEqual({ alertRetentionDays: 0 })
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
