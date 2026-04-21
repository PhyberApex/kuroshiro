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

  it('handles filters in templates', async () => {
    const template = '{{ title | capitalize }}'
    const data = { title: 'hello world' }

    const result = await service.render(template, data)

    expect(result).toBe('Hello world')
  })

  it('renders complex templates with multiple features', async () => {
    const template = `
      {% if items.size > 0 %}
        <ul>
        {% for item in items %}
          <li>{{ item.name | upcase }} - {{ item.price }}</li>
        {% endfor %}
        </ul>
      {% else %}
        <p>No items</p>
      {% endif %}
    `
    const data = {
      items: [
        { name: 'apple', price: '$1' },
        { name: 'banana', price: '$2' },
      ],
    }

    const result = await service.render(template, data)

    expect(result).toContain('APPLE')
    expect(result).toContain('BANANA')
    expect(result).toContain('$1')
    expect(result).toContain('$2')
  })

  it('handles empty data', async () => {
    const template = '<div>Static content</div>'

    const result = await service.render(template, {})

    expect(result).toBe('<div>Static content</div>')
  })

  describe('custom filters', () => {
    it('date_short formats dates', async () => {
      const template = '{{ date | date_short }}'
      const data = { date: '2026-04-21' }

      const result = await service.render(template, data)

      expect(result).toContain('Apr')
      expect(result).toContain('21')
    })

    it('date_long formats dates', async () => {
      const template = '{{ date | date_long }}'
      const data = { date: '2026-04-21' }

      const result = await service.render(template, data)

      expect(result).toContain('Tuesday')
      expect(result).toContain('April')
      expect(result).toContain('21')
      expect(result).toContain('2026')
    })

    it('time_short formats time', async () => {
      const template = '{{ date | time_short }}'
      const data = { date: '2026-04-21T10:30:00' }

      const result = await service.render(template, data)

      expect(result).toContain('10:30')
    })

    it('number_with_delimiter formats numbers', async () => {
      const template = '{{ num | number_with_delimiter }}'
      const data = { num: 1234567 }

      const result = await service.render(template, data)

      expect(result).toBe('1,234,567')
    })

    it('round formats numbers with precision', async () => {
      const template = '{{ num | round: 2 }}'
      const data = { num: 3.14159 }

      const result = await service.render(template, data)

      expect(result).toBe('3.14')
    })

    it('truncate_words truncates text', async () => {
      const template = '{{ text | truncate_words: 3 }}'
      const data = { text: 'one two three four five' }

      const result = await service.render(template, data)

      expect(result).toBe('one two three...')
    })

    it('titleize capitalizes words', async () => {
      const template = '{{ text | titleize }}'
      const data = { text: 'hello world' }

      const result = await service.render(template, data)

      expect(result).toBe('Hello World')
    })

    it('shuffle randomizes array', async () => {
      const template = '{{ items | shuffle | join: "," }}'
      const data = { items: [1, 2, 3, 4, 5] }

      const result = await service.render(template, data)

      expect(result.split(',').sort().join(',')).toBe('1,2,3,4,5')
    })

    it('sample picks random item', async () => {
      const template = '{{ items | sample }}'
      const data = { items: [1, 2, 3] }

      const result = await service.render(template, data)

      expect(['1', '2', '3']).toContain(result)
    })

    it('yesno converts boolean to text', async () => {
      const template = '{{ flag | yesno }}'
      const data = { flag: true }

      const result = await service.render(template, data)

      expect(result).toBe('Yes')
    })

    it('yesno with custom values', async () => {
      const template = '{{ flag | yesno: "✓", "✗" }}'
      const data = { flag: false }

      const result = await service.render(template, data)

      expect(result).toBe('✗')
    })

    it('json serializes objects', async () => {
      const template = '{{ obj | json }}'
      const data = { obj: { key: 'value' } }

      const result = await service.render(template, data)

      expect(result).toBe('{"key":"value"}')
    })

    it('url_encode encodes URLs', async () => {
      const template = '{{ url | url_encode }}'
      const data = { url: 'hello world' }

      const result = await service.render(template, data)

      expect(result).toBe('hello%20world')
    })

    it('url_decode decodes URLs', async () => {
      const template = '{{ url | url_decode }}'
      const data = { url: 'hello%20world' }

      const result = await service.render(template, data)

      expect(result).toBe('hello world')
    })
  })
})
