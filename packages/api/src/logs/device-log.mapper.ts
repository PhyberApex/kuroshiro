import type { DeviceLogEntry } from 'kuroshiro-shared'
import type { LogEntry } from './logs.entity.js'
import { toIsoString } from '../utils/readModel.js'
import { parseStoredLogEntry } from './parse-log-entry.js'

/** The level and the message are the columns stored at ingest; the rest is read from the firmware's JSON. */
export function toDeviceLogEntry(entry: LogEntry): DeviceLogEntry {
  const { source, status, firmwareVersion, extras } = parseStoredLogEntry(entry.entry)
  return {
    id: entry.id,
    at: toIsoString(entry.date),
    level: entry.level,
    message: entry.message,
    source,
    status,
    firmwareVersion,
    extras,
  }
}
