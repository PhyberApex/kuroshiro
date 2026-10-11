import type { ConfigService } from '@nestjs/config'
import type { ConfigurationImportSummary } from 'kuroshiro-shared'
import type { DeviceModelSyncService } from '../../../device-models/device-model-sync.service.js'
import type { Device } from '../../../devices/devices.entity.js'
import type { Plugin } from '../../../plugins/entities/plugin.entity.js'
import type { ConfigurationImportService } from '../../services/configuration-import.service.js'
import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asRepository, createMockRepository } from '../../../test/mockRepository.js'
import { asService } from '../../../test/mockService.js'
import { ShowcaseSeedService } from '../showcase-seed.service.js'

describe('showcaseSeedService', () => {
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let deviceModelSync: { seedFromSnapshot: ReturnType<typeof vi.fn> }
  let configurationImport: { importFromZip: ReturnType<typeof vi.fn> }
  let configService: { get: ReturnType<typeof vi.fn> }
  let service: ShowcaseSeedService

  const emptySummary: ConfigurationImportSummary = { created: {}, updated: {}, warnings: [] }

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    pluginRepo = createMockRepository<Plugin>()
    deviceRepo.count.mockResolvedValue(0)
    pluginRepo.count.mockResolvedValue(0)
    deviceModelSync = { seedFromSnapshot: vi.fn().mockResolvedValue({ models: 0, palettes: 0 }) }
    configurationImport = { importFromZip: vi.fn().mockResolvedValue(emptySummary) }
    configService = { get: vi.fn().mockReturnValue(true) }

    service = new ShowcaseSeedService(
      asService<ConfigService>(configService),
      asRepository(deviceRepo),
      asRepository(pluginRepo),
      asService<DeviceModelSyncService>(deviceModelSync),
      asService<ConfigurationImportService>(configurationImport),
    )
  })

  it('does nothing when demo mode is off', async () => {
    configService.get.mockReturnValue(false)

    await service.onApplicationBootstrap()

    expect(configurationImport.importFromZip).not.toHaveBeenCalled()
    expect(deviceModelSync.seedFromSnapshot).not.toHaveBeenCalled()
  })

  it('does nothing when demo mode is on but a Device already exists', async () => {
    deviceRepo.count.mockResolvedValue(1)

    await service.onApplicationBootstrap()

    expect(configurationImport.importFromZip).not.toHaveBeenCalled()
  })

  it('does nothing when demo mode is on but a Plugin already exists', async () => {
    pluginRepo.count.mockResolvedValue(1)

    await service.onApplicationBootstrap()

    expect(configurationImport.importFromZip).not.toHaveBeenCalled()
  })

  it('seeds the Device Model snapshot and imports the showcase archive when demo mode is on and the database is empty', async () => {
    await service.onApplicationBootstrap()

    expect(deviceModelSync.seedFromSnapshot).toHaveBeenCalledTimes(1)
    expect(configurationImport.importFromZip).toHaveBeenCalledTimes(1)
    expect(configurationImport.importFromZip).toHaveBeenCalledWith(expect.any(Buffer))
  })

  it('logs the failure and does not throw when the import fails', async () => {
    configurationImport.importFromZip.mockRejectedValue(new Error('boom'))

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()
  })
})
