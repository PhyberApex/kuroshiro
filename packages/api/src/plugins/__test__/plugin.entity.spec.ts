import type { Device } from '../../devices/devices.entity'
import { describe, expect, it } from 'vitest'
import { Plugin } from '../entities/plugin.entity'

describe('plugin entity', () => {
  it('creates a plugin with required fields', () => {
    const device = { id: 'device-1' } as Device

    const plugin = new Plugin()
    plugin.id = 'plugin-1'
    plugin.name = 'Weather Plugin'
    plugin.description = 'Shows current weather'
    plugin.kind = 'Poll'
    plugin.device = device
    plugin.refreshInterval = 15
    plugin.isActive = true
    plugin.order = 1

    expect(plugin.id).toBe('plugin-1')
    expect(plugin.name).toBe('Weather Plugin')
    expect(plugin.description).toBe('Shows current weather')
    expect(plugin.kind).toBe('Poll')
    expect(plugin.device).toBe(device)
    expect(plugin.refreshInterval).toBe(15)
    expect(plugin.isActive).toBe(true)
    expect(plugin.order).toBe(1)
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

  it('defaults isActive to true', () => {
    const plugin = new Plugin()
    expect(plugin.isActive).toBe(true)
  })

  it('defaults order to 0', () => {
    const plugin = new Plugin()
    expect(plugin.order).toBe(0)
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
