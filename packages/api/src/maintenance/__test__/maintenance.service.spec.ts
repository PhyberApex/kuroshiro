import type { Device } from '../../devices/devices.entity'
import type { Screen } from '../../screens/screens.entity'
import * as fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MaintenanceService } from '../maintenance.service'

vi.mock('../../utils/pathHelper', () => ({
  resolveAppPath: vi.fn((...parts: string[]) => `/mock/${parts.join('/')}`),
}))

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

describe('maintenanceService', () => {
  let service: MaintenanceService
  let deviceRepo: ReturnType<typeof createMockRepo>
  let screenRepo: ReturnType<typeof createMockRepo>

  beforeEach(() => {
    deviceRepo = createMockRepo()
    screenRepo = createMockRepo()
    service = new MaintenanceService(
      deviceRepo as any,
      screenRepo as any,
    )
    vi.resetAllMocks()
  })

  describe('scan', () => {
    it('returns empty issues when no devices exist', async () => {
      deviceRepo.find.mockResolvedValue([])
      screenRepo.find.mockResolvedValue([])
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'))

      const result = await service.scan()

      expect(result.orphanedScreenFiles).toEqual([])
      expect(result.orphanedDeviceDirs).toEqual([])
      expect(result.brokenScreens).toEqual([])
      expect(result.tempFiles).toEqual([])
      expect(result.oldUploads).toEqual([])
      expect(result.totalSize).toBe(0)
    })

    it('detects orphaned screen files', async () => {
      const device = { id: 'device-1' } as Device
      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([])

      vi.spyOn(fs.promises, 'stat').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1/orphaned-123.png')
          return { isDirectory: () => false, size: 1024, mtimeMs: Date.now() } as any
        throw new Error('ENOENT')
      })

      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1'] as any
        if (path === '/mock/public/screens/devices/device-1')
          return ['orphaned-123.png'] as any
        return [] as any
      })

      const result = await service.scan()

      expect(result.orphanedScreenFiles).toHaveLength(1)
      expect(result.orphanedScreenFiles[0]).toMatchObject({
        deviceId: 'device-1',
        screenId: 'orphaned-123',
        size: 1024,
      })
    })

    it('detects orphaned device directories', async () => {
      deviceRepo.find.mockResolvedValue([])
      screenRepo.find.mockResolvedValue([])

      vi.spyOn(fs.promises, 'stat').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/orphaned-device')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/orphaned-device/screen.png')
          return { isDirectory: () => false, size: 2048, mtimeMs: Date.now() } as any
        throw new Error('ENOENT')
      })

      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (path: any, _options?: any) => {
        if (path === '/mock/public/screens/devices')
          return ['orphaned-device'] as any
        if (path === '/mock/public/screens/devices/orphaned-device')
          return [{ name: 'screen.png', isDirectory: () => false }] as any
        return [] as any
      })

      const result = await service.scan()

      expect(result.orphanedDeviceDirs).toHaveLength(1)
      expect(result.orphanedDeviceDirs[0]).toMatchObject({
        deviceId: 'orphaned-device',
        fileCount: 1,
        size: 2048,
      })
    })

    it('detects broken screens', async () => {
      const device = { id: 'device-1' } as Device
      const screen = {
        id: 'screen-1',
        device,
        filename: 'missing.png',
        type: 'file',
      } as Screen

      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([screen])

      vi.spyOn(fs.promises, 'stat').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1')
          return { isDirectory: () => true } as any
        throw new Error('ENOENT')
      })

      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1'] as any
        return [] as any
      })

      vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'))

      const result = await service.scan()

      expect(result.brokenScreens).toHaveLength(1)
      expect(result.brokenScreens[0]).toMatchObject({
        screenId: 'screen-1',
        deviceId: 'device-1',
        filename: 'missing.png',
        type: 'file',
      })
    })

    it('detects temp files older than threshold', async () => {
      const device = { id: 'device-1' } as Device
      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([])

      const oldDate = Date.now() - (25 * 60 * 60 * 1000)

      vi.spyOn(fs.promises, 'stat').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1/tmp-source')
          return { isDirectory: () => false, size: 512, mtimeMs: oldDate } as any
        throw new Error('ENOENT')
      })

      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1'] as any
        if (path === '/mock/public/screens/devices/device-1')
          return ['tmp-source'] as any
        return [] as any
      })

      const result = await service.scan()

      expect(result.tempFiles).toHaveLength(1)
      expect(result.tempFiles[0]).toMatchObject({
        path: '/mock/public/screens/devices/device-1/tmp-source',
        size: 512,
      })
      expect(result.tempFiles[0].age).toBeGreaterThan(24)
    })

    it('ignores mirror.png files', async () => {
      const device = { id: 'device-1' } as Device
      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([])

      vi.spyOn(fs.promises, 'stat').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1/mirror.png')
          return { isDirectory: () => false, size: 1024, mtimeMs: Date.now() } as any
        throw new Error('ENOENT')
      })

      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1'] as any
        if (path === '/mock/public/screens/devices/device-1')
          return ['mirror.png'] as any
        return [] as any
      })

      const result = await service.scan()

      expect(result.orphanedScreenFiles).toHaveLength(0)
    })

    it('skips plugin and mashup screens when checking for broken screens', async () => {
      const device = { id: 'device-1' } as Device
      const pluginScreen = {
        id: 'screen-1',
        device,
        type: 'plugin',
      } as Screen
      const mashupScreen = {
        id: 'screen-2',
        device,
        type: 'mashup',
      } as Screen

      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([pluginScreen, mashupScreen])

      vi.spyOn(fs.promises, 'stat').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return { isDirectory: () => true } as any
        if (path === '/mock/public/screens/devices/device-1')
          return { isDirectory: () => true } as any
        throw new Error('ENOENT')
      })

      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1'] as any
        return [] as any
      })

      const result = await service.scan()

      expect(result.brokenScreens).toHaveLength(0)
    })
  })

  describe('cleanup', () => {
    it('deletes orphaned files in non-dry-run mode', async () => {
      const unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1024 } as any)

      const result = await service.cleanup(
        ['/mock/public/screens/devices/device-1/orphaned.png'],
        [],
        [],
        [],
        [],
        false,
      )

      expect(unlinkMock).toHaveBeenCalledWith('/mock/public/screens/devices/device-1/orphaned.png')
      expect(result.filesDeleted).toBe(1)
      expect(result.bytesFreed).toBe(1024)
    })

    it('does not delete files in dry-run mode', async () => {
      const unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1024 } as any)

      const result = await service.cleanup(
        ['/mock/public/screens/devices/device-1/orphaned.png'],
        [],
        [],
        [],
        [],
        true,
      )

      expect(unlinkMock).not.toHaveBeenCalled()
      expect(result.filesDeleted).toBe(1)
      expect(result.bytesFreed).toBe(1024)
    })

    it('protects system files from deletion', async () => {
      const unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1024 } as any)

      const result = await service.cleanup(
        ['/mock/public/screens/devices/noScreen.png'],
        [],
        [],
        [],
        [],
        false,
      )

      expect(unlinkMock).not.toHaveBeenCalled()
      expect(result.filesDeleted).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Protected system file')
    })

    it('validates paths before deletion', async () => {
      const unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)

      const result = await service.cleanup(
        ['../../../etc/passwd'],
        [],
        [],
        [],
        [],
        false,
      )

      expect(unlinkMock).not.toHaveBeenCalled()
      expect(result.filesDeleted).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Unsafe path')
    })

    it('deletes orphaned directories recursively', async () => {
      const rmMock = vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined)
      vi.spyOn(fs.promises, 'readdir').mockResolvedValue([{ name: 'file.png', isDirectory: () => false }] as any)
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 2048 } as any)

      const result = await service.cleanup(
        [],
        ['/mock/public/screens/devices/orphaned-device'],
        [],
        [],
        [],
        false,
      )

      expect(rmMock).toHaveBeenCalledWith('/mock/public/screens/devices/orphaned-device', { recursive: true, force: true })
      expect(result.dirsDeleted).toBe(1)
      expect(result.bytesFreed).toBe(2048)
    })

    it('deletes broken screens from database', async () => {
      const result = await service.cleanup(
        [],
        [],
        ['screen-1', 'screen-2'],
        [],
        [],
        false,
      )

      expect(screenRepo.delete).toHaveBeenCalledWith('screen-1')
      expect(screenRepo.delete).toHaveBeenCalledWith('screen-2')
      expect(result.screensDeleted).toBe(2)
    })

    it('handles deletion errors gracefully', async () => {
      vi.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('Permission denied'))
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: 1024 } as any)

      const result = await service.cleanup(
        ['/mock/public/screens/devices/device-1/orphaned.png'],
        [],
        [],
        [],
        [],
        false,
      )

      expect(result.filesDeleted).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Permission denied')
    })
  })

  describe('getStats', () => {
    it('returns stats for devices directory', async () => {
      vi.spyOn(fs.promises, 'stat').mockImplementation(async (path: any) => {
        if (path === '/mock/public/screens/devices')
          return { isDirectory: () => true } as any
        return { isDirectory: () => false, size: 1024 } as any
      })

      vi.spyOn(fs.promises, 'readdir').mockImplementation(async (path: any, _options?: any) => {
        if (path === '/mock/public/screens/devices') {
          return [
            { name: 'device-1', isDirectory: () => true },
          ] as any
        }
        if (path === '/mock/public/screens/devices/device-1') {
          return [
            { name: 'screen-1.png', isDirectory: () => false },
            { name: 'screen-2.png', isDirectory: () => false },
          ] as any
        }
        return [] as any
      })

      const result = await service.getStats()

      expect(result.fileCount).toBe(2)
      expect(result.totalSize).toBe(2048)
    })

    it('returns zero stats when directory does not exist', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'))

      const result = await service.getStats()

      expect(result.fileCount).toBe(0)
      expect(result.totalSize).toBe(0)
    })
  })
})
