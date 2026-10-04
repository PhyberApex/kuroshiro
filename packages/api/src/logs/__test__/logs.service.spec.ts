import type { Device } from '../../devices/devices.entity.js'
import type { CreateLogDto } from '../dto/create-log.dto.js'
import type { LogEntry } from '../logs.entity.js'

import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice, makeLogEntry } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { LogsService } from '../logs.service.js'

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
    const dto: CreateLogDto = { logs: [{ id: 1 }] }
    await expect(service.addLogToDevice(deviceMac, dto)).rejects.toThrow()
  })

  describe('current envelope: { logs: [...] }', () => {
    it('stores one row per entry, with logId from id and date from created_at', async () => {
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [] })
      devicesRepo.findOne.mockResolvedValue(device)
      const entry = {
        created_at: 1790619540,
        id: 4211,
        message: '[HTTPS] POST failed',
        level: 'error',
      }
      const dto: CreateLogDto = { logs: [entry] }

      await service.addLogToDevice(deviceMac, dto)

      expect(logsRepo.save).toHaveBeenCalledOnce()
      const saved = logsRepo.save.mock.calls[0][0] as unknown as LogEntry
      expect(saved.logId).toBe(4211)
      expect(saved.date).toEqual(new Date(1790619540 * 1000))
      expect(JSON.parse(saved.entry)).toEqual(entry)
    })

    it('does not save duplicate log entries', async () => {
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [makeLogEntry({ logId: 1 }), makeLogEntry({ logId: 2 })] })
      devicesRepo.findOne.mockResolvedValue(device)
      const dto: CreateLogDto = { logs: [{ id: 1 }, { id: 2 }] }

      await service.addLogToDevice(deviceMac, dto)

      expect(logsRepo.save).not.toHaveBeenCalled()
    })

    it('saves only the new entries among a mixed batch', async () => {
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [makeLogEntry({ logId: 1 }), makeLogEntry({ logId: 2 })] })
      devicesRepo.findOne.mockResolvedValue(device)
      const dto: CreateLogDto = { logs: [{ id: 1 }, { id: 2 }, { id: 3 }] }

      await service.addLogToDevice(deviceMac, dto)

      expect(logsRepo.save).toHaveBeenCalledOnce()
    })

    it('skips an entry without id, logs a warning, and still stores the rest of the batch', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [] })
      devicesRepo.findOne.mockResolvedValue(device)
      const dto: CreateLogDto = { logs: [{ message: 'no id here' }, { id: 7, message: 'has id' }] }

      await service.addLogToDevice(deviceMac, dto)

      expect(logsRepo.save).toHaveBeenCalledOnce()
      expect(warnSpy).toHaveBeenCalled()
    })

    it('falls back to receive time when created_at is implausible (epoch 0)', async () => {
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [] })
      devicesRepo.findOne.mockResolvedValue(device)
      const before = Date.now()
      const dto: CreateLogDto = { logs: [{ id: 1, created_at: 0 }] }

      await service.addLogToDevice(deviceMac, dto)

      const saved = logsRepo.save.mock.calls[0][0] as unknown as LogEntry
      expect(saved.date.getTime()).toBeGreaterThanOrEqual(before)
    })

    it('falls back to receive time when created_at is far in the future', async () => {
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [] })
      devicesRepo.findOne.mockResolvedValue(device)
      const before = Date.now()
      const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
      const dto: CreateLogDto = { logs: [{ id: 1, created_at: farFuture }] }

      await service.addLogToDevice(deviceMac, dto)

      const saved = logsRepo.save.mock.calls[0][0] as unknown as LogEntry
      expect(saved.date.getTime()).toBeGreaterThanOrEqual(before)
    })
  })

  describe('legacy envelope: { log: { logs_array: [...] } }', () => {
    it('stores one row per entry, with logId from log_id and date from creation_timestamp', async () => {
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [] })
      devicesRepo.findOne.mockResolvedValue(device)
      const entry = {
        creation_timestamp: 1790619540,
        log_id: 4211,
        log_message: 'boot',
      }
      const dto: CreateLogDto = { log: { logs_array: [entry] } }

      await service.addLogToDevice(deviceMac, dto)

      expect(logsRepo.save).toHaveBeenCalledOnce()
      const saved = logsRepo.save.mock.calls[0][0] as unknown as LogEntry
      expect(saved.logId).toBe(4211)
      expect(saved.date).toEqual(new Date(1790619540 * 1000))
    })

    it('does not save duplicate log entries', async () => {
      const device = makeDevice({ id: 'dev', width: 100, height: 100, logs: [makeLogEntry({ logId: 1 }), makeLogEntry({ logId: 2 })] })
      devicesRepo.findOne.mockResolvedValue(device)
      const dto: CreateLogDto = { log: { logs_array: [{ log_id: 1 }, { log_id: 2 }] } }

      await service.addLogToDevice(deviceMac, dto)

      expect(logsRepo.save).not.toHaveBeenCalled()
    })
  })
})
