import type { OnApplicationBootstrap } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { In, Repository } from 'typeorm'
import { TRMNL_MODELS_SNAPSHOT, TRMNL_PALETTES_SNAPSHOT } from './data/trmnl-snapshot'
import { DeviceModel } from './entities/device-model.entity'
import { Palette } from './entities/palette.entity'
import { toDeviceModelAttributes, toPaletteAttributes, TRMNL_API_URL, TrmnlModelPayload, TrmnlPalettePayload } from './trmnl-payloads'

export interface DeviceModelSyncResult {
  models: number
  palettes: number
  deprecatedModels: number
  deprecatedPalettes: number
  syncedAt: Date
}

const DAILY_AT_4AM = '0 4 * * *'

@Injectable()
export class DeviceModelSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DeviceModelSyncService.name)

  constructor(
    @InjectRepository(DeviceModel)
    private readonly deviceModelRepository: Repository<DeviceModel>,
    @InjectRepository(Palette)
    private readonly paletteRepository: Repository<Palette>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedFromSnapshot()
    void this.sync().catch(err => this.logger.warn(`Initial device model sync skipped: ${err.message}`))
    cron.schedule(DAILY_AT_4AM, () => {
      void this.sync().catch(err => this.logger.warn(`Scheduled device model sync failed: ${err.message}`))
    })
  }

  /**
   * Inserts snapshot rows that don't exist yet so a fresh or offline instance
   * has a complete reference table; rows already present (possibly newer, from
   * a live sync) are left untouched.
   */
  async seedFromSnapshot(): Promise<{ models: number, palettes: number }> {
    const existingPalettes = new Set((await this.paletteRepository.find({ select: { id: true } })).map(p => p.id))
    const missingPalettes = TRMNL_PALETTES_SNAPSHOT.filter(p => !existingPalettes.has(p.id)).map(toPaletteAttributes)
    if (missingPalettes.length > 0)
      await this.paletteRepository.insert(missingPalettes)

    const existingModels = new Set((await this.deviceModelRepository.find({ select: { name: true } })).map(m => m.name))
    const missingModels = TRMNL_MODELS_SNAPSHOT.filter(m => !existingModels.has(m.name)).map(toDeviceModelAttributes)
    if (missingModels.length > 0)
      await this.deviceModelRepository.insert(missingModels)

    if (missingModels.length > 0 || missingPalettes.length > 0)
      this.logger.log(`Seeded ${missingModels.length} device models and ${missingPalettes.length} palettes from snapshot`)
    return { models: missingModels.length, palettes: missingPalettes.length }
  }

  /**
   * Upserts the live TRMNL model and palette lists. Rows that disappeared
   * upstream are flagged deprecated but kept, so no device loses its model.
   */
  async sync(): Promise<DeviceModelSyncResult> {
    this.logger.log('Syncing device models from TRMNL')
    const [palettes, models] = await Promise.all([
      this.fetchList<TrmnlPalettePayload>('palettes'),
      this.fetchList<TrmnlModelPayload>('models'),
    ])
    const syncedAt = new Date()

    await this.paletteRepository.upsert(palettes.map(p => ({ ...toPaletteAttributes(p), deprecated: false, syncedAt })), ['id'])
    const deprecatedPalettes = await this.deprecateMissingPalettes(palettes.map(p => p.id))

    await this.deviceModelRepository.upsert(models.map(m => ({ ...toDeviceModelAttributes(m), deprecated: false, syncedAt })), ['name'])
    const deprecatedModels = await this.deprecateMissingModels(models.map(m => m.name))

    this.logger.log(`Synced ${models.length} device models and ${palettes.length} palettes (${deprecatedModels} models, ${deprecatedPalettes} palettes deprecated)`)
    return { models: models.length, palettes: palettes.length, deprecatedModels, deprecatedPalettes, syncedAt }
  }

  private async fetchList<T>(endpoint: string): Promise<T[]> {
    const res = await fetch(`${TRMNL_API_URL}/${endpoint}`)
    if (!res.ok)
      throw new Error(`TRMNL ${endpoint} request failed: ${res.status} ${res.statusText}`)
    const body = await res.json()
    if (!Array.isArray(body?.data))
      throw new Error(`TRMNL ${endpoint} response has no data array`)
    return body.data
  }

  private async deprecateMissingModels(presentNames: string[]): Promise<number> {
    const active = await this.deviceModelRepository.find({ select: { name: true }, where: { deprecated: false } })
    const missing = active.map(m => m.name).filter(name => !presentNames.includes(name))
    if (missing.length > 0)
      await this.deviceModelRepository.update({ name: In(missing) }, { deprecated: true })
    return missing.length
  }

  private async deprecateMissingPalettes(presentIds: string[]): Promise<number> {
    const active = await this.paletteRepository.find({ select: { id: true }, where: { deprecated: false } })
    const missing = active.map(p => p.id).filter(id => !presentIds.includes(id))
    if (missing.length > 0)
      await this.paletteRepository.update({ id: In(missing) }, { deprecated: true })
    return missing.length
  }
}
