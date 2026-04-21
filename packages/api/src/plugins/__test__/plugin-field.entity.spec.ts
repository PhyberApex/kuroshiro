import type { Plugin } from '../entities/plugin.entity'
import { describe, expect, it } from 'vitest'
import { PluginField } from '../entities/plugin-field.entity'

describe('pluginField entity', () => {
  it('creates a field with required fields', () => {
    const plugin = { id: 'plugin-1' } as Plugin

    const field = new PluginField()
    field.id = 'field-1'
    field.plugin = plugin
    field.keyname = 'api_key'
    field.fieldType = 'password'
    field.name = 'API Key'
    field.description = 'Your API key from the service'
    field.required = true
    field.order = 1

    expect(field.id).toBe('field-1')
    expect(field.plugin).toBe(plugin)
    expect(field.keyname).toBe('api_key')
    expect(field.fieldType).toBe('password')
    expect(field.name).toBe('API Key')
    expect(field.description).toBe('Your API key from the service')
    expect(field.required).toBe(true)
    expect(field.order).toBe(1)
  })

  it('supports string field type', () => {
    const field = new PluginField()
    field.fieldType = 'string'

    expect(field.fieldType).toBe('string')
  })

  it('supports password field type', () => {
    const field = new PluginField()
    field.fieldType = 'password'

    expect(field.fieldType).toBe('password')
  })

  it('supports url field type', () => {
    const field = new PluginField()
    field.fieldType = 'url'

    expect(field.fieldType).toBe('url')
  })

  it('supports select field type', () => {
    const field = new PluginField()
    field.fieldType = 'select'

    expect(field.fieldType).toBe('select')
  })

  it('supports boolean field type', () => {
    const field = new PluginField()
    field.fieldType = 'boolean'

    expect(field.fieldType).toBe('boolean')
  })

  it('has optional defaultValue', () => {
    const field = new PluginField()
    field.defaultValue = 'Tokyo'

    expect(field.defaultValue).toBe('Tokyo')
  })

  it('has optional description', () => {
    const field = new PluginField()

    expect(field.description).toBeUndefined()
  })

  it('defaults required to false', () => {
    const field = new PluginField()
    expect(field.required).toBe(false)
  })

  it('defaults order to 0', () => {
    const field = new PluginField()
    expect(field.order).toBe(0)
  })

  it('defaults fieldType to string', () => {
    const field = new PluginField()
    expect(field.fieldType).toBe('string')
  })
})
