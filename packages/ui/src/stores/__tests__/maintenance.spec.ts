import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMaintenanceStore } from '../maintenance'

globalThis.fetch = vi.fn()

describe('maintenanceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('scanSystem', () => {
    it('fetches scan results successfully', async () => {
      const mockIssues = {
        orphanedScreenFiles: [{ deviceId: 'dev-1', screenId: 'screen-1', path: '/path/to/file.png', size: 1024 }],
        orphanedDeviceDirs: [{ deviceId: 'dev-2', path: '/path/to/dir', fileCount: 5, size: 5120 }],
        brokenScreens: [{ screenId: 'screen-2', deviceId: 'dev-1', filename: 'broken.png', type: 'file' }],
        tempFiles: [{ path: '/path/to/temp', age: 25, size: 512 }],
        oldUploads: [{ path: '/path/to/upload.zip', age: 48, size: 2048 }],
        totalSize: 8704,
        scannedAt: '2026-04-24T12:00:00Z',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssues,
      } as Response)

      const store = useMaintenanceStore()
      await store.scanSystem()

      expect(fetch).toHaveBeenCalledWith('/api/maintenance/scan')
      expect(store.issues).toEqual(mockIssues)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('sets loading state during scan', async () => {
      vi.mocked(fetch).mockImplementationOnce(() =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  orphanedScreenFiles: [],
                  orphanedDeviceDirs: [],
                  brokenScreens: [],
                  tempFiles: [],
                  oldUploads: [],
                  totalSize: 0,
                  scannedAt: '2026-04-24T12:00:00Z',
                }),
              } as Response),
            100,
          ),
        ),
      )

      const store = useMaintenanceStore()
      const scanPromise = store.scanSystem()

      expect(store.loading).toBe(true)

      await scanPromise

      expect(store.loading).toBe(false)
    })

    it('handles scan errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response)

      const store = useMaintenanceStore()

      await expect(store.scanSystem()).rejects.toThrow('Scan failed: Internal Server Error')

      expect(store.error).toBe('Scan failed: Internal Server Error')
      expect(store.loading).toBe(false)
    })

    it('handles network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const store = useMaintenanceStore()

      await expect(store.scanSystem()).rejects.toThrow('Network error')

      expect(store.error).toBe('Network error')
      expect(store.loading).toBe(false)
    })
  })

  describe('cleanupIssues', () => {
    it('sends cleanup request with all parameters', async () => {
      const mockResult = {
        filesDeleted: 5,
        dirsDeleted: 2,
        screensDeleted: 1,
        bytesFreed: 10240,
        errors: [],
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response)

      const store = useMaintenanceStore()
      const result = await store.cleanupIssues(
        ['/path/to/file1.png', '/path/to/file2.png'],
        ['/path/to/dir1'],
        ['screen-1'],
        ['/path/to/temp'],
        ['/path/to/upload.zip'],
        false,
      )

      expect(fetch).toHaveBeenCalledWith('/api/maintenance/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orphanedFiles: ['/path/to/file1.png', '/path/to/file2.png'],
          orphanedDirs: ['/path/to/dir1'],
          brokenScreens: ['screen-1'],
          tempFiles: ['/path/to/temp'],
          oldUploads: ['/path/to/upload.zip'],
          dryRun: false,
        }),
      })

      expect(result).toEqual(mockResult)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('defaults to empty arrays and dry-run false', async () => {
      const mockResult = {
        filesDeleted: 0,
        dirsDeleted: 0,
        screensDeleted: 0,
        bytesFreed: 0,
        errors: [],
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response)

      const store = useMaintenanceStore()
      await store.cleanupIssues()

      expect(fetch).toHaveBeenCalledWith('/api/maintenance/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orphanedFiles: [],
          orphanedDirs: [],
          brokenScreens: [],
          tempFiles: [],
          oldUploads: [],
          dryRun: false,
        }),
      })
    })

    it('sends dry-run parameter', async () => {
      const mockResult = {
        filesDeleted: 5,
        dirsDeleted: 0,
        screensDeleted: 0,
        bytesFreed: 5120,
        errors: [],
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response)

      const store = useMaintenanceStore()
      await store.cleanupIssues(['/file.png'], [], [], [], [], true)

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]!.body as string)

      expect(body.dryRun).toBe(true)
    })

    it('handles cleanup errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
      } as Response)

      const store = useMaintenanceStore()

      await expect(store.cleanupIssues([], [], [], [], [], false)).rejects.toThrow('Cleanup failed: Forbidden')

      expect(store.error).toBe('Cleanup failed: Forbidden')
      expect(store.loading).toBe(false)
    })

    it('handles network errors during cleanup', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'))

      const store = useMaintenanceStore()

      await expect(store.cleanupIssues([], [], [], [], [], false)).rejects.toThrow('Connection refused')

      expect(store.error).toBe('Connection refused')
      expect(store.loading).toBe(false)
    })
  })

  describe('getStats', () => {
    it('fetches stats successfully', async () => {
      const mockStats = {
        fileCount: 42,
        totalSize: 1024000,
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as Response)

      const store = useMaintenanceStore()
      const result = await store.getStats()

      expect(fetch).toHaveBeenCalledWith('/api/maintenance/stats')
      expect(result).toEqual(mockStats)
    })

    it('handles stats fetch errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      } as Response)

      const store = useMaintenanceStore()

      await expect(store.getStats()).rejects.toThrow('Stats fetch failed: Service Unavailable')

      expect(store.error).toBe('Stats fetch failed: Service Unavailable')
    })

    it('handles network errors during stats fetch', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Timeout'))

      const store = useMaintenanceStore()

      await expect(store.getStats()).rejects.toThrow('Timeout')

      expect(store.error).toBe('Timeout')
    })
  })

  describe('clearIssues', () => {
    it('clears issues and error', async () => {
      const mockIssues = {
        orphanedScreenFiles: [],
        orphanedDeviceDirs: [],
        brokenScreens: [],
        tempFiles: [],
        oldUploads: [],
        totalSize: 0,
        scannedAt: '2026-04-24T12:00:00Z',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssues,
      } as Response)

      const store = useMaintenanceStore()
      await store.scanSystem()

      expect(store.issues).toEqual(mockIssues)

      store.clearIssues()

      expect(store.issues).toBeNull()
      expect(store.error).toBeNull()
    })
  })
})
