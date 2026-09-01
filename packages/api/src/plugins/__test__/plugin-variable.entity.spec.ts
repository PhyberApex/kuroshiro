import { describe, expect, it } from 'vitest'
import { PluginVariable } from '../entities/plugin-variable.entity.js'

describe('plugin-variable entity', () => {
  it('creates plugin variable with key and value', () => {
    const variable = new PluginVariable()
    variable.id = 'var-1'
    variable.key = 'API_KEY'
    variable.value = 'secret-123'

    expect(variable.id).toBe('var-1')
    expect(variable.key).toBe('API_KEY')
    expect(variable.value).toBe('secret-123')
  })

  it('has relationship to plugin', () => {
    const variable = new PluginVariable()
    expect(variable.plugin).toBeUndefined()
  })

  it('has an isSecret flag', () => {
    const variable = new PluginVariable()
    variable.isSecret = true

    expect(variable.isSecret).toBe(true)
  })
})
