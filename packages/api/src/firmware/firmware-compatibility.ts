import type { Firmware } from './entities/firmware.entity.js'

/**
 * Shared by a manual admin assignment (`DevicesService`) and the Firmware Auto-Update
 * policy (`FirmwareAutoUpdateService`, ADR-0029) so the two can never disagree on
 * eligibility. An empty `compatibleModels` means universally compatible; official-synced
 * rows are never empty (ADR-0015), so this only matters for admin-uploaded custom Firmware.
 */
export function isFirmwareCompatible(firmware: Pick<Firmware, 'compatibleModels'>, deviceModelName?: string | null): boolean {
  return firmware.compatibleModels.length === 0 || firmware.compatibleModels.includes(deviceModelName ?? '')
}
