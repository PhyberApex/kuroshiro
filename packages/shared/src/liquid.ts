import type { Context, Emitter, FilterImplOptions, FS, Hash, Parser, TagToken, Template, TopLevelToken } from 'liquidjs'
import { Liquid, Tag, toValue } from 'liquidjs'
import { findBy, mapToI } from './filters/collections.ts'
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
 * stay out of both filter lists, which name only what the dialect adds to Liquid.
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

/** The custom filters of TRMNL's `trmnl-liquid` gem, under its names and signatures (ADR-0043). */
const trmnlFilters: Record<string, FilterImplOptions> = {
  /** Ruby's `to_json`: `null` for a missing value and for `nil` (a drop in liquidjs); any other drop serialises as itself, not its `valueOf`. */
  json: (value: unknown) => JSON.stringify(toValue(value) == null ? null : value),
  sample: (arr: unknown[], count = 1) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return count === 1 ? shuffled[0] : shuffled.slice(0, count)
  },
  parse_json: parseJson,
  find_by: findBy,
  map_to_i: mapToI,
  number_with_delimiter: numberWithDelimiter,
  number_to_currency: numberToCurrency,
  pluralize,
  l_word: localizeWord,
  append_random: appendRandom,
  random_number: randomNumber,
  markdown_to_html: markdownToHtml,
  qr_code: qrCode,
  days_ago: daysAgo,
  ordinalize,
  l_date: localizeDate,
}

/** TRMNL filters liquidjs already ships under the same name and shape, listed for completion and registered by nobody. */
const TRMNL_BUILTINS = ['where_exp']

/** Kuroshiro's own inventions, which no Liquid dialect has. */
const kuroshiroFilters: Record<string, FilterImplOptions> = {
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
  yesno: (value: unknown, yes = 'Yes', no = 'No') => (value ? yes : no),
}

/** The filters TRMNL's Liquid adds to standard Liquid; the editor marks them "TRMNL". */
export const TRMNL_FILTERS: readonly string[] = [...Object.keys(trmnlFilters), ...TRMNL_BUILTINS]

/** The filters Kuroshiro alone adds; the editor marks them "Kuroshiro". */
export const KUROSHIRO_FILTERS: readonly string[] = [...Object.keys(zonedFilters(undefined)), ...Object.keys(kuroshiroFilters)]

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

const TEMPLATE_NAME = /^[\w/]+$/
const DEFINED_TEMPLATES_REGISTER = 'definedTemplates'

type DefinedTemplates = Record<string, Template[]>
type TagClass = Liquid['tags'][string]

/** The templates `{% template %}` has defined so far in this render, which `{% render %}` reads by name (ADR-0050). */
const definedTemplatesOf = (ctx: Context): DefinedTemplates => ctx.getRegister<DefinedTemplates>(DEFINED_TEMPLATES_REGISTER, {})

/** `{% template name %}…{% endtemplate %}` as TRMNL's Liquid has it: defines `name` for the `{% render %}` tags after it and draws nothing. */
class TemplateTag extends Tag {
  private readonly templateName: string
  private readonly templates: Template[] = []

  constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid, parser: Parser) {
    super(token, remainTokens, liquid)
    this.templateName = token.args.trim()
    const stream = parser.parseStream(remainTokens)
      .on('tag:endtemplate', () => stream.stop())
      .on('template', (template: Template) => this.templates.push(template))
      .on('end', () => {
        throw new Error(`tag ${token.getText()} not closed`)
      })
    stream.start()
  }

  * render(ctx: Context): Generator<unknown, void, unknown> {
    if (!TEMPLATE_NAME.test(this.templateName))
      throw new Error(`A template's name may hold only letters, numbers, underscores and slashes: "${this.templateName}".`)
    definedTemplatesOf(ctx)[this.templateName] = this.templates
  }
}

/**
 * `{% render "name", key: value %}` drawing a template the Template defined, with only the arguments it is given, as
 * TRMNL does; any other name goes to the engine's own tag, which looks it up nowhere.
 */
function renderDefinedTemplateTag(engine: Liquid): TagClass {
  const BuiltIn = engine.tags.render
  const renderPartial = BuiltIn.prototype.render as (this: Tag, ctx: Context, emitter: Emitter) => Generator<unknown, void, unknown>

  return class extends BuiltIn {
    * render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      const { file, hash } = this as unknown as { file: unknown, hash: Hash }
      const defined = typeof file === 'string' ? definedTemplatesOf(ctx)[file] : undefined
      if (!defined)
        return yield* renderPartial.call(this, ctx, emitter)

      const childCtx = ctx.spawn()
      childCtx.setRegister(DEFINED_TEMPLATES_REGISTER, definedTemplatesOf(ctx))
      Object.assign(childCtx.bottom(), yield hash.render(ctx))
      yield this.liquid.renderer.renderTemplates(defined, childCtx, emitter)
    }
  }
}

/**
 * `timeZone` is the IANA zone `date` and Kuroshiro's date and time filters render in (the Instance Time Zone); without
 * one they render in the running process's zone. liquidjs takes the zone only here, not per render.
 */
export function createLiquidEngine(timeZone?: string): Liquid {
  const engine = new Liquid({ fs: noPartials, relativeReference: false, ...(timeZone && { timezoneOffset: timeZone }) })
  Object.entries({ ...zonedFilters(timeZone), ...trmnlFilters, ...kuroshiroFilters, ...corrections }).forEach(([name, filter]) => engine.registerFilter(name, filter))
  engine.registerTag('template', TemplateTag)
  engine.registerTag('render', renderDefinedTemplateTag(engine))
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
