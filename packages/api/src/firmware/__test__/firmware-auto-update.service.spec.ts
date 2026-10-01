import type { Device } from '../../devices/devices.entity.js'
import type { InstanceSettingsService } from '../../settings/instance-settings.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice, makeFirmware } from '../../test/fixtures.js'
import { OG_PLUS, V2 } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { FirmwareAutoUpdateService } from '../firmware-auto-update.service.js'

describe('firmwareAutoUpdateService', () => {
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let settingsService: { resolveFirmwareAutoUpdate: ReturnType<typeof vi.fn> }
  let service: FirmwareAutoUpdateService

  const officialFirmware = makeFirmware({ id: 'fw-official', version: '1.5.6', kind: 'official-synced', compatibleModels: ['og_png', 'og_plus', 'og_bwry'] })

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    deviceRepo.find.mockResolvedValue([])
    deviceRepo.save.mockImplementation(async device => device as Device)
    settingsService = { resolveFirmwareAutoUpdate: vi.fn().mockResolvedValue(true) }
    service = new FirmwareAutoUpdateService(asRepository(deviceRepo), asService<InstanceSettingsService>(settingsService))
  })

  it('does nothing when the toggle is off', async () => {
    settingsService.resolveFirmwareAutoUpdate.mockResolvedValue(false)
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: OG_PLUS })])

    const count = await service.applyPolicy(officialFirmware)

    expect(count).toBe(0)
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('assigns the Firmware to an eligible Device', async () => {
    const device = makeDevice({ id: 'device-1', deviceModel: OG_PLUS, updateFirmware: false })
    deviceRepo.find.mockResolvedValue([device])

    const count = await service.applyPolicy(officialFirmware)

    expect(deviceRepo.find).toHaveBeenCalledWith({ where: { updateFirmware: false } })
    expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'device-1', targetFirmware: officialFirmware, updateFirmware: true }))
    expect(count).toBe(1)
  })

  it('skips a mirrored Device', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: OG_PLUS, mirrorEnabled: true })])

    const count = await service.applyPolicy(officialFirmware)

    expect(count).toBe(0)
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('skips a Device without a Device Model', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: null })])

    const count = await service.applyPolicy(officialFirmware)

    expect(count).toBe(0)
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('skips a Device whose model is outside compatibleModels', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: V2 })])

    const count = await service.applyPolicy(officialFirmware)

    expect(count).toBe(0)
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('never asks for a Device with a pending push, since those are excluded from the query', async () => {
    await service.applyPolicy(officialFirmware)
    expect(deviceRepo.find).toHaveBeenCalledWith({ where: { updateFirmware: false } })
  })
})
