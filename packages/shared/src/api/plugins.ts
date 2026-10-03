import type { DataSourceLiteralValue, DataSourceMode } from '../data-source'
import type { ScreenState, TemplateSize } from './screens'

export const PLUGIN_KINDS = ['Poll', 'Webhook'] as const
export type PluginKind = typeof PLUGIN_KINDS[number]

export const MERGE_STRATEGIES = ['standard', 'deep_merge', 'stream'] as const
export type MergeStrategy = typeof MERGE_STRATEGIES[number]

/** A Mashup holding the Plugin in a slot, with its Device. */
export interface PluginPlace {
  screenId: string
  name: string
  deviceId: string
  deviceName: string
}

export interface PluginSummary {
  id: string
  name: string
  kind: PluginKind
  sourceRecipeId: string | null
  /** The Devices the Plugin is assigned to, by name. */
  devices: Array<{ id: string, name: string }>
  mashups: PluginPlace[]
  /** `0` for a Webhook-kind Plugin. */
  worstFetchFailureStreak: number
  fetchAlertFiring: boolean
  needsValues: boolean
  /** `null` for a Poll-kind Plugin. */
  webhookPayloadStored: boolean | null
}

export interface DataSourceRead {
  id: string
  name: string
  mode: DataSourceMode
  /** `null`, like `url`, `headers`, `body` and `transformJs`, for a `literal` Data Source. */
  method: 'GET' | 'POST' | null
  url: string | null
  headers: Record<string, string> | null
  body: Record<string, unknown> | null
  transformJs: string | null
  /** `null` for a `fetch` Data Source. */
  literalValue: DataSourceLiteralValue | null
  fetchFailureStreak: number
  lastFetchAttemptAt: string | null
  lastFetchSucceededAt: string | null
  lastFetchError: string | null
  alertFiring: boolean
}

export interface PluginFieldOption {
  label: string
  value: string
}

export interface PluginFieldRead {
  id: string
  keyname: string
  label: string
  /** A type Kuroshiro does not know passes through as written. */
  type: string
  helpText: string | null
  default: string | null
  required: boolean
  order: number
  /** `null` unless the Plugin Field offers a choice. */
  options: PluginFieldOption[] | null
}

/** A password Field Value is never read back; it reports only whether one is stored. */
export type FieldValueRead = { secret: false, value: string | null } | { secret: true, set: boolean }

export interface PluginAssignmentRead {
  deviceId: string
  deviceName: string
  screenId: string
  order: number
  /** How many Screens the Device has, the Plugin Screen included. */
  screenCount: number
  /** `null` on a mirrored Device, and for a Screen waiting its turn. */
  state: ScreenState | null
}

export interface ScheduledRenderRead {
  at: string
  error: { message: string, line: number | null, size: TemplateSize } | null
}

export interface PluginDetail {
  id: string
  name: string
  description: string | null
  kind: PluginKind
  createdAt: string
  updatedAt: string
  /** In minutes; `null` for a Webhook-kind Plugin. */
  refreshInterval: number | null
  /** Always holds one of size `full`. */
  templates: Array<{ size: TemplateSize, liquidMarkup: string }>
  /** Empty for a Webhook-kind Plugin. */
  dataSources: DataSourceRead[]
  fields: PluginFieldRead[]
  /** By the Plugin Field's keyname. */
  fieldValues: Record<string, FieldValueRead>
  needsValues: boolean
  /** `null` for a Poll-kind Plugin. */
  webhook: {
    token: string
    url: string
    mergeStrategy: MergeStrategy
    streamLimit: number | null
    payload: unknown
    payloadReceivedAt: string | null
  } | null
  /** `null` for a Plugin that was not imported from a Recipe. */
  recipe: { id: string, name: string | null, importedAt: string, snapshotTakenAt: string | null } | null
  assignments: PluginAssignmentRead[]
  mashups: PluginPlace[]
  /** `null` until a scheduled render has run. */
  lastScheduledRender: ScheduledRenderRead | null
}
