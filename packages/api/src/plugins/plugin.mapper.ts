import type { DataSourceRead, PluginAssignmentRead, PluginDetail, PluginFieldRead, PluginPlace, PluginSummary, PreviewData, PreviewName, PreviewOrigin, ScheduledRenderRead } from 'kuroshiro-shared'
import type { Screen } from '../screens/screens.entity.js'
import type { PluginDataSource } from './entities/plugin-data-source.entity.js'
import type { PluginField } from './entities/plugin-field.entity.js'
import type { Plugin } from './entities/plugin.entity.js'
import type { StoredFieldValues } from './plugin-field-values.js'
import type { PluginRenderContext } from './services/plugin-template-context.service.js'
import { TEMPLATE_SIZES } from 'kuroshiro-shared'
import { screenStatesOfDevice } from '../screens/screen-states.js'
import { toIsoString, toIsoStringOrNull } from '../utils/readModel.js'
import { needsValues, toFieldValueReads } from './plugin-field-values.js'
import { isFetchErrorMarker } from './services/plugin-data-resolver.service.js'

export interface PluginFacts {
  /** Secrets included; the mappers never pass one on. */
  storedFieldValues: StoredFieldValues
  /** The Data Sources a fetch Alert is firing for. */
  firingDataSourceIds: ReadonlySet<string>
  /** The Plugin's Plugin Screens, each with its Device. */
  assignmentScreens: Screen[]
  /** The Mashups holding the Plugin in a slot, each with its Device. */
  mashupScreens: Screen[]
}

export interface PluginDetailFacts extends PluginFacts {
  /** Every Screen, in Order and with its Schedule, of each Device the Plugin is assigned to, by Device id. */
  screensByDevice: ReadonlyMap<string, Screen[]>
  now: Date
  /** The address the instance is reached at from outside. */
  apiUrl: string
}

export function compareIgnoringCase(a: string, b: string): number {
  return a.toLowerCase().localeCompare(b.toLowerCase()) || a.localeCompare(b)
}

function inOrder<T extends { order: number }>(items: T[] | undefined): T[] {
  return [...items ?? []].sort((a, b) => a.order - b.order)
}

function isPolled(plugin: Plugin): boolean {
  return plugin.kind !== 'Webhook'
}

function polledDataSources(plugin: Plugin): PluginDataSource[] {
  return isPolled(plugin) ? inOrder(plugin.dataSources) : []
}

function toPluginPlaces(mashupScreens: Screen[]): PluginPlace[] {
  const byScreen = new Map(mashupScreens.map(screen => [screen.id, screen]))
  return [...byScreen.values()]
    .map(screen => ({ screenId: screen.id, name: screen.filename ?? '', deviceId: screen.device.id, deviceName: screen.device.name }))
    .sort((a, b) => compareIgnoringCase(a.name, b.name) || compareIgnoringCase(a.deviceName, b.deviceName))
}

export function toPluginSummary(plugin: Plugin, facts: PluginFacts): PluginSummary {
  const dataSources = polledDataSources(plugin)
  return {
    id: plugin.id,
    name: plugin.name,
    kind: plugin.kind,
    sourceRecipeId: plugin.sourceRecipeId ?? null,
    devices: facts.assignmentScreens
      .map(({ device }) => ({ id: device.id, name: device.name }))
      .sort((a, b) => compareIgnoringCase(a.name, b.name)),
    mashups: toPluginPlaces(facts.mashupScreens),
    worstFetchFailureStreak: Math.max(0, ...dataSources.map(source => source.fetchFailureStreak)),
    fetchAlertFiring: dataSources.some(source => facts.firingDataSourceIds.has(source.id)),
    needsValues: needsValues(plugin.fields ?? [], facts.storedFieldValues),
    webhookPayloadStored: isPolled(plugin) ? null : plugin.webhookPayload != null,
  }
}

type FetchSettings = Pick<DataSourceRead, 'method' | 'url' | 'headers' | 'body' | 'transformJs' | 'literalValue'>

function toFetchSettings(source: PluginDataSource): FetchSettings {
  if (source.mode !== 'fetch')
    return { method: null, url: null, headers: null, body: null, transformJs: null, literalValue: source.literalValue ?? null }
  return {
    method: source.method === 'POST' ? 'POST' : 'GET',
    url: source.url ?? null,
    headers: source.headers ?? null,
    body: source.body ?? null,
    transformJs: source.transformJs ?? null,
    literalValue: null,
  }
}

function toDataSourceRead(source: PluginDataSource, facts: PluginFacts): DataSourceRead {
  return {
    id: source.id,
    name: source.name,
    mode: source.mode,
    ...toFetchSettings(source),
    fetchFailureStreak: source.fetchFailureStreak,
    lastFetchAttemptAt: toIsoStringOrNull(source.lastFetchAttemptAt),
    lastFetchSucceededAt: toIsoStringOrNull(source.lastFetchSucceededAt),
    lastFetchError: source.lastFetchError ?? null,
    alertFiring: facts.firingDataSourceIds.has(source.id),
  }
}

function toPluginFieldRead(field: PluginField): PluginFieldRead {
  return {
    id: field.id,
    keyname: field.keyname,
    label: field.name,
    type: field.fieldType,
    helpText: field.description ?? null,
    default: field.defaultValue ?? null,
    required: field.required,
    order: field.order,
    options: field.options ?? null,
  }
}

/** A Template stored under a layout that is no Template size is not read. */
function toTemplateReads(plugin: Plugin): PluginDetail['templates'] {
  return TEMPLATE_SIZES.flatMap((size) => {
    const template = plugin.templates?.find(candidate => candidate.layout === size)
    if (template)
      return [{ size, liquidMarkup: template.liquidMarkup }]
    return size === 'full' ? [{ size, liquidMarkup: '' }] : []
  })
}

function toWebhookRead(plugin: Plugin, apiUrl: string): PluginDetail['webhook'] {
  if (isPolled(plugin))
    return null
  const token = plugin.webhookToken ?? ''
  return {
    token,
    url: `${apiUrl}/api/webhook/${token}`,
    mergeStrategy: plugin.mergeStrategy ?? 'standard',
    streamLimit: plugin.streamLimit ?? null,
    payload: plugin.webhookPayload ?? null,
    payloadReceivedAt: toIsoStringOrNull(plugin.payloadReceivedAt),
  }
}

function toRecipeRead(plugin: Plugin): PluginDetail['recipe'] {
  if (!plugin.sourceRecipeId)
    return null
  const snapshotName = plugin.sourceRecipeSnapshot?.name
  return {
    id: plugin.sourceRecipeId,
    name: typeof snapshotName === 'string' ? snapshotName : null,
    importedAt: toIsoString(plugin.createdAt),
    snapshotTakenAt: toIsoStringOrNull(plugin.snapshotTakenAt),
  }
}

function toAssignmentRead(screen: Screen, facts: PluginDetailFacts): PluginAssignmentRead {
  const { device } = screen
  const screensInOrder = facts.screensByDevice.get(device.id) ?? [screen]
  const states = screenStatesOfDevice(device, screensInOrder, facts.now)
  return {
    deviceId: device.id,
    deviceName: device.name,
    screenId: screen.id,
    order: screen.order,
    screenCount: screensInOrder.length,
    state: states.get(screen.id)?.state ?? null,
  }
}

function toScheduledRenderRead(plugin: Plugin): ScheduledRenderRead | null {
  if (!plugin.lastScheduledRenderAt)
    return null
  return {
    at: toIsoString(plugin.lastScheduledRenderAt),
    error: plugin.lastScheduledRenderError == null
      ? null
      : {
          message: plugin.lastScheduledRenderError,
          line: plugin.lastScheduledRenderErrorLine ?? null,
          size: plugin.lastScheduledRenderErrorSize ?? 'full',
        },
  }
}

export function toPluginDetail(plugin: Plugin, facts: PluginDetailFacts): PluginDetail {
  const fields = inOrder(plugin.fields)
  return {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description ?? null,
    kind: plugin.kind,
    createdAt: toIsoString(plugin.createdAt),
    updatedAt: toIsoString(plugin.updatedAt),
    refreshInterval: isPolled(plugin) ? plugin.refreshInterval : null,
    templates: toTemplateReads(plugin),
    dataSources: polledDataSources(plugin).map(source => toDataSourceRead(source, facts)),
    fields: fields.map(toPluginFieldRead),
    fieldValues: toFieldValueReads(fields, facts.storedFieldValues),
    needsValues: needsValues(fields, facts.storedFieldValues),
    webhook: toWebhookRead(plugin, facts.apiUrl),
    recipe: toRecipeRead(plugin),
    assignments: facts.assignmentScreens
      .map(screen => toAssignmentRead(screen, facts))
      .sort((a, b) => compareIgnoringCase(a.deviceName, b.deviceName)),
    mashups: toPluginPlaces(facts.mashupScreens),
    lastScheduledRender: toScheduledRenderRead(plugin),
  }
}

const BUILT_IN_NAMES = ['sensors', 'trmnl'] as const satisfies readonly PreviewOrigin[]

function toPreviewNames(plugin: Plugin, { context, fieldValues, sourceData }: PluginRenderContext): PreviewName[] {
  if (Array.isArray(context))
    return []

  const data = isPolled(plugin) ? sourceData : plugin.webhookPayload ?? {}
  const origin = isPolled(plugin) ? 'dataSource' : 'webhookPayload'
  const isReplaced = (name: string) => name in data
  const isBuiltIn = (name: string) => name === 'sensors' || name === 'trmnl'
  const fieldValueNames = inOrder(plugin.fields)
    .map(field => field.keyname)
    .filter(keyname => keyname in fieldValues && !isReplaced(keyname) && !isBuiltIn(keyname))

  return [
    ...fieldValueNames.map((name): PreviewName => ({ name, origin: 'fieldValue', error: null })),
    ...Object.entries(data).map(([name, value]): PreviewName => ({ name, origin, error: isFetchErrorMarker(value) ? value.message : null })),
    ...BUILT_IN_NAMES.filter(name => !isReplaced(name)).map((name): PreviewName => ({ name, origin: name, error: null })),
  ]
}

/** The data a preview of the Plugin draws against, and the names of it a Template can read. */
export function toPreviewData(plugin: Plugin, rendering: PluginRenderContext, fetchedAt: Date): PreviewData {
  return {
    context: rendering.context,
    names: toPreviewNames(plugin, rendering),
    fetchedAt: toIsoString(fetchedAt),
    webhookPayloadReceivedAt: isPolled(plugin) ? null : toIsoStringOrNull(plugin.payloadReceivedAt),
  }
}
