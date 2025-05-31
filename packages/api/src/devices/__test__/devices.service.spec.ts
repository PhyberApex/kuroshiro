import type { Repository } from 'typeorm'
import type { Device } from '../devices.entity'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  beforeEach(() => {
    repo = createMockRepository()
    service = new DevicesService(repo as unknown as Repository<Device>)
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
    const result = await service.update('1', { mac: 'AA:BB:CC:DD:EE:FF' })
    expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' })
    expect(repo.save).toHaveBeenCalledWith({ ...baseDevice, mac: 'AA:BB:CC:DD:EE:FF' })
    expect(result).toEqual(updated)
  })

  it('update returns null if device not found', async () => {
    repo.findOneBy.mockResolvedValue(null)
    const result = await service.update('1', { mac: 'AA:BB:CC:DD:EE:FF' })
    expect(result).toBeNull()
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
