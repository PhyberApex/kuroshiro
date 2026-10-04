import type { PaletteRead, TemplateSize } from 'kuroshiro-shared'
import type { PreviewTarget } from './previewTarget'

export const SIZE_NAMES: Record<TemplateSize, string> = {
  full: 'Full',
  half_horizontal: 'Half horizontal',
  half_vertical: 'Half vertical',
  quadrant: 'Quadrant',
}

type SlotSize = Exclude<TemplateSize, 'full'>

/** Where a slot size stands in a Mashup, as the menu of missing sizes says it. */
export const SLOT_PLACES: Record<SlotSize, string> = {
  half_horizontal: 'top or bottom',
  half_vertical: 'left or right',
  quadrant: 'a quarter',
}

const SLOT_IS: Record<SlotSize, string> = {
  half_horizontal: 'the top or bottom half of a Mashup',
  half_vertical: 'the left or right half of a Mashup',
  quadrant: 'a quarter of a Mashup',
}

/** What the chosen Template is, after its name and a colon. */
export const SIZE_IS: Record<TemplateSize, string> = {
  full: 'the Screen on its own, and any Mashup slot that has no template of its own size.',
  half_horizontal: `${SLOT_IS.half_horizontal}.`,
  half_vertical: `${SLOT_IS.half_vertical}.`,
  quadrant: `${SLOT_IS.quadrant}.`,
}

export const editorName = (pluginName: string, size: TemplateSize) => `Template of ${pluginName}, ${SIZE_NAMES[size]}`

export const removedSentence = (size: TemplateSize) => `Removed when you save. A ${SIZE_NAMES[size].toLowerCase()} slot then shows the full template.`

/** "TRMNL OG (2-bit) · 800 × 480 · 4 Grays (2-bit)", or the size alone under the selects that already name the rest. */
export function targetFacts({ device, model, palette }: PreviewTarget) {
  const size = `${model.width} × ${model.height}`
  return device ? `${model.label} · ${size} · ${palette.name}` : size
}

function shadesOf({ colors, grays }: PaletteRead) {
  if (colors?.length)
    return `${colors.length} colours`
  return grays === 2 ? 'black and white' : `${grays} grays`
}

/** What the plate is not: the image dithered to the Palette, which only the Device shows. */
export function honestLine({ device, palette }: PreviewTarget, size: TemplateSize) {
  const slot = size === 'full' ? '' : `, in ${SLOT_IS[size]}; the other slots are left empty here`
  return `Your browser draws this. ${device?.name ?? 'The Device'} shows it in ${shadesOf(palette)}${slot}.`
}
