import type { Device } from '../../devices/devices.entity.js'
import type { InstanceSettingsService } from '../../settings/instance-settings.service.js'
import type { Firmware } from '../entities/firmware.entity.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice, makeFirmware } from '../../test/fixtures.js'
import { OG_PLUS, V2 } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { FirmwareAutoUpdateService } from '../firmware-auto-update.service.js'

describe('firmwareAutoUpdateService', () => {
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let settingsService: { resolveFirmwareAutoUpdate: ReturnType<typeof vi.fn> }
  let firmwareRepo: ReturnType<typeof createMockRepository<Firmware>>
  let service: FirmwareAutoUpdateService

  const officialFirmware = makeFirmware({ id: 'fw-official', version: '1.5.6', kind: 'official-synced', folder: 'trmnl_og', compatibleModels: ['og_png', 'og_plus'] })
  const officialXFirmware = makeFirmware({ id: 'fw-official-x', version: '1.5.6', kind: 'official-synced', folder: 'trmnl_x', compatibleModels: ['v2'] })

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    deviceRepo.find.mockResolvedValue([])
    deviceRepo.save.mockImplementation(async device => device as Device)
    settingsService = { resolveFirmwareAutoUpdate: vi.fn().mockResolvedValue(true) }
    firmwareRepo = createMockRepository<Firmware>()
    firmwareRepo.find.mockResolvedValue([officialFirmware])
    service = new FirmwareAutoUpdateService(asRepository(deviceRepo), asRepository(firmwareRepo), asService<InstanceSettingsService>(settingsService))
  })

  it('does nothing when the toggle is off', async () => {
    settingsService.resolveFirmwareAutoUpdate.mockResolvedValue(false)
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: OG_PLUS })])

    const assigned = await service.applyPolicy(officialFirmware)

    expect(assigned).toEqual([])
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('assigns the Firmware to an eligible Device', async () => {
    const device = makeDevice({ id: 'device-1', deviceModel: OG_PLUS, updateFirmware: false })
    deviceRepo.find.mockResolvedValue([device])

    const assigned = await service.applyPolicy(officialFirmware)

    expect(deviceRepo.find).toHaveBeenCalledWith({ where: { updateFirmware: false } })
    expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'device-1', targetFirmware: officialFirmware, updateFirmware: true }))
    expect(assigned).toEqual([device])
  })

  it('skips a mirrored Device', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: OG_PLUS, mirrorEnabled: true })])

    const assigned = await service.applyPolicy(officialFirmware)

    expect(assigned).toEqual([])
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('skips a Device without a Device Model', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: null })])

    const assigned = await service.applyPolicy(officialFirmware)

    expect(assigned).toEqual([])
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('skips a Device whose model is outside compatibleModels', async () => {
    deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: V2 })])

    const assigned = await service.applyPolicy(officialFirmware)

    expect(assigned).toEqual([])
    expect(deviceRepo.save).not.toHaveBeenCalled()
  })

  it('never asks for a Device with a pending push, since those are excluded from the query', async () => {
    await service.applyPolicy(officialFirmware)
    expect(deviceRepo.find).toHaveBeenCalledWith({ where: { updateFirmware: false } })
  })

  describe('catch up', () => {
    it('assigns the current official Firmware to eligible Devices that are behind or unknown', async () => {
      const behind = makeDevice({ id: 'behind', deviceModel: OG_PLUS, fwVersion: '1.5.0' })
      const unknown = makeDevice({ id: 'unknown', deviceModel: OG_PLUS })
      const current = makeDevice({ id: 'current', deviceModel: OG_PLUS, fwVersion: '1.5.6' })
      const mirrored = makeDevice({ id: 'mirrored', deviceModel: OG_PLUS, fwVersion: '1.5.0', mirrorEnabled: true })
      const incompatible = makeDevice({ id: 'incompatible', deviceModel: V2, fwVersion: '1.5.0' })
      deviceRepo.find.mockResolvedValue([behind, unknown, current, mirrored, incompatible])

      const { newest, assigned } = await service.catchUp()

      expect(firmwareRepo.find).toHaveBeenCalledWith({ where: { kind: 'official-synced', deprecated: false }, order: { syncedAt: 'DESC' } })
      expect(newest).toBe(officialFirmware)
      expect(assigned).toEqual([behind, unknown])
      expect(deviceRepo.find).toHaveBeenCalledWith({ where: { updateFirmware: false } })
      expect(deviceRepo.save).toHaveBeenCalledTimes(2)
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'behind', targetFirmware: officialFirmware, updateFirmware: true }))
    })

    it('gives each Device the current official Firmware of its own Device Model', async () => {
      firmwareRepo.find.mockResolvedValue([officialXFirmware, officialFirmware])
      const og = makeDevice({ id: 'og', deviceModel: OG_PLUS, fwVersion: '1.5.0' })
      const x = makeDevice({ id: 'x', deviceModel: V2, fwVersion: '1.5.0' })
      deviceRepo.find.mockResolvedValue([og, x])

      const { newest, assigned } = await service.catchUp()

      expect(newest).toBe(officialXFirmware)
      expect(assigned).toEqual([og, x])
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'og', targetFirmware: officialFirmware }))
      expect(deviceRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'x', targetFirmware: officialXFirmware }))
    })

    it('compares a Device with the version of its own Device Model\'s Firmware', async () => {
      const olderX = makeFirmware({ ...officialXFirmware, version: '1.5.5' })
      firmwareRepo.find.mockResolvedValue([officialFirmware, olderX])
      deviceRepo.find.mockResolvedValue([makeDevice({ id: 'x', deviceModel: V2, fwVersion: '1.5.5' })])

      const { behind } = await service.previewCatchUp()

      expect(behind).toEqual([])
    })

    it('previews without saving', async () => {
      deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: OG_PLUS, fwVersion: '1.5.0' })])
      const { behind } = await service.previewCatchUp()
      expect(behind).toHaveLength(1)
      expect(deviceRepo.save).not.toHaveBeenCalled()
    })

    it('does nothing while the Setting is off', async () => {
      settingsService.resolveFirmwareAutoUpdate.mockResolvedValue(false)
      deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: OG_PLUS })])
      expect(await service.catchUp()).toEqual({ newest: null, assigned: [] })
      expect(deviceRepo.save).not.toHaveBeenCalled()
    })

    it('does nothing with no current official Firmware', async () => {
      firmwareRepo.find.mockResolvedValue([])
      deviceRepo.find.mockResolvedValue([makeDevice({ deviceModel: OG_PLUS })])
      expect(await service.catchUp()).toEqual({ newest: null, assigned: [] })
      expect(deviceRepo.save).not.toHaveBeenCalled()
    })
  })
})
