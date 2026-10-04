import type { CleanupResult, RetentionRunResult, RetentionStatus, StorageCheck } from 'kuroshiro-shared'
import type { MaintenanceService } from '../maintenance.service.js'
import type { RetentionService } from '../retention.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { MaintenanceController } from '../maintenance.controller.js'

describe('maintenanceController', () => {
  let controller: MaintenanceController
  let service: { scan: ReturnType<typeof vi.fn>, cleanup: ReturnType<typeof vi.fn> }
  let retentionService: { getStatus: ReturnType<typeof vi.fn>, run: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = {
      scan: vi.fn(),
      cleanup: vi.fn(),
    }
    retentionService = {
      getStatus: vi.fn(),
      run: vi.fn(),
    }

    controller = new MaintenanceController(asService<MaintenanceService>(service), asService<RetentionService>(retentionService))
  })

  describe('scan', () => {
    it('answers the stored-files check', async () => {
      const check: StorageCheck = { checkedAt: new Date().toISOString(), screenImages: { files: 0, bytes: 0 }, findings: [] }
      vi.mocked(service.scan).mockResolvedValue(check)

      expect(await controller.scan()).toBe(check)
    })
  })

  describe('cleanup', () => {
    it('hands the finding ids to the service and answers its result', async () => {
      const cleaned: CleanupResult = { removed: { files: 5, folders: 2, screens: 1, bytes: 10240 }, failed: [] }
      vi.mocked(service.cleanup).mockResolvedValue(cleaned)

      const result = await controller.cleanup({ findingIds: ['oldUpload:uploads/abc'] })

      expect(service.cleanup).toHaveBeenCalledWith(['oldUpload:uploads/abc'])
      expect(result).toBe(cleaned)
    })
  })

  describe('getRetentionStatus', () => {
    it('calls retentionService.getStatus and returns the status', async () => {
      const mockStatus: RetentionStatus = {
        ages: { alertRetentionDays: 90, deviceLogRetentionDays: 30 },
        lastRun: null,
      }
      vi.mocked(retentionService.getStatus).mockResolvedValue(mockStatus)

      const result = await controller.getRetentionStatus()

      expect(retentionService.getStatus).toHaveBeenCalled()
      expect(result).toBe(mockStatus)
    })
  })

  describe('runRetention', () => {
    it('calls retentionService.run with the requested dryRun flag', async () => {
      const mockResult: RetentionRunResult = { alertsPruned: 2, deviceLogsPruned: 5 }
      vi.mocked(retentionService.run).mockResolvedValue(mockResult)

      const result = await controller.runRetention({ dryRun: true })

      expect(retentionService.run).toHaveBeenCalledWith(true)
      expect(result).toBe(mockResult)
    })

    it('defaults dryRun to false when omitted', async () => {
      const mockResult: RetentionRunResult = { alertsPruned: 0, deviceLogsPruned: 0 }
      vi.mocked(retentionService.run).mockResolvedValue(mockResult)

      await controller.runRetention({})

      expect(retentionService.run).toHaveBeenCalledWith(false)
    })
  })
})
