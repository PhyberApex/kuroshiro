import type { CleanupResult, MaintenanceIssues, RetentionRunResult, RetentionStatus } from 'kuroshiro-shared'
import type { MaintenanceService } from '../maintenance.service.js'
import type { RetentionService } from '../retention.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { MaintenanceController } from '../maintenance.controller.js'

describe('maintenanceController', () => {
  let controller: MaintenanceController
  let service: { scan: ReturnType<typeof vi.fn>, cleanup: ReturnType<typeof vi.fn>, getStats: ReturnType<typeof vi.fn> }
  let retentionService: { getStatus: ReturnType<typeof vi.fn>, run: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = {
      scan: vi.fn(),
      cleanup: vi.fn(),
      getStats: vi.fn(),
    }
    retentionService = {
      getStatus: vi.fn(),
      run: vi.fn(),
    }

    controller = new MaintenanceController(asService<MaintenanceService>(service), asService<RetentionService>(retentionService))
  })

  describe('scan', () => {
    it('calls service.scan and returns issues', async () => {
      const mockIssues: MaintenanceIssues = {
        orphanedScreenFiles: [],
        orphanedDeviceDirs: [],
        brokenScreens: [],
        tempFiles: [],
        oldUploads: [],
        totalSize: 0,
        scannedAt: new Date().toISOString(),
      }

      vi.mocked(service.scan).mockResolvedValue(mockIssues)

      const result = await controller.scan()

      expect(service.scan).toHaveBeenCalled()
      expect(result).toBe(mockIssues)
    })
  })

  describe('cleanup', () => {
    it('calls service.cleanup with provided parameters', async () => {
      const mockResult: CleanupResult = {
        filesDeleted: 5,
        dirsDeleted: 2,
        screensDeleted: 1,
        bytesFreed: 10240,
        errors: [],
      }

      vi.mocked(service.cleanup).mockResolvedValue(mockResult)

      const dto = {
        orphanedFiles: ['/path/to/file.png'],
        orphanedDirs: ['/path/to/dir'],
        brokenScreens: ['screen-1'],
        tempFiles: ['/path/to/temp'],
        oldUploads: ['/path/to/upload.zip'],
        dryRun: false,
      }

      const result = await controller.cleanup(dto)

      expect(service.cleanup).toHaveBeenCalledWith(
        dto.orphanedFiles,
        dto.orphanedDirs,
        dto.brokenScreens,
        dto.tempFiles,
        dto.oldUploads,
        dto.dryRun,
      )
      expect(result).toBe(mockResult)
    })

    it('defaults to empty arrays and false for missing parameters', async () => {
      const mockResult: CleanupResult = {
        filesDeleted: 0,
        dirsDeleted: 0,
        screensDeleted: 0,
        bytesFreed: 0,
        errors: [],
      }

      vi.mocked(service.cleanup).mockResolvedValue(mockResult)

      const dto = {}

      await controller.cleanup(dto)

      expect(service.cleanup).toHaveBeenCalledWith(
        [],
        [],
        [],
        [],
        [],
        false,
      )
    })

    it('passes dryRun parameter correctly', async () => {
      const mockResult: CleanupResult = {
        filesDeleted: 0,
        dirsDeleted: 0,
        screensDeleted: 0,
        bytesFreed: 0,
        errors: [],
      }

      vi.mocked(service.cleanup).mockResolvedValue(mockResult)

      const dto = {
        dryRun: true,
      }

      await controller.cleanup(dto)

      expect(service.cleanup).toHaveBeenCalledWith(
        [],
        [],
        [],
        [],
        [],
        true,
      )
    })
  })

  describe('getStats', () => {
    it('calls service.getStats and returns stats', async () => {
      const mockStats = {
        fileCount: 42,
        totalSize: 1024000,
      }

      vi.mocked(service.getStats).mockResolvedValue(mockStats)

      const result = await controller.getStats()

      expect(service.getStats).toHaveBeenCalled()
      expect(result).toBe(mockStats)
    })
  })

  describe('getRetentionStatus', () => {
    it('calls retentionService.getStatus and returns the status', () => {
      const mockStatus: RetentionStatus = {
        ages: { alertRetentionDays: 90, deviceLogRetentionDays: 30 },
        lastRun: null,
      }
      vi.mocked(retentionService.getStatus).mockReturnValue(mockStatus)

      const result = controller.getRetentionStatus()

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
