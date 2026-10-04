import type { DataSourceRead, PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import type { DataSourceDraft } from '../pluginDataSources'
import { describe, expect, it } from 'vitest'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { addedDataSource, dataSourceNameProblem, dataSourcesPart, isPublicAddress, sentPaths } from '../pluginDataSources'

const FORECAST = buildPluginDetail().dataSources[0]!

const source = (overrides: Partial<DataSourceRead>): DataSourceRead => ({ ...FORECAST, ...overrides })

const HOLIDAYS = source({
  id: 'holidays',
  name: 'holidays',
  mode: 'literal',
  method: null,
  url: null,
  headers: null,
  body: null,
  transformJs: null,
  literalValue: { next: 'Reformation Day' },
  lastFetchAttemptAt: null,
  lastFetchSucceededAt: null,
})

const pluginWith = (overrides: Partial<PluginDetail> = {}) => buildPluginDetail({ name: 'Weather', ...overrides })

const part = dataSourcesPart(() => false)
const demoPart = dataSourcesPart(() => true)

function problemsOf(plugin: PluginDetail, edit: (sources: DataSourceDraft[]) => void, unsaved: UpdatePluginInput = {}, checked = part) {
  const draft = checked.read(plugin)
  edit(draft.sources)
  return checked.validate!(draft, { plugin, unsaved })
}

describe('the Data Sources part of the Plugin\'s form', () => {
  describe('what it reads', () => {
    it('reads the refresh interval in hours where it is whole hours, in minutes otherwise', () => {
      expect(part.read(pluginWith({ refreshInterval: 30 })).interval).toEqual({ amount: 30, unit: 'minutes' })
      expect(part.read(pluginWith({ refreshInterval: 120 })).interval).toEqual({ amount: 2, unit: 'hours' })
      expect(part.read(pluginWith({ refreshInterval: 2880 })).interval).toEqual({ amount: 48, unit: 'hours' })
    })

    it('reads a fetch Data Source as text to edit, keyed by its id, with nothing where it has no headers, body or transform', () => {
      const [row] = part.read(pluginWith({ dataSources: [source({ method: 'POST', headers: { Accept: 'application/json' }, body: {}, transformJs: null })] })).sources

      expect(row).toEqual({
        key: FORECAST.id,
        id: FORECAST.id,
        name: 'forecast',
        mode: 'fetch',
        method: 'POST',
        url: FORECAST.url,
        headers: '{\n  "Accept": "application/json"\n}',
        body: '',
        transformJs: '',
        literalValue: '',
        removed: false,
      })
    })

    it('reads a literal Data Source with its value as JSON and a GET request waiting to be filled in', () => {
      const [row] = part.read(pluginWith({ dataSources: [HOLIDAYS] })).sources

      expect(row).toMatchObject({ mode: 'literal', method: 'GET', url: '', headers: '', literalValue: '{\n  "next": "Reformation Day"\n}' })
    })

    it('reads the same Plugin as the same draft', () => {
      const plugin = pluginWith({ dataSources: [FORECAST, HOLIDAYS] })

      expect(part.read(plugin)).toEqual(part.read(plugin))
    })
  })

  describe('what it sends', () => {
    it('sends a Plugin as it was read back unchanged, as inputs with their ids and none of the facts', () => {
      const plugin = pluginWith({ refreshInterval: 2880, dataSources: [FORECAST, HOLIDAYS] })

      expect(part.toInput(part.read(plugin))).toEqual({
        refreshInterval: 2880,
        dataSources: [
          { id: FORECAST.id, name: 'forecast', mode: 'fetch', method: 'GET', url: FORECAST.url, headers: {}, transformJs: null },
          { id: 'holidays', name: 'holidays', mode: 'literal', literalValue: { next: 'Reformation Day' } },
        ],
      })
    })

    it('sends the interval in minutes, and none while the field is empty', () => {
      const draft = part.read(pluginWith())
      draft.interval = { amount: 3, unit: 'hours' }
      expect(part.toInput(draft).refreshInterval).toBe(180)

      draft.interval.amount = null
      expect(part.toInput(draft).refreshInterval).toBeUndefined()
    })

    it('sends a new Data Source without an id, a removed one not at all, and the body with POST only', () => {
      const draft = part.read(pluginWith({ dataSources: [FORECAST, HOLIDAYS] }))
      draft.sources[1]!.removed = true
      draft.sources.push({ ...addedDataSource(draft.sources), name: ' pollen ', url: ' https://pollen.test/today ', method: 'POST', body: '{ "region": "north" }', transformJs: 'return input.days' })

      expect(part.toInput(draft).dataSources).toEqual([
        expect.objectContaining({ id: FORECAST.id }),
        { name: 'pollen', mode: 'fetch', method: 'POST', url: 'https://pollen.test/today', headers: {}, body: { region: 'north' }, transformJs: 'return input.days' },
      ])
    })

    it('sends only what the chosen Data Source Mode holds, while the draft keeps the other mode\'s entries', () => {
      const draft = part.read(pluginWith())
      Object.assign(draft.sources[0]!, { mode: 'literal', literalValue: '[1, 2]' })

      expect(draft.sources[0]!.url).toBe(FORECAST.url)
      expect(part.toInput(draft).dataSources).toEqual([{ id: FORECAST.id, name: 'forecast', mode: 'literal', literalValue: [1, 2] }])
    })

    it('leaves out code that does not parse, so that it differs from anything saved', () => {
      const draft = part.read(pluginWith())
      draft.sources[0]!.headers = '{ "Accept": '

      expect(part.toInput(draft).dataSources![0]!.headers).toBeUndefined()
    })
  })

  describe('the refresh interval\'s rule', () => {
    const RULE = [{ path: 'refreshInterval', message: 'Enter between 1 minute and 24 hours.' }]

    function intervalProblems(stored: number, amount: number | null, unit: 'minutes' | 'hours') {
      const plugin = pluginWith({ refreshInterval: stored })
      const draft = part.read(plugin)
      draft.interval = { amount, unit }
      return part.validate!(draft, { plugin, unsaved: {} })
    }

    it('accepts 1 minute to 24 hours', () => {
      expect(intervalProblems(30, 1, 'minutes')).toEqual([])
      expect(intervalProblems(30, 24, 'hours')).toEqual([])
    })

    it('refuses 0, 25 hours, a fraction of a minute and an empty field', () => {
      expect(intervalProblems(30, 0, 'minutes')).toEqual(RULE)
      expect(intervalProblems(30, 25, 'hours')).toEqual(RULE)
      expect(intervalProblems(30, 1.5, 'minutes')).toEqual(RULE)
      expect(intervalProblems(30, null, 'minutes')).toEqual(RULE)
    })

    it('keeps a longer interval that came with a Recipe for as long as it is not changed', () => {
      expect(intervalProblems(2880, 48, 'hours')).toEqual([])
      expect(intervalProblems(2880, 2880, 'minutes')).toEqual([])
      expect(intervalProblems(2880, 47, 'hours')).toEqual(RULE)
    })
  })

  describe('a Data Source\'s name', () => {
    const among = { plugin: 'Weather', earlier: ['forecast'], keynames: ['latitude'] }

    it('is required, unique in the Plugin, not a Plugin Field\'s keyname and not trmnl', () => {
      expect(dataSourceNameProblem('pollen', among)).toBeUndefined()
      expect(dataSourceNameProblem('  ', among)).toBe('A Data Source needs a name.')
      expect(dataSourceNameProblem(' forecast ', among)).toBe('Another Data Source of Weather is called forecast.')
      expect(dataSourceNameProblem('latitude', among)).toBe('latitude is already the keyname of a Plugin Field.')
      expect(dataSourceNameProblem('trmnl', among)).toBe('`trmnl` is taken by Kuroshiro.')
    })

    it('is checked at the path a save sends it at, which leaves a removed Data Source out', () => {
      const plugin = pluginWith({ dataSources: [FORECAST, HOLIDAYS, source({ id: 'pollen', name: 'pollen' })] })

      const problems = problemsOf(plugin, (sources) => {
        sources[1]!.removed = true
        sources[2]!.name = 'forecast'
      })

      expect(problems).toEqual([{ path: 'dataSources.1.name', message: 'Another Data Source of Weather is called forecast.' }])
    })

    it('may be the name of a removed Data Source', () => {
      const plugin = pluginWith({ dataSources: [FORECAST, HOLIDAYS] })

      expect(problemsOf(plugin, (sources) => {
        sources[0]!.removed = true
        sources[1]!.name = 'forecast'
      })).toEqual([])
    })

    it('is checked against the keynames of the Plugin Fields as they stand in the form, saved or not', () => {
      const field = { id: 'f1', keyname: 'forecast', label: 'Forecast', type: 'string', helpText: null, default: null, required: false, order: 0, options: null }
      const message = 'forecast is already the keyname of a Plugin Field.'

      expect(problemsOf(pluginWith({ fields: [field] }), () => {})).toEqual([{ path: 'dataSources.0.name', message }])
      expect(problemsOf(pluginWith({ fields: [field] }), () => {}, { fields: [] })).toEqual([])
      expect(problemsOf(pluginWith(), () => {}, { fields: [{ keyname: 'forecast', name: 'Forecast' }] })).toEqual([{ path: 'dataSources.0.name', message }])
    })
  })

  describe('a fetch Data Source\'s rules', () => {
    const fetchProblems = (edit: Partial<DataSourceDraft>, checked = part) => problemsOf(pluginWith(), sources => Object.assign(sources[0]!, edit), {}, checked)

    it('wants an address that starts with http:// or https://', () => {
      const message = 'Enter an address that starts with http:// or https://.'

      expect(fetchProblems({ url: 'HTTPS://api.test/{{ city }}' })).toEqual([])
      expect(fetchProblems({ url: '' })).toEqual([{ path: 'dataSources.0.url', message }])
      expect(fetchProblems({ url: 'ftp://api.test' })).toEqual([{ path: 'dataSources.0.url', message }])
    })

    it('refuses an address that is not public in demo mode only', () => {
      const message = 'In the demo a Data Source can only fetch a public address.'

      expect(fetchProblems({ url: 'http://192.168.1.20/status' })).toEqual([])
      expect(fetchProblems({ url: 'http://192.168.1.20/status' }, demoPart)).toEqual([{ path: 'dataSources.0.url', message }])
      expect(fetchProblems({ url: 'https://api.open-meteo.com/v1' }, demoPart)).toEqual([])
    })

    it('wants headers that are a JSON object, or none', () => {
      const message = 'Headers must be a JSON object, like { "Accept": "application/json" }.'

      expect(fetchProblems({ headers: '' })).toEqual([])
      expect(fetchProblems({ headers: '{ "Accept": "application/json" }' })).toEqual([])
      expect(fetchProblems({ headers: '["Accept"]' })).toEqual([{ path: 'dataSources.0.headers', message }])
      expect(fetchProblems({ headers: '{ "Accept": ' })).toEqual([{ path: 'dataSources.0.headers', message }])
    })

    it('wants a body that is a JSON object, with POST only', () => {
      const message = 'The body must be a JSON object.'

      expect(fetchProblems({ method: 'POST', body: '"north"' })).toEqual([{ path: 'dataSources.0.body', message }])
      expect(fetchProblems({ method: 'POST', body: '' })).toEqual([])
      expect(fetchProblems({ method: 'GET', body: '"north"' })).toEqual([])
    })

    it('does not check what the Literal mode holds', () => {
      expect(fetchProblems({ literalValue: '{' })).toEqual([])
    })
  })

  describe('a literal Data Source\'s rule', () => {
    const literalProblems = (literalValue: string) => problemsOf(pluginWith(), sources => Object.assign(sources[0]!, { mode: 'literal', url: '', literalValue }))

    it('takes any JSON value and no request', () => {
      expect(literalProblems('[1, 2]')).toEqual([])
      expect(literalProblems('"closed"')).toEqual([])
    })

    it('refuses what is not JSON with the parser\'s own message', () => {
      const [problem, ...others] = literalProblems('{ "next": }')

      expect(others).toEqual([])
      expect(problem!.path).toBe('dataSources.0.literalValue')
      expect(problem!.message).toMatch(/^This is not valid JSON: \w[^\n]+\.$/)
      expect(problem!.message).toContain('JSON')
    })
  })

  describe('adding a Data Source', () => {
    it('starts as a GET fetch called source, or the next free source_n', () => {
      const none = part.read(pluginWith({ dataSources: [] })).sources
      expect(addedDataSource(none)).toMatchObject({ id: null, name: 'source', mode: 'fetch', method: 'GET', url: '', removed: false })

      const taken = part.read(pluginWith({ dataSources: [source({ name: 'source' }), source({ id: 'b', name: 'source_2' })] })).sources
      expect(addedDataSource(taken).name).toBe('source_3')
    })

    it('gives every added row a key of its own', () => {
      const sources = part.read(pluginWith()).sources
      const first = addedDataSource(sources)
      const second = addedDataSource([...sources, first])

      expect(new Set([sources[0]!.key, first.key, second.key]).size).toBe(3)
    })
  })

  describe('the paths a save sends the rows at', () => {
    it('counts the kept rows and leaves the removed ones without a path', () => {
      const sources = part.read(pluginWith({ dataSources: [FORECAST, HOLIDAYS, source({ id: 'pollen', name: 'pollen' })] })).sources
      sources[1]!.removed = true

      expect(sentPaths(sources)).toEqual(['dataSources.0', undefined, 'dataSources.1'])
    })
  })

  describe('a public address', () => {
    it('is anything but this machine, a private network and a local name', () => {
      expect(['https://api.open-meteo.com/v1', 'http://8.8.8.8/dns', 'https://{{ host }}/data'].filter(isPublicAddress)).toHaveLength(3)
      expect([
        'http://localhost:3000/x',
        'http://127.0.0.1/x',
        'http://10.1.2.3/x',
        'http://172.20.0.1/x',
        'http://192.168.1.20/x',
        'http://169.254.169.254/latest',
        'http://[::1]/x',
        'http://[fd00::1]/x',
        'http://printer.local/x',
        'http://metadata.google.internal/x',
      ].filter(isPublicAddress)).toEqual([])
    })
  })
})
