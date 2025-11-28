import type { Device } from '../../devices/devices.entity'
import type { CreateLogDto } from '../dto/create-log.dto'
import type { LogEntry } from '../logs.entity'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogsService } from '../logs.service'

function createMockRepo() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
  }
}

describe('logsService', () => {
  let service: LogsService
  let logsRepo: ReturnType<typeof createMockRepo>
  let devicesRepo: ReturnType<typeof createMockRepo>
  const deviceMac = '2d:34:e2:27:5b:46'

  beforeEach(() => {
    logsRepo = createMockRepo()
    devicesRepo = createMockRepo()
    service = new LogsService(
      logsRepo as any,
      devicesRepo as any,
    )
    vi.resetAllMocks()
  })

  it('addLogToDevice throws if device is not found', async () => {
    const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }] } }
    await expect(service.addLogToDevice(deviceMac, dto)).rejects.toThrow()
  })

  it('addLogToDevice is not saving duplicate log entries', async () => {
    const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }, { log_id: 2 }] } }
    const device = { id: 'dev', screens: [], width: 100, height: 100, logs: [{ logId: 1 }, { logId: 2 }] } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    await service.addLogToDevice(deviceMac, dto)
    expect(logsRepo.create).not.toHaveBeenCalled()
  })

  it('addLogToDevice saves new log entries', async () => {
    const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }, { log_id: 2 }, { log_id: 3 }] } }
    const device = { id: 'dev', screens: [], width: 100, height: 100, logs: [{ logId: 1 }, { logId: 2 }] } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    await service.addLogToDevice(deviceMac, dto)
    expect(logsRepo.create).toHaveBeenCalledOnce()
  })

  it('getByDevice returns logs for a device', async () => {
    const logs = [{ logId: 1 } as LogEntry]
    logsRepo.find.mockResolvedValue(logs)
    const result = await service.getByDevice('dev')
    expect(result).toBe(logs)
  })

  it('clearLogsByDeviceId clears logs for a device', async () => {
    await service.clearLogsByDeviceId('dev')
    expect(logsRepo.delete).toHaveBeenCalledOnce()
  })
})
