import type { MergeStrategy, PluginKind } from '../plugins/entities/plugin.entity.js'
import type { Screen } from '../screens/screens.entity.js'

export const CONFIG_ARCHIVE_FILES = {
  manifest: 'manifest.json',
  plugins: 'plugins.json',
  devices: 'devices.json',
  screens: 'screens.json',
  assignments: 'assignments.json',
  palettes: 'palettes.json',
  firmware: 'firmware.json',
} as const

export interface ConfigurationManifest {
  kuroshiroVersion: string
  schemaVersion: number
  exportedAt: string
  containsSecrets: true
}

export interface PluginManifestDataSource {
  id: string
  name: string
}

export interface PluginManifestTemplate {
  id: string
  layout: string
}

export interface PluginManifestField {
  id: string
  keyname: string
}

export interface PluginManifestVariable {
  id: string
  key: string
  value: string
  isSecret: boolean
}

// The fields the nested `plugins/<id>/.trmnlp` folder can't carry (ADR-0021):
// identity for every child row, plus Webhook-kind-only fields the per-Plugin
// exporter deliberately omits.
export interface PluginManifestEntry {
  id: string
  kind: PluginKind
  mergeStrategy: MergeStrategy | null
  streamLimit: number | null
  webhookToken: string | null
  sourceRecipeId: string | null
  dataSources: PluginManifestDataSource[]
  templates: PluginManifestTemplate[]
  fields: PluginManifestField[]
  variables: PluginManifestVariable[]
}

export interface DeviceManifestEntry {
  id: string
  name: string
  friendlyId: string
  mac: string
  apikey: string
  refreshRate: number
  deviceModelName: string | null
  paletteId: string | null
  mirrorEnabled: boolean | null
  mirrorMac: string | null
  mirrorApikey: string | null
  sleepModeEnabled: boolean
  sleepStartTime: number | null
  sleepEndTime: number | null
  sleepScreenEnabled: boolean
  targetFirmwareId: string | null
}

export interface ScheduleManifestEntry {
  id: string
  enabled: boolean
  weekdays: number[] | null
  startTime: string | null
  endTime: string | null
  startDate: string | null
  endDate: string | null
}

export interface MashupSlotManifestEntry {
  id: string
  position: string
  size: string
  order: number
  pluginId: string
}

export interface MashupConfigurationManifestEntry {
  id: string
  layout: string
  slots: MashupSlotManifestEntry[]
}

export interface ScreenManifestEntry {
  id: string
  deviceId: string
  type: Screen['type']
  order: number
  filename: string | null
  externalLink: string | null
  html: string | null
  fetchManual: boolean
  pluginId: string | null
  devicePluginId: string | null
  schedule: ScheduleManifestEntry | null
  mashupConfiguration: MashupConfigurationManifestEntry | null
}

export interface AssignmentFieldValueManifestEntry {
  id: string
  fieldId: string
  value: string
}

export interface AssignmentManifestEntry {
  id: string
  deviceId: string
  pluginId: string
  order: number
  isActive: boolean
  fieldValues: AssignmentFieldValueManifestEntry[]
}

export interface PaletteManifestEntry {
  id: string
  name: string
  kind: 'custom'
  grays: number
  colors: string[] | null
  frameworkClass: string
  grayscaleBitDepth: number | null
  deprecated: boolean
}

export interface FirmwareManifestEntry {
  id: string
  version: string
  checksum: string
  compatibleModels: string[]
  label: string | null
  deprecated: boolean
  uploadedAt: string | null
}
