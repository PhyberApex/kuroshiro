import type { AdditionalInfoMap, LogSeverity, NormalizedLogEntry, NormalizedLogStatus } from '@/types.ts'

const CURRENT_EXTRA_KEYS = ['refresh_rate', 'sleep_duration', 'special_function', 'max_alloc_size', 'retry'] as const

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function getKeywordSeverity(message: string): LogSeverity {
  const lowerMessage = message.toLowerCase()
  if (lowerMessage.includes('error') || lowerMessage.includes('failed'))
    return 'error'
  if (lowerMessage.includes('warning') || lowerMessage.includes('warn'))
    return 'warning'
  if (lowerMessage.includes('info'))
    return 'info'
  return 'default'
}

function severityFromLevel(level: unknown): LogSeverity | undefined {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'error'
    case 'warn':
      return 'warning'
    case 'info':
      return 'info'
    case 'debug':
      return 'default'
    default:
      return undefined
  }
}

function isLegacyEntry(parsed: Record<string, unknown>): boolean {
  return 'log_message' in parsed || 'log_id' in parsed || 'creation_timestamp' in parsed
}

function normalizeLegacyEntry(parsed: Record<string, unknown>): NormalizedLogEntry {
  const message = stringOrUndefined(parsed.log_message) ?? ''
  const statusStamp = parsed.device_status_stamp
  const status: NormalizedLogStatus | undefined
    = statusStamp && typeof statusStamp === 'object'
      ? {
          wifiRssi: numberOrUndefined((statusStamp as Record<string, unknown>).wifi_rssi_level),
          wifiStatus: stringOrUndefined((statusStamp as Record<string, unknown>).wifi_status),
          batteryVoltage: numberOrUndefined((statusStamp as Record<string, unknown>).battery_voltage),
          firmwareVersion: stringOrUndefined((statusStamp as Record<string, unknown>).current_fw_version),
          freeHeapSize: numberOrUndefined((statusStamp as Record<string, unknown>).free_heap_size),
          wakeReason: stringOrUndefined((statusStamp as Record<string, unknown>).wakeup_reason),
        }
      : undefined

  return {
    message,
    sourceFile: stringOrUndefined(parsed.log_sourcefile),
    sourceLine: numberOrUndefined(parsed.log_codeline),
    severity: getKeywordSeverity(message),
    status,
    extras: (parsed.additional_info as AdditionalInfoMap | undefined) ?? {},
  }
}

function normalizeCurrentEntry(parsed: Record<string, unknown>): NormalizedLogEntry {
  const message = stringOrUndefined(parsed.message) ?? ''
  const status: NormalizedLogStatus = {
    wifiRssi: numberOrUndefined(parsed.wifi_signal),
    wifiStatus: stringOrUndefined(parsed.wifi_status),
    batteryVoltage: numberOrUndefined(parsed.battery_voltage),
    firmwareVersion: stringOrUndefined(parsed.firmware_version),
    freeHeapSize: numberOrUndefined(parsed.free_heap_size),
    wakeReason: stringOrUndefined(parsed.wake_reason),
  }
  const hasStatus = Object.values(status).some(value => value !== undefined)

  const extras: AdditionalInfoMap = {}
  for (const key of CURRENT_EXTRA_KEYS) {
    if (parsed[key] !== undefined)
      extras[key] = parsed[key] as AdditionalInfoMap[string]
  }

  return {
    message,
    sourceFile: stringOrUndefined(parsed.source_path),
    sourceLine: numberOrUndefined(parsed.source_line),
    severity: severityFromLevel(parsed.level) ?? getKeywordSeverity(message),
    status: hasStatus ? status : undefined,
    extras,
  }
}

export function parseLogEntry(rawEntry: string): NormalizedLogEntry {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawEntry)
  }
  catch {
    return { message: rawEntry, severity: getKeywordSeverity(rawEntry), extras: {} }
  }

  if (typeof parsed !== 'object' || parsed === null)
    return { message: rawEntry, severity: getKeywordSeverity(rawEntry), extras: {} }

  const record = parsed as Record<string, unknown>
  return isLegacyEntry(record) ? normalizeLegacyEntry(record) : normalizeCurrentEntry(record)
}
