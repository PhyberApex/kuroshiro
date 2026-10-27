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

function binaryResponse(status = 200): Response {
  return new Response(status === 200 ? new Uint8Array([1, 2, 3]) : null, { status })
}

const OG_URL = 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_og/FW1.8.17.bin'
const BWRY_URL = 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_bwry/FW1.8.17.bin'
const X_URL = 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_x/FW1.8.17.bin'
const FEED_URL = 'https://usetrmnl.com/api/firmware'

interface FeedEntry { model: string, label?: string, chip_family?: string, latest: string, url: string }

/** What `GET /api/firmware` answered on 2026-10-27. */
const feed: FeedEntry[] = [
  { model: 'og_png', label: 'TRMNL OG (1-bit)', chip_family: 'esp32c3', latest: '1.8.17', url: OG_URL },
  { model: 'og_plus', label: 'TRMNL OG (2-bit)', chip_family: 'esp32c3', latest: '1.8.17', url: OG_URL },
  { model: 'og_bwry', label: 'TRMNL OG (B/W/R/Y)', chip_family: 'esp32c3', latest: '1.8.17', url: BWRY_URL },
  { model: 'v2', label: 'TRMNL X', chip_family: 'esp32s3', latest: '1.8.17', url: X_URL },
]

/** TRMNL answers the feed with `entries`, and each binary URL with the status given for it, else 200. */
function trmnlAnswers(binaryStatus: Record<string, number> = {}, entries: unknown[] = feed): void {
  mockFetch.mockImplementation(async input => String(input) === FEED_URL
    ? jsonResponse({ data: entries })
    : binaryResponse(binaryStatus[String(input)] ?? 200))
}

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
      trmnlAnswers()
      firmwareRepo.existsBy.mockResolvedValue(true)

      await service.onApplicationBootstrap()

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
      expect(mockFetch).toHaveBeenCalledWith(FEED_URL, { signal: expect.any(AbortSignal) })
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
    it('stores one row per binary the feed lists, compatible with every model whose entry points at it', async () => {
      trmnlAnswers()
      autoUpdateService.applyPolicy
        .mockResolvedValueOnce([{ id: 'd1', name: 'One', apikey: 'secret' }])
        .mockResolvedValueOnce([{ id: 'd2', name: 'Two' }])

      const result = await service.sync()

      expect(mockFetch).toHaveBeenNthCalledWith(1, FEED_URL, { signal: expect.any(AbortSignal) })
      expect(mockFetch).toHaveBeenCalledWith(OG_URL)
      expect(mockFetch).toHaveBeenCalledWith(X_URL)
      expect(firmwareRepo.insert).toHaveBeenCalledTimes(2)
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
        version: '1.8.17',
        kind: 'official-synced',
        folder: 'trmnl_og',
        checksum: expect.any(String),
        compatibleModels: ['og_png', 'og_plus'],
        deprecated: false,
      }))
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ version: '1.8.17', folder: 'trmnl_x', compatibleModels: ['v2'] }))
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_og' }))
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_x' }))
      expect(result).toEqual({ ranAt: expect.any(String), inserted: true, version: '1.8.17', assigned: [{ id: 'd1', name: 'One' }, { id: 'd2', name: 'Two' }] })
    })

    it('stores each folder at the version its own entry names', async () => {
      trmnlAnswers({}, [
        { model: 'og_png', latest: '1.8.17', url: OG_URL },
        { model: 'v2', latest: '1.8.16', url: 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_x/FW1.8.16.bin' },
      ])

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledWith('https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_x/FW1.8.16.bin')
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_og', version: '1.8.17' }))
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_x', version: '1.8.16' }))
      expect(result).toMatchObject({ inserted: true, version: '1.8.17' })
    })

    it('syncs a model Kuroshiro has no Device Model for yet, keeping its key', async () => {
      const newUrl = 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_new/FW2.0.0.bin'
      trmnlAnswers({}, [{ model: 'brand_new', latest: '2.0.0', url: newUrl }])

      await service.sync()

      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_new', version: '2.0.0', compatibleModels: ['brand_new'] }))
    })

    it('never syncs a binary for OG B/W/R/Y Devices, and drops the model from any entry it shares', async () => {
      trmnlAnswers({}, [...feed, { model: 'og_bwry', latest: '1.8.17', url: OG_URL }])

      await service.sync()

      expect(mockFetch).not.toHaveBeenCalledWith(BWRY_URL)
      expect(firmwareRepo.insert).not.toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_bwry' }))
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_og', compatibleModels: ['og_png', 'og_plus'] }))
      expect(firmwareRepo.update).not.toHaveBeenCalledWith(expect.anything(), { compatibleModels: expect.arrayContaining(['og_bwry']) })
    })

    it('deprecates only the previous official row of the same folder', async () => {
      trmnlAnswers()

      await service.sync()

      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_og', deprecated: false }, { deprecated: true })
      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_x', deprecated: false }, { deprecated: true })
      expect(firmwareRepo.update).not.toHaveBeenCalledWith({ kind: 'official-synced', deprecated: false }, { deprecated: true })
    })

    it('skips a folder that already holds its version and still syncs the others', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockImplementation(async where => (where as { folder?: string }).folder === 'trmnl_og')

      const result = await service.sync()

      expect(firmwareRepo.existsBy).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_og', version: '1.8.17' })
      expect(mockFetch).not.toHaveBeenCalledWith(OG_URL)
      expect(firmwareRepo.insert).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_x' }))
      expect(result).toMatchObject({ inserted: true, version: '1.8.17' })
    })

    it('is a no-op when every folder already holds its version', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockResolvedValue(true)

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
      expect(firmwareRepo.update).not.toHaveBeenCalledWith(expect.anything(), { deprecated: true })
      expect(autoUpdateService.applyPolicy).not.toHaveBeenCalled()
      expect(result).toEqual({ ranAt: expect.any(String), inserted: false, version: '1.8.17', assigned: [] })
    })

    it('syncs no folder at a version a custom Firmware already holds', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockImplementation(async where => (where as { kind?: string }).kind === 'custom')

      const result = await service.sync()

      expect(firmwareRepo.existsBy).toHaveBeenCalledWith({ kind: 'custom', version: '1.8.17' })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ ranAt: expect.any(String), inserted: false, version: '1.8.17', assigned: [] })
    })

    it('realigns already-synced official rows of each folder to the models the feed lists for it, even when nothing is new', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockResolvedValue(true)

      await service.sync()

      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_og' }, { compatibleModels: ['og_png', 'og_plus'] })
      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_x' }, { compatibleModels: ['v2'] })
    })

    it('logs and skips a malformed entry, and syncs the others', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      trmnlAnswers({}, [
        { model: 'og_png', latest: '1.8.17', url: OG_URL },
        { model: 'v2', latest: '1.8.17' },
        { model: 'v2', latest: '1.8.17', url: 'http://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_x/FW1.8.17.bin' },
        { model: 'v2', latest: '1.8.17', url: 'https://trmnl-fw.s3.us-east-2.amazonaws.com/FW1.8.17.bin' },
        null,
      ])

      await service.sync()

      expect(firmwareRepo.insert).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_og' }))
      expect(warnSpy).toHaveBeenCalledTimes(4)
      warnSpy.mockRestore()
    })

    it('keeps the first version named for a binary, and warns when another entry names it differently', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      trmnlAnswers({}, [
        { model: 'og_png', latest: '1.8.17', url: OG_URL },
        { model: 'og_plus', latest: '1.8.16', url: OG_URL },
      ])

      await service.sync()

      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_og', version: '1.8.17', compatibleModels: ['og_png', 'og_plus'] }))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('og_plus names 1.8.16'))
      warnSpy.mockRestore()
    })

    it('throws, and stores nothing, when the feed lists two binaries in one folder', async () => {
      trmnlAnswers({}, [
        { model: 'og_png', latest: '1.8.17', url: OG_URL },
        { model: 'og_plus', latest: '1.8.16', url: 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_og/FW1.8.16.bin' },
      ])

      await expect(service.sync()).rejects.toThrow(/two binaries in trmnl_og/)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
    })

    it('throws when the feed lists no binary left to sync', async () => {
      trmnlAnswers({}, [{ model: 'og_bwry', latest: '1.8.17', url: BWRY_URL }])

      await expect(service.sync()).rejects.toThrow(/lists no binary/)
      expect(syncRuns.recordFailure).toHaveBeenCalled()
    })

    /** The downloads succeed and the trmnl_og insert then fails on `constraint`, as when another sync commits that folder's version first. */
    function loseOgInsertOn(constraint: string): QueryFailedError {
      trmnlAnswers()
      const violation = uniqueViolation(constraint)
      firmwareRepo.insert.mockImplementation(async (row) => {
        if ((row as Firmware).folder === 'trmnl_og')
          throw violation
        return undefined as never
      })
      return violation
    }

    it('skips the folder without throwing, and unlinks the very file it wrote, when another sync takes its version first', async () => {
      loseOgInsertOn('UQ_firmware_folder_version')

      const result = await service.sync()

      expect(result).toEqual({ ranAt: expect.any(String), inserted: true, version: '1.8.17', assigned: [] })
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledTimes(1)
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_x' }))
      expect(fsMock.unlink).toHaveBeenCalledWith(fsMock.writeFile.mock.calls[0][0])
    })

    it('still skips the folder when unlinking the losing file fails', async () => {
      loseOgInsertOn('UQ_firmware_folder_version')
      fsMock.unlink.mockRejectedValue(new Error('ENOENT'))

      await expect(service.sync()).resolves.toMatchObject({ inserted: true })
    })

    it('rethrows a unique violation on any other constraint and keeps the file', async () => {
      const otherViolation = loseOgInsertOn('UQ_something_else')

      await expect(service.sync()).rejects.toBe(otherViolation)
      expect(fsMock.unlink).not.toHaveBeenCalled()
    })

    it('coalesces concurrent sync() calls into a single run', async () => {
      trmnlAnswers()
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
      expect(firmwareRepo.update).not.toHaveBeenCalled()
      expect(syncRuns.recordFailure).toHaveBeenCalledWith('firmware', expect.any(Date), expect.objectContaining({ message: expect.stringContaining('request failed') }))
    })

    it('throws when the response has no data array', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ version: '1.8.17' }))
      await expect(service.sync()).rejects.toThrow(/no data array/)
    })

    it('surfaces a clear error when the fetch times out', async () => {
      mockFetch.mockImplementation(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      })
      await expect(service.sync()).rejects.toThrow('TRMNL firmware request timed out')
    })

    it('rethrows any other fetch error unchanged', async () => {
      const networkError = new TypeError('fetch failed')
      mockFetch.mockRejectedValue(networkError)
      await expect(service.sync()).rejects.toBe(networkError)
    })

    it.each([404, 502])('throws, and stores and assigns nothing, when downloading any advertised binary fails with a %i', async (status) => {
      trmnlAnswers({ [X_URL]: status })

      await expect(service.sync()).rejects.toThrow(/Failed to download firmware binary/)
      expect(fsMock.writeFile).not.toHaveBeenCalled()
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
      expect(autoUpdateService.applyPolicy).not.toHaveBeenCalled()
    })
  })
})
