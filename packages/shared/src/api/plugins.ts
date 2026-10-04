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

/** The `details` of a `plugin-in-mashup` refusal: the Mashups that keep the Plugin from being deleted. */
export interface PluginInMashupDetails {
  mashups: PluginPlace[]
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
  method: DataSourceMethod | null
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

export const DATA_SOURCE_METHODS = ['GET', 'POST'] as const
export type DataSourceMethod = typeof DATA_SOURCE_METHODS[number]

/** In minutes, for an interval the admin enters. A longer one that came with a Recipe is kept as imported. */
export const REFRESH_INTERVAL_BOUNDS = { min: 1, max: 1440 } as const

export interface DataSourceInput {
  name: string
  mode: DataSourceMode
  method?: DataSourceMethod
  /** http or https. */
  url?: string
  headers?: Record<string, string>
  body?: Record<string, unknown>
  transformJs?: string | null
  literalValue?: DataSourceLiteralValue
}

export interface PluginFieldInput {
  keyname: string
  name: string
  fieldType?: string
  description?: string
  defaultValue?: string
  options?: PluginFieldOption[] | null
  required?: boolean
  order?: number
}

/** A key left out keeps what is stored. Each collection is the whole set. */
export interface UpdatePluginInput {
  name?: string
  description?: string | null
  /** Poll only. A whole number within `REFRESH_INTERVAL_BOUNDS`. */
  refreshInterval?: number
  templates?: Array<{ size: TemplateSize, liquidMarkup: string }>
  /** Matched by `id`: one with an id is updated in place, one without is created, one left out is deleted. */
  dataSources?: Array<{ id?: string } & DataSourceInput>
  /** Matched by keyname. */
  fields?: PluginFieldInput[]
  /** By keyname; `null` or an empty string clears a value, a keyname left out keeps it. */
  fieldValues?: Record<string, string | null>
}

/** What the Plugin page's form holds and has not saved, for the data its preview draws against. */
export interface PreviewDataInput {
  /** `null`: no Device, so no Sensors. */
  deviceId: string | null
  /** For `trmnl.plugin_settings.instance_name`. */
  name?: string
  /** The whole set; Poll only. */
  dataSources?: Array<{ id?: string } & DataSourceInput>
  /** By keyname; a keyname left out uses what is stored, a password included. */
  fieldValues?: Record<string, string | null>
}

export type PreviewOrigin = 'fieldValue' | 'dataSource' | 'webhookPayload' | 'sensors' | 'trmnl'

/** One name a Template can read. */
export interface PreviewName {
  name: string
  origin: PreviewOrigin
  /** Why a Data Source could not be fetched; its value in `context` is then the error marker. */
  error: string | null
}

export interface PreviewData {
  /** What the server's render passes to Liquid, with a password Field Value as dots. A Webhook Payload that is a list is the whole context. */
  context: Record<string, unknown> | unknown[]
  /** In the order Field Values, Data Sources or Webhook Payload keys, `sensors`, `trmnl`. A name the data replaces is listed once, as the data. */
  names: PreviewName[]
  fetchedAt: string
  /** `null` for a Poll-kind Plugin, and until a Webhook Payload is received. */
  webhookPayloadReceivedAt: string | null
}
