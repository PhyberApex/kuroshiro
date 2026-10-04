import type { FilterImplOptions, FS } from 'liquidjs'
import { Liquid } from 'liquidjs'

export interface TemplateProblem {
  message: string
  line: number | null
}

const EMPTY_TEMPLATE_MESSAGE = 'A template cannot be empty.'
const POSITION_SUFFIX = /, line:\d+, col:\d+$/

const asDate = (value: unknown) => new Date(value as string | number | Date)

const filters: Record<string, FilterImplOptions> = {
  date_short: (date: unknown) =>
    asDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  date_long: (date: unknown) =>
    asDate(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  time_short: (date: unknown) =>
    asDate(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  number_with_delimiter: (num: unknown) => Number(num).toLocaleString('en-US'),
  round: (num: unknown, precision = 0) => Number(num).toFixed(precision),
  truncate_words: (text: string, count = 20) => {
    const words = text.split(/\s+/)
    if (words.length <= count)
      return text
    return `${words.slice(0, count).join(' ')}...`
  },
  titleize: (text: string) =>
    text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '),
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
  url_encode: (value: unknown) => encodeURIComponent(String(value)),
  url_decode: (value: unknown) => decodeURIComponent(String(value)),
}

export const KUROSHIRO_FILTERS: readonly string[] = Object.keys(filters)

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

export function createLiquidEngine(): Liquid {
  const engine = new Liquid({ fs: noPartials, relativeReference: false })
  Object.entries(filters).forEach(([name, filter]) => engine.registerFilter(name, filter))
  return engine
}

const engine = createLiquidEngine()

export function renderLiquid(markup: string, context: object): Promise<string> {
  return engine.parseAndRender(markup, context)
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
