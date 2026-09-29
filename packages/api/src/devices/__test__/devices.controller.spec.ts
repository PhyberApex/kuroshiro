import type { MockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService.js'
import type { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import type { DevicesService } from '../devices.service.js'
import type { CreateDeviceDto } from '../dto/create-device.dto.js'
import type { UpdateDeviceDto } from '../dto/update-device.dto.js'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceSensorsService, primeMockDeviceSensorsService } from '../../device-sensors/__test__/mockDeviceSensorsService.js'
import { asService } from '../../test/mockService.js'
import { DevicesController } from '../devices.controller.js'

function createMockService() {
  return {
    findAll: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  }
}

describe('devicesController', () => {
  let controller: DevicesController
  let service: ReturnType<typeof createMockService>
  let sensorsService: MockDeviceSensorsService

  beforeEach(() => {
    service = createMockService()
    sensorsService = createMockDeviceSensorsService()
    primeMockDeviceSensorsService(sensorsService)
    controller = new DevicesController(asService<DevicesService>(service), asService<DeviceSensorsService>(sensorsService))
  })

  it('getAll returns all devices', async () => {
    const devices = [{ id: '1' }]
    service.findAll.mockResolvedValue(devices)
    const result = await controller.getAll()
    expect(result).toBe(devices)
  })

  it('add creates a device with valid MAC', async () => {
    const dto: CreateDeviceDto = { mac: 'AA:BB:CC:DD:EE:FF', name: 'name' }
    const device = { id: '1', ...dto }
    service.create.mockResolvedValue(device)
    const result = await controller.add(dto)
    expect(service.create).toHaveBeenCalledWith(dto)
    expect(result).toBe(device)
  })

  it('add throws BadRequestException for invalid MAC', async () => {
    const dto: CreateDeviceDto = { mac: 'invalid-mac', name: 'name' }
    await expect(controller.add(dto)).rejects.toThrow(BadRequestException)
  })

  it('delete removes a device if found', async () => {
    service.remove.mockResolvedValue(true)
    await expect(controller.delete('1')).resolves.toBeUndefined()
    expect(service.remove).toHaveBeenCalledWith('1')
  })

  it('delete throws NotFoundException if device not found', async () => {
    service.remove.mockResolvedValue(false)
    await expect(controller.delete('1')).rejects.toThrow(NotFoundException)
  })

  it('update updates a device if found and valid', async () => {
    const id = '1'
    const dbDevice = { id, apikey: 'key' }
    const dto: UpdateDeviceDto = { specialFunction: 'identify', resetDevice: false, updateFirmware: false }
    service.findById.mockResolvedValue(dbDevice)
    service.update.mockResolvedValue({ ...dbDevice, ...dto })
    await expect(controller.update(id, dto)).resolves.toBeUndefined()
    expect(service.update).toHaveBeenCalledWith(id, dto)
  })

  it('update throws NotFoundException if device not found', async () => {
    service.findById.mockResolvedValue(null)
    const dto: UpdateDeviceDto = { specialFunction: 'identify', resetDevice: false, updateFirmware: false }
    await expect(controller.update('1', dto)).rejects.toThrow(NotFoundException)
  })

  describe('getSensors', () => {
    it('returns the device\'s current sensor readings', async () => {
      service.findById.mockResolvedValue({ id: '1' })
      sensorsService.findForDevice.mockResolvedValue([
        { id: 'sensor-1', kind: 'temperature', value: 21.5, unit: '°C' },
        { id: 'sensor-2', kind: 'humidity', value: 40, unit: '%' },
      ])
      const result = await controller.getSensors('1')
      expect(sensorsService.findForDevice).toHaveBeenCalledWith('1')
      expect(result).toEqual([
        { kind: 'temperature', value: 21.5, unit: '°C' },
        { kind: 'humidity', value: 40, unit: '%' },
      ])
    })

    it('returns an empty array when the device has no current readings', async () => {
      service.findById.mockResolvedValue({ id: '1' })
      sensorsService.findForDevice.mockResolvedValue([])
      const result = await controller.getSensors('1')
      expect(result).toEqual([])
    })

    it('throws NotFoundException if device not found', async () => {
      service.findById.mockResolvedValue(null)
      await expect(controller.getSensors('missing')).rejects.toThrow(NotFoundException)
      expect(sensorsService.findForDevice).not.toHaveBeenCalled()
    })
  })
})
