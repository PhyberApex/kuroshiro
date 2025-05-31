import type { DevicesService } from '../devices.service'
import type { CreateDeviceDto } from '../dto/create-device.dto'
import type { UpdateDeviceDto } from '../dto/update-device.dto'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevicesController } from '../devices.controller'

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

  beforeEach(() => {
    service = createMockService()
    controller = new DevicesController(service as unknown as DevicesService)
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
    const dto: UpdateDeviceDto = { id, apikey: 'key', specialFunction: 'identify', resetDevice: false, updateFirmware: false }
    service.findById.mockResolvedValue(dbDevice)
    service.update.mockResolvedValue({ ...dbDevice, ...dto })
    await expect(controller.update(id, dto)).resolves.toBeUndefined()
    expect(service.update).toHaveBeenCalledWith(id, dto)
  })

  it('update throws NotFoundException if device not found', async () => {
    service.findById.mockResolvedValue(null)
    const dto: UpdateDeviceDto = { id: '1', apikey: 'key', specialFunction: 'identify', resetDevice: false, updateFirmware: false }
    await expect(controller.update('1', dto)).rejects.toThrow(NotFoundException)
  })

  it('update throws BadRequestException if apikey update attempted', async () => {
    const dbDevice = { id: '1', apikey: 'key' }
    const dto: UpdateDeviceDto = { apikey: 'different', specialFunction: 'identify', resetDevice: false, updateFirmware: false }
    service.findById.mockResolvedValue(dbDevice)
    await expect(controller.update('1', dto)).rejects.toThrow(BadRequestException)
  })
})
