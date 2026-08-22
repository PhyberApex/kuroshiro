import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity'
import type { Plugin } from '../entities/plugin.entity'
import { Injectable } from '@nestjs/common'

export interface PluginTemplateContext {
  trmnl: {
    system: { timestamp_utc: number }
    plugin_settings: { instance_name: string, strategy: 'polling', dark_mode: 'no' | 'yes', no_screen_padding: 'no' | 'yes' }
    user: { id: string, locale: string }
  }
  sensors: Record<string, { value: number, unit: string }>
}

/**
 * Base Liquid template context: the `trmnl` system object plus an implicit
 * `sensors` object keyed by kind (ADR-0018) for whichever kinds the rendering
 * Device currently has a reading for. Callers merge a Plugin's fetched Data
 * Source `data` on top of this at the render call.
 */
@Injectable()
export class PluginTemplateContextService {
  build(plugin: Plugin, sensors: DeviceSensor[]): PluginTemplateContext {
    return {
      trmnl: {
        system: {
          timestamp_utc: Math.floor(Date.now() / 1000),
        },
        plugin_settings: {
          instance_name: plugin.name,
          strategy: 'polling',
          dark_mode: 'no',
          no_screen_padding: 'no',
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
