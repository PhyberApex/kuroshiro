import { beforeEach, describe, expect, it } from 'vitest'
import { PluginRendererService } from '../services/plugin-renderer.service'

describe('pluginRendererService', () => {
  let service: PluginRendererService

  beforeEach(() => {
    service = new PluginRendererService()
  })

  it('renders a simple liquid template with data', async () => {
    const template = '<div>Temperature: {{ temperature }}°C</div>'
    const data = { temperature: 25 }

    const result = await service.render(template, data)

    expect(result).toBe('<div>Temperature: 25°C</div>')
  })

  it('renders template with conditionals', async () => {
    const template = '{% if condition == "sunny" %}☀️{% else %}🌧️{% endif %}'
    const data = { condition: 'sunny' }

    const result = await service.render(template, data)

    expect(result).toBe('☀️')
  })

  it('renders template with loops', async () => {
    const template = '{% for item in items %}{{ item }},{% endfor %}'
    const data = { items: ['a', 'b', 'c'] }

    const result = await service.render(template, data)

    expect(result).toBe('a,b,c,')
  })

  it('renders nested objects', async () => {
    const template = '{{ weather.temp }}°C in {{ weather.location }}'
    const data = { weather: { temp: 20, location: 'Tokyo' } }

    const result = await service.render(template, data)

    expect(result).toBe('20°C in Tokyo')
  })

  it('renders arrays with nested objects', async () => {
    const template = '{% for service in services %}{{ service.name }}: {{ service.time }}{% unless forloop.last %}, {% endunless %}{% endfor %}'
    const data = {
      services: [
        { name: 'Train A', time: '10:30' },
        { name: 'Train B', time: '10:45' },
      ],
    }

    const result = await service.render(template, data)

    expect(result).toBe('Train A: 10:30, Train B: 10:45')
  })

  it('handles missing data gracefully', async () => {
    const template = '{{ missing }}'
    const data = {}

    const result = await service.render(template, data)

    expect(result).toBe('')
  })

  it('wraps rendered content in TRMNL framework', async () => {
    const template = '<div>Test</div>'
    const data = {}

    const result = await service.renderForDisplay(template, data)

    expect(result).toContain('https://usetrmnl.com/css/latest/plugins.css')
    expect(result).toContain('https://usetrmnl.com/js/latest/plugins.js')
    expect(result).toContain('<div>Test</div>')
    expect(result).toContain('class="environment trmnl"')
  })
})
