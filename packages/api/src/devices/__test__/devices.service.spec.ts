import type { Repository } from 'typeorm'
import type { MockDeviceModelsService } from '../../device-models/__test__/mockDeviceModelsService'
import type { Device } from '../devices.entity'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BW, createMockDeviceModelsService, CUSTOM_RED_3BWR, GRAY_4, GRAY_16, OG_PLUS, V2 } from '../../device-models/__test__/mockDeviceModelsService'
import { DevicesService } from '../devices.service'

interface MockRepository {
  find: ReturnType<typeof vi.fn>
  findOneBy: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

function createMockRepository(): MockRepository {
  return {
    find: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  }
}

describe('devicesService', () => {
  let service: DevicesService
  let repo: MockRepository
  let deviceModels: MockDeviceModelsService
  let firmwareService: { findById: ReturnType<typeof vi.fn> }
  let screensService: { reconvertImageScreens: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = createMockRepository()
    deviceModels = createMockDeviceModelsService()
    firmwareService = { findById: vi.fn() }
    screensService = { reconvertImageScreens: vi.fn().mockResolvedValue(0) }
    service = new DevicesService(repo as unknown as Repository<Device>, deviceModels as any, firmwareService as any, screensService as any)
  })

  const baseDevice = {
    id: '1',
    friendlyId: 'abc',
    mac: '00:11:22:33:44:55',
    apikey: 'key',
    refreshRate: 60,
    resetDevice: false,
    updateFirmware: false,
    screens: [],
    // Optional fields
    batteryVoltage: undefined,
    fwVersion: undefined,
    rssi: undefined,
    userAgent: undefined,
    width: undefined,
    height: undefined,
    mirrorEnabled: undefined,
    mirrorMac: undefined,
    mirrorApikey: undefined,
    specialFunction: 'identify',
  } as unknown as Device

  it('findAll returns all devices ordered by friendlyId', async () => {
    const devices = [baseDevice]
    repo.find.mockResolvedValue(devices)
    const result = await service.findAll()
    expect(repo.find).toHaveBeenCalledWith({ order: { friendlyId: 'ASC' } })
    expect(result).toBe(devices)
  })

  it('findById returns a device by id', async () => {
    repo.findOneBy.mockResolvedValue(baseDevice)
    const result = await service.findById('1')
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(result).toBe(baseDevice)
  })

  it('create creates and saves a new device with a friendlyId', async () => {
    const device: Partial<Device> = { mac: '00:11:22:33:44:55' }
    repo.create.mockReturnValue(baseDevice)
    repo.save.mockResolvedValue(baseDevice)
    const result = await service.create(device)
    expect(repo.create).toHaveBeenCalled()
    expect(repo.save).toHaveBeenCalledWith(baseDevice)
    expect(result).toBe(baseDevice)
  })

  it('update updates and saves an existing device', async () => {
    repo.findOneBy.mockResolvedValue(baseDevice)
    const updated = { ...baseDevice, mac: 'AA:BB:CC:DD:EE:FF' } as unknown as Device
    repo.save.mockResolvedValue(updated)
    const result = await service.update('1', { mac: 'AA:BB:CC:DD:EE:FF' } as any)
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(repo.save).toHaveBeenCalledWith({ ...baseDevice, mac: 'AA:BB:CC:DD:EE:FF' })
    expect(result).toEqual(updated)
  })

  it('update returns null if device not found', async () => {
    repo.findOneBy.mockResolvedValue(null)
    const result = await service.update('1', { mac: 'AA:BB:CC:DD:EE:FF' } as any)
    expect(result).toBeNull()
  })

  describe('update with device model and palette', () => {
    beforeEach(() => {
      repo.save.mockImplementation(async (device: Device) => device)
    })

    it('assigns a new model with its default palette', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 })
      deviceModels.findByName.mockResolvedValue(V2)
      deviceModels.defaultPaletteFor.mockResolvedValue(GRAY_16)
      const result = await service.update('1', { deviceModelName: 'v2' } as any)
      expect(deviceModels.findByName).toHaveBeenCalledWith('v2')
      expect(result.deviceModel).toBe(V2)
      expect(result.palette).toBe(GRAY_16)
      expect(screensService.reconvertImageScreens).toHaveBeenCalledWith(result)
    })

    it('assigns a new model together with an explicitly chosen palette', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 })
      deviceModels.findByName.mockResolvedValue(V2)
      deviceModels.findPalette.mockResolvedValue(BW)
      const result = await service.update('1', { deviceModelName: 'v2', paletteId: 'bw' } as any)
      expect(result.deviceModel).toBe(V2)
      expect(result.palette).toBe(BW)
      expect(deviceModels.defaultPaletteFor).not.toHaveBeenCalled()
    })

    it('changes only the palette when the model stays the same', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 })
      deviceModels.findPalette.mockResolvedValue(BW)
      const result = await service.update('1', { deviceModelName: 'og_plus', paletteId: 'bw' } as any)
      expect(deviceModels.findByName).not.toHaveBeenCalled()
      expect(result.deviceModel).toBe(OG_PLUS)
      expect(result.palette).toBe(BW)
      expect(screensService.reconvertImageScreens).toHaveBeenCalledWith(result)
    })

    it('does not reconvert images when neither model nor palette changed', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 })
      deviceModels.findPalette.mockResolvedValue(GRAY_4)
      await service.update('1', { name: 'renamed', deviceModelName: 'og_plus', paletteId: 'gray-4' } as any)
      expect(screensService.reconvertImageScreens).not.toHaveBeenCalled()
    })

    it('rejects an unknown model', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS })
      deviceModels.findByName.mockResolvedValue(null)
      await expect(service.update('1', { deviceModelName: 'nope' } as any)).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects a palette the model does not support', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 })
      deviceModels.findPalette.mockResolvedValue(GRAY_16)
      await expect(service.update('1', { paletteId: 'gray-16' } as any)).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects a palette sent for a device with no assigned device model', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: null, palette: null })
      await expect(service.update('1', { paletteId: 'bw' } as any)).rejects.toThrow(BadRequestException)
      expect(deviceModels.findPalette).not.toHaveBeenCalled()
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('fills in the default palette for a device that has a model but no palette', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: null })
      deviceModels.defaultPaletteFor.mockResolvedValue(GRAY_4)
      const result = await service.update('1', { name: 'renamed' } as any)
      expect(result.name).toBe('renamed')
      expect(result.palette).toBe(GRAY_4)
    })

    it('accepts a custom palette whose colour family is compatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 })
      deviceModels.findPalette.mockResolvedValue(CUSTOM_RED_3BWR)
      deviceModels.compatibleFamiliesFor.mockResolvedValue(new Set(['screen--color-3bwr']))
      const result = await service.update('1', { paletteId: CUSTOM_RED_3BWR.id } as any)
      expect(deviceModels.compatibleFamiliesFor).toHaveBeenCalledWith(OG_PLUS)
      expect(result.palette).toBe(CUSTOM_RED_3BWR)
    })

    it('rejects a custom palette whose colour family is not compatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS, palette: GRAY_4 })
      deviceModels.findPalette.mockResolvedValue(CUSTOM_RED_3BWR)
      deviceModels.compatibleFamiliesFor.mockResolvedValue(new Set())
      await expect(service.update('1', { paletteId: CUSTOM_RED_3BWR.id } as any)).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })
  })

  describe('update with target firmware', () => {
    const compatibleFirmware = { id: 'fw-1', version: '1.5.6', kind: 'official-synced', compatibleModels: ['og_plus'] }
    const universalFirmware = { id: 'fw-2', version: '1.0.0', kind: 'custom', compatibleModels: [] }

    beforeEach(() => {
      repo.save.mockImplementation(async (device: Device) => device)
    })

    it('assigns a firmware compatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS })
      firmwareService.findById.mockResolvedValue(compatibleFirmware)
      const result = await service.update('1', { targetFirmwareId: 'fw-1' } as any)
      expect(firmwareService.findById).toHaveBeenCalledWith('fw-1')
      expect(result.targetFirmware).toBe(compatibleFirmware)
    })

    it('assigns a universal firmware (empty compatibleModels) regardless of device model', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: null })
      firmwareService.findById.mockResolvedValue(universalFirmware)
      const result = await service.update('1', { targetFirmwareId: 'fw-2' } as any)
      expect(result.targetFirmware).toBe(universalFirmware)
    })

    it('rejects a firmware incompatible with the device model', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: V2 })
      firmwareService.findById.mockResolvedValue(compatibleFirmware)
      await expect(service.update('1', { targetFirmwareId: 'fw-1' } as any)).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('rejects an unknown firmware id', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS })
      firmwareService.findById.mockResolvedValue(null)
      await expect(service.update('1', { targetFirmwareId: 'nope' } as any)).rejects.toThrow(BadRequestException)
      expect(repo.save).not.toHaveBeenCalled()
    })

    it('is a no-op when targetFirmwareId is not provided', async () => {
      repo.findOneBy.mockResolvedValue({ ...baseDevice, deviceModel: OG_PLUS })
      await service.update('1', { name: 'renamed' } as any)
      expect(firmwareService.findById).not.toHaveBeenCalled()
    })
  })

  it('remove deletes a device and returns true', async () => {
    repo.findOneBy.mockResolvedValue(baseDevice)
    repo.remove.mockResolvedValue(undefined)
    const result = await service.remove('1')
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(repo.remove).toHaveBeenCalledWith(baseDevice)
    expect(result).toBe(true)
  })

  it('remove returns false if device not found', async () => {
    repo.findOneBy.mockResolvedValue(null)
    const result = await service.remove('1')
    expect(result).toBe(false)
  })
})
