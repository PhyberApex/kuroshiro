import type { DeviceDetail, DeviceModelRead, FirmwareRead, PaletteRead } from 'kuroshiro-shared'
import type { SelectOption } from '@/components/selectOption'

/** The Device Models a Device can be set to: a deprecated one only while it is the assigned one. */
export function deviceModelOptions(models: DeviceModelRead[], assigned: string | null): SelectOption[] {
  return models
    .filter(model => !model.deprecated || model.name === assigned)
    .map(model => ({ value: model.name, label: `${model.label} · ${model.width} × ${model.height}` }))
}

/** A Palette's label: its name, marked "· custom" where it is one so a free-text name is never mistaken for an official one. */
export const paletteLabel = ({ name, kind }: Pick<PaletteRead, 'name' | 'kind'>) => kind === 'custom' ? `${name} · custom` : name

/** The Palettes a Device on `model` can be set to, in the Device Model's order, and the assigned one whatever the Device Model lists. */
export function paletteOptions(model: DeviceModelRead | undefined, palettes: PaletteRead[], assigned: DeviceDetail['palette']): SelectOption[] {
  const offered = (model?.paletteIds ?? []).flatMap(id => palettes.filter(palette => palette.id === id))
  const kept = assigned && !offered.some(palette => palette.id === assigned.id) ? [assigned] : []
  return [...offered, ...kept].map(palette => ({ value: palette.id, label: paletteLabel(palette) }))
}

/** A select option cannot be the empty string, so "None" has a value of its own. */
export const NO_TARGET = 'none'

type FirmwareNamed = Pick<FirmwareRead, 'version' | 'kind' | 'label'>

function firmwareLabel({ version, kind, label }: FirmwareNamed) {
  return [version, kind === 'custom' ? 'custom' : 'official', kind === 'custom' ? label : null].filter(Boolean).join(' · ')
}

/** As the server decides it: a Firmware that names no Device Model fits every one. */
function fits({ compatibleModels }: FirmwareRead, deviceModel: string | null) {
  return compatibleModels.length === 0 || compatibleModels.includes(deviceModel ?? '')
}

interface FirmwareOffered {
  deviceModel: string | null
  target: DeviceDetail['targetFirmware']
  pushPending: boolean
}

/** "None", then the Firmware that fits the Device Model and is not deprecated, and the assigned one whatever it is. */
export function firmwareOptions(firmware: FirmwareRead[], { deviceModel, target, pushPending }: FirmwareOffered): SelectOption[] {
  const offered: (FirmwareNamed & { id: string })[] = firmware.filter(candidate => !candidate.deprecated && fits(candidate, deviceModel))
  const kept = target && !offered.some(candidate => candidate.id === target.id) ? [target] : []
  return [
    { value: NO_TARGET, label: 'None', disabled: pushPending, reason: pushPending ? 'A push is pending' : undefined },
    ...[...offered, ...kept].map(candidate => ({ value: candidate.id, label: firmwareLabel(candidate) })),
  ]
}
