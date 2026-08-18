import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TRMNL_MODELS_SNAPSHOT, TRMNL_PALETTES_SNAPSHOT } from './data/trmnl-snapshot'
import { DeviceModel } from './entities/device-model.entity'
import { Palette } from './entities/palette.entity'
import { FALLBACK_MODEL_NAME, FIRMWARE_MODEL_NAMES } from './firmware-model-names'
import { toDeviceModelAttributes, toPaletteAttributes, TrmnlModelPayload } from './trmnl-payloads'

export interface DeviceReport {
  reportedModel?: string | null
  width?: number | null
  height?: number | null
}

export interface DeviceRenderTarget {
  model: DeviceModel
  palette: Palette
}

interface DeviceLike extends DeviceReport {
  deviceModel?: DeviceModel | null
  palette?: Palette | null
}

function paletteRichness(palette: Palette): number {
  return palette.colors?.length ? 1000 + palette.colors.length : palette.grays
}

function pickRichest(palettes: Palette[]): Palette | null {
  return palettes.reduce<Palette | null>((richest, candidate) =>
    !richest || paletteRichness(candidate) > paletteRichness(richest) ? candidate : richest, null)
}

function snapshotFallbackModel(): TrmnlModelPayload {
  const model = TRMNL_MODELS_SNAPSHOT.find(m => m.name === FALLBACK_MODEL_NAME)
  if (!model)
    throw new Error(`Bundled device model snapshot is missing ${FALLBACK_MODEL_NAME}`)
  return model
}

@Injectable()
export class DeviceModelsService {
  private readonly logger = new Logger(DeviceModelsService.name)

  constructor(
    @InjectRepository(DeviceModel)
    private readonly deviceModelRepository: Repository<DeviceModel>,
    @InjectRepository(Palette)
    private readonly paletteRepository: Repository<Palette>,
  ) {}

  findAll(): Promise<DeviceModel[]> {
    return this.deviceModelRepository.find({ order: { kind: 'ASC', label: 'ASC' } })
  }

  findByName(name: string): Promise<DeviceModel | null> {
    return this.deviceModelRepository.findOneBy({ name })
  }

  findAllPalettes(): Promise<Palette[]> {
    return this.paletteRepository.find({ order: { grays: 'ASC' } })
  }

  findPalette(id: string): Promise<Palette | null> {
    return this.paletteRepository.findOneBy({ id })
  }

  async allowedPalettesFor(model: DeviceModel): Promise<Palette[]> {
    if (model.paletteIds.length === 0)
      return []
    const palettes = await this.paletteRepository.find()
    return model.paletteIds
      .map(id => palettes.find(p => p.id === id))
      .filter((p): p is Palette => !!p)
  }

  async defaultPaletteFor(model: DeviceModel): Promise<Palette | null> {
    return pickRichest(await this.allowedPalettesFor(model))
  }

  /**
   * Resolves what a device reports about itself to a Device Model:
   * the firmware board name (renamed to its upstream counterpart, or used as-is
   * when it already is an upstream name), then a match on the reported panel
   * dimensions preferring TRMNL's own hardware, then the OG fallback.
   * Without dimensions an unknown name resolves to nothing so a later report
   * that includes them can still pick a better match.
   */
  async resolve(report: DeviceReport): Promise<DeviceModel | null> {
    const byName = await this.resolveByName(report.reportedModel)
    if (byName)
      return byName
    if (!report.width || !report.height)
      return null
    const byDimensions = await this.resolveByDimensions(report.width, report.height)
    if (byDimensions)
      return byDimensions
    this.logger.warn(`No device model matches "${report.reportedModel}" at ${report.width}x${report.height}, falling back to ${FALLBACK_MODEL_NAME}`)
    return this.findByName(FALLBACK_MODEL_NAME)
  }

  /**
   * Resolves the device's report and assigns the result together with the
   * model's default palette. Returns the assigned model, or null when the
   * report could not be resolved and the device was left untouched.
   */
  async assignResolvedModel(device: DeviceLike): Promise<DeviceModel | null> {
    const model = await this.resolve(device)
    if (!model)
      return null
    device.deviceModel = model
    device.palette = await this.defaultPaletteFor(model)
    this.logger.log(`Resolved "${device.reportedModel}" at ${device.width}x${device.height} to device model ${model.name} (palette ${device.palette?.id})`)
    return model
  }

  /**
   * The model and palette images are generated with. Devices without an
   * assignment (created before models existed, or whose report could not be
   * resolved yet) render as an OG with its richest palette.
   */
  async renderTargetFor(device: DeviceLike): Promise<DeviceRenderTarget> {
    const model = device.deviceModel ?? await this.findByName(FALLBACK_MODEL_NAME) ?? this.fallbackModelFromSnapshot()
    const palette = device.palette ?? await this.defaultPaletteFor(model) ?? this.fallbackPaletteFromSnapshot(model)
    return { model, palette }
  }

  async outputSizeFor(device: DeviceLike): Promise<{ width: number, height: number }> {
    const { model } = await this.renderTargetFor(device)
    return { width: model.width, height: model.height }
  }

  private async resolveByName(reportedModel?: string | null): Promise<DeviceModel | null> {
    if (!reportedModel)
      return null
    const upstreamName = FIRMWARE_MODEL_NAMES[reportedModel] ?? reportedModel
    return this.findByName(upstreamName)
  }

  private async resolveByDimensions(width: number, height: number): Promise<DeviceModel | null> {
    const candidates = await this.deviceModelRepository.find({ where: { width, height, deprecated: false } })
    return candidates.find(c => c.kind === 'trmnl') ?? candidates[0] ?? null
  }

  private fallbackModelFromSnapshot(): DeviceModel {
    return Object.assign(new DeviceModel(), toDeviceModelAttributes(snapshotFallbackModel()), { deprecated: false, syncedAt: null })
  }

  private fallbackPaletteFromSnapshot(model: DeviceModel): Palette {
    const palettes = TRMNL_PALETTES_SNAPSHOT
      .filter(p => model.paletteIds.includes(p.id))
      .map(p => Object.assign(new Palette(), toPaletteAttributes(p), { deprecated: false, syncedAt: null }))
    const palette = pickRichest(palettes)
    if (!palette)
      throw new Error(`Bundled palette snapshot has no palette for device model ${model.name}`)
    return palette
  }
}
