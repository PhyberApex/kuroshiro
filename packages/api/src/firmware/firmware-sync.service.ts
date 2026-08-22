import type { OnApplicationBootstrap } from '@nestjs/common'
import buffer from 'node:buffer'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { Repository } from 'typeorm'
import { TRMNL_API_URL } from '../device-models/trmnl-payloads'
import { Firmware } from './entities/firmware.entity'
import { firmwareFilePath } from './firmware-paths'

export interface FirmwareSyncResult {
  inserted: boolean
  version: string
  syncedAt?: Date
}

interface TrmnlFirmwarePayload {
  url: string
  version: string
}

// TRMNL's public firmware endpoint only ever returns the OG binary (see
// docs/adr/0015-firmware-compatibility-enforced-og-only-sync.md).
const OFFICIAL_SYNC_COMPATIBLE_MODELS = ['og_png', 'og_plus', 'og_bwry']

const DAILY_AT_4AM = '0 4 * * *'
const TRMNL_FETCH_TIMEOUT_MS = 15_000

@Injectable()
export class FirmwareSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FirmwareSyncService.name)
  private syncing: Promise<FirmwareSyncResult> | null = null

  constructor(
    @InjectRepository(Firmware)
    private readonly firmwareRepository: Repository<Firmware>,
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
    this.syncing ??= this.runSync().finally(() => {
      this.syncing = null
    })
    return this.syncing
  }

  private async runSync(): Promise<FirmwareSyncResult> {
    this.logger.log('Syncing firmware from TRMNL')
    const payload = await this.fetchLatest()
    const newest = await this.firmwareRepository.findOne({ where: { kind: 'official-synced' }, order: { syncedAt: 'DESC' } })
    if (newest && newest.version === payload.version) {
      this.logger.log(`Firmware ${payload.version} already synced, nothing to do`)
      return { inserted: false, version: payload.version }
    }

    const binary = await this.downloadBinary(payload.url)
    const checksum = crypto.createHash('sha256').update(binary).digest('hex')
    const id = crypto.randomUUID()
    const syncedAt = new Date()
    const filePath = firmwareFilePath(id)
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, binary)

    if (newest)
      await this.firmwareRepository.update({ kind: 'official-synced', deprecated: false }, { deprecated: true })
    await this.firmwareRepository.insert({
      id,
      version: payload.version,
      kind: 'official-synced',
      checksum,
      compatibleModels: OFFICIAL_SYNC_COMPATIBLE_MODELS,
      deprecated: false,
      syncedAt,
    })

    this.logger.log(`Synced firmware ${payload.version} (${id})`)
    return { inserted: true, version: payload.version, syncedAt }
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
