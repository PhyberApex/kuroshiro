import { describe, expect, it } from 'vitest'
import { PluginVariable } from '../entities/plugin-variable.entity'

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

  it('has relationship to device plugin', () => {
    const variable = new PluginVariable()
    expect(variable.devicePlugin).toBeUndefined()
  })

  it('has timestamps', () => {
    const variable = new PluginVariable()
    variable.createdAt = new Date('2026-01-01')
    variable.updatedAt = new Date('2026-01-02')

    expect(variable.createdAt).toEqual(new Date('2026-01-01'))
    expect(variable.updatedAt).toEqual(new Date('2026-01-02'))
  })
})
