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
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { Firmware } from './entities/firmware.entity.js'
import { FirmwareAutoUpdateService } from './firmware-auto-update.service.js'
import { firmwareFilePath } from './firmware-paths.js'
import { toDeviceReference } from './firmware.mapper.js'

interface TrmnlFirmwarePayload {
  url: string
  version: string
}

// TRMNL's public firmware endpoint only ever returns the OG binary (see
// docs/adr/0015-firmware-compatibility-enforced-og-only-sync.md). `og_bwry` is left out
// because OTA with that binary fails or loops on OG B/W/R/Y Devices
// (usetrmnl/trmnl-firmware#538).
const OFFICIAL_SYNC_COMPATIBLE_MODELS = ['og_png', 'og_plus']

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
      await this.syncRuns.record('firmware', ranAt, { ok: false, error: getErrorMessage(error) })
        .catch(recordError => this.logger.error(`Could not record the failed firmware sync: ${getErrorMessage(recordError)}`))
      throw error
    }
    await this.syncRuns.record('firmware', ranAt, { ok: true })
    return result
  }

  private async runSync(ranAt: Date): Promise<FirmwareSyncResult> {
    this.logger.log('Syncing firmware from TRMNL')
    await this.realignOfficialCompatibility()
    const payload = await this.fetchLatest()
    const noop = { ranAt: ranAt.toISOString(), inserted: false, version: payload.version, assigned: [] }
    if (await this.firmwareRepository.existsBy({ version: payload.version })) {
      this.logger.log(`Firmware ${payload.version} already exists, nothing to sync`)
      return noop
    }

    const binary = await this.downloadBinary(payload.url)
    const checksum = crypto.createHash('sha256').update(binary).digest('hex')
    const id = crypto.randomUUID()
    const syncedAt = new Date()
    const filePath = firmwareFilePath(id)
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, binary)

    const newFirmware = this.firmwareRepository.create({
      id,
      version: payload.version,
      kind: 'official-synced',
      checksum,
      compatibleModels: OFFICIAL_SYNC_COMPATIBLE_MODELS,
      deprecated: false,
      syncedAt,
    })

    try {
      await this.firmwareRepository.manager.transaction(async (manager) => {
        await manager.getRepository(Firmware).update({ kind: 'official-synced', deprecated: false }, { deprecated: true })
        await manager.getRepository(Firmware).insert(newFirmware)
      })
    }
    catch (err) {
      if (!isUniqueViolation(err, 'UQ_firmware_version'))
        throw err
      await fs.promises.unlink(filePath).catch(() => {})
      this.logger.log(`Firmware ${payload.version} was inserted elsewhere first, nothing to do`)
      return noop
    }

    const assigned = await this.autoUpdateService.applyPolicy(newFirmware)

    this.logger.log(`Synced firmware ${payload.version} (${id})`)
    return {
      ranAt: ranAt.toISOString(),
      inserted: true,
      version: payload.version,
      assigned: assigned.map(toDeviceReference),
    }
  }

  /**
   * Official-synced rows aren't admin-editable, so their compatibility is whatever this
   * service currently declares; rows synced under an older declaration catch up here.
   */
  private async realignOfficialCompatibility(): Promise<void> {
    await this.firmwareRepository.update({ kind: 'official-synced' }, { compatibleModels: OFFICIAL_SYNC_COMPATIBLE_MODELS })
  }

  private async fetchLatest(): Promise<TrmnlFirmwarePayload> {
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
    if (typeof body?.url !== 'string' || typeof body?.version !== 'string')
      throw new Error('TRMNL firmware/latest response is missing url/version')
    return { url: body.url, version: body.version }
  }

  private async downloadBinary(url: string): Promise<buffer.Buffer> {
    const res = await fetch(url)
    if (!res.ok)
      throw new Error(`Failed to download firmware binary: ${res.status} ${res.statusText}`)
    return buffer.Buffer.from(await res.arrayBuffer())
  }
}
