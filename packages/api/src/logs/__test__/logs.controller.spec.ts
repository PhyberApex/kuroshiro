import type { CreateLogDto } from '../dto/create-log.dto'
import type { LogEntry } from '../logs.entity'
import type { LogsService } from '../logs.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogsController } from '../logs.controller'

function createMockService() {
  return {
    addLogToDevice: vi.fn(),
    getByDevice: vi.fn(),
    clearLogsByDeviceId: vi.fn(),
  }
}

describe('logsController (unit)', () => {
  let controller: LogsController
  let service: ReturnType<typeof createMockService>

  beforeEach(() => {
    service = createMockService()
    controller = new LogsController(service as unknown as LogsService)
  })

  it('consumeLog calls the service', async () => {
    const deviceHeader = { id: '2d:34:e2:27:5b:46' }
    const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }] } }
    await controller.consumeLog(deviceHeader, dto)
    expect(service.addLogToDevice).toHaveBeenCalledWith(deviceHeader.id, dto)
  })

  it('getLogsByDevice returns logs for a device', async () => {
    const logs = [{ } as LogEntry]
    service.getByDevice.mockResolvedValue(logs)
    const result = await controller.getLogsByDevice('dev')
    expect(service.getByDevice).toHaveBeenCalledWith('dev')
    expect(result).toBe(logs)
  })

  it('clearLogs calls the service', async () => {
    await controller.clearLogs('dev')
    expect(service.clearLogsByDeviceId).toHaveBeenCalledWith('dev')
  })
})
