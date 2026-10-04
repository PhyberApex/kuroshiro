import type { DeviceModelRead, DeviceModelSyncResult, PaletteRead } from 'kuroshiro-shared'
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

const deviceModels = (count: number) => count === 1 ? '1 Device Model' : `${count} Device Models`

export function othersTitle({ inUse, others }: DeviceModelsByUse) {
  if (inUse.length === 0)
    return `All ${deviceModels(others.length)}`
  return others.length === 1 ? 'The other Device Model' : `The other ${deviceModels(others.length)}`
}

/** The Device Models whose label holds what was typed. */
export function labelled(models: DeviceModelRead[], query: string) {
  const sought = query.trim().toLowerCase()
  return models.filter(model => model.label.toLowerCase().includes(sought))
}

export function noneCalled(query: string) {
  return `No Device Model is called “${query.trim()}”.`
}

export function panelSize({ width, height }: Pick<DeviceModelRead, 'width' | 'height'>) {
  return `${width} × ${height}`
}

/** The names of the Palettes a Device on `model` can be set to, in the Device Model's order. */
export function paletteNames({ paletteIds }: Pick<DeviceModelRead, 'paletteIds'>, palettes: PaletteRead[]) {
  return paletteIds.flatMap(id => palettes.filter(palette => palette.id === id)).map(palette => palette.name).join(', ')
}

/** What a sync came to: what TRMNL lists now, and how many of the Device Models as they stand after it TRMNL has dropped. */
export function syncOutcome({ models, palettes }: DeviceModelSyncResult, modelsAfterwards: DeviceModelRead[]) {
  const synced = `Synced: ${deviceModels(models)} and ${palettes === 1 ? '1 Palette' : `${palettes} Palettes`}.`
  const dropped = modelsAfterwards.filter(model => model.deprecated).length
  if (dropped === 0)
    return synced
  return `${synced} ${deviceModels(dropped)} ${dropped === 1 ? 'is no longer listed by TRMNL and stays' : 'are no longer listed by TRMNL and stay'} usable.`
}

/** Under a sync that failed: when the lists on the page were last synced from TRMNL. */
export function seenFrom(models: DeviceModelRead[], now: Date) {
  const lastSynced = models.flatMap(model => model.syncedAt ? [new Date(model.syncedAt)] : []).sort((one, other) => other.getTime() - one.getTime())[0]
  if (!lastSynced)
    return 'What you see is the list Kuroshiro was shipped with.'
  return `What you see is from ${relativeTime(lastSynced, now) ?? exactTime(lastSynced)}.`
}
