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

const latestPayload = { url: 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_og/FW1.5.6.bin', version: '1.5.6' }
const OG_URL = 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_og/FW1.5.6.bin'
const X_URL = 'https://trmnl-fw.s3.us-east-2.amazonaws.com/trmnl_x/FW1.5.6.bin'

/** TRMNL answers `latest` with `latestPayload`, and each binary URL with the status given for it, else 200. */
function trmnlAnswers(binaryStatus: Record<string, number> = {}): void {
  mockFetch.mockImplementation(async input => String(input).endsWith('/firmware/latest')
    ? jsonResponse(latestPayload)
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
    it('stores the newest version once per folder, each compatible with that folder\'s Device Models', async () => {
      trmnlAnswers()
      autoUpdateService.applyPolicy
        .mockResolvedValueOnce([{ id: 'd1', name: 'One', apikey: 'secret' }])
        .mockResolvedValueOnce([{ id: 'd2', name: 'Two' }])

      const result = await service.sync()

      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://usetrmnl.com/api/firmware/latest', { signal: expect.any(AbortSignal) })
      expect(mockFetch).toHaveBeenCalledWith(OG_URL)
      expect(mockFetch).toHaveBeenCalledWith(X_URL)
      expect(firmwareRepo.insert).toHaveBeenCalledTimes(2)
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
        version: '1.5.6',
        kind: 'official-synced',
        folder: 'trmnl_og',
        checksum: expect.any(String),
        compatibleModels: ['og_png', 'og_plus'],
        deprecated: false,
      }))
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ version: '1.5.6', folder: 'trmnl_x', compatibleModels: ['v2'] }))
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_og' }))
      expect(autoUpdateService.applyPolicy).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_x' }))
      expect(result).toEqual({ ranAt: expect.any(String), inserted: true, version: '1.5.6', assigned: [{ id: 'd1', name: 'One' }, { id: 'd2', name: 'Two' }] })
    })

    it('deprecates only the previous official row of the same folder', async () => {
      trmnlAnswers()

      await service.sync()

      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_og', deprecated: false }, { deprecated: true })
      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_x', deprecated: false }, { deprecated: true })
      expect(firmwareRepo.update).not.toHaveBeenCalledWith({ kind: 'official-synced', deprecated: false }, { deprecated: true })
    })

    it('skips a folder that already holds the version and still syncs the others', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockImplementation(async where => (where as { folder?: string }).folder === 'trmnl_og')

      const result = await service.sync()

      expect(firmwareRepo.existsBy).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_og', version: '1.5.6' })
      expect(mockFetch).not.toHaveBeenCalledWith(OG_URL)
      expect(firmwareRepo.insert).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_x' }))
      expect(result).toMatchObject({ inserted: true, version: '1.5.6' })
    })

    it('is a no-op when every folder already holds the version', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockResolvedValue(true)

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
      expect(firmwareRepo.update).not.toHaveBeenCalledWith(expect.anything(), { deprecated: true })
      expect(autoUpdateService.applyPolicy).not.toHaveBeenCalled()
      expect(result).toEqual({ ranAt: expect.any(String), inserted: false, version: '1.5.6', assigned: [] })
    })

    it('syncs nothing when a custom Firmware already holds the version', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockImplementation(async where => (where as { kind?: string }).kind === 'custom')

      const result = await service.sync()

      expect(firmwareRepo.existsBy).toHaveBeenCalledWith({ kind: 'custom', version: '1.5.6' })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ ranAt: expect.any(String), inserted: false, version: '1.5.6', assigned: [] })
    })

    it('logs and skips a folder TRMNL has no binary of the version in, and syncs the others', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      trmnlAnswers({ [X_URL]: 404 })

      const result = await service.sync()

      expect(firmwareRepo.insert).toHaveBeenCalledTimes(1)
      expect(firmwareRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_og' }))
      expect(firmwareRepo.update).not.toHaveBeenCalledWith(expect.objectContaining({ folder: 'trmnl_x', deprecated: false }), { deprecated: true })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('trmnl_x'))
      expect(result).toMatchObject({ inserted: true })
      expect(syncRuns.record).toHaveBeenCalledWith('firmware', expect.any(Date), { ok: true })
      warnSpy.mockRestore()
    })

    it('realigns already-synced official rows of each folder to its compatible models, even when nothing is new', async () => {
      trmnlAnswers()
      firmwareRepo.existsBy.mockResolvedValue(true)

      await service.sync()

      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_og' }, { compatibleModels: ['og_png', 'og_plus'] })
      expect(firmwareRepo.update).toHaveBeenCalledWith({ kind: 'official-synced', folder: 'trmnl_x' }, { compatibleModels: ['v2'] })
    })

    it('never syncs a binary for OG B/W/R/Y Devices', async () => {
      trmnlAnswers()

      await service.sync()

      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('trmnl_bwry'))
      expect(firmwareRepo.insert).not.toHaveBeenCalledWith(expect.objectContaining({ compatibleModels: expect.arrayContaining(['og_bwry']) }))
      expect(firmwareRepo.update).not.toHaveBeenCalledWith(expect.anything(), { compatibleModels: expect.arrayContaining(['og_bwry']) })
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

      expect(result).toEqual({ ranAt: expect.any(String), inserted: true, version: '1.5.6', assigned: [] })
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

    it('throws when the response is missing the version', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'https://example.com/fw.bin' }))
      await expect(service.sync()).rejects.toThrow(/missing version/)
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

    it('throws when downloading a binary fails other than with a 404', async () => {
      trmnlAnswers({ [OG_URL]: 502 })

      await expect(service.sync()).rejects.toThrow(/Failed to download firmware binary/)
      expect(firmwareRepo.insert).not.toHaveBeenCalled()
    })
  })
})
