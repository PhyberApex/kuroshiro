import { describe, expect, it } from 'vitest'
import { makeDeviceSensor, makePlugin } from '../../test/fixtures.js'
import { createPluginTemplateContextService } from '../../test/mockPluginCollaborators.js'

describe('pluginTemplateContextService', () => {
  const plugin = makePlugin({ name: 'Weather' })

  it('includes the trmnl system object keyed by the plugin name', async () => {
    const context = await createPluginTemplateContextService().build(plugin, [])

    expect(context.trmnl.plugin_settings.instance_name).toBe('Weather')
    expect(context.trmnl.user).toEqual({ id: 'kuroshiro-user', locale: 'en' })
    expect(typeof context.trmnl.system.timestamp_utc).toBe('number')
  })

  it('shapes a sensors object keyed by kind for a device with readings across multiple kinds', async () => {
    const sensors = [
      makeDeviceSensor({ kind: 'temperature', value: 21.5, unit: 'C' }),
      makeDeviceSensor({ kind: 'humidity', value: 45, unit: '%' }),
    ]

    const context = await createPluginTemplateContextService().build(plugin, sensors)

    expect(context.sensors).toEqual({
      temperature: { value: 21.5, unit: 'C' },
      humidity: { value: 45, unit: '%' },
    })
  })

  it('produces an empty sensors object for a device with none', async () => {
    const context = await createPluginTemplateContextService().build(plugin, [])

    expect(context.sensors).toEqual({})
  })

  it('omits kinds the device has no current reading for', async () => {
    const sensors = [makeDeviceSensor({ kind: 'pressure', value: 1013, unit: 'hPa' })]

    const context = await createPluginTemplateContextService().build(plugin, sensors)

    expect(context.sensors).toEqual({ pressure: { value: 1013, unit: 'hPa' } })
    expect(context.sensors.temperature).toBeUndefined()
  })

  it('exposes the resolved Field Values as bare keys and under trmnl.plugin_settings.custom_fields_values', async () => {
    const context = await createPluginTemplateContextService({ city: 'Berlin' }).build(plugin, [])

    expect(context.city).toBe('Berlin')
    expect(context.trmnl.plugin_settings.custom_fields_values).toEqual({ city: 'Berlin' })
  })

  it('never lets a Field Value keyname replace trmnl or sensors', async () => {
    const context = await createPluginTemplateContextService({ trmnl: 'x', sensors: 'y' }).build(plugin, [])

    expect(context.trmnl.plugin_settings.instance_name).toBe('Weather')
    expect(context.sensors).toEqual({})
  })
})
