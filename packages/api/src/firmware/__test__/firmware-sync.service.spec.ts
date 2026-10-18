import type { SyncRunService } from '../../sync-runs/sync-run.service.js'
import type { Firmware } from '../entities/firmware.entity.js'
import type { FirmwareAutoUpdateService } from '../firmware-auto-update.service.js'
import { Logger } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { asRepository, createMockTransactionalRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { FirmwareSyncService } from '../firmware-sync.service.js'

function uniqueViolation(constraint: string): QueryFailedError {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate key'), { code: '23505', constraint }))
}

const { fsMock, cronMock } = vi.hoisted(() => ({
  fsMock: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
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
  let firmwareRepo: ReturnType<typeof createMockTransactionalRepository<Firmware>> & { existsBy: ReturnType<typeof vi.fn> }
  let autoUpdateService: { applyPolicy: ReturnType<typeof vi.fn> }
  let syncRuns: { record: ReturnType<typeof vi.fn>, recordFailure: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.resetAllMocks()
    fsMock.mkdir.mockResolvedValue(undefined)
    fsMock.writeFile.mockResolvedValue(undefined)
    fsMock.unlink.mockResolvedValue(undefined)
    firmwareRepo = Object.assign(createMockTransactionalRepository<Firmware>(), { existsBy: vi.fn().mockResolvedValue(false) })
    autoUpdateService = { applyPolicy: vi.fn().mockResolvedValue([]) }
    syncRuns = { record: vi.fn().mockResolvedValue(undefined), recordFailure: vi.fn().mockResolvedValue(undefined) }
    service = new FirmwareSyncService(asRepository(firmwareRepo), asService<FirmwareAutoUpdateService>(autoUpdateService), asService<SyncRunService>(syncRuns))
  })

  describe('onApplicationBootstrap', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('runs a sync immediately and schedules the daily sync at 4am', async () => {
      mockFetch.mockResolvedValue(jsonResponse(latestPayload))
      firmwareRepo.existsBy.mockResolvedValue(true)

      await service.onApplicationBootstrap()

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
      expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/firmware/latest', { signal: expect.any(AbortSignal) })
      expect(cronMock.schedule).toHaveBeenCalledTimes(1)
      expect(cronMock.schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function))
    })

    it('logs a boot-time sync failure as a warning instead of rejecting', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      mockFetch.mockImplementation(async () => jsonResponse(null, { ok: false }))

      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()

      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/^Initial firmware sync skipped: .*request failed/)))
    })

    it('logs a failure of the scheduled sync as a warning instead of throwing', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      mockFetch.mockImplementation(async () => jsonResponse(null, { ok: false }))
      await service.onApplicationBootstrap()
      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledTimes(1))
      const scheduled: () => void = cronMock.schedule.mock.calls[0][1]

      expect(() => scheduled()).not.toThrow()

      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/^Scheduled firmware sync failed: .*request failed/)))
    })
  })

  describe('sync', () => {
    it('inserts a new row when the upstream version changed', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse())
      autoUpdateService.applyPolicy.mockResolvedValue([{ id: 'd1', name: 'One', apikey: 'secret' }, { id: 'd2', name: 'Two' }])

      const result = await service.sync()

      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://usetrmnl.com/api/firmware/latest', { signal: expect.any(AbortSignal) })
      expect(mockFetch).toHaveBeenNthCalledWith(2, latestPayload.url)
      expect(firmwareRepo.existsBy).toHaveBeenCalledWith({ version: '1.5.6' })
      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', deprecated: false }, { deprecated: true })
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
        version: '1.5.6',
        kind: 'official-synced',
        checksum: expect.any(String),
        compatibleModels: ['og_png', 'og_plus'],
        deprecated: false,
      }))
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledWith(expect.objectContaining({ version: '1.5.6', kind: 'official-synced' }))
      expect(result).toEqual({ ranAt: expect.any(String), inserted: true, version: '1.5.6', assigned: [{ id: 'd1', name: 'One' }, { id: 'd2', name: 'Two' }] })
    })

    it('is a no-op when the version matches an existing row, synced or uploaded', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(latestPayload))
      firmwareRepo.existsBy.mockResolvedValue(true)

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
      expect(firmwareRepo.update).not.toHaveBeenCalledWith(expect.anything(), { deprecated: true })
      expect(autoUpdateService.applyPolicy).not.toHaveBeenCalled()
      expect(result).toEqual({ ranAt: expect.any(String), inserted: false, version: '1.5.6', assigned: [] })
    })

    it('realigns already-synced official rows to the current compatible models, even when the version is unchanged', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(latestPayload))
      firmwareRepo.existsBy.mockResolvedValue(true)

      await service.sync()

      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced' }, { compatibleModels: ['og_png', 'og_plus'] })
    })

    it('never declares the synced OG binary compatible with OG B/W/R/Y Devices', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse())

      await service.sync()

      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ compatibleModels: expect.not.arrayContaining(['og_bwry']) }))
      expect(firmwareRepo.update).not.toHaveBeenCalledWith(expect.anything(), { compatibleModels: expect.arrayContaining(['og_bwry']) })
    })

    it('inserts on the first-ever sync, when there is no previous official-synced row to deprecate', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse())

      await service.sync()

      expect(firmwareRepo.insert).toHaveBeenCalled()
    })

    /** The download succeeds and the insert then fails on `constraint`, as when another sync or upload commits the version first. */
    function loseInsertOn(constraint: string): QueryFailedError {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse())
      const violation = uniqueViolation(constraint)
      firmwareRepo.insert.mockRejectedValue(violation)
      return violation
    }

    it('answers inserted: false, without throwing, and unlinks the very file it wrote when another sync or upload takes the version first', async () => {
      loseInsertOn('UQ_firmware_version')

      const result = await service.sync()

      expect(result).toEqual({ ranAt: expect.any(String), inserted: false, version: '1.5.6', assigned: [] })
      expect(autoUpdateService.applyPolicy).not.toHaveBeenCalled()
      expect(fsMock.unlink).toHaveBeenCalledWith(fsMock.writeFile.mock.calls[0][0])
    })

    it('still answers inserted: false when unlinking the losing file fails', async () => {
      loseInsertOn('UQ_firmware_version')
      fsMock.unlink.mockRejectedValue(new Error('ENOENT'))

      await expect(service.sync()).resolves.toEqual({ ranAt: expect.any(String), inserted: false, version: '1.5.6', assigned: [] })
    })

    it('rethrows a unique violation on any other constraint and keeps the file', async () => {
      const otherViolation = loseInsertOn('UQ_something_else')

      await expect(service.sync()).rejects.toBe(otherViolation)
      expect(fsMock.unlink).not.toHaveBeenCalled()
    })

    it('coalesces concurrent sync() calls into a single run', async () => {
      mockFetch.mockImplementation(async () => jsonResponse(latestPayload))
      firmwareRepo.existsBy.mockResolvedValue(true)

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
      expect(syncRuns.recordFailure).toHaveBeenCalledWith('firmware', expect.any(Date), expect.objectContaining({ message: expect.stringContaining('request failed') }))
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

    it('recognises a timeout by the error name alone', async () => {
      mockFetch.mockRejectedValue(Object.assign(new Error('x'), { name: 'TimeoutError' }))
      await expect(service.sync()).rejects.toThrow('TRMNL firmware/latest request timed out')
    })

    it('rethrows any other fetch error unchanged', async () => {
      const networkError = new TypeError('fetch failed')
      mockFetch.mockRejectedValue(networkError)
      await expect(service.sync()).rejects.toBe(networkError)
    })

    it('throws when downloading the binary fails', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(latestPayload))
        .mockResolvedValueOnce(binaryResponse(false))

      await expect(service.sync()).rejects.toThrow(/Failed to download firmware binary/)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
    })
  })
})
