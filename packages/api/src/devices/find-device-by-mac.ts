import type { Repository } from 'typeorm'
import type { Device } from './devices.entity.js'
import { Raw } from 'typeorm'

/** The form a MAC is stored in from now on: trimmed and upper-cased, as `POST /api/devices` stores it. */
export function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase()
}

/**
 * Finds the Device a Device-facing request names by its MAC, without letter case:
 * a hand-registered Device is stored upper-cased, while a Device that registered
 * itself through `/api/setup` earlier kept the case it sent. An exact match wins,
 * so a Device that already has a case-only duplicate keeps the one it has been using.
 */
export async function findDeviceByMac(devices: Repository<Device>, mac: string): Promise<Device | null> {
  return await devices.findOneBy({ mac })
    ?? devices.findOneBy({ mac: Raw(column => `UPPER(${column}) = :mac`, { mac: normalizeMac(mac) }) })
}
