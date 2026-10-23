import type { ScreenModifiers } from 'kuroshiro-shared'
import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import type { JsonObject } from '../../utils/json.js'
import type { PluginField } from '../entities/plugin-field.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { OAuthSettings } from '../plugin-oauth.js'
import type { TrmnlDevice } from '../trmnl-device.js'
import type { ResolvableDataSource } from './plugin-data-resolver.service.js'
import type { FieldValueWrites } from './plugin-field-values.service.js'
import type { OAuthPoll } from './plugin-oauth.service.js'
import { Buffer } from 'node:buffer'
import { Injectable } from '@nestjs/common'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { hideSecretFieldValues, hideSecretsIn, secretValues, templateFieldValues } from '../plugin-field-values.js'
import { isOAuthKeyname } from '../plugin-oauth.js'
import { isFetchErrorMarker, loneSourceRootKeys, PluginDataResolverService } from './plugin-data-resolver.service.js'
import { PluginDataSourceStateService } from './plugin-data-source-state.service.js'
import { PluginFieldValuesService } from './plugin-field-values.service.js'

export interface PluginTemplateContext {
  [fieldKeyname: string]: unknown
  trmnl: {
    system: { timestamp_utc: number }
    plugin_settings: {
      instance_name: string
      strategy: 'polling' | 'webhook'
      dark_mode: 'no' | 'yes'
      no_screen_padding: 'no' | 'yes'
      custom_fields_values: Record<string, string | string[]>
      /** The second the data was fetched at, absent until a fetch happened (ADR-0057). */
      data_fetched_utc?: number
    }
    user: { id: string, locale: string, time_zone: string, time_zone_iana: string, utc_offset: number }
    /** A lone Data Source's saved state, as its transform last wrote it (ADR-0052); empty otherwise. */
    state: JsonObject
    /** The Device the render is for, laid in after the fetch by `withTrmnlDevice` (ADR-0069); absent for no single Device. */
    device?: TrmnlDevice
  }
  sensors: Record<string, { value: number, unit: string }>
}

/** What the Plugin page's form holds and has not saved, for a context built ahead of the save. */
export interface UnsavedPluginInput {
  name?: string
  /** Poll only. */
  dataSources?: ResolvableDataSource[]
  fieldValues?: FieldValueWrites
}

export interface ContextOptions {
  /**
   * The Plugin Fields whose password values the admin's browser must not
   * read: each reads as dots in `context`, in a Field Value and wherever a
   * Data Source's result or error repeats it. A Data Source is still fetched
   * with the real one.
   */
  hideSecretsOf?: Array<Pick<PluginField, 'keyname' | 'fieldType'>>
}

export interface PluginRenderContext {
  /** What Liquid is given. A Webhook Payload that is an array has no keys to merge into, so it is the whole context. */
  context: Record<string, unknown> | unknown[]
  /** By keyname, as `context` holds them. */
  fieldValues: Record<string, string>
  /**
   * By keyname, with no password hidden: for a caller that must hide a
   * secret somewhere `contextFor` does not (e.g. a scheduled fetch's error
   * before it is stored), so it does not resolve the Plugin's Field Values a
   * second time.
   */
  resolvedFieldValues: Record<string, string>
  /** Each Data Source's result or error marker by name; empty for a Webhook-kind Plugin. */
  sourceData: Record<string, unknown>
  /** The state each Data Source's transform wrote this run as `trmnl_state`, by name, taken out of `sourceData` (ADR-0052). */
  sourceStates: Record<string, JsonObject>
  /** What each transform returned this run, by name: the Previous Output the next scheduled run reads at `trmnl.previous_merge_variables` (ADR-0070). */
  sourcePreviousOutputs: Record<string, JsonObject>
}

const STATE_KEY = 'trmnl_state'
const STATE_LIMIT_BYTES = 8192
const PREVIOUS_MERGE_VARIABLES_KEY = 'previous_merge_variables'
// TRMNL refuses merge variables over 100 kB, and so a Previous Output over it.
const PREVIOUS_OUTPUT_LIMIT_BYTES = 100 * 1024

const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The written state when it is an object within TRMNL's limit; anything else is dropped and the saved state stays. */
function writableState(value: unknown): JsonObject | null {
  return isPlainRecord(value) && Buffer.byteLength(JSON.stringify(value)) <= STATE_LIMIT_BYTES ? value as JsonObject : null
}

/** A transform that echoes its input at any depth would otherwise store its history and double it every run, as trmnlp strips it. */
function withoutEchoedPreviousOutput(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(withoutEchoedPreviousOutput)
  if (!isPlainRecord(value))
    return value
  const { [PREVIOUS_MERGE_VARIABLES_KEY]: _, ...rest } = value
  return Object.fromEntries(Object.entries(rest).map(([key, nested]) => [key, withoutEchoedPreviousOutput(nested)]))
}

/** Each transform's object result as the next run reads it, within TRMNL's limit; a failure, a list or text is not stored and the Previous Output stays. */
function writtenPreviousOutputs(dataSources: ResolvableDataSource[], data: Record<string, unknown>): Record<string, JsonObject> {
  const written: Record<string, JsonObject> = {}
  for (const source of dataSources) {
    const result = data[source.name]
    if (!source.transformJs || !isPlainRecord(result) || isFetchErrorMarker(result))
      continue
    const output = withoutEchoedPreviousOutput(result) as JsonObject
    if (Buffer.byteLength(JSON.stringify(output)) <= PREVIOUS_OUTPUT_LIMIT_BYTES)
      written[source.name] = output
  }
  return written
}

const loneOf = <T>(dataSources: T[]): T | undefined => dataSources.length === 1 ? dataSources[0] : undefined

/** What one render resolves before its data: the Field Values as fetched with and as shown. */
interface RenderInput {
  instanceName: string
  /** The Plugin Fields, for which Field Values read as lists (ADR-0064). */
  fields: PluginField[]
  /** The Plugin's screen modifiers, told to the template as TRMNL spells them (ADR-0054). */
  modifiers: ScreenModifiers
  sensors: DeviceSensor[]
  resolved: Record<string, string>
  fieldValues: Record<string, string>
  hideSecretsOf: ContextOptions['hideSecretsOf'] & object
}

/** Each result without its `trmnl_state`, and the states the run wrote. */
function takeWrittenStates(fetched: Record<string, unknown>): { data: Record<string, unknown>, states: Record<string, JsonObject> } {
  const data: Record<string, unknown> = {}
  const states: Record<string, JsonObject> = {}
  for (const [name, result] of Object.entries(fetched)) {
    if (!isPlainRecord(result) || !(STATE_KEY in result)) {
      data[name] = result
      continue
    }
    const { [STATE_KEY]: written, ...rest } = result
    data[name] = rest
    const state = writableState(written)
    if (state)
      states[name] = state
  }
  return { data, states }
}

/** The `trmnl` object with its `plugin_settings` told when the data was fetched, or left as they are when nothing was. */
function fetchedAt(trmnl: PluginTemplateContext['trmnl'], at: Date | null | undefined, strategy: 'polling' | 'webhook'): PluginTemplateContext['trmnl'] {
  const plugin_settings = { ...trmnl.plugin_settings, strategy, ...(at && { data_fetched_utc: Math.floor(at.getTime() / 1000) }) }
  return { ...trmnl, plugin_settings }
}

/** A preview of tokens not saved yet refreshes apart from the saved Plugin, so it neither keeps nor spends the saved one's token. */
function oauthPollOf(plugin: Plugin, settings: OAuthSettings, unsaved: UnsavedPluginInput): Omit<OAuthPoll, 'fieldValues'> {
  const tokensUnsaved = Object.keys(unsaved.fieldValues ?? {}).some(isOAuthKeyname)
  return { pluginId: tokensUnsaved ? undefined : plugin.id, settings }
}

/**
 * The Liquid context of every render of a Plugin, and of the preview's data:
 * its resolved Field Values, both under `trmnl.plugin_settings.custom_fields_values`
 * and as bare root keys (ADR-0032), the `trmnl` system object, an implicit
 * `sensors` object keyed by kind (ADR-0018) for whichever kinds the rendering
 * Device currently has a reading for, and on top the data: a Poll-kind
 * Plugin's Data Source results or error markers by name, a Webhook-kind
 * Plugin's Webhook Payload keys. A lone Data Source's keys are laid at the
 * root too (ADR-0049). The data wins over a bare Field Value key of the same
 * name; nothing replaces `trmnl` or `sensors`.
 */
@Injectable()
export class PluginTemplateContextService {
  constructor(
    private readonly fieldValues: PluginFieldValuesService,
    private readonly dataResolver: PluginDataResolverService,
    private readonly instanceTimeZone: InstanceTimeZone,
    private readonly sourceStates: PluginDataSourceStateService,
  ) {}

  /** `sensors` are the rendering Device's, and empty where the render is for no single Device. */
  async contextFor(plugin: Plugin, sensors: DeviceSensor[], unsaved: UnsavedPluginInput = {}, { hideSecretsOf = [] }: ContextOptions = {}): Promise<PluginRenderContext> {
    const resolved = await this.fieldValues.resolveFor(plugin.id, unsaved.fieldValues)
    const modifiers = { noScreenPadding: plugin.noScreenPadding, darkMode: plugin.darkMode }
    const render: RenderInput = { instanceName: unsaved.name ?? plugin.name, fields: plugin.fields ?? [], modifiers, sensors, resolved, fieldValues: hideSecretFieldValues(hideSecretsOf, resolved), hideSecretsOf }

    return plugin.kind === 'Webhook'
      ? this.webhookContext(plugin, render)
      : this.pollContext(unsaved.dataSources ?? plugin.dataSources ?? [], render, plugin.oauthSettings ? oauthPollOf(plugin, plugin.oauthSettings, unsaved) : null)
  }

  private webhookContext(plugin: Plugin, { instanceName, fields, modifiers, sensors, resolved, fieldValues }: RenderInput): PluginRenderContext {
    const withoutData = this.hidingSecrets(this.withoutData(instanceName, modifiers, templateFieldValues(fields, resolved), sensors, {}), templateFieldValues(fields, fieldValues))
    const payload = plugin.webhookPayload
    const trmnl = fetchedAt(withoutData.trmnl, plugin.payloadReceivedAt, 'webhook')
    return { context: Array.isArray(payload) ? payload : { ...withoutData, trmnl, ...payload }, fieldValues, resolvedFieldValues: resolved, sourceData: {}, sourceStates: {}, sourcePreviousOutputs: {} }
  }

  private async pollContext(dataSources: ResolvableDataSource[], { instanceName, fields, modifiers, sensors, resolved, fieldValues, hideSecretsOf }: RenderInput, oauth: Omit<OAuthPoll, 'fieldValues'> | null): Promise<PluginRenderContext> {
    const stored = await this.sourceStates.load(dataSources)
    const lone = loneOf(dataSources)
    const loneSavedState = (lone?.id && stored.savedStates[lone.id]) || {}
    const fetchContext = this.withoutData(instanceName, modifiers, templateFieldValues(fields, resolved), sensors, loneSavedState)
    const withoutData = this.hidingSecrets(fetchContext, templateFieldValues(fields, fieldValues))

    const { data, states } = takeWrittenStates(await this.dataResolver.resolveAll(dataSources, fetchContext, { ...stored, ...(oauth && { oauth: { ...oauth, fieldValues: resolved } }) }))
    const sourceData = hideSecretsIn(data, secretValues(hideSecretsOf, resolved))
    const trmnl = { ...fetchedAt(withoutData.trmnl, dataSources.length ? new Date() : null, 'polling'), state: lone ? states[lone.name] ?? loneSavedState : {} }
    const context = { ...withoutData, ...loneSourceRootKeys(sourceData), trmnl, sensors: withoutData.sensors, ...sourceData }
    return { context, fieldValues, resolvedFieldValues: resolved, sourceData, sourceStates: states, sourcePreviousOutputs: writtenPreviousOutputs(dataSources, data) }
  }

  /** The fetch context with each password Field Value as dots, in both address forms. */
  private hidingSecrets(fetchContext: PluginTemplateContext, fieldValues: Record<string, string | string[]>): PluginTemplateContext {
    return {
      ...fetchContext,
      ...fieldValues,
      trmnl: { ...fetchContext.trmnl, plugin_settings: { ...fetchContext.trmnl.plugin_settings, custom_fields_values: fieldValues } },
      sensors: fetchContext.sensors,
    }
  }

  private withoutData(instanceName: string, modifiers: ScreenModifiers, fieldValues: Record<string, string | string[]>, sensors: DeviceSensor[], state: JsonObject): PluginTemplateContext {
    return {
      ...fieldValues,
      trmnl: {
        system: {
          timestamp_utc: Math.floor(Date.now() / 1000),
        },
        plugin_settings: {
          instance_name: instanceName,
          strategy: 'polling',
          dark_mode: modifiers.darkMode ? 'yes' : 'no',
          no_screen_padding: modifiers.noScreenPadding ? 'yes' : 'no',
          custom_fields_values: fieldValues,
        },
        user: {
          id: 'kuroshiro-user',
          locale: 'en',
          // TRMNL's `time_zone` is a Rails name; there is no IANA-to-Rails table, so it carries the IANA name too.
          time_zone: this.instanceTimeZone.name,
          time_zone_iana: this.instanceTimeZone.name,
          utc_offset: this.instanceTimeZone.utcOffsetSeconds(),
        },
        state,
      },
      sensors: Object.fromEntries(sensors.map(sensor => [sensor.kind, { value: sensor.value, unit: sensor.unit }])),
    }
  }
}
