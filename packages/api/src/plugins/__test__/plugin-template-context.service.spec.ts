import { beforeEach, describe, expect, it } from 'vitest'
import { makeDeviceSensor, makePlugin } from '../../test/fixtures'
import { PluginTemplateContextService } from '../services/plugin-template-context.service'

describe('pluginTemplateContextService', () => {
  let service: PluginTemplateContextService

  const plugin = makePlugin({ name: 'Weather' })

  beforeEach(() => {
    service = new PluginTemplateContextService()
  })

  it('includes the trmnl system object keyed by the plugin name', () => {
    const context = service.build(plugin, [])

    expect(context.trmnl.plugin_settings.instance_name).toBe('Weather')
    expect(context.trmnl.user).toEqual({ id: 'kuroshiro-user', locale: 'en' })
    expect(typeof context.trmnl.system.timestamp_utc).toBe('number')
  })

  it('shapes a sensors object keyed by kind for a device with readings across multiple kinds', () => {
    const sensors = [
      makeDeviceSensor({ kind: 'temperature', value: 21.5, unit: 'C' }),
      makeDeviceSensor({ kind: 'humidity', value: 45, unit: '%' }),
    ]

    const context = service.build(plugin, sensors)

    expect(context.sensors).toEqual({
      temperature: { value: 21.5, unit: 'C' },
      humidity: { value: 45, unit: '%' },
    })
  })

  it('produces an empty sensors object for a device with none', () => {
    const context = service.build(plugin, [])

    expect(context.sensors).toEqual({})
  })

  it('omits kinds the device has no current reading for', () => {
    const sensors = [makeDeviceSensor({ kind: 'pressure', value: 1013, unit: 'hPa' })]

    const context = service.build(plugin, sensors)

    expect(context.sensors).toEqual({ pressure: { value: 1013, unit: 'hPa' } })
    expect(context.sensors.temperature).toBeUndefined()
  })
})
