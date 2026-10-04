import type { DeviceModelRead, DeviceSummary, PaletteRead, PluginAssignmentRead } from 'kuroshiro-shared'

/** What the admin chose the preview for, for this visit: a Device, or with no Device a Device Model and one of its Palettes. */
export interface PreviewChoice {
  deviceId: string | null
  /** Read only without a Device. `null` is the usual Device Model. */
  modelName: string | null
  /** `null`, or a Palette the Device Model does not have, is the Device Model's richest. */
  paletteId: string | null
}

export interface PreviewLibrary {
  devices: DeviceSummary[]
  models: DeviceModelRead[]
  palettes: PaletteRead[]
}

/** What the preview is sized and classed for. */
export interface PreviewTarget {
  device: DeviceSummary | null
  model: DeviceModelRead
  palette: PaletteRead
}

/** TRMNL OG, which the server also falls back to for a Device it cannot tell the Device Model of. */
const USUAL_MODEL = 'og_plus'

/** The first Device the Plugin is assigned to, else the first Device, else none. */
export function startingChoice(assignments: PluginAssignmentRead[], devices: DeviceSummary[]): PreviewChoice {
  const assigned = assignments.map(assignment => devices.find(device => device.id === assignment.deviceId)).find(Boolean)
  return { deviceId: (assigned ?? devices[0])?.id ?? null, modelName: null, paletteId: null }
}

export function palettesOf(model: DeviceModelRead, palettes: PaletteRead[]) {
  return model.paletteIds.flatMap(id => palettes.filter(palette => palette.id === id))
}

/** As the server ranks them when it gives a Device its Palette: any colour Palette over a grayscale one, then by how many. */
const richness = (palette: PaletteRead) => palette.colors?.length ? 1000 + palette.colors.length : palette.grays

function richest(palettes: PaletteRead[]) {
  return palettes.reduce<PaletteRead | undefined>((best, palette) => !best || richness(palette) > richness(best) ? palette : best, undefined)
}

const modelNamed = (name: string | null | undefined, models: DeviceModelRead[]) => models.find(model => model.name === name)

/** The target of a choice, or nothing while this Instance holds no Device Model with a Palette to draw it for. */
export function targetOf(choice: PreviewChoice, { devices, models, palettes }: PreviewLibrary): PreviewTarget | undefined {
  const device = devices.find(known => known.id === choice.deviceId) ?? null
  const model = modelNamed(device ? device.deviceModel?.name : choice.modelName, models) ?? modelNamed(USUAL_MODEL, models) ?? models[0]
  if (!model)
    return undefined
  const offered = palettesOf(model, palettes)
  const chosen = device
    ? palettes.find(palette => palette.usedBy.some(user => user.id === device.id))
    : offered.find(palette => palette.id === choice.paletteId)
  const palette = chosen ?? richest(offered)
  return palette && { device, model, palette }
}
