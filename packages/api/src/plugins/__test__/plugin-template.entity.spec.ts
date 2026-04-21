import type { Plugin } from '../entities/plugin.entity'
import { describe, expect, it } from 'vitest'
import { PluginTemplate } from '../entities/plugin-template.entity'

describe('pluginTemplate entity', () => {
  it('creates a template with required fields', () => {
    const plugin = { id: 'plugin-1' } as Plugin

    const template = new PluginTemplate()
    template.id = 'template-1'
    template.plugin = plugin
    template.layout = 'full'
    template.liquidMarkup = '<div>{{ weather.temp }}</div>'

    expect(template.id).toBe('template-1')
    expect(template.plugin).toBe(plugin)
    template.layout = 'full'
    expect(template.liquidMarkup).toBe('<div>{{ weather.temp }}</div>')
  })

  it('supports full layout', () => {
    const template = new PluginTemplate()
    template.layout = 'full'

    expect(template.layout).toBe('full')
  })

  it('supports half_horizontal layout', () => {
    const template = new PluginTemplate()
    template.layout = 'half_horizontal'

    expect(template.layout).toBe('half_horizontal')
  })

  it('supports half_vertical layout', () => {
    const template = new PluginTemplate()
    template.layout = 'half_vertical'

    expect(template.layout).toBe('half_vertical')
  })

  it('supports quadrant layout', () => {
    const template = new PluginTemplate()
    template.layout = 'quadrant'

    expect(template.layout).toBe('quadrant')
  })

  it('tracks lastRenderedAt timestamp', () => {
    const template = new PluginTemplate()
    template.lastRenderedAt = new Date('2026-01-01T12:00:00Z')

    expect(template.lastRenderedAt).toEqual(new Date('2026-01-01T12:00:00Z'))
  })

  it('has optional lastRenderedAt', () => {
    const template = new PluginTemplate()

    expect(template.lastRenderedAt).toBeUndefined()
  })

  it('defaults layout to full', () => {
    const template = new PluginTemplate()
    expect(template.layout).toBe('full')
  })
})
