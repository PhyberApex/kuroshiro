import type { DeviceModel } from './entities/device-model.entity.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TRMNL_PALETTES_SNAPSHOT } from './data/trmnl-snapshot.js'
import { Palette } from './entities/palette.entity.js'
import { paletteFitsModel } from './palette-compatibility.js'
import { toPaletteAttributes } from './trmnl-payloads.js'

function paletteRichness(palette: Palette): number {
  return palette.colors?.length ? 1000 + palette.colors.length : palette.grays
}

function pickRichest(palettes: Palette[]): Palette | null {
  return palettes.reduce<Palette | null>((richest, candidate) =>
    !richest || paletteRichness(candidate) > paletteRichness(richest) ? candidate : richest, null)
}

/** The Palette a Device on `model` is given when it has none: the richest of TRMNL's curated ones, never a custom one. */
export function defaultPaletteAmong(model: DeviceModel, palettes: Palette[]): Palette | null {
  return pickRichest(model.paletteIds.flatMap(id => palettes.filter(palette => palette.id === id)))
}

@Injectable()
export class PaletteSelectionService {
  constructor(
    @InjectRepository(Palette)
    private readonly paletteRepository: Repository<Palette>,
  ) {}

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
    return defaultPaletteAmong(model, await this.allowedPalettesFor(model))
  }

  async supportsPalette(model: DeviceModel, palette: Palette): Promise<boolean> {
    return paletteFitsModel(palette, model, await this.paletteRepository.find())
  }

  /** The Palette a render falls back to when the reference table has none: TRMNL's bundled snapshot, richest first. */
  fallbackPaletteFor(model: DeviceModel): Palette {
    const palettes = TRMNL_PALETTES_SNAPSHOT
      .filter(p => model.paletteIds.includes(p.id))
      .map(p => Object.assign(new Palette(), toPaletteAttributes(p), { deprecated: false, syncedAt: null }))
    const palette = pickRichest(palettes)
    if (!palette)
      throw new Error(`Bundled palette snapshot has no palette for device model ${model.name}`)
    return palette
  }
}
