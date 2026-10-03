import type { DeviceModelList, DeviceModelRead, PaletteRead } from 'kuroshiro-shared'
import type { Device } from '../devices/devices.entity.js'
import type { SyncRun } from '../sync-runs/entities/sync-run.entity.js'
import type { DeviceModel } from './entities/device-model.entity.js'
import type { Palette } from './entities/palette.entity.js'
import { toDeviceReference } from '../firmware/firmware.mapper.js'
import { toSyncRun } from '../sync-runs/sync-run.mapper.js'
import { toIsoStringOrNull } from '../utils/readModel.js'

type DeviceName = Pick<Device, 'id' | 'name'>

export interface DeviceModelFacts {
  /** Every Palette that fits the Device Model, curated ones first, then the custom ones. */
  paletteIds: string[]
  usedBy: DeviceName[]
}

function byDeviceName(a: DeviceName, b: DeviceName): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

function toDeviceReferences(devices: DeviceName[]) {
  return [...devices].sort(byDeviceName).map(toDeviceReference)
}

export function toDeviceModelRead(model: DeviceModel, facts: DeviceModelFacts): DeviceModelRead {
  return {
    name: model.name,
    label: model.label,
    description: model.description ?? null,
    width: model.width,
    height: model.height,
    colors: model.colors,
    bitDepth: model.bitDepth,
    scaleFactor: model.scaleFactor,
    rotation: model.rotation,
    offsetX: model.offsetX,
    offsetY: model.offsetY,
    mimeType: model.mimeType,
    kind: model.kind,
    paletteIds: facts.paletteIds,
    cssClasses: model.cssClasses,
    cssVariables: model.cssVariables,
    imageSizeLimit: model.imageSizeLimit ?? null,
    deprecated: model.deprecated,
    syncedAt: toIsoStringOrNull(model.syncedAt),
    usedBy: toDeviceReferences(facts.usedBy),
  }
}

export function toPaletteRead(palette: Palette, usedBy: DeviceName[]): PaletteRead {
  return {
    id: palette.id,
    name: palette.name,
    kind: palette.kind,
    grays: palette.grays,
    colors: palette.colors ?? null,
    frameworkClass: palette.frameworkClass,
    grayscaleBitDepth: palette.grayscaleBitDepth ?? null,
    deprecated: palette.deprecated,
    syncedAt: toIsoStringOrNull(palette.syncedAt),
    usedBy: toDeviceReferences(usedBy),
  }
}

export function toDeviceModelList(lastSync: SyncRun | null, models: DeviceModelRead[]): DeviceModelList {
  return { lastSync: lastSync ? toSyncRun(lastSync) : null, models }
}
