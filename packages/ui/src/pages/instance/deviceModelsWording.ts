import type { DeviceModelRead, DeviceModelSyncResult, PaletteRead } from 'kuroshiro-shared'
import { paletteLabel } from '@/pages/devices/deviceSettings'
import { exactTime, relativeTime } from '@/patterns/time'

const MOST_GREYS_SHOWN = 8

function greys(count: number) {
  const steps = Math.min(count, MOST_GREYS_SHOWN)
  return Array.from({ length: steps }, (_, step) => {
    const level = Math.round(step / Math.max(steps - 1, 1) * 255).toString(16).padStart(2, '0')
    return `#${level}${level}${level}`
  })
}

/** What a Palette's swatches show: its colours, or its greys from black to white, eight at most. */
export function swatchColours({ colors, grays }: Pick<PaletteRead, 'colors' | 'grays'>) {
  return colors ?? greys(grays)
}

export function customPalettesByName(palettes: PaletteRead[]) {
  return palettes
    .filter(palette => palette.kind === 'custom')
    .sort((one, other) => one.name.localeCompare(other.name, undefined, { sensitivity: 'base' }))
}

export interface DeviceModelsByUse {
  inUse: DeviceModelRead[]
  others: DeviceModelRead[]
}

export function inUseAndOthers(models: DeviceModelRead[]): DeviceModelsByUse {
  return {
    inUse: models.filter(model => model.usedBy.length > 0),
    others: models.filter(model => model.usedBy.length === 0),
  }
}

const counted = (count: number, one: string) => count === 1 ? `1 ${one}` : `${count} ${one}s`
const deviceModels = (count: number) => counted(count, 'Device Model')

export function othersTitle({ inUse, others }: DeviceModelsByUse) {
  if (inUse.length === 0)
    return `All ${deviceModels(others.length)}`
  return others.length === 1 ? 'The other Device Model' : `The other ${deviceModels(others.length)}`
}

/** The Device Models whose label holds what was typed. */
export function modelsMatching(models: DeviceModelRead[], query: string) {
  const sought = query.trim().toLowerCase()
  return models.filter(model => model.label.toLowerCase().includes(sought))
}

export function noneCalled(query: string) {
  return `No Device Model is called “${query.trim()}”.`
}

export function imageSize({ width, height }: Pick<DeviceModelRead, 'width' | 'height'>) {
  return `${width} × ${height}`
}

/** The Palettes a Device on `model` can be set to, labelled "· custom" for a custom one, in the Device Model's order. */
export function paletteLabels({ paletteIds }: Pick<DeviceModelRead, 'paletteIds'>, palettes: PaletteRead[]) {
  return paletteIds.flatMap(id => palettes.filter(palette => palette.id === id)).map(palette => ({ id: palette.id, label: paletteLabel(palette) }))
}

/** What a sync came to: what TRMNL lists now, and how many of the Device Models as they stand after it TRMNL has dropped. */
export function syncOutcome({ models, palettes }: DeviceModelSyncResult, modelsAfterwards: DeviceModelRead[]) {
  const synced = `Synced: ${deviceModels(models)} and ${counted(palettes, 'Palette')}.`
  const dropped = modelsAfterwards.filter(model => model.deprecated).length
  if (dropped === 0)
    return synced
  return `${synced} ${deviceModels(dropped)} ${dropped === 1 ? 'is no longer listed by TRMNL and stays' : 'are no longer listed by TRMNL and stay'} usable.`
}

/** When the lists on the page were last synced from TRMNL. */
function seenFrom(models: DeviceModelRead[], now: Date) {
  const lastSynced = models.flatMap(model => model.syncedAt ? [new Date(model.syncedAt)] : []).sort((one, other) => other.getTime() - one.getTime())[0]
  if (!lastSynced)
    return 'What you see is the list Kuroshiro was shipped with.'
  return `What you see is from ${relativeTime(lastSynced, now) ?? exactTime(lastSynced)}.`
}

/** What the notice of a sync that failed says after its title: why, and how old the lists it left on the page are. */
export function whyNotSynced(reason: string | undefined, models: DeviceModelRead[], now: Date) {
  const why = reason?.trim().replace(/[^.!?]$/, '$&.')
  return [why, seenFrom(models, now)].filter(Boolean).join(' ')
}
