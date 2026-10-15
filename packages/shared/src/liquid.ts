import type { Context, FilterImplOptions, FS } from 'liquidjs'
import { Liquid } from 'liquidjs'
import { findBy } from './filters/collections.ts'
import { daysAgo, localizeDate, ordinalize } from './filters/dates.ts'
import { markdownToHtml, qrCode } from './filters/markup.ts'
import { numberToCurrency, numberWithDelimiter } from './filters/numbers.ts'
import { appendRandom, randomNumber } from './filters/random.ts'
import { parseJson, pluralize } from './filters/strings.ts'
import { localizeWord } from './filters/words.ts'

export interface TemplateProblem {
  message: string
  line: number | null
}

const EMPTY_TEMPLATE_MESSAGE = 'A template cannot be empty.'
const POSITION_SUFFIX = /, line:\d+, col:\d+$/

const asText = (value: unknown) => (typeof value === 'string' ? value : null)

function asDate(value: unknown) {
  if (typeof value !== 'string' && !(value instanceof Date))
    return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: unknown, format: (date: Date) => string) {
  const date = asDate(value)
  return date ? format(date) : ''
}

function toNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isNaN(number) ? 0 : number
}

/** Ruby reads `3.0` and `'3.0'` as floats; JavaScript cannot tell `3.0` from `3`, so the divisor's source text is asked too. */
function isFloat(value: unknown, literal: string | undefined) {
  return !Number.isInteger(toNumber(value)) || (typeof value === 'string' ? /[.e]/i.test(value) : /^[-+]?\d*\./.test(literal ?? ''))
}

type FilterThis = ThisParameterType<Extract<FilterImplOptions, (...args: never[]) => unknown>>

/**
 * Standard filters whose liquidjs answer differs (or throws) from Ruby Liquid's (ADR-0043). They are registered like the rest but
 * stay out of `KUROSHIRO_FILTERS`, which names only the filters Kuroshiro adds.
 */
const corrections: Record<string, FilterImplOptions> = {
  divided_by(this: FilterThis, dividend: unknown, divisor: unknown) {
    const quotient = toNumber(dividend) / toNumber(divisor)
    const first = this.token.args[0]
    const literal = Array.isArray(first) ? undefined : first?.getText()
    return isFloat(dividend, undefined) || isFloat(divisor, literal) ? quotient : Math.floor(quotient)
  },
  url_decode: (value: unknown) => {
    const text = String(value ?? '')
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '))
    }
    catch {
      return text
    }
  },
}

/** The filters that print a date or time, in the engine's zone; `undefined` is the process's own. */
function zonedFilters(timeZone: string | undefined): Record<string, FilterImplOptions> {
  return {
    date_short: (date: unknown) =>
      formatDate(date, d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })),
    date_long: (date: unknown) =>
      formatDate(date, d => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone })),
    time_short: (date: unknown) =>
      formatDate(date, d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })),
  }
}

const filters: Record<string, FilterImplOptions> = {
  number_with_delimiter: numberWithDelimiter,
  number_to_currency: numberToCurrency,
  pluralize,
  parse_json: parseJson,
  find_by: findBy,
  markdown_to_html: markdownToHtml,
  qr_code: qrCode,
  random_number: randomNumber,
  l_word: localizeWord,
  // The filters below read the render's own context: its clock zone for dates, its identity for `append_random`.
  days_ago(this: { context: Context }, days: unknown) {
    return daysAgo(this.context, days)
  },
  ordinalize(this: { context: Context }, value: unknown, format?: string) {
    return ordinalize(this.context, value, format)
  },
  l_date(this: { context: Context }, value: unknown, format?: string, locale?: unknown) {
    return localizeDate(this.context, value, format, locale)
  },
  append_random(this: { context: Context }, value: unknown) {
    return appendRandom(this.context, value)
  },
  truncate_words: (value: unknown, count = 20) => {
    const text = asText(value)
    if (text === null)
      return ''
    const words = text.split(/\s+/)
    if (words.length <= count)
      return text
    return `${words.slice(0, count).join(' ')}...`
  },
  titleize: (value: unknown) =>
    (asText(value) ?? '').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
  shuffle: (arr: unknown[]) => {
    const shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  },
  sample: (arr: unknown[], count = 1) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return count === 1 ? shuffled[0] : shuffled.slice(0, count)
  },
  yesno: (value: unknown, yes = 'Yes', no = 'No') => (value ? yes : no),
  json: (value: unknown) => JSON.stringify(value),
}

export const KUROSHIRO_FILTERS: readonly string[] = [...Object.keys(zonedFilters(undefined)), ...Object.keys(filters)]

function refusePartial(name: string): never {
  throw new Error(`A template cannot render "${name}": Kuroshiro has no partials.`)
}

/**
 * Where `{% render %}`, `{% include %}` and `{% layout %}` look for their file: nowhere. Left to itself the engine reads
 * the server's disk and, in a browser, asks the network, so the same Template would not render the same in both.
 */
const noPartials: FS = {
  exists: async () => true,
  existsSync: () => true,
  readFile: async name => refusePartial(name),
  readFileSync: refusePartial,
  resolve: (_directory, name) => name,
}

/**
 * `timeZone` is the IANA zone `date` and Kuroshiro's date and time filters render in (the Instance Time Zone); without
 * one they render in the running process's zone. liquidjs takes the zone only here, not per render.
 */
export function createLiquidEngine(timeZone?: string): Liquid {
  const engine = new Liquid({ fs: noPartials, relativeReference: false, ...(timeZone && { timezoneOffset: timeZone }) })
  Object.entries({ ...zonedFilters(timeZone), ...filters, ...corrections }).forEach(([name, filter]) => engine.registerFilter(name, filter))
  return engine
}

const engine = createLiquidEngine()
const enginesByZone = new Map<string, Liquid>()

function engineFor(timeZone: string | undefined): Liquid {
  if (!timeZone)
    return engine
  let zoned = enginesByZone.get(timeZone)
  if (!zoned) {
    zoned = createLiquidEngine(timeZone)
    enginesByZone.set(timeZone, zoned)
  }
  return zoned
}

export function renderLiquid(markup: string, context: object, { timeZone }: { timeZone?: string } = {}): Promise<string> {
  return engineFor(timeZone).parseAndRender(markup, context)
}

export function templateProblemOf(error: unknown): TemplateProblem {
  const { message = String(error), token } = (error ?? {}) as {
    message?: string
    token?: { getPosition?: () => [number, number] }
  }
  const line = token?.getPosition?.()[0]
  return { message: message.replace(POSITION_SUFFIX, ''), line: line ?? null }
}

export function checkTemplate(markup: string): TemplateProblem | null {
  if (markup.trim() === '')
    return { message: EMPTY_TEMPLATE_MESSAGE, line: null }
  try {
    engine.parse(markup)
    return null
  }
  catch (error) {
    return templateProblemOf(error)
  }
}
