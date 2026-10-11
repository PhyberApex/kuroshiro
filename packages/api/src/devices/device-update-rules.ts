import type { DeviceModelsService } from '../device-models/device-models.service.js'
import type { PaletteSelectionService } from '../device-models/palette-selection.service.js'
import type { FirmwareService } from '../firmware/firmware.service.js'
import type { Device } from './devices.entity.js'
import { BadRequestException, HttpStatus } from '@nestjs/common'
import { ApiException } from '../errors/api.exception.js'
import { isFirmwareCompatible } from '../firmware/firmware-compatibility.js'

/**
 * UpdateDeviceDto's own cross-field check only sees a single request's
 * payload, so a PATCH that clears just `sleepStartTime`/`sleepEndTime`
 * (with `sleepModeEnabled` already `true` from an earlier request) would
 * slip past it. Re-checking the merged entity here catches that case too.
 */
export function assertSleepWindowConfigured(device: Device): void {
  if (device.sleepModeEnabled && (device.sleepStartTime == null || device.sleepEndTime == null))
    throw new BadRequestException('sleepModeEnabled requires both sleepStartTime and sleepEndTime to be set')
}

export async function applyModelChange(device: Device, deviceModelName: string | undefined, deviceModels: DeviceModelsService): Promise<void> {
  if (deviceModelName === undefined || deviceModelName === device.deviceModel?.name)
    return
  const model = await deviceModels.findByName(deviceModelName)
  if (!model)
    throw new BadRequestException(`Unknown device model: ${deviceModelName}`)
  device.deviceModel = model
  device.palette = null
}

export async function applyPaletteChange(device: Device, paletteId: string | undefined, paletteSelection: PaletteSelectionService): Promise<void> {
  if (paletteId !== undefined) {
    if (!device.deviceModel)
      throw new BadRequestException('Cannot set a palette on a device with no assigned device model')
    const palette = await paletteSelection.findPalette(paletteId)
    if (!palette || !(await paletteSelection.supportsPalette(device.deviceModel, palette)))
      throw new BadRequestException(`Palette ${paletteId} is not supported by device model ${device.deviceModel.name}`)
    device.palette = palette
  }
  if (device.deviceModel && !device.palette)
    device.palette = await paletteSelection.defaultPaletteFor(device.deviceModel)
}

export async function applyFirmwareChanges(device: Device, targetFirmwareId: string | null | undefined, pushWasPending: boolean, firmwareService: FirmwareService): Promise<void> {
  if (targetFirmwareId === undefined)
    return
  if (targetFirmwareId === null) {
    if (pushWasPending)
      throw new ApiException(HttpStatus.CONFLICT, 'firmware-push-pending', 'The target Firmware cannot be cleared while a push is pending.', { id: device.id })
    device.targetFirmware = null
    return
  }
  const firmware = await firmwareService.findById(targetFirmwareId)
  if (!firmware)
    throw new BadRequestException(`Unknown firmware: ${targetFirmwareId}`)
  if (!isFirmwareCompatible(firmware, device.deviceModel?.name))
    throw new BadRequestException(`Firmware ${targetFirmwareId} is not compatible with device model ${device.deviceModel?.name ?? 'unknown'}`)
  device.targetFirmware = firmware
}

export function assertPushCanBeServed(device: Device, updateFirmware: boolean | undefined): void {
  if (updateFirmware !== true)
    return
  if (!device.targetFirmware)
    throw new ApiException(HttpStatus.CONFLICT, 'firmware-push-without-target', 'A Firmware push needs a target Firmware.', { id: device.id })
  if (device.mirrorEnabled)
    throw new ApiException(HttpStatus.CONFLICT, 'firmware-push-mirrored', 'A mirrored Device is not given Firmware.', { id: device.id })
}

/** A Device mirrors itself (proxy) when TRMNL knows it by its own MAC: TRMNL answers its polls, so nothing requested here reaches it. */
export function isProxiedDevice(device: Device): boolean {
  return !!device.mirrorEnabled && device.mirrorMac === device.mac
}

/**
 * "Also give {Device} a new API key" (ADR-0039): refused on a Proxied Device, whose own key is not what
 * authenticates its polls. Checked against the merged entity, not just this request's own fields — like
 * `assertSleepWindowConfigured`, so a PATCH that turns a Device Proxied while a rotation is already pending
 * from an earlier request is caught too.
 */
export function assertApikeyRotationAllowed(device: Device): void {
  if (device.resetDeviceNewApikey && isProxiedDevice(device))
    throw new ApiException(HttpStatus.CONFLICT, 'device-reset-apikey-proxied', 'A Proxied Device cannot be given a new API key.', { id: device.id })
}

export function renderTargetChanged(before: { model?: string, palette?: string }, device: Device): boolean {
  return before.model !== device.deviceModel?.name || before.palette !== device.palette?.id
}
