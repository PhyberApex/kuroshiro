import type { ConfigService } from '@nestjs/config'
import type { Alert } from '../../alerts/entities/alert.entity.js'
import type { LogEntry } from '../../logs/logs.entity.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { RetentionService } from '../retention.service.js'

const { cronMock } = vi.hoisted(() => ({ cronMock: { schedule: vi.fn() } }))

vi.mock('node-cron', () => ({ default: cronMock }))

function makeConfigService(overrides: Partial<{ alertRetentionDays: number, deviceLogRetentionDays: number }> = {}): ConfigService {
  const retention = { alertRetentionDays: 90, deviceLogRetentionDays: 30, ...overrides }
  return { get: (key: string) => (key === 'retention' ? retention : undefined) } as unknown as ConfigService
}

describe('retentionService', () => {
  let alertRepo: ReturnType<typeof createMockRepository<Alert>>
  let logEntryRepo: ReturnType<typeof createMockRepository<LogEntry>>
  let service: RetentionService

  beforeEach(() => {
    vi.clearAllMocks()
    alertRepo = createMockRepository<Alert>()
    logEntryRepo = createMockRepository<LogEntry>()
    alertRepo.count.mockResolvedValue(0)
    alertRepo.delete.mockResolvedValue({ affected: 0, raw: [] })
    logEntryRepo.count.mockResolvedValue(0)
    logEntryRepo.delete.mockResolvedValue({ affected: 0, raw: [] })
    service = new RetentionService(asRepository(alertRepo), asRepository(logEntryRepo), makeConfigService())
  })

  describe('onApplicationBootstrap', () => {
    it('schedules the daily run without running immediately', async () => {
      await service.onApplicationBootstrap()
      expect(cronMock.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function))
      expect(alertRepo.delete).not.toHaveBeenCalled()
      expect(logEntryRepo.delete).not.toHaveBeenCalled()
    })

    it('swallows a scheduled run failure instead of throwing', async () => {
      await service.onApplicationBootstrap()
      const scheduledFn = cronMock.schedule.mock.calls[0][1] as () => void
      alertRepo.delete.mockRejectedValue(new Error('boom'))
      expect(() => scheduledFn()).not.toThrow()
    })
  })

  describe('getStatus', () => {
    it('reports the configured ages and no last run before any run', () => {
      expect(service.getStatus()).toEqual({
        ages: { alertRetentionDays: 90, deviceLogRetentionDays: 30 },
        lastRun: null,
      })
    })
  })

  describe('run', () => {
    it('deletes resolved Alerts older than the retention age and Device Logs older than theirs', async () => {
      alertRepo.delete.mockResolvedValue({ affected: 4, raw: [] })
      logEntryRepo.delete.mockResolvedValue({ affected: 7, raw: [] })

      const result = await service.run(false)

      expect(alertRepo.delete).toHaveBeenCalledWith({ resolvedAt: expect.anything() })
      expect(logEntryRepo.delete).toHaveBeenCalledWith({ date: expect.anything() })
      expect(result).toEqual({ alertsPruned: 4, deviceLogsPruned: 7 })
    })

    it('never touches active Alerts, since LessThan(resolvedAt) never matches a null column', async () => {
      alertRepo.delete.mockResolvedValue({ affected: 0, raw: [] })
      await service.run(false)
      const criteria = alertRepo.delete.mock.calls[0][0] as unknown as { resolvedAt: { _type: string, _value: Date } }
      expect(criteria.resolvedAt._type).toBe('lessThan')
    })

    it('updates lastRun after a real run', async () => {
      alertRepo.delete.mockResolvedValue({ affected: 2, raw: [] })
      logEntryRepo.delete.mockResolvedValue({ affected: 3, raw: [] })

      await service.run(false)

      expect(service.getStatus().lastRun).toMatchObject({ alertsPruned: 2, deviceLogsPruned: 3 })
      expect(service.getStatus().lastRun?.ranAt).toEqual(expect.any(String))
    })

    it('does a dry run: same counts, no deletion, lastRun left unchanged', async () => {
      alertRepo.count.mockResolvedValue(5)
      logEntryRepo.count.mockResolvedValue(9)

      const result = await service.run(true)

      expect(result).toEqual({ alertsPruned: 5, deviceLogsPruned: 9 })
      expect(alertRepo.delete).not.toHaveBeenCalled()
      expect(logEntryRepo.delete).not.toHaveBeenCalled()
      expect(service.getStatus().lastRun).toBeNull()
    })

    it('skips pruning Alerts when their retention age is 0, but still prunes Device Logs', async () => {
      service = new RetentionService(asRepository(alertRepo), asRepository(logEntryRepo), makeConfigService({ alertRetentionDays: 0 }))
      logEntryRepo.delete.mockResolvedValue({ affected: 3, raw: [] })

      const result = await service.run(false)

      expect(alertRepo.delete).not.toHaveBeenCalled()
      expect(logEntryRepo.delete).toHaveBeenCalled()
      expect(result).toEqual({ alertsPruned: 0, deviceLogsPruned: 3 })
    })

    it('skips pruning Device Logs when their retention age is 0, but still prunes Alerts', async () => {
      service = new RetentionService(asRepository(alertRepo), asRepository(logEntryRepo), makeConfigService({ deviceLogRetentionDays: 0 }))
      alertRepo.delete.mockResolvedValue({ affected: 4, raw: [] })

      const result = await service.run(false)

      expect(logEntryRepo.delete).not.toHaveBeenCalled()
      expect(alertRepo.delete).toHaveBeenCalled()
      expect(result).toEqual({ alertsPruned: 4, deviceLogsPruned: 0 })
    })

    it('logs and continues pruning the other table when one table fails, and does not update lastRun for that count as a crash', async () => {
      alertRepo.delete.mockRejectedValue(new Error('db down'))
      logEntryRepo.delete.mockResolvedValue({ affected: 6, raw: [] })

      const result = await service.run(false)

      expect(result).toEqual({ alertsPruned: 0, deviceLogsPruned: 6 })
      expect(service.getStatus().lastRun).toMatchObject({ alertsPruned: 0, deviceLogsPruned: 6 })
    })
  })
})
