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

/** The `details` of a `template-invalid` refusal: the Template a save was refused for, and where Liquid stopped reading it. */
export interface TemplateInvalidDetails {
  size: TemplateSize
  /** `null` for an empty Template, and where Liquid names no line. */
  line: number | null
  message: string
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

export interface CreatePollPluginInput {
  kind: 'Poll'
  /** Not empty; stored trimmed. */
  name: string
  /** The Device the new Plugin is assigned to at once, at the end of its Order. */
  deviceId?: string
}

export interface CreateWebhookPluginInput {
  kind: 'Webhook'
  /** Not empty; stored trimmed. */
  name: string
  mergeStrategy: MergeStrategy
  /** A whole number of at least 1. Required with `stream`, refused with any other Merge Strategy. */
  streamLimit?: number
  /** The Device the new Plugin is assigned to at once, at the end of its Order. */
  deviceId?: string
}

/** What a Plugin is built from. It starts with one `full` Template, the starter, and for Poll a refresh interval of 15 minutes. */
export type CreatePluginInput = CreatePollPluginInput | CreateWebhookPluginInput

export interface ImportGithubPluginInput {
  /** `https://github.com/{owner}/{repository}`: a public repository with the Plugin at its root, on the branch `main`. */
  githubUrl: string
  /** The Device the imported Plugin is assigned to at once, at the end of its Order. */
  deviceId?: string
}

export interface ImportRecipeInput {
  /** The Recipe's id, or the address of its page on trmnl.com. */
  recipe: string
  /** The Device the imported Plugin is assigned to at once, at the end of its Order. */
  deviceId?: string
}

// Optional `www.`, `.git` and a closing slash; a branch or a sub-folder is not an address of a repository.
const GITHUB_REPOSITORY = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/

/** `owner/repository` of the address of a GitHub repository, or `null` for anything else. */
export function githubRepositoryOf(entered: string): string | null {
  const match = GITHUB_REPOSITORY.exec(entered.trim())
  return match ? `${match[1]}/${match[2]}` : null
}

/** The Recipe id in what was entered: the digits alone, or an address holding `recipes/{digits}`. Zeros in front are not part of an id. */
export function recipeIdOf(entered: string): string | null {
  const text = entered.trim()
  const digits = /^\d+$/.test(text) ? text : /recipes\/(\d+)/.exec(text)?.[1]
  return digits?.replace(/^0+(?=\d)/, '') ?? null
}

/** Where an imported Plugin came from. A Recipe's `name` is the name the Recipe gave the Plugin. */
export type PluginImportOrigin
  = | { type: 'recipe', id: string, name: string }
    | { type: 'file', fileName: string }
    | { type: 'github', repository: string }

/** What each of the three imports answers. */
export interface PluginImportResult {
  plugin: PluginDetail
  origin: PluginImportOrigin
  /** Whether a Data Source came with a transform: JavaScript that runs on the server at every fetch. */
  hasTransform: boolean
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

export const UPDATE_ITEM_TYPES = ['name', 'description', 'refreshInterval', 'template', 'dataSource', 'field'] as const
export type UpdateItemType = typeof UPDATE_ITEM_TYPES[number]

export type UpdateItemKind = 'added' | 'changed' | 'removed'

/** `two-way` without a Recipe Snapshot: every difference is listed, none is a conflict or `removed`. */
export type RecipeUpdateMode = 'two-way' | 'three-way'

/** A Data Source as a Recipe Update Check compares it: only what its mode uses. */
export type RecipeDataSource
  = | {
    mode: 'fetch'
    method: string
    url: string | null
    headers: Record<string, string>
    body: Record<string, unknown>
    transformJs: string | null
  }
  | { mode: 'literal', literalValue: DataSourceLiteralValue }

/** A Plugin Field as a Recipe Update Check compares it, in the words of `PluginFieldRead`. */
export type RecipeField = Omit<PluginFieldRead, 'id'>

interface UpdateItemOf<T extends UpdateItemType, V> {
  itemType: T
  /** The item's own name for a name, description and refresh interval; the size, the Data Source's name or the keyname otherwise. */
  key: string
  kind: UpdateItemKind
  /** The Recipe and the Plugin both changed it since the Recipe Snapshot. Never set without one. */
  conflict: boolean
  /** Each side is `null` where the item does not exist, and `snapshot` always without a Recipe Snapshot. */
  snapshot: V | null
  local: V | null
  upstream: V | null
}

/** One unit a Recipe Update Check offers. A template's value is its Liquid markup. */
export type UpdateItem
  = | UpdateItemOf<'name', string>
    | UpdateItemOf<'description', string>
    | UpdateItemOf<'refreshInterval', number>
    | UpdateItemOf<'template', string>
    | UpdateItemOf<'dataSource', RecipeDataSource>
    | UpdateItemOf<'field', RecipeField>

/** What a Recipe Update Check answers. */
export interface RecipeUpdatePreview {
  /** The Recipe as TRMNL has it now. */
  recipe: { id: string, name: string }
  /** `null` without a Recipe Snapshot, and for one taken before Kuroshiro recorded when. */
  snapshotTakenAt: string | null
  /** Handed back to apply, which is refused with `recipe-changed` when the Recipe moved since. */
  contentHash: string
  mode: RecipeUpdateMode
  items: UpdateItem[]
  /** Keynames of the required Plugin Fields that applying would leave without a value or a default. */
  requiredFieldsLeftEmpty: string[]
}

/** `apply: []` applies nothing and takes the Recipe as it is now as the Recipe Snapshot. */
export interface ApplyRecipeUpdateInput {
  contentHash: string
  apply: Array<{ itemType: UpdateItemType, key: string }>
}
