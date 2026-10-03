import type { DeviceReference, FirmwareList, FirmwareRead, SyncRun } from 'kuroshiro-shared'
import type { Device } from '../devices/devices.entity.js'
import type { Firmware } from './entities/firmware.entity.js'
import { toIsoStringOrNull } from '../utils/readModel.js'

export interface FirmwareFacts {
  filePresent: boolean
  /** The Devices with this Firmware as their target. */
  targetedBy: Pick<Device, 'id' | 'name' | 'updateFirmware'>[]
  /** The Devices reporting this Firmware's version. */
  runningOn: Pick<Device, 'id' | 'name'>[]
}

function toDeviceReference({ id, name }: Pick<Device, 'id' | 'name'>): DeviceReference {
  return { id, name }
}

export function toFirmwareRead(firmware: Firmware, facts: FirmwareFacts): FirmwareRead {
  return {
    id: firmware.id,
    version: firmware.version,
    kind: firmware.kind,
    label: firmware.label ?? null,
    compatibleModels: firmware.compatibleModels,
    deprecated: firmware.deprecated,
    syncedAt: toIsoStringOrNull(firmware.syncedAt),
    uploadedAt: toIsoStringOrNull(firmware.uploadedAt),
    filePresent: facts.filePresent,
    targetOf: facts.targetedBy.map(device => ({ ...toDeviceReference(device), pushPending: device.updateFirmware })),
    runningOn: facts.runningOn.map(toDeviceReference),
  }
}

export function toFirmwareList(lastSync: SyncRun | null, firmware: FirmwareRead[]): FirmwareList {
  return { lastSync, firmware }
}
