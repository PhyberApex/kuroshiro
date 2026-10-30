import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkTemplate, createLiquidEngine, KUROSHIRO_FILTERS, renderLiquid, templateProblemOf, TRMNL_FILTERS } from '../liquid.ts'

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

  it('json renders a missing value as null, as Ruby\'s to_json does', async () => {
    expect(await renderLiquid('var items = {{ data.items | json }};', { data: {} })).toBe('var items = null;')
    expect(await renderLiquid('{{ nil | json }}', {})).toBe('null')
  })

  it('registers a fresh engine with the same filters', async () => {
    const result = await createLiquidEngine().parseAndRender('{{ n | round: 1 }}', { n: 2.25 })

    expect(result).toBe('2.3')
  })

  it('names the filters Kuroshiro alone adds, apart from TRMNL\'s and from the corrections', () => {
    expect(KUROSHIRO_FILTERS).toEqual(['date_short', 'date_long', 'time_short', 'truncate_words', 'titleize', 'shuffle', 'yesno'])
    expect(KUROSHIRO_FILTERS.filter(name => TRMNL_FILTERS.includes(name))).toEqual([])
    for (const standard of ['divided_by', 'round', 'url_encode', 'url_decode']) {
      expect(KUROSHIRO_FILTERS).not.toContain(standard)
      expect(TRMNL_FILTERS).not.toContain(standard)
    }
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

describe('templates a Template defines itself', () => {
  const render = (markup: string, context: object = {}) => renderLiquid(markup, context)
  const problemOf = (markup: string, context: object = {}) => render(markup, context).then(() => null, templateProblemOf)

  it('renders a template it defined, with the arguments it is given, and draws nothing where it is defined', async () => {
    const markup = 'a{% template greeting %}Hello, {{ name }}{% endtemplate %}b{% render "greeting", name: "world" %}'

    expect(await render(markup, {})).toBe('abHello, world')
  })

  it('gives a template only its arguments, not what the Template around it reads', async () => {
    const markup = '{% template t %}[{{ name }}|{{ given }}]{% endtemplate %}{% render "t", given: name %}'

    expect(await render(markup, { name: 'Seneca' })).toBe('[|Seneca]')
  })

  it('lets a template render another, and the same one again', async () => {
    const markup = [
      '{% template item %}<li>{{ label }}</li>{% endtemplate %}',
      '{% template list %}<ul>{% for label in labels %}{% render "item", label: label %}{% endfor %}</ul>{% endtemplate %}',
      '{%- render "list", labels: labels -%}',
    ].join('\n')

    expect(await render(markup, { labels: ['x', 'y'] })).toBe('\n<ul><li>x</li><li>y</li></ul>')
  })

  it('reads the single-quoted name and the whitespace-trimming form', async () => {
    expect(await render('{%- template t -%}T{%- endtemplate -%}{%- render \'t\' -%}', {})).toBe('T')
  })

  it('refuses a template name holding anything but letters, numbers, underscores and slashes', async () => {
    expect(await problemOf('{% template Danger! %}x{% endtemplate %}')).toEqual({ message: 'A template\'s name may hold only letters, numbers, underscores and slashes: "Danger!".', line: 1 })
  })

  it('still renders no partial it did not define, so nothing is read from disk or the network', async () => {
    expect(await problemOf('{% template t %}x{% endtemplate %}\n{% render "package.json" %}')).toEqual({ message: 'A template cannot render "package.json": Kuroshiro has no partials.', line: 2 })
  })

  it('names the template left open', () => {
    expect(checkTemplate('{% template t %}x')).toEqual({ message: 'tag {% template t %} not closed', line: 1 })
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

describe('trmnl custom filters (ADR-0043, after the trmnl-liquid gem)', () => {
  const render = (markup: string, context: object = {}) => renderLiquid(markup, context)

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('parse_json parses a JSON string', async () => {
    expect(await render('{% assign parsed = data.stuff | parse_json %}{{ parsed.num }}', { data: { stuff: '{"num":5}' } })).toBe('5')
  })

  it('parse_json makes invalid JSON a render error the editor can word', async () => {
    const problem = await render('{{ "{bad" | parse_json }}').then(() => null, templateProblemOf)

    expect(problem?.message).toContain('parse_json could not read the JSON')
    expect(problem?.line).toBe(1)
    await expect(render('{{ nothing | parse_json }}')).rejects.toThrow('parse_json expects a JSON string')
  })

  it('find_by finds the first strict match and falls back when nothing matches', async () => {
    const people = [{ name: 'Ryan', age: 35 }, { name: 'Sara', age: 29 }]
    expect(await render('{{ people | find_by: "name", "Ryan" | json }}', { people })).toBe('{"name":"Ryan","age":35}')
    expect(await render('{{ people | find_by: "name", "Toby", "Not Found" }}', { people })).toBe('Not Found')
    expect(await render('{{ people | find_by: "name", "Toby" }}', { people })).toBe('')
    expect(await render('{{ people | find_by: "age", "35" | json }}', { people })).toBe('null')
    expect(await render('{{ objs | find_by: "ok", true | json }}', { objs: [{ ok: false }, { ok: true }] })).toBe('{"ok":true}')
  })

  it('map_to_i reads every item as Ruby\'s to_i does', async () => {
    expect(await render('{% assign nums = "5, 4, 3.7, 2abc, e" | split: ", " | map_to_i %}{{ nums | join: "," }}')).toBe('5,4,3,2,0')
    expect(await render('{% assign nums = "1,2,3,4,5" | split: "," | map_to_i %}{{ nums | sum }}')).toBe('15')
  })

  it('number_with_delimiter honours its delimiter and separator and leaves text alone', async () => {
    expect(await render('{{ 1234 | number_with_delimiter }}')).toBe('1,234')
    expect(await render('{{ 1234 | number_with_delimiter: "." }}')).toBe('1.234')
    expect(await render('{{ 1000000 | number_with_delimiter: " " }}')).toBe('1 000 000')
    expect(await render('{{ 1234.57 | number_with_delimiter: " ", "," }}')).toBe('1 234,57')
    expect(await render('{{ "n/a" | number_with_delimiter }}')).toBe('n/a')
  })

  it('number_to_currency takes a unit prefix with grouping on, and explicit delimiter and separator', async () => {
    expect(await render('{{ 10420 | number_to_currency }}')).toBe('$10,420.00')
    expect(await render('{{ 10 | number_to_currency }}')).toBe('$10.00')
    expect(await render('{{ 152350.69 | number_to_currency: "£" }}')).toBe('£152,350.69')
    expect(await render('{{ 1234.57 | number_to_currency: "£", ".", "," }}')).toBe('£1.234,57')
    expect(await render('{{ 123 | number_to_currency: "tbd" }}')).toBe('tbd123.00')
    expect(await render('{{ -5 | number_to_currency }}')).toBe('-$5.00')
    expect(await render('{{ 1234.567 | number_to_currency: "$", ",", ".", 0 }}')).toBe('$1,235')
  })

  it('number_to_currency takes a trmnl-i18n locale, placing its unit as rails-i18n does, grouped', async () => {
    expect(await render('{{ 1234.57 | number_to_currency: "sv" }}')).toBe('1,234.57 kr')
    expect(await render('{{ 567 | number_to_currency: "sv" }}')).toBe('567.00 kr')
    expect(await render('{{ 1234.57 | number_to_currency: "en-GB" }}')).toBe('£1,234.57')
    expect(await render('{{ 1234.57 | number_to_currency: "de", ".", "," }}')).toBe('1.234,57 €')
    expect(await render('{{ 1234.57 | number_to_currency: "ja" }}')).toBe('1,234.57円')
    expect(await render('{{ 1234.57 | number_to_currency: "pt-BR" }}')).toBe('R$ 1,234.57')
  })

  it('pluralize puts the count in front, inflects the word and takes a plural keyword', async () => {
    expect(await render('{{ "book" | pluralize: 0 }}')).toBe('0 books')
    expect(await render('{{ "book" | pluralize: 1 }}')).toBe('1 book')
    expect(await render('{{ "book" | pluralize: 2 }}')).toBe('2 books')
    expect(await render('{{ "octopus" | pluralize: 3 }}')).toBe('3 octopi')
    expect(await render('{{ "person" | pluralize: 4 }}')).toBe('4 people')
    expect(await render('{{ "ox" | pluralize: 2, plural: "oxen" }}')).toBe('2 oxen')
    expect(await render('{{ "person" | pluralize: 4, plural: "humans" }}')).toBe('4 humans')
    expect(await render('{{ "city" | pluralize: 2 }}, {{ "box" | pluralize: 2 }}, {{ "church" | pluralize: 2 }}, {{ "wolf" | pluralize: 2 }}'))
      .toBe('2 cities, 2 boxes, 2 churches, 2 wolves')
  })

  it('markdown_to_html renders Markdown as Redcarpet with no extensions does', async () => {
    expect(await render('{{ "*x*" | markdown_to_html }}')).toBe('<p><em>x</em></p>')
    expect(await render('{{ "This is *crazy* and [a link](https://somewhere.com)." | markdown_to_html | strip_html }}'))
      .toBe('This is crazy and a link.')
    expect(await render('{{ nothing | markdown_to_html }}')).toBe('')
    const table = await render('{{ source | markdown_to_html }}', { source: '| a | b |\n|---|---|\n| 1 | 2 |' })
    expect(table).not.toContain('<table')
    expect(table).toContain('<p>')
    expect(await render('{{ "~~gone~~ https://x.test" | markdown_to_html }}')).toBe('<p>~~gone~~ https://x.test</p>')
    const fenced = await render('{{ source | markdown_to_html }}', { source: '```\ncode\n```' })
    expect(fenced).not.toContain('<pre')
    expect(fenced).toContain('```')
  })

  it('days_ago is the calendar date that many days before today, in the zone date renders in', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-10-10T12:00:00Z'))
    expect(await render('{{ 7 | days_ago }}')).toBe('2025-10-03')
    expect(await render('{{ "2" | days_ago }}')).toBe('2025-10-08')
    expect(await render('{{ 7 | days_ago }}', {})).toBe(await renderLiquid('{{ "now" | date: "%Y-%m-%d" | date: "%s" | minus: 604800 | date: "%Y-%m-%d" }}', {}))
  })

  it('days_ago honours an IANA zone argument', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-10-10T05:00:00Z'))
    expect(await render('{{ 1 | days_ago: "Pacific/Kiritimati" }}')).toBe('2025-10-09')
    expect(await render('{{ 1 | days_ago: "Pacific/Pago_Pago" }}')).toBe('2025-10-08')
  })

  it('ordinalize substitutes the ordinal day into the strftime format', async () => {
    expect(await render('{{ "2025-10-02" | ordinalize: "%A, %B <<ordinal_day>>, %Y" }}')).toBe('Thursday, October 2nd, 2025')
    expect(await render('{{ "2025-10-02" | ordinalize: "%b <<ordinal_day>>" }}')).toBe('Oct 2nd')
    expect(await render('{{ "2025-12-31 16:50:38 -0400" | ordinalize: "%A, %b <<ordinal_day>>" }}')).toBe('Wednesday, Dec 31st')
    expect(await render('{{ "2025-12-31 23:50:38 -0400" | ordinalize: "%b <<ordinal_day>> %H:%M" }}')).toBe('Dec 31st 23:50')
    expect(await renderLiquid('{{ "2025-12-31 23:50:38 -0400" | ordinalize: "%b <<ordinal_day>> %H:%M" }}', {}, { timeZone: 'Asia/Tokyo' })).toBe('Dec 31st 23:50')
    expect(await render('{{ "2025-10-11" | ordinalize: "<<ordinal_day>>" }}, {{ "2025-10-23" | ordinalize: "<<ordinal_day>>" }}')).toBe('11th, 23rd')
  })

  it('append_random adds two random bytes as hex, fresh on every call', async () => {
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValueOnce(0.5).mockReturnValueOnce(0.5).mockReturnValueOnce(0.25)
    const [first, again, third] = (await render('{{ "chart-" | append_random }}|{{ "chart-" | append_random }}|{{ "x" | append_random }}')).split('|')

    expect(first).toMatch(/^chart-[0-9a-f]{4}$/)
    expect(again).toBe(first)
    expect(third).toBe('x4000')
    random.mockRestore()
    const [a, b] = (await render('{{ "x" | append_random }}|{{ "x" | append_random }}')).split('|')
    expect(a).not.toBe(b)
  })

  it('random_number is an inclusive integer in sorted bounds, ignoring its input', async () => {
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValue(0.999999)
    expect(await render('{{ 0 | random_number: 1, 10 }}')).toBe('10')
    expect(await render('{{ 0 | random_number }}')).toBe('100')
    expect(await render('{{ "" | random_number: 5 }}')).toBe('5')
    expect(await render('{{ 99 | random_number: 6, 1 }}')).toBe('6')
    random.mockReturnValue(0)
    expect(await render('{{ 0 | random_number: 1, 10 }}')).toBe('1')
    expect(await render('{{ "" | random_number: 5 }}')).toBe('0')
    expect(await render('{{ "" | random_number: 6, 1 }}')).toBe('1')
    expect(await render('{{ "" | random_number: min, max }}', { min: '3', max: '3' })).toBe('3')
    expect(await render('{% assign n = nil | random_number: 5, 5 %}{{ n | plus: 1 }}')).toBe('6')
  })

  it('l_date localizes month and weekday names', async () => {
    expect(await render('{{ "2025-01-11" | l_date: "%y %b" }}')).toBe('25 Jan')
    expect(await render('{{ "2025-01-11" | l_date: "%y %b", "ko" }}')).toBe('25 1월')
    expect(await render('{{ "2025-01-11" | l_date: "%A", "de" }}')).toBe('Samstag')
    expect(await renderLiquid('{{ "2025-01-11T23:30:00-05:00" | l_date: "%-d %B %H:%M", "fr" }}', {}, { timeZone: 'Asia/Tokyo' })).toBe('11 janvier 23:30')
  })

  it.each([
    ['{{ missing | l_date: "%A" }}', ''],
    ['{{ nil | l_date: "%A" }}', ''],
    ['{{ "" | l_date: "%A" }}', ''],
    ['{{ data | l_date: "%A" }}', ''],
    ['{{ "soon" | l_date: "%A" }}', 'soon'],
    ['{{ missing | ordinalize }}', ''],
    ['{{ nil | ordinalize }}', ''],
    ['{{ "" | ordinalize }}', ''],
    ['{{ data | ordinalize }}', ''],
    ['{{ "soon" | ordinalize }}', 'soon'],
  ])('%s renders %j, as date does for a value that is not a date', async (markup, expected) => {
    expect(await render(markup, { data: {} })).toBe(expected)
  })

  it('l_word translates the six words trmnl-i18n ships and falls back to the input', async () => {
    expect(await render('{{ "today" | l_word: "es-ES" }}')).toBe('hoy')
    expect(await render('{{ "tomorrow" | l_word: "ko" }}')).toBe('내일')
    expect(await render('{{ "due" | l_word: "de-AT" }}')).toBe('Fällig')
    expect(await render('{{ "updated" | l_word: "fr-CA" }}')).toBe('Mis à jour')
    expect(await render('{{ "banana" | l_word: "de" }}')).toBe('banana')
    expect(await render('{{ "today" | l_word: "xx" }}')).toBe('today')
  })

  it('qr_code is the gem\'s svg: a viewBox when responsive, pixel width and height when fixed', async () => {
    const scaling = await render('{{ "Test" | qr_code }}')
    expect(scaling).toContain('<svg version="1.1" xmlns="http://www.w3.org/2000/svg"')
    expect(scaling).toContain('class="qr-code"')
    expect(scaling).toContain('shape-rendering="crispEdges"')
    expect(scaling).toContain('viewBox="0 0 231 231"')
    expect(scaling.match(/<svg [^>]*>/)![0]).not.toContain('width=')
    expect(scaling.match(/<rect /g)).toHaveLength(1)
    expect(scaling.match(/<path /g)).toHaveLength(1)
    const fixed = await render('{{ "Test" | qr_code: 18, "", "fixed" }}')
    expect(fixed).toContain('width="378" height="378"')
    expect(fixed).not.toContain('viewBox')
    expect(fixed.match(/<svg/g)).toHaveLength(1)
    expect(await render('{{ "Test" | qr_code: 11, "l" }}')).toContain('viewBox="0 0 231 231"')
    expect(await render('{{ "Test" | qr_code: 11, "BOGUS" }}')).toBe(scaling)
  })

  it('lists every TRMNL filter for completion, apart from Kuroshiro\'s', () => {
    expect([...TRMNL_FILTERS].sort()).toEqual([
      'append_random',
      'days_ago',
      'find_by',
      'json',
      'l_date',
      'l_word',
      'map_to_i',
      'markdown_to_html',
      'number_to_currency',
      'number_with_delimiter',
      'ordinalize',
      'parse_json',
      'pluralize',
      'qr_code',
      'random_number',
      'sample',
      'where_exp',
    ])
    expect(TRMNL_FILTERS.filter(name => KUROSHIRO_FILTERS.includes(name))).toEqual([])
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
