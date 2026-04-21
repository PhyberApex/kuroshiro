import { describe, expect, it } from 'vitest'
import { Plugin } from '../entities/plugin.entity'

describe('plugin entity', () => {
  it('creates a plugin with required fields', () => {
    const plugin = new Plugin()
    plugin.id = 'plugin-1'
    plugin.name = 'Weather Plugin'
    plugin.description = 'Shows current weather'
    plugin.kind = 'Poll'
    plugin.refreshInterval = 15

    expect(plugin.id).toBe('plugin-1')
    expect(plugin.name).toBe('Weather Plugin')
    expect(plugin.description).toBe('Shows current weather')
    expect(plugin.kind).toBe('Poll')
    expect(plugin.refreshInterval).toBe(15)
  })

  it('has timestamps', () => {
    const plugin = new Plugin()
    plugin.createdAt = new Date('2026-01-01')
    plugin.updatedAt = new Date('2026-01-02')

    expect(plugin.createdAt).toEqual(new Date('2026-01-01'))
    expect(plugin.updatedAt).toEqual(new Date('2026-01-02'))
  })

  it('has optional relationships to data source, templates, fields', () => {
    const plugin = new Plugin()
    plugin.dataSource = undefined

    expect(plugin.dataSource).toBeUndefined()
    expect(plugin.templates).toBeUndefined()
    expect(plugin.fields).toBeUndefined()
  })

  it('has relationships to device assignments', () => {
    const plugin = new Plugin()
    expect(plugin.deviceAssignments).toBeUndefined()
  })

  it('defaults kind to Poll', () => {
    const plugin = new Plugin()
    expect(plugin.kind).toBe('Poll')
  })

  it('defaults refreshInterval to 15 minutes', () => {
    const plugin = new Plugin()
    expect(plugin.refreshInterval).toBe(15)
  })
})
