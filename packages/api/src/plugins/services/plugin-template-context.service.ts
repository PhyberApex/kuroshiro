import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable } from '@nestjs/common'
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

/**
 * The Liquid context every render of a Plugin starts from: its resolved Field
 * Values, both under `trmnl.plugin_settings.custom_fields_values` and as bare
 * root keys (ADR-0032), the `trmnl` system object, and an implicit `sensors`
 * object keyed by kind (ADR-0018) for whichever kinds the rendering Device
 * currently has a reading for. Callers spread a Plugin's Data Source data on
 * top, so that data wins over a bare Field Value key of the same name.
 */
@Injectable()
export class PluginTemplateContextService {
  constructor(private readonly fieldValues: PluginFieldValuesService) {}

  async build(plugin: Plugin, sensors: DeviceSensor[]): Promise<PluginTemplateContext> {
    return this.buildFrom(plugin.name, await this.fieldValues.resolveFor(plugin.id), sensors)
  }

  /** For a render of something that isn't saved (the preview), which brings its own Field Values. */
  buildFrom(instanceName: string, fieldValues: Record<string, string>, sensors: DeviceSensor[]): PluginTemplateContext {
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
