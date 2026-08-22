import type { Device } from '../../devices/devices.entity'
import type { CreateLogDto } from '../dto/create-log.dto'
import type { LogEntry } from '../logs.entity'

import { beforeEach, describe, expect, it } from 'vitest'
import { makeDevice, makeLogEntry } from '../../test/fixtures'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { LogsService } from '../logs.service'

describe('logsService', () => {
  let service: LogsService
  let logsRepo: ReturnType<typeof createMockRepository<LogEntry>>
  let devicesRepo: ReturnType<typeof createMockRepository<Device>>
  const deviceMac = '2d:34:e2:27:5b:46'

  beforeEach(() => {
    logsRepo = createMockRepository<LogEntry>()
    devicesRepo = createMockRepository<Device>()
    service = new LogsService(
      asRepository(logsRepo),
      asRepository(devicesRepo),
    )
  })

  it('addLogToDevice throws if device is not found', async () => {
    const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }] } }
    await expect(service.addLogToDevice(deviceMac, dto)).rejects.toThrow()
  })

  it('addLogToDevice is not saving duplicate log entries', async () => {
    const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }, { log_id: 2 }] } }
    const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [makeLogEntry({ logId: 1 }), makeLogEntry({ logId: 2 })] })
    devicesRepo.findOne.mockResolvedValue(device)
    await service.addLogToDevice(deviceMac, dto)
    expect(logsRepo.save).not.toHaveBeenCalled()
  })

  it('addLogToDevice saves new log entries', async () => {
    const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }, { log_id: 2 }, { log_id: 3 }] } }
    const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [makeLogEntry({ logId: 1 }), makeLogEntry({ logId: 2 })] })
    devicesRepo.findOne.mockResolvedValue(device)
    await service.addLogToDevice(deviceMac, dto)
    expect(logsRepo.save).toHaveBeenCalledOnce()
  })

  it('getByDevice returns logs for a device', async () => {
    const logs = [makeLogEntry({ logId: 1 })]
    logsRepo.find.mockResolvedValue(logs)
    const result = await service.getByDevice('dev')
    expect(result).toBe(logs)
  })

  it('clearLogsByDeviceId clears logs for a device', async () => {
    await service.clearLogsByDeviceId('dev')
    expect(logsRepo.delete).toHaveBeenCalledOnce()
  })
})
