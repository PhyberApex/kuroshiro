import type { DataSource } from 'typeorm'
import type { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import type { PluginSchedulerService } from '../../plugins/services/plugin-scheduler.service.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Palette } from '../../device-models/entities/palette.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { Firmware } from '../../firmware/entities/firmware.entity.js'
import { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
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

describe('a Plugin\'s Fields, through Configuration Export and Import, against a real database', () => {
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

  /** A Plugin with a null description, whose second Field is stored first and was edited since, so the rows come back out of `order`. */
  async function seedPlugin(): Promise<Plugin> {
    const plugin = await database.getRepository(Plugin).save({ name: 'Weather', kind: 'Poll', description: null })
    await database.getRepository(PluginTemplate).save({ plugin, layout: 'full', liquidMarkup: 'Hello' })
    const fields = database.getRepository(PluginField)
    const units = await fields.save({ plugin, keyname: 'units', fieldType: 'string', name: 'Units', description: 'metric or imperial', defaultValue: 'metric', order: 2 })
    await fields.save({ plugin, keyname: 'town', fieldType: 'string', name: 'Town', description: null, defaultValue: null, required: true, order: 1 })
    await fields.update({ id: units.id }, { name: 'Unit system' })
    return plugin
  }

  async function storedFields(pluginId: string) {
    const rows = await database.getRepository(PluginField).find({ where: { plugin: { id: pluginId } }, order: { order: 'ASC' } })
    return rows.map(({ id, keyname, name, description, defaultValue, required, order }) => ({ id, keyname, name, description, defaultValue, required, order }))
  }

  it('restores the Fields in their order with their nulls, and the Plugin\'s null description, onto a fresh instance', async () => {
    const plugin = await seedPlugin()
    const before = await storedFields(plugin.id)
    const archive = await exportService.exportToZip()

    // A fresh instance has none of the Plugin's rows.
    await database.synchronize(true)
    await importService.importFromZip(archive)

    expect(await storedFields(plugin.id)).toEqual(before)
    expect(before.map(field => field.keyname)).toEqual(['town', 'units'])
    expect((await database.getRepository(Plugin).findOneByOrFail({ id: plugin.id })).description).toBeNull()
  })

  it('clears a description and a default edited in since the export, as the archive holds none', async () => {
    const plugin = await seedPlugin()
    const before = await storedFields(plugin.id)
    const archive = await exportService.exportToZip()
    await database.getRepository(Plugin).update({ id: plugin.id }, { description: 'Edited' })
    await database.getRepository(PluginField).update({ keyname: 'town' }, { description: 'Edited', defaultValue: 'Berlin', order: 5 })

    await importService.importFromZip(archive)

    expect(await storedFields(plugin.id)).toEqual(before)
    expect((await database.getRepository(Plugin).findOneByOrFail({ id: plugin.id })).description).toBeNull()
  })
})
