import type { SyncRunService } from '../../sync-runs/sync-run.service.js'
import type { Firmware } from '../entities/firmware.entity.js'
import type { FirmwareAutoUpdateService } from '../firmware-auto-update.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { makeFirmware } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { FirmwareSyncService } from '../firmware-sync.service.js'

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

const mockFetch = stubFetch()

function binaryResponse(ok = true): Response {
  return new Response(new Uint8Array([1, 2, 3]), { status: ok ? 200 : 502, statusText: ok ? 'OK' : 'Bad Gateway' })
}

const latestPayload = { url: 'https://trmnl-fw.example.com/trmnl_og/FW1.5.6.bin', version: '1.5.6' }

describe('firmwareSyncService', () => {
  let service: FirmwareSyncService
  let firmwareRepo: ReturnType<typeof createMockRepository<Firmware>>
  let autoUpdateService: { applyPolicy: ReturnType<typeof vi.fn> }
  let syncRuns: { record: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.resetAllMocks()
    fsMock.mkdir.mockResolvedValue(undefined)
    fsMock.writeFile.mockResolvedValue(undefined)
    firmwareRepo = createMockRepository<Firmware>()
    autoUpdateService = { applyPolicy: vi.fn().mockResolvedValue([]) }
    syncRuns = { record: vi.fn().mockResolvedValue(undefined) }
    service = new FirmwareSyncService(asRepository(firmwareRepo), asService<FirmwareAutoUpdateService>(autoUpdateService), asService<SyncRunService>(syncRuns))
  })

  describe('onApplicationBootstrap', () => {
    it('schedules the daily sync and swallows a boot-time sync failure instead of throwing', async () => {
      mockFetch.mockImplementation(async () => jsonResponse(null, { ok: false }))
      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()
      expect(cronMock.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function))
    })
  })

  describe('sync', () => {
    it('inserts a new row when the upstream version changed', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse())
      firmwareRepo.findOne.mockResolvedValue(makeFirmware({ id: 'old', version: '1.5.5' }))
      autoUpdateService.applyPolicy.mockResolvedValue([{ id: 'd1', name: 'One', apikey: 'secret' }, { id: 'd2', name: 'Two' }])

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
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledWith(expect.objectContaining({ version: '1.5.6', kind: 'official-synced' }))
      expect(result).toEqual({ ranAt: expect.any(String), inserted: true, version: '1.5.6', assigned: [{ id: 'd1', name: 'One' }, { id: 'd2', name: 'Two' }] })
    })

    it('is a no-op when the version matches the newest existing row', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(latestPayload))
      firmwareRepo.findOne.mockResolvedValue(makeFirmware({ id: 'current', version: '1.5.6' }))

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
      expect(firmwareRepo.update).not.toHaveBeenCalled()
      expect(autoUpdateService.applyPolicy).not.toHaveBeenCalled()
      expect(result).toEqual({ ranAt: expect.any(String), inserted: false, version: '1.5.6', assigned: [] })
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
      mockFetch.mockImplementation(async () => jsonResponse(latestPayload))
      firmwareRepo.findOne.mockResolvedValue(makeFirmware({ id: 'current', version: '1.5.6' }))

      const [first, second] = await Promise.all([service.sync(), service.sync()])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)

      await service.sync()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws and writes nothing when TRMNL is unreachable', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(null, { ok: false }))
      await expect(service.sync()).rejects.toThrow(/request failed/)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
      expect(syncRuns.record).toHaveBeenCalledWith('firmware', expect.any(Date), { ok: false, error: expect.stringContaining('request failed') })
    })

    it('still throws the upstream error when recording the failure fails', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(null, { ok: false }))
      syncRuns.record.mockRejectedValue(new Error('database down'))
      await expect(service.sync()).rejects.toThrow(/request failed/)
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
      firmwareRepo.findOne.mockResolvedValue(makeFirmware({ id: 'old', version: '1.5.5' }))

      await expect(service.sync()).rejects.toThrow(/Failed to download firmware binary/)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
    })
  })
})
