import { describe, expect, it } from 'vitest'
import { makeDevice, makePlugin, makePluginField } from '../../test/fixtures.js'
import { PluginFieldValue } from '../entities/plugin-field-value.entity.js'

describe('pluginFieldValue entity', () => {
  it('creates a field value with required fields', () => {
    const plugin = makePlugin({ id: 'plugin-1' })
    const field = makePluginField({ id: 'field-1' })
    const device = makeDevice({ id: 'device-1' })

    const fieldValue = new PluginFieldValue()
    fieldValue.id = 'value-1'
    fieldValue.plugin = plugin
    fieldValue.field = field
    fieldValue.value = 'abc123token'
    fieldValue.device = device

    expect(fieldValue.id).toBe('value-1')
    expect(fieldValue.plugin).toBe(plugin)
    expect(fieldValue.field).toBe(field)
    expect(fieldValue.value).toBe('abc123token')
    expect(fieldValue.device).toBe(device)
  })

  it('stores string values', () => {
    const fieldValue = new PluginFieldValue()
    fieldValue.value = 'Tokyo'

    expect(fieldValue.value).toBe('Tokyo')
  })

  it('has optional device for device-specific values', () => {
    const fieldValue = new PluginFieldValue()

    expect(fieldValue.device).toBeUndefined()
  })

  it('allows same field to have different values per device', () => {
    const plugin = makePlugin({ id: 'plugin-1' })
    const field = makePluginField({ id: 'location' })
    const device1 = makeDevice({ id: 'device-1' })
    const device2 = makeDevice({ id: 'device-2' })

    const value1 = new PluginFieldValue()
    value1.plugin = plugin
    value1.field = field
    value1.device = device1
    value1.value = 'Tokyo'

    const value2 = new PluginFieldValue()
    value2.plugin = plugin
    value2.field = field
    value2.device = device2
    value2.value = 'London'

    expect(value1.value).toBe('Tokyo')
    expect(value2.value).toBe('London')
    expect(value1.device).toBe(device1)
    expect(value2.device).toBe(device2)
  })
})
