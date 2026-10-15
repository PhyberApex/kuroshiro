import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('names the filters Kuroshiro adds, and none it merely corrects', () => {
    expect(KUROSHIRO_FILTERS).toHaveLength(22)
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

describe('trmnl custom filters', () => {
  const render = (markup: string, context: object = {}) => renderLiquid(markup, context)

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('parse_json parses a nested JSON string and leaves other text alone', async () => {
    expect(await render('{% assign parsed = data.stuff | parse_json %}{{ parsed.num }}', { data: { stuff: '{"num":5}' } })).toBe('5')
    expect(await render('{{ "not json" | parse_json }}')).toBe('not json')
  })

  it('find_by finds the first match and falls back when nothing matches', async () => {
    const people = [{ name: 'Ryan', age: 35 }, { name: 'Sara', age: 29 }]
    expect(await render('{{ people | find_by: "name", "Ryan" | json }}', { people })).toBe('{"name":"Ryan","age":35}')
    expect(await render('{{ people | find_by: "name", "Toby", "Not Found" }}', { people })).toBe('Not Found')
    expect(await render('{{ objs | find_by: "ok", true | json }}', { objs: [{ ok: false }, { ok: true }] })).toBe('{"ok":true}')
  })

  it('number_with_delimiter honours its delimiter and separator', async () => {
    expect(await render('{{ 1234 | number_with_delimiter }}')).toBe('1,234')
    expect(await render('{{ 1234 | number_with_delimiter: "." }}')).toBe('1.234')
    expect(await render('{{ 1000000 | number_with_delimiter: " " }}')).toBe('1 000 000')
    expect(await render('{{ 1234.57 | number_with_delimiter: " ", "," }}')).toBe('1 234,57')
  })

  it('number_to_currency takes a unit, a locale, a delimiter and a separator', async () => {
    expect(await render('{{ 10420 | number_to_currency }}')).toBe('$10,420.00')
    expect(await render('{{ 10 | number_to_currency }}')).toBe('$10.00')
    expect(await render('{{ 152350.69 | number_to_currency: "£" }}')).toBe('£152,350.69')
    expect(await render('{{ 1234.57 | number_to_currency: "£", ".", "," }}')).toBe('£1.234,57')
    expect(await render('{{ 1234.57 | number_to_currency: "sv" }}')).toBe('1234.57 kr')
    expect(await render('{{ 1234.57 | number_to_currency: "sv", ".", "," }}')).toBe('1.234,57 kr')
    expect(await render('{{ 1234.57 | number_to_currency: "en-GB" }}')).toBe('£1234.57')
    expect(await render('{{ 1234.57 | number_to_currency: "CHF " }}')).toBe('CHF 1,234.57')
  })

  it('pluralize puts the count in front and inflects the word', async () => {
    expect(await render('{{ "book" | pluralize: 1 }}')).toBe('1 book')
    expect(await render('{{ "book" | pluralize: 2 }}')).toBe('2 books')
    expect(await render('{{ "octopus" | pluralize: 3 }}')).toBe('3 octopi')
    expect(await render('{{ "person" | pluralize: 4 }}')).toBe('4 people')
    expect(await render('{{ "city" | pluralize: 2 }}, {{ "box" | pluralize: 2 }}, {{ "church" | pluralize: 2 }}, {{ "wolf" | pluralize: 2 }}'))
      .toBe('2 cities, 2 boxes, 2 churches, 2 wolves')
  })

  it('markdown_to_html renders Markdown', async () => {
    expect(await render('{{ "*x*" | markdown_to_html }}')).toBe('<p><em>x</em></p>')
    expect(await render('{{ "This is *crazy* and [a link](https://somewhere.com)." | markdown_to_html | strip_html }}'))
      .toBe('This is crazy and a link.')
  })

  it('days_ago is the date that many days before now', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-10-10T12:00:00Z'))
    expect(await render('{{ 7 | days_ago }}')).toBe('2025-10-03')
  })

  it('ordinalize substitutes the ordinal day into the strftime format', async () => {
    expect(await render('{{ "2025-10-02" | ordinalize: "%A, %B <<ordinal_day>>, %Y" }}')).toBe('Thursday, October 2nd, 2025')
    expect(await render('{{ "2025-10-02" | ordinalize: "%b <<ordinal_day>>" }}')).toBe('Oct 2nd')
    expect(await render('{{ "2025-12-31 16:50:38 -0400" | ordinalize: "%A, %b <<ordinal_day>>" }}')).toBe('Wednesday, Dec 31st')
    expect(await render('{{ "2025-10-11" | ordinalize: "<<ordinal_day>>" }}, {{ "2025-10-23" | ordinalize: "<<ordinal_day>>" }}')).toBe('11th, 23rd')
  })

  it('append_random gives one suffix per input within a render and another in the next', async () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.05, 0.15]
    vi.spyOn(Math, 'random').mockImplementation(() => values.shift() ?? 0)
    const markup = '{{ "chart-" | append_random }}|{{ "chart-" | append_random }}|{{ "map-" | append_random }}'
    const [first, again, other] = (await render(markup)).split('|')
    expect(first).toMatch(/^chart-[a-z0-9]{4}$/)
    expect(again).toBe(first)
    expect(other).not.toBe(first)
    expect((await render('{{ "chart-" | append_random }}'))).not.toBe(first)
  })

  it('random_number is an inclusive integer', async () => {
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValue(0.999999)
    expect(await render('{{ 0 | random_number: 1, 10 }}')).toBe('10')
    expect(await render('{{ 0 | random_number }}')).toBe('100')
    expect(await render('{{ "" | random_number: 5 }}')).toBe('5')
    random.mockReturnValue(0)
    expect(await render('{{ 0 | random_number: 1, 10 }}')).toBe('1')
    expect(await render('{{ "" | random_number: 5 }}')).toBe('0')
  })

  it('l_date localizes month and weekday names', async () => {
    expect(await render('{{ "2025-01-11" | l_date: "%y %b" }}')).toBe('25 Jan')
    expect(await render('{{ "2025-01-11" | l_date: "%y %b", "ko" }}')).toBe('25 1월')
    expect(await render('{{ "2025-01-11" | l_date: "%A", "de" }}')).toBe('Samstag')
  })

  it('l_word translates common words and falls back to the input', async () => {
    expect(await render('{{ "today" | l_word: "es-ES" }}')).toBe('hoy')
    expect(await render('{{ "tomorrow" | l_word: "ko" }}')).toBe('내일')
    expect(await render('{{ "monday" | l_word: "fr" }}')).toBe('lundi')
    expect(await render('{{ "banana" | l_word: "de" }}')).toBe('banana')
  })

  it('qr_code is one inline svg that scales unless fixed', async () => {
    const scaling = await render('{{ "x" | qr_code }}')
    expect(scaling).toContain('<svg')
    expect(scaling).toContain('class="qr-code"')
    expect(scaling).toContain('width="100%"')
    const fixed = await render('{{ "https://somewhere.com" | qr_code: 18, "", "fixed" }}')
    expect(fixed).toMatch(/width="\d+" height="\d+"/)
    expect(fixed.match(/<svg/g)).toHaveLength(1)
  })

  it('lists every added filter for completion', () => {
    expect(KUROSHIRO_FILTERS).toEqual(expect.arrayContaining([
      'parse_json',
      'find_by',
      'number_to_currency',
      'pluralize',
      'markdown_to_html',
      'days_ago',
      'ordinalize',
      'append_random',
      'random_number',
      'l_date',
      'l_word',
      'qr_code',
    ]))
  })
})
