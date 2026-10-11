import type { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import { CONFIGURATION_REDACTION_SENTINEL } from 'kuroshiro-shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceModelSyncService } from '../../../device-models/device-model-sync.service.js'
import { DeviceModel } from '../../../device-models/entities/device-model.entity.js'
import { Palette } from '../../../device-models/entities/palette.entity.js'
import { Device } from '../../../devices/devices.entity.js'
import { DevicePlugin } from '../../../plugins/entities/device-plugin.entity.js'
import { Plugin } from '../../../plugins/entities/plugin.entity.js'
import { PluginImporterService } from '../../../plugins/services/plugin-importer.service.js'
import { Schedule } from '../../../schedule/schedule.entity.js'
import { Screen } from '../../../screens/screens.entity.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../../test/mockDeviceModelsService.js'
import { asService } from '../../../test/mockService.js'
import { createTestDatabase } from '../../../test/testDatabase.js'
import { ConfigurationImportService } from '../../services/configuration-import.service.js'
import { buildShowcaseArchiveZip } from '../showcase-archive.js'
import { ShowcaseSeedService } from '../showcase-seed.service.js'

describe('the showcase seed, against a real database', () => {
  let database: DataSource
  let scheduler: { schedulePlugin: ReturnType<typeof vi.fn> }
  let configurationImport: ConfigurationImportService
  let deviceModelSync: DeviceModelSyncService
  let service: ShowcaseSeedService

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  beforeEach(async () => {
    await database.synchronize(true)
    scheduler = { schedulePlugin: vi.fn() }
    const deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)

    configurationImport = new ConfigurationImportService(
      database.getRepository(Plugin),
      new PluginImporterService(),
      asService(scheduler),
      asService(deviceModels),
    )
    deviceModelSync = new DeviceModelSyncService(database.getRepository(DeviceModel), database.getRepository(Palette), asService({}))

    service = new ShowcaseSeedService(
      asService<ConfigService>({ get: () => true }),
      database.getRepository(Device),
      database.getRepository(Plugin),
      deviceModelSync,
      configurationImport,
    )
  })

  afterAll(async () => {
    await database.destroy()
  })

  it('seeds the showcase Device, Screens, Mashup, Schedule and Poll Plugins, and schedules every Plugin', async () => {
    await service.onApplicationBootstrap()

    const devices = await database.getRepository(Device).find()
    expect(devices).toHaveLength(1)
    expect(devices[0].mac).toBe('DE:AD:BE:EF:00:01')
    expect(devices[0].apikey).not.toBe(CONFIGURATION_REDACTION_SENTINEL)

    const plugins = await database.getRepository(Plugin).find()
    expect(plugins).toHaveLength(3)
    expect(plugins.every(plugin => plugin.kind === 'Poll')).toBe(true)

    const screens = await database.getRepository(Screen).find()
    expect(screens).toHaveLength(3)
    expect(screens.map(screen => screen.type).sort()).toEqual(['mashup', 'plugin', 'plugin'])

    expect(await database.getRepository(Schedule).count()).toBe(1)
    expect(await database.getRepository(DevicePlugin).count()).toBe(2)

    expect(scheduler.schedulePlugin).toHaveBeenCalledTimes(3)
  })

  it('imports the archive with no device-model or palette warnings, once the Device Model snapshot is seeded', async () => {
    await deviceModelSync.seedFromSnapshot()

    const summary = await configurationImport.importFromZip(buildShowcaseArchiveZip())

    expect(summary.warnings.filter(w => w.kind === 'device-model-unknown' || w.kind === 'palette-unknown')).toEqual([])
  })

  it('does nothing on a second boot, once the first has seeded the database', async () => {
    await service.onApplicationBootstrap()
    const afterFirstBoot = await database.getRepository(Device).find()

    await service.onApplicationBootstrap()

    expect(await database.getRepository(Device).find()).toEqual(afterFirstBoot)
    expect(await database.getRepository(Plugin).count()).toBe(3)
  })

  it('leaves the database empty when demo mode is off', async () => {
    const offService = new ShowcaseSeedService(
      asService<ConfigService>({ get: () => false }),
      database.getRepository(Device),
      database.getRepository(Plugin),
      asService({}),
      asService({}),
    )

    await offService.onApplicationBootstrap()

    expect(await database.getRepository(Device).count()).toBe(0)
  })
})
