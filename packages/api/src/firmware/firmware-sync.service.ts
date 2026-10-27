import type { OnApplicationBootstrap } from '@nestjs/common'
import type { FirmwareSyncResult } from 'kuroshiro-shared'
import buffer from 'node:buffer'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { Repository } from 'typeorm'
import { TRMNL_API_URL } from '../device-models/trmnl-payloads.js'
import { isUniqueViolation } from '../errors/unique-violation.js'
import { SyncRunService } from '../sync-runs/sync-run.service.js'
import { Firmware } from './entities/firmware.entity.js'
import { FirmwareAutoUpdateService } from './firmware-auto-update.service.js'
import { firmwareFilePath } from './firmware-paths.js'
import { toDeviceReference } from './firmware.mapper.js'

/**
 * TRMNL's `/api/firmware/latest` names only the version; each hardware family's binary of it
 * sits in its own folder of TRMNL's firmware bucket, the way TRMNL's own `trmnl-api` gem and
 * Terminus fetch it (ADR-0065, superseding the OG-only sync of ADR-0015). Each folder gets
 * its own `official-synced` row, compatible with the Device Models listed here. `trmnl_bwry`
 * is left out because OTA on OG B/W/R/Y Devices fails or loops (usetrmnl/trmnl-firmware#538,
 * tracked in #1328).
 */
const OFFICIAL_FOLDERS: Record<string, string[]> = {
  trmnl_og: ['og_png', 'og_plus'],
  trmnl_x: ['v2'],
}

function officialBinaryUrl(folder: string, version: string): string {
  return `https://trmnl-fw.s3.us-east-2.amazonaws.com/${folder}/FW${encodeURIComponent(version)}.bin`
}

const DAILY_AT_4AM = '0 4 * * *'
const TRMNL_FETCH_TIMEOUT_MS = 15_000

@Injectable()
export class FirmwareSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FirmwareSyncService.name)
  private syncing: Promise<FirmwareSyncResult> | null = null

  constructor(
    @InjectRepository(Firmware)
    private readonly firmwareRepository: Repository<Firmware>,
    private readonly autoUpdateService: FirmwareAutoUpdateService,
    private readonly syncRuns: SyncRunService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    void this.sync().catch(err => this.logger.warn(`Initial firmware sync skipped: ${err.message}`))
    cron.schedule(DAILY_AT_4AM, () => {
      void this.sync().catch(err => this.logger.warn(`Scheduled firmware sync failed: ${err.message}`))
    })
  }

  /**
   * A scheduled run and a manual sync request share the same in-flight
   * promise instead of racing on the same insert.
   */
  sync(): Promise<FirmwareSyncResult> {
    this.syncing ??= this.runAndRecord().finally(() => {
      this.syncing = null
    })
    return this.syncing
  }

  private async runAndRecord(): Promise<FirmwareSyncResult> {
    const ranAt = new Date()
    let result: FirmwareSyncResult
    try {
      result = await this.runSync(ranAt)
    }
    catch (error) {
      await this.syncRuns.recordFailure('firmware', ranAt, error)
      throw error
    }
    await this.syncRuns.record('firmware', ranAt, { ok: true })
    return result
  }

  private async runSync(ranAt: Date): Promise<FirmwareSyncResult> {
    this.logger.log('Syncing firmware from TRMNL')
    await this.realignOfficialCompatibility()
    const version = await this.fetchLatestVersion()
    const result: FirmwareSyncResult = { ranAt: ranAt.toISOString(), inserted: false, version, assigned: [] }
    if (await this.firmwareRepository.existsBy({ kind: 'custom', version })) {
      this.logger.log(`A custom Firmware already holds ${version}, nothing to sync`)
      return result
    }

    // Every download comes before the first insert, so a folder failing other than with a
    // 404 fails the sync before any row is stored or any Device is assigned one.
    const downloads: Array<{ folder: string, binary: buffer.Buffer }> = []
    for (const folder of Object.keys(OFFICIAL_FOLDERS)) {
      const binary = await this.downloadNew(folder, version)
      if (binary)
        downloads.push({ folder, binary })
    }

    for (const { folder, binary } of downloads) {
      const inserted = await this.store(folder, version, binary)
      if (!inserted)
        continue
      result.inserted = true
      result.assigned.push(...(await this.autoUpdateService.applyPolicy(inserted)).map(toDeviceReference))
    }
    return result
  }

  /** The binary of `version` from `folder`, or `null` when the folder already holds it or TRMNL has none. */
  private async downloadNew(folder: string, version: string): Promise<buffer.Buffer | null> {
    if (await this.firmwareRepository.existsBy({ kind: 'official-synced', folder, version })) {
      this.logger.log(`Firmware ${version} from ${folder} already exists, nothing to sync`)
      return null
    }
    const binary = await this.downloadBinary(officialBinaryUrl(folder, version))
    if (!binary)
      this.logger.warn(`TRMNL has no ${folder} binary of firmware ${version}, skipped`)
    return binary
  }

  /** The new row of `version` from `folder`, or `null` when another sync stored it first. */
  private async store(folder: string, version: string, binary: buffer.Buffer): Promise<Firmware | null> {
    const checksum = crypto.createHash('sha256').update(binary).digest('hex')
    const id = crypto.randomUUID()
    const filePath = firmwareFilePath(id)
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, binary)

    const newFirmware = this.firmwareRepository.create({
      id,
      version,
      kind: 'official-synced',
      folder,
      checksum,
      compatibleModels: OFFICIAL_FOLDERS[folder],
      deprecated: false,
      syncedAt: new Date(),
    })

    try {
      await this.firmwareRepository.manager.transaction(async (manager) => {
        await manager.getRepository(Firmware).update({ kind: 'official-synced', folder, deprecated: false }, { deprecated: true })
        await manager.getRepository(Firmware).insert(newFirmware)
      })
    }
    catch (err) {
      if (!isUniqueViolation(err, 'UQ_firmware_folder_version'))
        throw err
      await fs.promises.unlink(filePath).catch(() => {})
      this.logger.log(`Firmware ${version} from ${folder} was inserted elsewhere first, nothing to do`)
      return null
    }

    this.logger.log(`Synced firmware ${version} from ${folder} (${id})`)
    return newFirmware
  }

  /**
   * Official-synced rows aren't admin-editable, so their compatibility is whatever this
   * service currently declares for their folder; rows synced under an older declaration
   * catch up here.
   */
  private async realignOfficialCompatibility(): Promise<void> {
    for (const [folder, compatibleModels] of Object.entries(OFFICIAL_FOLDERS))
      await this.firmwareRepository.update({ kind: 'official-synced', folder }, { compatibleModels })
  }

  private async fetchLatestVersion(): Promise<string> {
    let res: Response
    try {
      res = await fetch(`${TRMNL_API_URL}/firmware/latest`, { signal: AbortSignal.timeout(TRMNL_FETCH_TIMEOUT_MS) })
    }
    catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError')
        throw new Error('TRMNL firmware/latest request timed out')
      throw err
    }
    if (!res.ok)
      throw new Error(`TRMNL firmware/latest request failed: ${res.status} ${res.statusText}`)
    const body = await res.json()
    if (typeof body?.version !== 'string')
      throw new TypeError('TRMNL firmware/latest response is missing version')
    return body.version
  }

  /** `null` when the folder has no binary of that version. */
  private async downloadBinary(url: string): Promise<buffer.Buffer | null> {
    const res = await fetch(url)
    if (res.status === 404)
      return null
    if (!res.ok)
      throw new Error(`Failed to download firmware binary: ${res.status} ${res.statusText}`)
    return buffer.Buffer.from(await res.arrayBuffer())
  }
}
