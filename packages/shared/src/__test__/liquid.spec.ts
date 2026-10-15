import { describe, expect, it, vi } from 'vitest'
import { checkTemplate, createLiquidEngine, KUROSHIRO_FILTERS, renderLiquid, templateProblemOf } from '../liquid.ts'

describe('kuroshiro liquid filters', () => {
  it('date_short formats dates', async () => {
    const template = '{{ date | date_short }}'
    const data = { date: '2026-04-21' }

    const result = await renderLiquid(template, data)

    expect(result).toContain('Apr')
    expect(result).toContain('21')
  })

  it('date_long formats dates', async () => {
    const template = '{{ date | date_long }}'
    const data = { date: '2026-04-21' }

    const result = await renderLiquid(template, data)

    expect(result).toContain('Tuesday')
    expect(result).toContain('April')
    expect(result).toContain('21')
    expect(result).toContain('2026')
  })

  it('time_short formats time', async () => {
    const template = '{{ date | time_short }}'
    const data = { date: '2026-04-21T10:30:00' }

    const result = await renderLiquid(template, data)

    expect(result).toContain('10:30')
  })

  it('number_with_delimiter formats numbers', async () => {
    const template = '{{ num | number_with_delimiter }}'
    const data = { num: 1234567 }

    const result = await renderLiquid(template, data)

    expect(result).toBe('1,234,567')
  })

  it('round formats numbers with precision', async () => {
    const template = '{{ num | round: 2 }}'
    const data = { num: 3.14159 }

    const result = await renderLiquid(template, data)

    expect(result).toBe('3.14')
  })

  it('truncate_words truncates text', async () => {
    const template = '{{ text | truncate_words: 3 }}'
    const data = { text: 'one two three four five' }

    const result = await renderLiquid(template, data)

    expect(result).toBe('one two three...')
  })

  it('titleize capitalizes words', async () => {
    const template = '{{ text | titleize }}'
    const data = { text: 'hello world' }

    const result = await renderLiquid(template, data)

    expect(result).toBe('Hello World')
  })

  it('shuffle randomizes array', async () => {
    const template = '{{ items | shuffle | join: "," }}'
    const data = { items: [1, 2, 3, 4, 5] }

    const result = await renderLiquid(template, data)

    expect(result.split(',').sort().join(',')).toBe('1,2,3,4,5')
  })

  it('sample picks random item', async () => {
    const template = '{{ items | sample }}'
    const data = { items: [1, 2, 3] }

    const result = await renderLiquid(template, data)

    expect(['1', '2', '3']).toContain(result)
  })

  it('yesno converts boolean to text', async () => {
    const template = '{{ flag | yesno }}'
    const data = { flag: true }

    const result = await renderLiquid(template, data)

    expect(result).toBe('Yes')
  })

  it('yesno with custom values', async () => {
    const template = '{{ flag | yesno: "✓", "✗" }}'
    const data = { flag: false }

    const result = await renderLiquid(template, data)

    expect(result).toBe('✗')
  })

  it('json serializes objects', async () => {
    const template = '{{ obj | json }}'
    const data = { obj: { key: 'value' } }

    const result = await renderLiquid(template, data)

    expect(result).toBe('{"key":"value"}')
  })

  it('registers a fresh engine with the same filters', async () => {
    const result = await createLiquidEngine().parseAndRender('{{ n | round: 1 }}', { n: 2.25 })

    expect(result).toBe('2.3')
  })

  it('names the ten filters Kuroshiro adds, and none it merely corrects', () => {
    expect(KUROSHIRO_FILTERS).toHaveLength(10)
    expect(KUROSHIRO_FILTERS).toContain('truncate_words')
    for (const standard of ['divided_by', 'round', 'url_encode', 'url_decode'])
      expect(KUROSHIRO_FILTERS).not.toContain(standard)
  })
})

describe('standard filters follow Ruby Liquid (ADR-0043)', () => {
  it.each([
    ['{{ 10 | divided_by: 3 }}', '3'],
    ['{{ 10 | divided_by: 3.0 }}', '3.3333333333333335'],
    ['{{ 10.5 | divided_by: 3 }}', '3.5'],
    ['{{ "10" | divided_by: 3 }}', '3'],
    ['{{ "10" | divided_by: "3.0" }}', '3.3333333333333335'],
    ['{{ -7 | divided_by: 2 }}', '-4'],
    ['{{ 7 | divided_by: 2 | plus: 1 }}', '4'],
    ['{{ 1893456000 | minus: 1792093470 | divided_by: 86400 }}', '1173'],
    ['{{ 1 | divided_by: 0 }}', 'Infinity'],
    ['{{ 3.14159 | round: 2 }}', '3.14'],
    ['{{ 3.7 | round }}', '4'],
    ['{{ "abc" | round }}', '0'],
    ['{{ 3.7 | round | plus: 1 }}', '5'],
    ['{{ "a b&c" | url_encode }}', 'a+b%26c'],
    ['{{ "a+b%26c" | url_decode }}', 'a b&c'],
    ['{{ "100%" | url_decode }}', '100%'],
    ['{{ nil | truncate_words: 2 }}', ''],
    ['{{ nil | titleize }}', ''],
    ['{{ nil | date_short }}', ''],
    ['{{ nil | date_long }}', ''],
    ['{{ nil | time_short }}', ''],
    ['{{ 5 | date_short }}', ''],
    ['{{ "garbage" | date_short }}', ''],
  ])('%s renders %j', async (markup, expected) => {
    expect(await renderLiquid(markup, {})).toBe(expected)
  })

  it('renders the Countdown recipe\'s day count as whole days', async () => {
    vi.useFakeTimers({ now: 1792093470 * 1000 })
    try {
      const markup = `{% assign target_seconds = countdown.targetDate | date: '%s' %}
{% assign now_seconds = 'now' | date: '%s' %}
{% assign days_left = target_seconds | minus: now_seconds | divided_by: 86400 %}{{ days_left }}`
      const result = await renderLiquid(markup, { countdown: { targetDate: '2030-01-01T00:00:00Z' } })

      expect(result.trim()).toBe('1173')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ['{{ 5 | plus: "3" }}', '8'],
    ['{{ -7 | modulo: 3 }}', '2'],
    ['{{ "abc" | capitalize }}', 'Abc'],
    ['{{ 2 | times: "3" }}', '6'],
  ])('%s still renders %j', async (markup, expected) => {
    expect(await renderLiquid(markup, {})).toBe(expected)
  })
})

describe('checkTemplate', () => {
  const starter = `<div class="layout layout--col layout--center">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`

  it('accepts the starter template', () => {
    expect(checkTemplate(starter)).toBeNull()
  })

  it('names the line of an unclosed if', () => {
    const problem = checkTemplate('<div>\n</div>\n{% if a %}\nbody')

    expect(problem?.line).toBe(3)
    expect(problem?.message).not.toMatch(/line:\d+/)
  })

  it.each(['', '  \n\t '])('refuses the empty template %j', (markup) => {
    expect(checkTemplate(markup)).toEqual({ message: 'A template cannot be empty.', line: null })
  })
})

describe('templateProblemOf', () => {
  it('reads message and line from a render-time error', async () => {
    const strict = createLiquidEngine()
    strict.options.strictFilters = true
    const error = await strict.parseAndRender('a\n{{ x | nope }}', {}).catch((e: unknown) => e)

    expect(templateProblemOf(error)).toEqual({ message: 'undefined filter: nope', line: 2 })
  })

  it('reads the line of a tag that fails at render', async () => {
    const error = await renderLiquid('a\n{% render "zz" %}', {}).catch((e: unknown) => e)

    expect(templateProblemOf(error).line).toBe(2)
  })

  it('looks a partial up nowhere, on the server\'s disk as little as over the browser\'s network', async () => {
    const error = await renderLiquid('{% render "package.json" %}', {}).catch((e: unknown) => e)

    expect(templateProblemOf(error)).toEqual({ message: 'A template cannot render "package.json": Kuroshiro has no partials.', line: 1 })
  })

  it('answers no line for an error without a position', () => {
    expect(templateProblemOf(new Error('boom'))).toEqual({ message: 'boom', line: null })
  })
})
