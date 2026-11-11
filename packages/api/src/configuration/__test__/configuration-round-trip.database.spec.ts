import type { DataSource } from 'typeorm'
import type { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import type { PluginSchedulerService } from '../../plugins/services/plugin-scheduler.service.js'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { PluginTemplate } from '../../plugins/entities/plugin-template.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginExporterService } from '../../plugins/services/plugin-exporter.service.js'
import { PluginImporterService } from '../../plugins/services/plugin-importer.service.js'
import { Schedule } from '../../schedule/schedule.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { ConfigurationExportService } from '../services/configuration-export.service.js'
import { ConfigurationImportService } from '../services/configuration-import.service.js'

/** The tables a Configuration Archive carries, each read by its id alone, so runtime state the import resets on purpose does not count. */
const CARRIED_TABLES = ['palette', 'firmware', 'plugin', 'plugin_template', 'plugin_field', 'device', 'device_plugin', 'screen', 'schedule', 'mashup_configuration', 'mashup_slot']

describe('a whole Instance, through Configuration Export and Import, against a real database', () => {
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

  /** One of everything an archive carries, made the way the API makes it: a custom Palette's id is a fresh UUID. */
  async function seedInstance(): Promise<void> {
    const palette = await database.getRepository(Palette).save({ id: randomUUID(), name: 'Warm red', kind: 'custom', grays: 2, colors: ['#000000', '#FFFFFF', '#FF0000'], frameworkClass: 'screen--color-3bwr', grayscaleBitDepth: null, deprecated: false })
    const firmware = await database.getRepository(Firmware).save({ version: '2.0.3', kind: 'custom', checksum: 'abc', compatibleModels: [], uploadedAt: new Date('2026-10-01T08:00:00.000Z') })
    const plugin = await database.getRepository(Plugin).save({ name: 'Weather', kind: 'Poll', mergeStrategy: 'deep_merge' })
    await database.getRepository(PluginTemplate).save({ plugin, layout: 'full', liquidMarkup: 'Hello' })
    await database.getRepository(PluginField).save({ plugin, keyname: 'town', fieldType: 'string', name: 'Town', order: 1 })
    const device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300, rotationMode: 'manual', palette, targetFirmware: firmware })
    const assignment = await database.getRepository(DevicePlugin).save({ device, plugin, order: 1, isActive: true })
    const pluginScreen = await database.getRepository(Screen).save({ device, type: 'plugin', order: 1, plugin, devicePluginId: assignment.id, generatedAt: new Date() })
    await database.getRepository(Schedule).save({ screen: pluginScreen, enabled: true, weekdays: [1, 2, 3], startTime: '08:00:00', endTime: '18:00:00' })
    const mashupScreen = await database.getRepository(Screen).save({ device, type: 'mashup', order: 2, generatedAt: new Date() })
    const mashup = await database.getRepository(MashupConfiguration).save({ screen: mashupScreen, layout: '1Lx1R' })
    await database.getRepository(MashupSlot).save([
      { mashupConfiguration: mashup, plugin, position: 'left', size: 'half_vertical', order: 1 },
      { mashupConfiguration: mashup, plugin, position: 'right', size: 'half_vertical', order: 2 },
    ])
    await database.getRepository(Screen).save({ device, type: 'html', order: 3, html: '<p>Hi</p>', generatedAt: new Date() })
  }

  async function carriedIds(): Promise<Record<string, string[]>> {
    const rows = await Promise.all(CARRIED_TABLES.map(table => database.query(`SELECT id FROM "${table}" ORDER BY id`) as Promise<Array<{ id: string }>>))
    return Object.fromEntries(CARRIED_TABLES.map((table, index) => [table, rows[index].map(row => row.id)]))
  }

  it('restores every record of an exported Instance onto a fresh one, its custom Palette as it was', async () => {
    await seedInstance()
    const before = await carriedIds()
    const paletteBefore = await database.getRepository(Palette).find()
    const archive = await exportService.exportToZip()

    await database.synchronize(true)
    const summary = await importService.importFromZip(archive)

    expect(summary.created).toMatchObject({ palettes: 1, firmware: 1, plugins: 1, templates: 1, fields: 1, devices: 1, assignments: 1, screens: 3, schedules: 1, mashupConfigurations: 1, mashupSlots: 2 })
    expect(await carriedIds()).toEqual(before)
    expect(await database.getRepository(Palette).find()).toEqual(paletteBefore)
    expect(await database.getRepository(Device).findOneOrFail({ where: {}, relations: { palette: true, targetFirmware: true } })).toMatchObject({ palette: { id: paletteBefore[0].id }, targetFirmware: { id: before.firmware[0] } })
  })
})
