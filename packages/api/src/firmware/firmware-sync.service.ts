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
 * Device Models whose entries in TRMNL's firmware feed are never synced: OTA on OG B/W/R/Y
 * Devices fails or loops (usetrmnl/trmnl-firmware#538, tracked in #1328; lifting it is #1573).
 */
const EXCLUDED_MODELS = ['og_bwry']

const FOLDER_PATTERN = /^[\w.-]+$/

/** One binary the feed advertises, with every model whose entry points at it. */
interface OfficialBinary {
  url: string
  /** The folder of TRMNL's firmware bucket the binary sits in: the row's lineage (ADR-0065). */
  folder: string
  version: string
  compatibleModels: string[]
}

interface TrmnlFirmwareEntry {
  model: string
  latest: string
  url: string
}

/** The folder `url` names its binary in, or a reason the entry can't be synced. */
function folderOf(url: string): { folder: string } | { reason: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return { reason: `url "${url}" is not a URL` }
  }
  if (parsed.protocol !== 'https:')
    return { reason: `url "${url}" is not https` }
  const segments = parsed.pathname.split('/').filter(Boolean)
  const folder = segments.at(-2)
  if (!folder || !FOLDER_PATTERN.test(folder))
    return { reason: `url "${url}" names no folder` }
  return { folder }
}

/** The highest of `versions`, compared segment by segment as numbers. */
function newestOf(versions: string[]): string {
  return versions.reduce((newest, version) => version.localeCompare(newest, undefined, { numeric: true }) > 0 ? version : newest)
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
    const binaries = this.officialBinaries(await this.fetchFeed())
    await this.realignOfficialCompatibility(binaries)
    const result: FirmwareSyncResult = { ranAt: ranAt.toISOString(), inserted: false, version: newestOf(binaries.map(binary => binary.version)), assigned: [] }

    // Every download comes before the first insert, so a failed download fails the sync
    // before any row is stored or any Device is assigned one.
    const downloads: Array<{ binary: OfficialBinary, file: buffer.Buffer }> = []
    for (const binary of binaries) {
      if (await this.isHeld(binary))
        continue
      downloads.push({ binary, file: await this.downloadBinary(binary.url) })
    }

    const insertedVersions: string[] = []
    for (const { binary, file } of downloads) {
      const inserted = await this.store(binary, file)
      if (!inserted)
        continue
      result.inserted = true
      insertedVersions.push(inserted.version)
      result.assigned.push(...(await this.autoUpdateService.applyPolicy(inserted)).map(toDeviceReference))
    }
    if (insertedVersions.length > 0)
      result.version = newestOf(insertedVersions)
    return result
  }

  /** Whether `binary`'s folder already holds its version, or a custom Firmware does, so there is nothing to sync. */
  private async isHeld({ folder, version }: OfficialBinary): Promise<boolean> {
    if (await this.firmwareRepository.existsBy({ kind: 'custom', version })) {
      this.logger.log(`A custom Firmware already holds ${version}, ${folder} not synced`)
      return true
    }
    if (await this.firmwareRepository.existsBy({ kind: 'official-synced', folder, version })) {
      this.logger.log(`Firmware ${version} from ${folder} already exists, nothing to sync`)
      return true
    }
    return false
  }

  /**
   * The feed's entries grouped by binary URL, minus the excluded models; an entry that
   * can't be synced is logged and skipped (ADR-0071).
   */
  private officialBinaries(entries: unknown[]): OfficialBinary[] {
    const byUrl = new Map<string, OfficialBinary>()
    for (const entry of entries) {
      if (!isFirmwareEntry(entry)) {
        this.logger.warn(`Skipping invalid firmware entry: ${JSON.stringify(entry)}`)
        continue
      }
      if (EXCLUDED_MODELS.includes(entry.model))
        continue
      const located = folderOf(entry.url)
      if ('reason' in located) {
        this.logger.warn(`Skipping firmware entry for ${entry.model}: ${located.reason}`)
        continue
      }
      const binary = byUrl.get(entry.url)
      if (binary)
        binary.compatibleModels.push(entry.model)
      else
        byUrl.set(entry.url, { url: entry.url, folder: located.folder, version: entry.latest, compatibleModels: [entry.model] })
    }

    const binaries = [...byUrl.values()]
    if (binaries.length === 0)
      throw new Error('TRMNL firmware response lists no binary to sync')
    const folders = new Set<string>()
    for (const { folder } of binaries) {
      if (folders.has(folder))
        throw new Error(`TRMNL firmware response lists two binaries in ${folder}`)
      folders.add(folder)
    }
    return binaries
  }

  /** The new row of `binary`, or `null` when another sync stored it first. */
  private async store({ folder, version, compatibleModels }: OfficialBinary, file: buffer.Buffer): Promise<Firmware | null> {
    const checksum = crypto.createHash('sha256').update(file).digest('hex')
    const id = crypto.randomUUID()
    const filePath = firmwareFilePath(id)
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, file)

    const newFirmware = this.firmwareRepository.create({
      id,
      version,
      kind: 'official-synced',
      folder,
      checksum,
      compatibleModels,
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
   * Official-synced rows aren't admin-editable, so their compatibility is whatever the feed
   * currently lists for their folder; rows synced under an older listing catch up here.
   */
  private async realignOfficialCompatibility(binaries: OfficialBinary[]): Promise<void> {
    for (const { folder, compatibleModels } of binaries)
      await this.firmwareRepository.update({ kind: 'official-synced', folder }, { compatibleModels })
  }

  private async fetchFeed(): Promise<unknown[]> {
    let res: Response
    try {
      res = await fetch(`${TRMNL_API_URL}/firmware`, { signal: AbortSignal.timeout(TRMNL_FETCH_TIMEOUT_MS) })
    }
    catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError')
        throw new Error('TRMNL firmware request timed out')
      throw err
    }
    if (!res.ok)
      throw new Error(`TRMNL firmware request failed: ${res.status} ${res.statusText}`)
    const body = await res.json()
    if (!Array.isArray(body?.data))
      throw new Error('TRMNL firmware response has no data array')
    return body.data
  }

  private async downloadBinary(url: string): Promise<buffer.Buffer> {
    const res = await fetch(url)
    if (!res.ok)
      throw new Error(`Failed to download firmware binary ${url}: ${res.status} ${res.statusText}`)
    return buffer.Buffer.from(await res.arrayBuffer())
  }
}

function isFirmwareEntry(entry: unknown): entry is TrmnlFirmwareEntry {
  if (typeof entry !== 'object' || entry === null)
    return false
  const { model, latest, url } = entry as Record<string, unknown>
  return typeof model === 'string' && model !== '' && typeof latest === 'string' && latest !== '' && typeof url === 'string'
}
