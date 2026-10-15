import { describe, expect, it } from 'vitest'
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

  it('url_encode encodes URLs', async () => {
    const template = '{{ url | url_encode }}'
    const data = { url: 'hello world' }

    const result = await renderLiquid(template, data)

    expect(result).toBe('hello%20world')
  })

  it('url_decode decodes URLs', async () => {
    const template = '{{ url | url_decode }}'
    const data = { url: 'hello%20world' }

    const result = await renderLiquid(template, data)

    expect(result).toBe('hello world')
  })

  it('registers a fresh engine with the same filters', async () => {
    const result = await createLiquidEngine().parseAndRender('{{ n | round: 1 }}', { n: 2.25 })

    expect(result).toBe('2.3')
  })

  it('names the thirteen filters', () => {
    expect(KUROSHIRO_FILTERS).toHaveLength(13)
    expect(KUROSHIRO_FILTERS).toContain('truncate_words')
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

describe('rendering in a given time zone', () => {
  const instant = { at: '2030-01-05T09:00:00Z' }

  it('renders date in the zone it is given', async () => {
    expect(await renderLiquid('{{ at | date: "%H:%M %z" }}', instant, { timeZone: 'Asia/Tokyo' })).toBe('18:00 +0900')
  })

  it('renders date_short, date_long and time_short in the zone it is given', async () => {
    const late = { at: '2030-01-05T20:30:00Z' }
    expect(await renderLiquid('{{ at | date_short }}', late, { timeZone: 'Asia/Tokyo' })).toBe('Jan 6')
    expect(await renderLiquid('{{ at | date_long }}', late, { timeZone: 'Asia/Tokyo' })).toContain('Sunday, January 6')
    expect(await renderLiquid('{{ at | time_short }}', late, { timeZone: 'Asia/Tokyo' })).toMatch(/^5:30\sAM$/)
  })

  it('renders a zone other than the one before it', async () => {
    expect(await renderLiquid('{{ at | date: "%H:%M" }}', instant, { timeZone: 'America/New_York' })).toBe('04:00')
    expect(await renderLiquid('{{ at | date: "%H:%M" }}', instant, { timeZone: 'Asia/Tokyo' })).toBe('18:00')
  })

  it('renders a Template with no date filter the same with and without a zone', async () => {
    const markup = '<p>{{ n | plus: 1 }} {{ s | upcase }}</p>'
    const data = { n: 1, s: 'x' }
    expect(await renderLiquid(markup, data, { timeZone: 'Asia/Tokyo' })).toBe(await renderLiquid(markup, data))
  })

  it('keeps the process zone when none is given', async () => {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(await renderLiquid('{{ at | date: "%H:%M" }}', instant)).toBe(await renderLiquid('{{ at | date: "%H:%M" }}', instant, { timeZone: zone }))
  })
})
