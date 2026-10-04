import type { DeviceReadsService } from '../device-reads.service.js'
import type { DevicesService } from '../devices.service.js'
import type { CreateDeviceDto } from '../dto/create-device.dto.js'
import type { UpdateDeviceDto } from '../dto/update-device.dto.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { DevicesController } from '../devices.controller.js'

function createMockService() {
  return {
    create: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  }
}

describe('devicesController', () => {
  let controller: DevicesController
  let service: ReturnType<typeof createMockService>
  let reads: { detail: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = createMockService()
    reads = { detail: vi.fn() }
    controller = new DevicesController(asService<DevicesService>(service), asService<DeviceReadsService>(reads))
  })

  it('add answers the registered device through the reads', async () => {
    const dto: CreateDeviceDto = { mac: 'AA:BB:CC:DD:EE:FF', name: 'name' }
    const detail = { id: '1', ...dto }
    service.create.mockResolvedValue({ id: '1' })
    reads.detail.mockResolvedValue(detail)
    await expect(controller.add(dto)).resolves.toBe(detail)
    expect(service.create).toHaveBeenCalledWith(dto)
    expect(reads.detail).toHaveBeenCalledWith('1')
  })

  it('delete removes a device if found', async () => {
    service.remove.mockResolvedValue(true)
    await expect(controller.delete('1')).resolves.toBeUndefined()
    expect(service.remove).toHaveBeenCalledWith('1')
  })

  it('delete answers device-not-found if the device does not exist', async () => {
    service.remove.mockResolvedValue(false)
    await expect(controller.delete('1')).rejects.toMatchObject({ code: 'device-not-found', status: 404 })
  })

  it('update answers the saved device through the reads', async () => {
    const dto: UpdateDeviceDto = { name: 'Pantry' }
    const detail = { id: '1', name: 'Pantry' }
    service.update.mockResolvedValue({ id: '1' })
    reads.detail.mockResolvedValue(detail)
    await expect(controller.update('1', dto)).resolves.toBe(detail)
    expect(service.update).toHaveBeenCalledWith('1', dto)
    expect(reads.detail).toHaveBeenCalledWith('1')
  })

  it('update answers device-not-found if the device does not exist', async () => {
    service.update.mockResolvedValue(null)
    await expect(controller.update('1', { name: 'Pantry' })).rejects.toMatchObject({ code: 'device-not-found', status: 404 })
  })
})
