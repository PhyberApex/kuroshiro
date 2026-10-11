import type { Palette } from '../../device-models/entities/palette.entity.js'
import type { Device } from '../../devices/devices.entity.js'
import type { Firmware } from '../../firmware/entities/firmware.entity.js'
import type { MashupConfiguration } from '../../mashup/entities/mashup-configuration.entity.js'
import type { DevicePlugin } from '../../plugins/entities/device-plugin.entity.js'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { StoredFieldValues } from '../../plugins/plugin-field-values.js'
import type { ParsedPlugin } from '../../plugins/services/plugin-importer.service.js'
import type { Schedule } from '../../schedule/schedule.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { InstanceSettings } from '../../settings/entities/instance-settings.entity.js'
import type {
  AssignmentManifestEntry,
  DeviceManifestEntry,
  FirmwareManifestEntry,
  InstanceSettingsManifestEntry,
  MashupConfigurationManifestEntry,
  PaletteManifestEntry,
  PluginManifestEntry,
  ScheduleManifestEntry,
  ScreenManifestEntry,
} from '../types.js'
import { BOOLEAN_SETTING_KEYS, CONFIGURATION_REDACTION_SENTINEL, SETTING_KEYS } from 'kuroshiro-shared'
import { isSecretField } from '../../plugins/plugin-field-values.js'

/** A shallow clone whose Data Source header *values* are replaced by the Redaction Sentinel, for `buildEntries` to write into the archive's nested `.trmnlp` — the standalone per-Plugin export/import never sees this clone (ADR-0028). */
export function withRedactedHeaders(plugin: Plugin): Plugin {
  return {
    ...plugin,
    dataSources: redactHeaders(plugin.dataSources),
  }
}

/** Replaces every Data Source header *value* with the Redaction Sentinel, keeping the rest of each Data Source as it was. */
function redactHeaders<T extends { headers?: Record<string, string> | null }>(dataSources: T[] | null | undefined): T[] {
  return (dataSources || []).map(ds => ({
    ...ds,
    headers: ds.headers && Object.fromEntries(Object.keys(ds.headers).map(key => [key, CONFIGURATION_REDACTION_SENTINEL])),
  }))
}

export function buildPluginEntry(plugin: Plugin, fieldValues: StoredFieldValues, redact: boolean): PluginManifestEntry {
  return {
    id: plugin.id,
    kind: plugin.kind,
    mergeStrategy: plugin.mergeStrategy ?? null,
    streamLimit: plugin.streamLimit ?? null,
    webhookToken: redactWebhookToken(plugin.webhookToken, redact),
    sourceRecipeId: plugin.sourceRecipeId ?? null,
    sourceRecipeSnapshot: redactSnapshotHeaders(plugin.sourceRecipeSnapshot as ParsedPlugin | null | undefined, redact),
    dataSources: (plugin.dataSources || []).map(ds => ({ id: ds.id, name: ds.name })),
    templates: (plugin.templates || []).map(template => ({ id: template.id, layout: template.layout })),
    fields: (plugin.fields || []).map(field => ({ id: field.id, keyname: field.keyname })),
    fieldValues: redact ? redactSecretFieldValues(plugin, fieldValues) : fieldValues,
  }
}

function redactWebhookToken(webhookToken: string | null | undefined, redact: boolean): string | null {
  return redact && webhookToken ? CONFIGURATION_REDACTION_SENTINEL : (webhookToken ?? null)
}

/** A Recipe Snapshot can carry a Data Source's header values as they stood at import time — redact them the same way `withRedactedHeaders` does for the live Plugin, so a Redacted Archive doesn't leak recipe-time secrets through the snapshot (ADR-0028, ADR-0030). */
function redactSnapshotHeaders(snapshot: ParsedPlugin | null | undefined, redact: boolean): ParsedPlugin | null {
  if (!snapshot) {
    return null
  }
  if (!redact) {
    return snapshot
  }
  return {
    ...snapshot,
    dataSources: redactHeaders(snapshot.dataSources),
  }
}

function redactSecretFieldValues(plugin: Plugin, fieldValues: StoredFieldValues): StoredFieldValues {
  const secretKeynames = new Set((plugin.fields || []).filter(isSecretField).map(field => field.keyname))
  return Object.fromEntries(
    Object.entries(fieldValues).map(([keyname, value]) => [keyname, secretKeynames.has(keyname) ? CONFIGURATION_REDACTION_SENTINEL : value]),
  )
}

export function buildDeviceEntry(device: Device, redact: boolean): DeviceManifestEntry {
  return {
    id: device.id,
    name: device.name,
    friendlyId: device.friendlyId,
    mac: device.mac,
    apikey: redact ? CONFIGURATION_REDACTION_SENTINEL : device.apikey,
    refreshRate: device.refreshRate,
    deviceModelName: device.deviceModel?.name ?? null,
    paletteId: device.palette?.id ?? null,
    ...buildDeviceMirrorFields(device, redact),
    ...buildDeviceSleepFields(device),
    targetFirmwareId: device.targetFirmware?.id ?? null,
  }
}

function buildDeviceMirrorFields(device: Device, redact: boolean): Pick<DeviceManifestEntry, 'mirrorEnabled' | 'mirrorMac' | 'mirrorApikey'> {
  return {
    mirrorEnabled: device.mirrorEnabled ?? null,
    mirrorMac: device.mirrorMac ?? null,
    mirrorApikey: redact && device.mirrorApikey ? CONFIGURATION_REDACTION_SENTINEL : (device.mirrorApikey ?? null),
  }
}

function buildDeviceSleepFields(device: Device): Pick<DeviceManifestEntry, 'sleepModeEnabled' | 'sleepStartTime' | 'sleepEndTime' | 'sleepScreenEnabled'> {
  return {
    sleepModeEnabled: device.sleepModeEnabled,
    sleepStartTime: device.sleepStartTime ?? null,
    sleepEndTime: device.sleepEndTime ?? null,
    sleepScreenEnabled: device.sleepScreenEnabled,
  }
}

export function buildScreenEntry(screen: Screen): ScreenManifestEntry {
  return {
    id: screen.id,
    deviceId: screen.device.id,
    type: screen.type,
    order: screen.order,
    filename: screen.filename ?? null,
    externalLink: screen.externalLink ?? null,
    html: screen.html ?? null,
    fetchManual: screen.fetchManual,
    pluginId: screen.plugin?.id ?? null,
    devicePluginId: screen.devicePluginId ?? null,
    schedule: screen.schedule ? buildScheduleEntry(screen.schedule) : null,
    mashupConfiguration: screen.mashupConfiguration ? buildMashupEntry(screen.mashupConfiguration) : null,
  }
}

function buildScheduleEntry(schedule: Schedule): ScheduleManifestEntry {
  return {
    id: schedule.id,
    enabled: schedule.enabled,
    weekdays: schedule.weekdays ?? null,
    startTime: schedule.startTime ?? null,
    endTime: schedule.endTime ?? null,
    startDate: schedule.startDate ?? null,
    endDate: schedule.endDate ?? null,
  }
}

function buildMashupEntry(mashup: MashupConfiguration): MashupConfigurationManifestEntry {
  return {
    id: mashup.id,
    layout: mashup.layout,
    slots: (mashup.slots || []).map(slot => ({
      id: slot.id,
      position: slot.position,
      size: slot.size,
      order: slot.order,
      pluginId: slot.plugin.id,
    })),
  }
}

export function buildAssignmentEntry(assignment: DevicePlugin): AssignmentManifestEntry {
  return {
    id: assignment.id,
    deviceId: assignment.device.id,
    pluginId: assignment.plugin.id,
    order: assignment.order,
    isActive: assignment.isActive,
  }
}

export function buildPaletteEntry(palette: Palette): PaletteManifestEntry {
  return {
    id: palette.id,
    name: palette.name,
    kind: 'custom',
    grays: palette.grays,
    colors: palette.colors ?? null,
    frameworkClass: palette.frameworkClass,
    grayscaleBitDepth: palette.grayscaleBitDepth ?? null,
    deprecated: palette.deprecated,
  }
}

/** Only the overridden Settings (ADR-0027) — fallback values (env/built-in default) are never exported. */
export function buildSettingsEntry(instanceSettings: InstanceSettings | null): InstanceSettingsManifestEntry {
  const entry: InstanceSettingsManifestEntry = {}
  if (!instanceSettings)
    return entry
  for (const key of SETTING_KEYS) {
    const value = instanceSettings[key]
    if (value != null)
      entry[key] = value
  }
  for (const key of BOOLEAN_SETTING_KEYS) {
    const value = instanceSettings[key]
    if (value != null)
      entry[key] = value
  }
  return entry
}

export function buildFirmwareEntry(firmware: Firmware): FirmwareManifestEntry {
  return {
    id: firmware.id,
    version: firmware.version,
    checksum: firmware.checksum,
    compatibleModels: firmware.compatibleModels,
    label: firmware.label ?? null,
    deprecated: firmware.deprecated,
    uploadedAt: firmware.uploadedAt ? firmware.uploadedAt.toISOString() : null,
  }
}
