import type { CreateLogDto } from '../dto/create-log.dto.js'
import type { LogsService } from '../logs.service.js'
import { HTTP_CODE_METADATA } from '@nestjs/common/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { LogsController } from '../logs.controller.js'

function createMockService() {
  return {
    addLogToDevice: vi.fn(),
  }
}

describe('logsController (unit)', () => {
  let controller: LogsController
  let service: ReturnType<typeof createMockService>

  beforeEach(() => {
    service = createMockService()
    controller = new LogsController(asService<LogsService>(service))
  })

  it('consumeLog hands the service the Device credentials and the body', async () => {
    const headers = { 'id': '2d:34:e2:27:5b:46', 'access-token': 'token' }
    const dto: CreateLogDto = { logs: [{ id: 1 }] }
    await controller.consumeLog(headers, dto)
    expect(service.addLogToDevice).toHaveBeenCalledWith(headers, dto)
  })

  it('consumeLog answers 204 No Content', () => {
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, LogsController.prototype.consumeLog)).toBe(204)
  })
})
