import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import type { PluginField } from '../entities/plugin-field.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { ResolvableDataSource } from './plugin-data-resolver.service.js'
import type { FieldValueWrites } from './plugin-field-values.service.js'
import { Injectable } from '@nestjs/common'
import { hideSecretFieldValues, hideSecretsIn, secretValues } from '../plugin-field-values.js'
import { PluginDataResolverService } from './plugin-data-resolver.service.js'
import { PluginFieldValuesService } from './plugin-field-values.service.js'

export interface PluginTemplateContext {
  [fieldKeyname: string]: unknown
  trmnl: {
    system: { timestamp_utc: number }
    plugin_settings: {
      instance_name: string
      strategy: 'polling'
      dark_mode: 'no' | 'yes'
      no_screen_padding: 'no' | 'yes'
      custom_fields_values: Record<string, string>
    }
    user: { id: string, locale: string }
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
}

/**
 * The Liquid context of every render of a Plugin, and of the preview's data:
 * its resolved Field Values, both under `trmnl.plugin_settings.custom_fields_values`
 * and as bare root keys (ADR-0032), the `trmnl` system object, an implicit
 * `sensors` object keyed by kind (ADR-0018) for whichever kinds the rendering
 * Device currently has a reading for, and on top the data: a Poll-kind
 * Plugin's Data Source results or error markers by name, a Webhook-kind
 * Plugin's Webhook Payload keys. The data wins over a bare Field Value key of
 * the same name.
 */
@Injectable()
export class PluginTemplateContextService {
  constructor(
    private readonly fieldValues: PluginFieldValuesService,
    private readonly dataResolver: PluginDataResolverService,
  ) {}

  /** `sensors` are the rendering Device's, and empty where the render is for no single Device. */
  async contextFor(plugin: Plugin, sensors: DeviceSensor[], unsaved: UnsavedPluginInput = {}, { hideSecretsOf = [] }: ContextOptions = {}): Promise<PluginRenderContext> {
    const resolved = await this.fieldValues.resolveFor(plugin.id, unsaved.fieldValues)
    const fetchContext = this.withoutData(unsaved.name ?? plugin.name, resolved, sensors)

    const fieldValues = hideSecretFieldValues(hideSecretsOf, resolved)
    const withoutData = {
      ...fetchContext,
      ...fieldValues,
      trmnl: { ...fetchContext.trmnl, plugin_settings: { ...fetchContext.trmnl.plugin_settings, custom_fields_values: fieldValues } },
      sensors: fetchContext.sensors,
    }

    if (plugin.kind === 'Webhook') {
      const payload = plugin.webhookPayload
      return { context: Array.isArray(payload) ? payload : { ...withoutData, ...payload }, fieldValues, resolvedFieldValues: resolved, sourceData: {} }
    }

    const fetched = await this.dataResolver.resolveAll(unsaved.dataSources ?? plugin.dataSources ?? [], fetchContext)
    const sourceData = hideSecretsIn(fetched, secretValues(hideSecretsOf, resolved))
    return { context: { ...withoutData, ...sourceData }, fieldValues, resolvedFieldValues: resolved, sourceData }
  }

  private withoutData(instanceName: string, fieldValues: Record<string, string>, sensors: DeviceSensor[]): PluginTemplateContext {
    return {
      ...fieldValues,
      trmnl: {
        system: {
          timestamp_utc: Math.floor(Date.now() / 1000),
        },
        plugin_settings: {
          instance_name: instanceName,
          strategy: 'polling',
          dark_mode: 'no',
          no_screen_padding: 'no',
          custom_fields_values: fieldValues,
        },
        user: {
          id: 'kuroshiro-user',
          locale: 'en',
        },
      },
      sensors: Object.fromEntries(sensors.map(sensor => [sensor.kind, { value: sensor.value, unit: sensor.unit }])),
    }
  }
}
