import type { SyncRun } from '../entities/sync-run.entity.js'
import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { SyncRunService } from '../sync-run.service.js'

describe('syncRunService', () => {
  let service: SyncRunService
  let repository: ReturnType<typeof createMockRepository<SyncRun>>

  beforeEach(() => {
    vi.resetAllMocks()
    repository = createMockRepository<SyncRun>()
    service = new SyncRunService(asRepository(repository))
  })

  describe('recordFailure', () => {
    it('saves the error message of a failed run', async () => {
      await service.recordFailure('firmware', new Date('2026-10-01T04:00:00.000Z'), new Error('TRMNL said 502'))

      expect(repository.save).toHaveBeenCalledWith({ kind: 'firmware', ranAt: new Date('2026-10-01T04:00:00.000Z'), ok: false, error: 'TRMNL said 502' })
    })

    it('logs, instead of throwing, when saving the failure itself fails', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
      repository.save.mockRejectedValue(new Error('database is down'))

      await expect(service.recordFailure('device-models', new Date(), new Error('upstream unreachable'))).resolves.toBeUndefined()
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('database is down'))
      errorSpy.mockRestore()
    })
  })
})
