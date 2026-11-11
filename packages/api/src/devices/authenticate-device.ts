import type { Logger } from '@nestjs/common'
import type { Repository } from 'typeorm'
import type { Device } from './devices.entity.js'
import type { DeviceCredentialsHeadersDto } from './dto/device-credentials-headers.dto.js'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { findDeviceByMac } from './find-device-by-mac.js'

/**
 * Compares in constant time, so how long a refusal takes says nothing about how
 * much of the key was right. `timingSafeEqual` needs equal lengths; a key of the
 * wrong length is refused before it, which gives away only the length.
 */
function apiKeysMatch(expected: string, given: string | undefined): boolean {
  if (given === undefined)
    return false
  const expectedBytes = Buffer.from(expected, 'utf8')
  const givenBytes = Buffer.from(given, 'utf8')
  return expectedBytes.length === givenBytes.length && timingSafeEqual(expectedBytes, givenBytes)
}

/**
 * Looks up a Device by the MAC in `credentials.id` (without letter case) and checks its API key —
 * the entry check of every Device-facing endpoint after `/api/setup`: the
 * polls (`/api/display`, `/api/current_screen`) and the Device Log ingest
 * (`/api/log`).
 */
export async function authenticateDevice(devices: Repository<Device>, credentials: DeviceCredentialsHeadersDto, logger: Logger): Promise<Device> {
  const device = await findDeviceByMac(devices, credentials.id)
  if (!device) {
    logger.warn(`Device not found: ${credentials.id}`)
    throw new NotFoundException('Device not found')
  }
  if (!apiKeysMatch(device.apikey, credentials['access-token'])) {
    logger.warn(`Invalid API key for device: ${credentials.id}`)
    throw new UnauthorizedException('Invalid API key')
  }
  return device
}
