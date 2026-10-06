import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { DeviceModel } from '../../device-models/entities/device-model.entity.js'
import type { Palette } from '../../device-models/entities/palette.entity.js'
import type { FirmwareService } from '../../firmware/firmware.service.js'
import type { ScreensService } from '../../screens/screens.service.js'
import type { MockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import type { Device } from '../devices.entity.js'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice, makeFirmware } from '../../test/fixtures.js'
import { BW, createMockDeviceModelsService, CUSTOM_RED_3BWR, GRAY_4, GRAY_16, OG_PLUS, V2 } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { DevicesService } from '../devices.service.js'

const DEVICE_ID = '7b0c6a3e-5d1f-4f7a-9c1e-2a4b6c8d0e1f'

describe('devicesService', () => {
  let service: DevicesService
  let repo: ReturnType<typeof createMockRepository<Device>>
  let deviceModels: MockDeviceModelsService
  let firmwareService: { findById: ReturnType<typeof vi.fn> }
  let screensService: { reconvertImageScreens: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = createMockRepository<Device>()
    deviceModels = createMockDeviceModelsService()
    deviceModels.supportsPalette.mockImplementation(async (model: DeviceModel, palette: Palette) => model.paletteIds.includes(palette.id))
    firmwareService = { findById: vi.fn() }
    screensService = { reconvertImageScreens: vi.fn().mockResolvedValue(0) }
    service = new DevicesService(
      asRepository(repo),
      asService<DeviceModelsService>(deviceModels),
      asService<FirmwareService>(firmwareService),
      asService<ScreensService>(screensService),
    )
  })

  const baseDevice: Device = makeDevice({
    id: '1',
    friendlyId: 'abc',
    mac: '00:11:22:33:44:55',
    apikey: 'key',
    refreshRate: 60,
    resetDevice: false,
    updateFirmware: false,
    specialFunction: 'identify',
  })

  it('findById returns a device by id', async () => {
    repo.findOneBy.mockResolvedValue(baseDevice)
    const result = await service.findById('1')
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(result).toBe(baseDevice)
  })

  it('create creates and saves a new device with a friendlyId', async () => {
    const device = { mac: '00:11:22:33:44:55', name: 'Test Device' }
    repo.create.mockReturnValue(baseDevice)
    repo.save.mockResolvedValue(baseDevice)
    const result = await service.create(device)
    expect(repo.create).toHaveBeenCalled()
    expect(repo.save).toHaveBeenCalledWith(baseDevice)
    expect(result).toBe(baseDevice)
  })

  it('update updates and saves an existing device', async () => {
    repo.findOneBy.mockResolvedValue(baseDevice)
    const updated = makeDevice({ ...baseDevice, name: 'Pantry' })
    repo.save.mockResolvedValue(updated)
    const result = await service.update(DEVICE_ID, { name: 'Pantry' })
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: DEVICE_ID })
    expect(repo.save).toHaveBeenCalledWith({ ...baseDevice, name: 'Pantry' })
    expect(result).toEqual(updated)
  })

  it('update returns null if device not found', async () => {
    repo.findOneBy.mockResolvedValue(null)
    const result = await service.update(DEVICE_ID, { name: 'Pantry' })
    expect(result).toBeNull()
  })

  describe('update with sleep mode', () => {
    it('rejects a PATCH that clears the window while sleep mode is already enabled', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, sleepModeEnabled: true, sleepStartTime: 79200, sleepEndTime: 21600 }))
      await expect(service.update(DEVICE_ID, { sleepStartTime: null })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('allows disabling sleep mode without sending the window', async () => {
      const device = makeDevice({ ...baseDevice, sleepModeEnabled: true, sleepStartTime: 79200, sleepEndTime: 21600 })
      repo.findOneBy.mockResolvedValue(device)
      repo.save.mockResolvedValue({ ...device, sleepModeEnabled: false })
      await expect(service.update(DEVICE_ID, { sleepModeEnabled: false })).resolves.toBeTruthy()
    })

    it('allows enabling sleep mode together with a full window in the same request', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, sleepModeEnabled: false, sleepStartTime: null, sleepEndTime: null }))
      repo.save.mockResolvedValue(makeDevice({ ...baseDevice, sleepModeEnabled: true, sleepStartTime: 79200, sleepEndTime: 21600 }))
      await expect(service.update(DEVICE_ID, { sleepModeEnabled: true, sleepStartTime: 79200, sleepEndTime: 21600 })).resolves.toBeTruthy()
    })
  })

  describe('update with device model and palette', () => {
    beforeEach(() => {
      repo.save.mockImplementation(async device => device as Device)
    })

    it('assigns a new model with its default palette', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 }))
      deviceModels.findByName.mockResolvedValue(V2)
      deviceModels.defaultPaletteFor.mockResolvedValue(GRAY_16)
      const result = (await service.update(DEVICE_ID, { deviceModelName: 'v2' }))!
      expect(deviceModels.findByName).toHaveBeenCalledWith('v2')
      expect(result.deviceModel).toBe(V2)
      expect(result.palette).toBe(GRAY_16)
      expect(screensService.reconvertImageScreens).toHaveBeenCalledWith(result)
    })

    it('assigns a new model together with an explicitly chosen palette', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 }))
      deviceModels.findByName.mockResolvedValue(V2)
      deviceModels.findPalette.mockResolvedValue(BW)
      const result = (await service.update(DEVICE_ID, { deviceModelName: 'v2', paletteId: 'bw' }))!
      expect(result.deviceModel).toBe(V2)
      expect(result.palette).toBe(BW)
      expect(deviceModels.defaultPaletteFor).not.toHaveBeenCalled()
    })

    it('changes only the palette when the model stays the same', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 }))
      deviceModels.findPalette.mockResolvedValue(BW)
      const result = (await service.update(DEVICE_ID, { deviceModelName: 'og_plus', paletteId: 'bw' }))!
      expect(deviceModels.findByName).not.toHaveBeenCalled()
      expect(result.deviceModel).toBe(OG_PLUS)
      expect(result.palette).toBe(BW)
      expect(screensService.reconvertImageScreens).toHaveBeenCalledWith(result)
    })

    it('does not reconvert images when neither model nor palette changed', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 }))
      deviceModels.findPalette.mockResolvedValue(GRAY_4)
      await service.update(DEVICE_ID, { name: 'renamed', deviceModelName: 'og_plus', paletteId: 'gray-4' })
      expect(screensService.reconvertImageScreens).not.toHaveBeenCalled()
    })

    it('rejects an unknown model', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS }))
      deviceModels.findByName.mockResolvedValue(null)
      await expect(service.update(DEVICE_ID, { deviceModelName: 'nope' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects a palette the model does not support', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 }))
      deviceModels.findPalette.mockResolvedValue(GRAY_16)
      await expect(service.update(DEVICE_ID, { paletteId: 'gray-16' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects a palette sent for a device with no assigned device model', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: null, palette: null }))
      await expect(service.update(DEVICE_ID, { paletteId: 'bw' })).rejects.toThrow(BadRequestException)
      expect(deviceModels.findPalette).not.toHaveBeenCalled()
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('fills in the default palette for a device that has a model but no palette', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: null }))
      deviceModels.defaultPaletteFor.mockResolvedValue(GRAY_4)
      const result = (await service.update(DEVICE_ID, { name: 'renamed' }))!
      expect(result.name).toBe('renamed')
      expect(result.palette).toBe(GRAY_4)
    })

    it('accepts a custom palette whose colour family is compatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 }))
      deviceModels.findPalette.mockResolvedValue(CUSTOM_RED_3BWR)
      deviceModels.supportsPalette.mockResolvedValue(true)
      const result = (await service.update(DEVICE_ID, { paletteId: CUSTOM_RED_3BWR.id }))!
      expect(deviceModels.supportsPalette).toHaveBeenCalledWith(OG_PLUS, CUSTOM_RED_3BWR)
      expect(result.palette).toBe(CUSTOM_RED_3BWR)
    })

    it('rejects a custom palette whose colour family is not compatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 }))
      deviceModels.findPalette.mockResolvedValue(CUSTOM_RED_3BWR)
      deviceModels.supportsPalette.mockResolvedValue(false)
      await expect(service.update(DEVICE_ID, { paletteId: CUSTOM_RED_3BWR.id })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })
  })

  describe('update with target firmware', () => {
    const compatibleFirmware = makeFirmware({ id: 'fw-1', version: '1.5.6', kind: 'official-synced', compatibleModels: ['og_plus'] })
    const universalFirmware = makeFirmware({ id: 'fw-2', version: '1.0.0', kind: 'custom', compatibleModels: [] })

    beforeEach(() => {
      repo.save.mockImplementation(async device => device as Device)
    })

    it('assigns a firmware compatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS }))
      firmwareService.findById.mockResolvedValue(compatibleFirmware)
      const result = (await service.update(DEVICE_ID, { targetFirmwareId: 'fw-1' }))!
      expect(firmwareService.findById).toHaveBeenCalledWith('fw-1')
      expect(result.targetFirmware).toBe(compatibleFirmware)
    })

    it('assigns a universal firmware (empty compatibleModels) regardless of device model', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: null }))
      firmwareService.findById.mockResolvedValue(universalFirmware)
      const result = (await service.update(DEVICE_ID, { targetFirmwareId: 'fw-2' }))!
      expect(result.targetFirmware).toBe(universalFirmware)
    })

    it('rejects a firmware incompatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: V2 }))
      firmwareService.findById.mockResolvedValue(compatibleFirmware)
      await expect(service.update(DEVICE_ID, { targetFirmwareId: 'fw-1' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects an unknown firmware id', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS }))
      firmwareService.findById.mockResolvedValue(null)
      await expect(service.update(DEVICE_ID, { targetFirmwareId: 'nope' })).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('is a no-op when targetFirmwareId is not provided', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, deviceModel: OG_PLUS }))
      await service.update(DEVICE_ID, { name: 'renamed' })
      expect(firmwareService.findById).not.toHaveBeenCalled()
    })
  })

  describe('resetDeviceNewApikey', () => {
    it('refuses it with device-proxied for a Proxied Device', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, mirrorEnabled: true, mirrorMac: baseDevice.mac }))
      await expect(service.update(DEVICE_ID, { resetDevice: true, resetDeviceNewApikey: true })).rejects.toMatchObject({ code: 'device-proxied' })
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('allows it for a mirrored but not Proxied Device', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, mirrorEnabled: true, mirrorMac: 'other-mac' }))
      repo.save.mockImplementation(async device => device as Device)
      const result = (await service.update(DEVICE_ID, { resetDevice: true, resetDeviceNewApikey: true }))!
      expect(result.resetDeviceNewApikey).toBe(true)
    })

    it('is cleared together with resetDevice when the Reset is cancelled', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, resetDevice: true, resetDeviceNewApikey: true }))
      repo.save.mockImplementation(async device => device as Device)
      const result = (await service.update(DEVICE_ID, { resetDevice: false }))!
      expect(result.resetDeviceNewApikey).toBe(false)
    })
  })

  describe('regenerateApikey', () => {
    it('rotates the apikey and saves it', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, apikey: 'old-key' }))
      repo.save.mockImplementation(async device => device as Device)
      const result = (await service.regenerateApikey(DEVICE_ID))!
      expect(result.apikey).not.toBe('old-key')
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ apikey: result.apikey }))
    })

    it('refuses it with device-proxied for a Proxied Device', async () => {
      repo.findOneBy.mockResolvedValue(makeDevice({ ...baseDevice, mirrorEnabled: true, mirrorMac: baseDevice.mac }))
      await expect(service.regenerateApikey(DEVICE_ID)).rejects.toMatchObject({ code: 'device-proxied' })
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('returns null if device not found', async () => {
      repo.findOneBy.mockResolvedValue(null)
      await expect(service.regenerateApikey(DEVICE_ID)).resolves.toBeNull()
    })
  })

  it('remove deletes a device and returns true', async () => {
    repo.findOneBy.mockResolvedValue(baseDevice)
    repo.remove.mockResolvedValue(baseDevice)
    const result = await service.remove(DEVICE_ID)
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: DEVICE_ID })
    expect(repo.remove).toHaveBeenCalledWith(baseDevice)
    expect(result).toBe(true)
  })

  it('remove returns false if device not found', async () => {
    repo.findOneBy.mockResolvedValue(null)
    const result = await service.remove(DEVICE_ID)
    expect(result).toBe(false)
  })
})
