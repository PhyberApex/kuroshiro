import type { CleanupResult, MaintenanceIssues, MaintenanceService } from '../maintenance.service'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MaintenanceController } from '../maintenance.controller'

describe('maintenanceController', () => {
  let controller: MaintenanceController
  let service: MaintenanceService

  beforeEach(() => {
    service = {
      scan: vi.fn(),
      cleanup: vi.fn(),
      getStats: vi.fn(),
    } as any

    controller = new MaintenanceController(service)
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
})
