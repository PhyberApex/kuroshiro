import type { DeviceLogEntry, LogLevel } from 'kuroshiro-shared'
import { isPlainObject } from '../utils/json.js'

/** What the firmware's JSON says, in the words of the read model. */
export type ParsedLogEntry = Pick<DeviceLogEntry, 'level' | 'message' | 'source' | 'status' | 'firmwareVersion' | 'extras'>

type FirmwareFields = Record<string, unknown>

const FIRMWARE_LEVELS: Record<string, LogLevel> = {
  fatal: 'error',
  error: 'error',
  warn: 'warning',
  info: 'info',
  debug: 'debug',
}

const CURRENT_KNOWN_KEYS = ['id', 'created_at', 'message', 'level', 'source_path', 'source_line', 'wifi_signal', 'wifi_status', 'battery_voltage', 'firmware_version', 'free_heap_size', 'wake_reason']
const LEGACY_STATUS_KNOWN_KEYS = ['wifi_rssi_level', 'wifi_status', 'battery_voltage', 'current_fw_version', 'free_heap_size', 'wakeup_reason']

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function without(fields: FirmwareFields, keys: string[]): FirmwareFields {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !keys.includes(key)))
}

function levelFromKeywords(message: string): LogLevel {
  const lower = message.toLowerCase()
  if (lower.includes('error') || lower.includes('failed'))
    return 'error'
  if (lower.includes('warn'))
    return 'warning'
  return 'info'
}

function sourceOf(file: unknown, line: unknown): ParsedLogEntry['source'] {
  return typeof file === 'string' ? { file, line: numberOrNull(line) } : null
}

function statusOf(status: NonNullable<ParsedLogEntry['status']>): ParsedLogEntry['status'] {
  return Object.values(status).some(value => value !== null) ? status : null
}

function isLegacy(fields: FirmwareFields): boolean {
  return 'log_message' in fields || 'log_id' in fields || 'creation_timestamp' in fields
}

function parseLegacy(fields: FirmwareFields): ParsedLogEntry {
  const message = stringOrNull(fields.log_message) ?? ''
  const stamp = isPlainObject(fields.device_status_stamp) ? fields.device_status_stamp : {}
  const additional = isPlainObject(fields.additional_info) ? fields.additional_info : {}
  return {
    level: levelFromKeywords(message),
    message,
    source: sourceOf(fields.log_sourcefile, fields.log_codeline),
    status: statusOf({
      wifiRssi: numberOrNull(stamp.wifi_rssi_level),
      wifiStatus: stringOrNull(stamp.wifi_status),
      batteryVoltage: numberOrNull(stamp.battery_voltage),
      freeHeapSize: numberOrNull(stamp.free_heap_size),
      wakeReason: stringOrNull(stamp.wakeup_reason),
    }),
    firmwareVersion: stringOrNull(stamp.current_fw_version),
    extras: { ...without(stamp, LEGACY_STATUS_KNOWN_KEYS), ...additional },
  }
}

function parseCurrent(fields: FirmwareFields): ParsedLogEntry {
  const message = stringOrNull(fields.message) ?? ''
  return {
    level: FIRMWARE_LEVELS[String(fields.level)] ?? levelFromKeywords(message),
    message,
    source: sourceOf(fields.source_path, fields.source_line),
    status: statusOf({
      wifiRssi: numberOrNull(fields.wifi_signal),
      wifiStatus: stringOrNull(fields.wifi_status),
      batteryVoltage: numberOrNull(fields.battery_voltage),
      freeHeapSize: numberOrNull(fields.free_heap_size),
      wakeReason: stringOrNull(fields.wake_reason),
    }),
    firmwareVersion: stringOrNull(fields.firmware_version),
    extras: without(fields, CURRENT_KNOWN_KEYS),
  }
}

/** One entry of a `POST /api/log` body, in either of the two formats the firmware has sent. */
export function parseLogEntry(fields: FirmwareFields): ParsedLogEntry {
  return isLegacy(fields) ? parseLegacy(fields) : parseCurrent(fields)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return undefined
  }
}

/** The `entry` column: the firmware's JSON as text. Anything else stored there is read as a bare message. */
export function parseStoredLogEntry(stored: string): ParsedLogEntry {
  const fields = parseJson(stored)
  return isPlainObject(fields)
    ? parseLogEntry(fields)
    : { level: levelFromKeywords(stored), message: stored, source: null, status: null, firmwareVersion: null, extras: {} }
}
