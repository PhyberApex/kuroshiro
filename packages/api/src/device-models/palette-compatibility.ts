import type { DeviceModel } from './entities/device-model.entity.js'
import type { Palette } from './entities/palette.entity.js'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES } from './entities/palette.entity.js'

/**
 * The colour families a custom palette may target on this model: whichever
 * of the 5 custom-eligible colour families are already represented among
 * its curated official palettes. Deliberately ignores `DeviceModel.colors`/
 * `bitDepth` — those reflect native grayscale depth only, not colour-family
 * support.
 */
function compatibleFamilies(model: DeviceModel, palettes: Palette[]): Set<string> {
  return new Set(
    palettes
      .filter(p => model.paletteIds.includes(p.id) && p.kind === 'official' && (CUSTOM_PALETTE_FRAMEWORK_CLASSES as readonly string[]).includes(p.frameworkClass))
      .map(p => p.frameworkClass),
  )
}

/**
 * Official palettes are limited to the model's curated `paletteIds`; custom
 * palettes have no per-model list, so they fit when their colour family is
 * already represented on the model.
 */
export function paletteFitsModel(palette: Palette, model: DeviceModel, palettes: Palette[]): boolean {
  if (palette.kind === 'official')
    return model.paletteIds.includes(palette.id)
  return compatibleFamilies(model, palettes).has(palette.frameworkClass)
}

/** The curated ids in their curated order, then every custom palette that fits. */
export function compatiblePaletteIds(model: DeviceModel, palettes: Palette[]): string[] {
  const families = compatibleFamilies(model, palettes)
  const customIds = palettes.filter(p => p.kind === 'custom' && families.has(p.frameworkClass)).map(p => p.id)
  return [...model.paletteIds, ...customIds]
}
