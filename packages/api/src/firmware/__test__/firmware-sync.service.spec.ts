import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FirmwareSyncService } from '../firmware-sync.service'

const { fsMock, cronMock } = vi.hoisted(() => ({
  fsMock: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  cronMock: { schedule: vi.fn() },
}))

vi.mock('node:fs', () => ({
  promises: fsMock,
}))

vi.mock('node-cron', () => ({
  default: cronMock,
}))

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function createMockRepo() {
  return {
    findOne: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  }
}

function jsonResponse(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 502, statusText: ok ? 'OK' : 'Bad Gateway', json: async () => data }
}

function binaryResponse(ok = true) {
  return { ok, status: ok ? 200 : 502, statusText: ok ? 'OK' : 'Bad Gateway', arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }
}

const latestPayload = { url: 'https://trmnl-fw.example.com/trmnl_og/FW1.5.6.bin', version: '1.5.6' }

describe('firmwareSyncService', () => {
  let service: FirmwareSyncService
  let firmwareRepo: ReturnType<typeof createMockRepo>

  beforeEach(() => {
    vi.resetAllMocks()
    fsMock.mkdir.mockResolvedValue(undefined)
    fsMock.writeFile.mockResolvedValue(undefined)
    firmwareRepo = createMockRepo()
    service = new FirmwareSyncService(firmwareRepo as any)
  })

  describe('onApplicationBootstrap', () => {
    it('schedules the daily sync and swallows a boot-time sync failure instead of throwing', async () => {
      mockFetch.mockResolvedValue(jsonResponse(null, false))
      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()
      expect(cronMock.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function))
    })
  })

  describe('sync', () => {
    it('inserts a new row when the upstream version changed', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse())
      firmwareRepo.findOne.mockResolvedValue({ id: 'old', version: '1.5.5' })

      const result = await service.sync()

      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://usetrmnl.com/api/firmware/latest', { signal: expect.any(AbortSignal) })
      expect(mockFetch).toHaveBeenNthCalledWith(2, latestPayload.url)
      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', deprecated: false }, { deprecated: true })
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
        version: '1.5.6',
        kind: 'official-synced',
        checksum: expect.any(String),
        compatibleModels: ['og_png', 'og_plus', 'og_bwry'],
        deprecated: false,
      }))
      expect(result).toMatchObject({ inserted: true, version: '1.5.6' })
    })

    it('is a no-op when the version matches the newest existing row', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(latestPayload))
      firmwareRepo.findOne.mockResolvedValue({ id: 'current', version: '1.5.6' })

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
      expect(firmwareRepo.update).not.toHaveBeenCalled()
      expect(result).toEqual({ inserted: false, version: '1.5.6' })
    })

    it('inserts without deprecating anything on the first-ever sync', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse())
      firmwareRepo.findOne.mockResolvedValue(null)

      await service.sync()

      expect(firmwareRepo.update).not.toHaveBeenCalled()
      expect(firmwareRepo.insert).toHaveBeenCalled()
    })

    it('coalesces concurrent sync() calls into a single run', async () => {
      mockFetch.mockResolvedValue(jsonResponse(latestPayload))
      firmwareRepo.findOne.mockResolvedValue({ id: 'current', version: '1.5.6' })

      const [first, second] = await Promise.all([service.sync(), service.sync()])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)

      await service.sync()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws and writes nothing when TRMNL is unreachable', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(null, false))
      await expect(service.sync()).rejects.toThrow(/request failed/)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
    })

    it('throws when the response is missing url/version', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://example.com/fw.bin' }))
      await expect(service.sync()).rejects.toThrow(/missing url\/version/)
    })

    it('surfaces a clear error when the fetch times out', async () => {
      mockFetch.mockImplementation(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      })
      await expect(service.sync()).rejects.toThrow(/request timed out/)
    })

    it('throws when downloading the binary fails', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse(false))
      firmwareRepo.findOne.mockResolvedValue({ id: 'old', version: '1.5.5' })

      await expect(service.sync()).rejects.toThrow(/Failed to download firmware binary/)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
    })
  })
})
