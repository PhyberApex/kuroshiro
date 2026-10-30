import type { Repository } from 'typeorm'
import type { Device } from './devices.entity.js'
import { Raw } from 'typeorm'

/** The form a Device's MAC is stored in, whether registered by hand or through `/api/setup`: trimmed and upper-cased. */
export function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase()
}

/**
 * Finds a Device by its MAC without letter case: a Device that registered itself
 * through `/api/setup` before MACs were stored upper-cased kept the case it sent.
 * An exact match wins, so a Device that already has a case-only duplicate keeps
 * the one it has been using; only a MAC stored in neither form costs a scan.
 */
export async function findDeviceByMac(devices: Repository<Device>, mac: string): Promise<Device | null> {
  const normalized = normalizeMac(mac)
  return await devices.findOneBy({ mac })
    ?? await devices.findOneBy({ mac: normalized })
    ?? devices.findOneBy({ mac: Raw(column => `UPPER(${column}) = :normalized`, { normalized }) })
}
