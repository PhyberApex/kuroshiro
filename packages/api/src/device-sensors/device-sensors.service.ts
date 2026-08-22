import type { Device } from '../devices/devices.entity'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DEVICE_SENSOR_KINDS, DeviceSensor, DeviceSensorKind } from './entities/device-sensor.entity'

interface ParsedSensorRecord {
  kind: DeviceSensorKind
  value: number
  unit: string
}

function isDeviceSensorKind(value: string): value is DeviceSensorKind {
  return (DEVICE_SENSOR_KINDS as readonly string[]).includes(value)
}

/**
 * Parses one `make=...;model=...;kind=...;value=...;unit=...;created_at=...`
 * record. `make`/`model`/`created_at` are read but discarded (ADR-0018). A
 * record missing `kind`/`value`/`unit`, with an unrecognised `kind`, or a
 * non-numeric `value` is dropped rather than raising, matching the wire
 * protocol's own reference parser behaviour.
 */
function parseSensorRecord(record: string): ParsedSensorRecord | null {
  const fields = new Map<string, string>()
  for (const field of record.split(';')) {
    const separatorIndex = field.indexOf('=')
    if (separatorIndex === -1)
      continue
    fields.set(field.slice(0, separatorIndex).trim(), field.slice(separatorIndex + 1).trim())
  }

  const kind = fields.get('kind')
  const unit = fields.get('unit')
  const value = Number.parseFloat(fields.get('value') ?? '')

  if (!kind || !unit || !isDeviceSensorKind(kind) || Number.isNaN(value))
    return null

  return { kind, value, unit }
}

/**
 * A kind repeated within one header collapses to its last occurrence, so the
 * upsert step below never has two records racing to write the same
 * `(device, kind)` row.
 */
function parseSensorsHeader(rawHeaderValue?: string | null): ParsedSensorRecord[] {
  if (!rawHeaderValue)
    return []
  const byKind = new Map<DeviceSensorKind, ParsedSensorRecord>()
  for (const record of rawHeaderValue.split(',')) {
    const parsed = parseSensorRecord(record)
    if (parsed)
      byKind.set(parsed.kind, parsed)
  }
  return [...byKind.values()]
}

@Injectable()
export class DeviceSensorsService {
  private readonly logger = new Logger(DeviceSensorsService.name)

  constructor(
    @InjectRepository(DeviceSensor)
    private readonly sensorRepository: Repository<DeviceSensor>,
  ) {}

  findForDevice(deviceId: string): Promise<DeviceSensor[]> {
    return this.sensorRepository.find({ where: { device: { id: deviceId } } })
  }

  /**
   * Treats the poll's header as the complete, authoritative snapshot of what
   * the Device currently has attached (ADR-0018): every existing row for a
   * kind missing from this poll is deleted, and every kind present is
   * upserted with its latest value/unit.
   */
  async syncFromHeader(device: Device, rawHeaderValue?: string | null): Promise<void> {
    const records = parseSensorsHeader(rawHeaderValue)
    const presentKinds = new Set(records.map(record => record.kind))

    const existing = await this.sensorRepository.find({ where: { device: { id: device.id } } })

    const toDelete = existing.filter(row => !presentKinds.has(row.kind))
    if (toDelete.length > 0) {
      this.logger.debug(`Clearing sensor kinds no longer reported for device ${device.id}: ${toDelete.map(row => row.kind).join(', ')}`)
      await this.sensorRepository.remove(toDelete)
    }

    await Promise.all(records.map((record) => {
      const existingRow = existing.find(row => row.kind === record.kind)
      if (existingRow) {
        existingRow.value = record.value
        existingRow.unit = record.unit
        return this.sensorRepository.save(existingRow)
      }
      return this.sensorRepository.save(this.sensorRepository.create({ device, kind: record.kind, value: record.value, unit: record.unit }))
    }))
  }
}
