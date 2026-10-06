import type { DevicePreviewSignal, PaletteRead, TemplateSize } from 'kuroshiro-shared'
import type { PreviewTarget } from './previewTarget'
import { clockTime } from '@/patterns/time'

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

/** A target as its words need it: the Device by its name only. */
export type WordedTarget = Pick<PreviewTarget, 'model' | 'palette'> & { device: { name: string } | null }

export const editorName = (pluginName: string, size: TemplateSize) => `Template of ${pluginName}, ${SIZE_NAMES[size]}`

export const removedSentence = (size: TemplateSize) => `Removed when you save. A ${SIZE_NAMES[size].toLowerCase()} slot then shows the full template.`

/** "TRMNL OG (2-bit) · 800 × 480 · 4 Grays (2-bit)", or the size alone under the selects that already name the rest. */
export function targetFacts({ device, model, palette }: WordedTarget) {
  const size = `${model.width} × ${model.height}`
  return device ? `${model.label} · ${size} · ${palette.name}` : size
}

function shadesOf({ colors, grays }: PaletteRead) {
  if (colors?.length)
    return `${colors.length} colours`
  return grays === 2 ? 'black and white' : `${grays} grays`
}

/** What the plate is not: the image dithered to the Palette, which only the Device shows. */
export function honestLine({ device, palette }: WordedTarget, size: TemplateSize) {
  const slot = size === 'full' ? '' : `, in ${SLOT_IS[size]}; the other slots are left empty here`
  return `Your browser draws this. ${device?.name ?? 'The Device'} shows it in ${shadesOf(palette)}${slot}.`
}

const deviceOrThe = (device: { name: string } | null) => device?.name ?? 'the Device'

/** The honest line's button: "See it as {Device} shows it" (ADR-0040). */
export const devicePreviewButton = (device: { name: string } | null) => `See it as ${deviceOrThe(device)} shows it`

/** While the device preview is being drawn. */
/** Takes the Device's name alone: the plate only ever has that, whether it holds a full Device (Edit HTML) or just a choice of name (the Template editor). */
export const devicePreviewDrawingLine = (name: string | null) => `Drawing it as ${name ?? 'the Device'} shows it`

/** Once it is drawn: "As {Device} shows it, in {4 grays}, drawn at {hh:mm}." */
export function devicePreviewDrawnLine({ device, palette }: WordedTarget, drawnAt: Date) {
  return `As ${deviceOrThe(device)} shows it, in ${shadesOf(palette)}, drawn at ${clockTime(drawnAt)}.`
}

/** A Render Signal the content raised while the device preview was drawn; nothing for `none`. */
export function devicePreviewSignalLine(signal: DevicePreviewSignal): string | null {
  if (signal === 'skip')
    return 'This content asks to be skipped.'
  if (signal === 'hold')
    return 'This content asks to keep its previous image.'
  return null
}

export const DEVICE_PREVIEW_BUSY_LINE = 'Another preview is being drawn. Try again in a moment.'

/** A failure other than the busy refusal: "Could not draw it as {Device} shows it." */
export const devicePreviewFailedLine = (device: { name: string } | null) => `Could not draw it as ${deviceOrThe(device)} shows it.`
