import type { Device } from '../../devices/devices.entity'
import type { Screen } from '../../screens/screens.entity'
import * as fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice, makeScreen } from '../../test/fixtures'
import { makeDirent, makeStats, mockReaddir, mockStat } from '../../test/fs'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { MaintenanceService } from '../maintenance.service'

vi.mock('../../utils/pathHelper', () => ({
  resolveAppPath: vi.fn((...parts: string[]) => `/mock/${parts.join('/')}`),
}))

describe('maintenanceService', () => {
  let service: MaintenanceService
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>

  beforeEach(() => {
    deviceRepo = createMockRepository<Device>()
    screenRepo = createMockRepository<Screen>()
    service = new MaintenanceService(
      asRepository(deviceRepo),
      asRepository(screenRepo),
    )
    vi.resetAllMocks()
  })

  describe('scan', () => {
    it('returns empty issues when no devices exist', async () => {
      deviceRepo.find.mockResolvedValue([])
      screenRepo.find.mockResolvedValue([])
      mockStat(async () => {
        throw new Error('ENOENT')
      })

      const result = await service.scan()

      expect(result.orphanedScreenFiles).toEqual([])
      expect(result.orphanedDeviceDirs).toEqual([])
      expect(result.brokenScreens).toEqual([])
      expect(result.tempFiles).toEqual([])
      expect(result.oldUploads).toEqual([])
      expect(result.totalSize).toBe(0)
    })

    it('detects orphaned screen files', async () => {
      const device = makeDevice({ id: 'device-1' })
      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([])

      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1/orphaned-123.png')
          return makeStats({ size: 1024, mtimeMs: Date.now() })
        throw new Error('ENOENT')
      })

      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1']
        if (path === '/mock/public/screens/devices/device-1')
          return ['orphaned-123.png']
        return []
      })

      const result = await service.scan()

      expect(result.orphanedScreenFiles).toHaveLength(1)
      expect(result.orphanedScreenFiles[0]).toMatchObject({
        deviceId: 'device-1',
        screenId: 'orphaned-123',
        size: 1024,
      })
    })

    it('treats retained originals like screen images: orphaned without a screen, kept with one', async () => {
      const device = makeDevice({ id: 'device-1' })
      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([makeScreen({ id: 'kept', type: 'file', device })])

      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices' || path === '/mock/public/screens/devices/device-1')
          return makeStats({ directory: true })
        return makeStats({ size: 10, mtimeMs: Date.now() })
      })
      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1']
        if (path === '/mock/public/screens/devices/device-1')
          return ['kept.png', 'kept.original', 'gone.original']
        return []
      })

      const result = await service.scan()

      expect(result.orphanedScreenFiles.map(f => f.path)).toEqual(['/mock/public/screens/devices/device-1/gone.original'])
      expect(result.orphanedScreenFiles[0].screenId).toBe('gone')
    })

    it('detects orphaned device directories', async () => {
      deviceRepo.find.mockResolvedValue([])
      screenRepo.find.mockResolvedValue([])

      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/orphaned-device')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/orphaned-device/screen.png')
          return makeStats({ size: 2048, mtimeMs: Date.now() })
        throw new Error('ENOENT')
      })

      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return ['orphaned-device']
        if (path === '/mock/public/screens/devices/orphaned-device')
          return [makeDirent('screen.png', false)]
        return []
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
      const device = makeDevice({ id: 'device-1' })
      const screen = makeScreen({
        id: 'screen-1',
        device,
        filename: 'missing.png',
        type: 'file',
      })

      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([screen])

      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1')
          return makeStats({ directory: true })
        throw new Error('ENOENT')
      })

      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1']
        return []
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
      const device = makeDevice({ id: 'device-1' })
      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([])

      const oldDate = Date.now() - (25 * 60 * 60 * 1000)

      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1/tmp-source')
          return makeStats({ size: 512, mtimeMs: oldDate })
        throw new Error('ENOENT')
      })

      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1']
        if (path === '/mock/public/screens/devices/device-1')
          return ['tmp-source']
        return []
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
      const device = makeDevice({ id: 'device-1' })
      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([])

      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1/mirror.png')
          return makeStats({ size: 1024, mtimeMs: Date.now() })
        throw new Error('ENOENT')
      })

      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1']
        if (path === '/mock/public/screens/devices/device-1')
          return ['mirror.png']
        return []
      })

      const result = await service.scan()

      expect(result.orphanedScreenFiles).toHaveLength(0)
    })

    it('skips plugin and mashup screens when checking for broken screens', async () => {
      const device = makeDevice({ id: 'device-1' })
      const pluginScreen = makeScreen({
        id: 'screen-1',
        device,
        type: 'plugin',
      })
      const mashupScreen = makeScreen({
        id: 'screen-2',
        device,
        type: 'mashup',
      })

      deviceRepo.find.mockResolvedValue([device])
      screenRepo.find.mockResolvedValue([pluginScreen, mashupScreen])

      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices')
          return makeStats({ directory: true })
        if (path === '/mock/public/screens/devices/device-1')
          return makeStats({ directory: true })
        throw new Error('ENOENT')
      })

      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return ['device-1']
        return []
      })

      const result = await service.scan()

      expect(result.brokenScreens).toHaveLength(0)
    })
  })

  describe('cleanup', () => {
    it('deletes orphaned files in non-dry-run mode', async () => {
      const unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
      mockStat(async () => makeStats({ size: 1024 }))

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
      mockStat(async () => makeStats({ size: 1024 }))

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
      mockStat(async () => makeStats({ size: 1024 }))

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
      mockReaddir(async () => [makeDirent('file.png', false)])
      mockStat(async () => makeStats({ size: 2048 }))

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
      mockStat(async () => makeStats({ size: 1024 }))

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
      mockStat(async (path) => {
        if (path === '/mock/public/screens/devices')
          return makeStats({ directory: true })
        return makeStats({ size: 1024 })
      })

      mockReaddir(async (path) => {
        if (path === '/mock/public/screens/devices')
          return [makeDirent('device-1', true)]
        if (path === '/mock/public/screens/devices/device-1') {
          return [
            makeDirent('screen-1.png', false),
            makeDirent('screen-2.png', false),
          ]
        }
        return []
      })

      const result = await service.getStats()

      expect(result.fileCount).toBe(2)
      expect(result.totalSize).toBe(2048)
    })

    it('returns zero stats when directory does not exist', async () => {
      mockStat(async () => {
        throw new Error('ENOENT')
      })

      const result = await service.getStats()

      expect(result.fileCount).toBe(0)
      expect(result.totalSize).toBe(0)
    })
  })
})
