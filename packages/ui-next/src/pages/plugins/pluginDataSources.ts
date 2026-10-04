import type { DataSourceInput, DataSourceMethod, DataSourceMode, DataSourceRead, PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import type { FieldProblem, PluginFormPart } from './pluginForm'
import type { RateUnit } from '@/pages/devices/deviceSettings'
import { REFRESH_INTERVAL_BOUNDS } from 'kuroshiro-shared'
import { RATE_RANGE_MESSAGE } from '@/pages/devices/deviceSettings'

/** One Data Source as its row edits it. Both modes' entries are held, so switching the mode and back loses nothing before a save. */
export interface DataSourceDraft {
  /** Tells the rows apart in the page: the id of a saved Data Source, a counted one for a row that was added. */
  key: string
  /** `null` for a Data Source that was added and not saved yet. */
  id: string | null
  name: string
  mode: DataSourceMode
  method: DataSourceMethod
  url: string
  /** JSON as typed; empty for none. */
  headers: string
  /** JSON as typed; empty for none. */
  body: string
  transformJs: string
  /** JSON as typed. */
  literalValue: string
  /** Left out of the next save. The row stays, struck through, until then. */
  removed: boolean
}

export interface DataSourcesDraft {
  interval: { amount: number | null, unit: RateUnit }
  sources: DataSourceDraft[]
}

type DataSourceField = 'name' | 'url' | 'headers' | 'body' | 'literalValue'

type SavedDataSource = NonNullable<UpdatePluginInput['dataSources']>[number]

const MINUTES: Record<RateUnit, number> = { minutes: 1, hours: 60 }

function intervalShown(minutes: number | null): DataSourcesDraft['interval'] {
  if (minutes === null)
    return { amount: null, unit: 'minutes' }
  const unit: RateUnit = minutes % MINUTES.hours === 0 ? 'hours' : 'minutes'
  return { amount: minutes / MINUTES[unit], unit }
}

const intervalMinutes = ({ amount, unit }: DataSourcesDraft['interval']) => amount === null ? undefined : amount * MINUTES[unit]

const isEntered = (text: string) => text.trim() !== ''

const asText = (value: unknown) => JSON.stringify(value, null, 2)

const objectText = (value: Record<string, unknown> | null) => value && Object.keys(value).length > 0 ? asText(value) : ''

function draftOf(source: DataSourceRead): DataSourceDraft {
  return {
    key: source.id,
    id: source.id,
    name: source.name,
    mode: source.mode,
    method: source.method ?? 'GET',
    url: source.url ?? '',
    headers: objectText(source.headers),
    body: objectText(source.body),
    transformJs: source.transformJs ?? '',
    literalValue: source.mode === 'literal' ? asText(source.literalValue) : '',
    removed: false,
  }
}

type Parsed = { value: unknown, mistake?: undefined } | { value?: undefined, mistake: string }

function parsed(text: string): Parsed {
  try {
    return { value: JSON.parse(text) }
  }
  catch (error) {
    return { mistake: (error as Error).message }
  }
}

const isJsonObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The object a headers or body input holds: none for an empty input, and nothing for what is no JSON object. */
function enteredObject(text: string) {
  if (!isEntered(text))
    return {}
  const { value } = parsed(text)
  return isJsonObject(value) ? value : undefined
}

function fetchInput(row: DataSourceDraft): Partial<DataSourceInput> {
  return {
    method: row.method,
    url: row.url.trim(),
    headers: enteredObject(row.headers) as Record<string, string> | undefined,
    ...(row.method === 'POST' ? { body: enteredObject(row.body) } : {}),
    transformJs: isEntered(row.transformJs) ? row.transformJs : null,
  }
}

const literalInput = (row: DataSourceDraft): Partial<DataSourceInput> => ({ literalValue: parsed(row.literalValue).value as DataSourceInput['literalValue'] })

function inputOf(row: DataSourceDraft): SavedDataSource {
  return {
    ...(row.id ? { id: row.id } : {}),
    name: row.name.trim(),
    mode: row.mode,
    ...(row.mode === 'literal' ? literalInput(row) : fetchInput(row)),
  }
}

const kept = (sources: DataSourceDraft[]) => sources.filter(row => !row.removed)

/** The path a save sends each row at, by the row's place in the draft: a removed row is not sent and has none. */
export function sentPaths(sources: DataSourceDraft[]): Array<string | undefined> {
  const keptRows = kept(sources)
  return sources.map(row => row.removed ? undefined : `dataSources.${keptRows.indexOf(row)}`)
}

/** What is wrong with a Data Source's name as entered, among the names before it in the Plugin and the Plugin Fields' keynames. */
export function dataSourceNameProblem(entered: string, among: { plugin: string, earlier: string[], keynames: string[] }) {
  const name = entered.trim()
  if (!name)
    return 'A Data Source needs a name.'
  if (name === 'trmnl')
    return '`trmnl` is taken by Kuroshiro.'
  if (among.earlier.includes(name))
    return `Another Data Source of ${among.plugin} is called ${name}.`
  return among.keynames.includes(name) ? `${name} is already the keyname of a Plugin Field.` : undefined
}

const LOCAL_NAMES = ['localhost', 'metadata.google.internal']
const LOCAL_SUFFIXES = ['.local', '.internal', '.localhost']
const IPV4 = /^(\d+)\.(\d+)\.\d+\.\d+$/

function isPrivateIpv4(first: number, second: number) {
  return first === 127 || first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 169 && second === 254)
}

function isLocalHost(host: string) {
  const ipv4 = IPV4.exec(host)
  if (ipv4)
    return isPrivateIpv4(Number(ipv4[1]), Number(ipv4[2]))
  return LOCAL_NAMES.includes(host)
    || LOCAL_SUFFIXES.some(suffix => host.endsWith(suffix))
    || (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd')))
}

/**
 * Whether the server would fetch the address in demo mode, by the hosts its guard refuses (`ssrfGuard.ts` of the API).
 * An address the browser cannot read a host from, such as one whose host is a Liquid placeholder, is left to the server.
 */
export function isPublicAddress(address: string) {
  if (!URL.canParse(address))
    return true
  return !isLocalHost(new URL(address).hostname.toLowerCase().replace(/^\[|\]$/g, ''))
}

function addressProblem(url: string, demoMode: boolean) {
  const address = url.trim()
  if (!/^https?:\/\//i.test(address))
    return 'Enter an address that starts with http:// or https://.'
  return demoMode && !isPublicAddress(address) ? 'In the demo a Data Source can only fetch a public address.' : undefined
}

const objectProblem = (text: string, message: string) => enteredObject(text) === undefined ? message : undefined

function literalProblem(text: string) {
  const { mistake } = parsed(text)
  return mistake === undefined ? undefined : `This is not valid JSON: ${mistake.replace(/\.$/, '')}.`
}

interface NameContext {
  plugin: string
  keynames: string[]
}

const HEADERS_RULE = 'Headers must be a JSON object, like { "Accept": "application/json" }.'
const BODY_RULE = 'The body must be a JSON object.'

/** What is wrong with the code a Data Source's chosen mode holds, by field. Its section shows each on leaving the field, before any save. */
export function codeProblems(row: DataSourceDraft): Partial<Record<'headers' | 'body' | 'literalValue', string>> {
  if (row.mode === 'literal')
    return { literalValue: literalProblem(row.literalValue) }
  return {
    headers: objectProblem(row.headers, HEADERS_RULE),
    body: row.method === 'POST' ? objectProblem(row.body, BODY_RULE) : undefined,
  }
}

function sourceProblems(row: DataSourceDraft, earlier: string[], names: NameContext, demoMode: boolean): Partial<Record<DataSourceField, string>> {
  return {
    name: dataSourceNameProblem(row.name, { ...names, earlier }),
    url: row.mode === 'fetch' ? addressProblem(row.url, demoMode) : undefined,
    ...codeProblems(row),
  }
}

function sourcesProblems(sources: DataSourceDraft[], names: NameContext, demoMode: boolean): FieldProblem[] {
  const rows = kept(sources)
  return rows.flatMap((row, index) => {
    const earlier = rows.slice(0, index).map(other => other.name.trim())
    return Object.entries(sourceProblems(row, earlier, names, demoMode))
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([field, message]) => ({ path: `dataSources.${index}.${field}`, message }))
  })
}

/** The limit holds for an interval the admin enters: one that is stored, such as a longer one a Recipe brought, stays as it is. */
function intervalProblems(interval: DataSourcesDraft['interval'], stored: number | null): FieldProblem[] {
  const minutes = intervalMinutes(interval)
  const { min, max } = REFRESH_INTERVAL_BOUNDS
  const allowed = minutes !== undefined && (minutes === stored || (Number.isInteger(minutes) && minutes >= min && minutes <= max))
  return allowed ? [] : [{ path: 'refreshInterval', message: RATE_RANGE_MESSAGE }]
}

const keynamesOf = (plugin: PluginDetail, unsaved: UpdatePluginInput) => (unsaved.fields ?? plugin.fields).map(field => field.keyname)

/**
 * The part of the Plugin's form that the Data Sources section edits: the refresh interval and the Data Sources.
 * It is made by the section, because one rule depends on the Instance: whether it runs in demo mode.
 */
export function dataSourcesPart(demoMode: () => boolean): PluginFormPart<DataSourcesDraft> {
  return {
    keys: ['refreshInterval', 'dataSources'],
    read: plugin => ({ interval: intervalShown(plugin.refreshInterval), sources: plugin.dataSources.map(draftOf) }),
    toInput: draft => ({ refreshInterval: intervalMinutes(draft.interval), dataSources: kept(draft.sources).map(inputOf) }),
    validate: (draft, { plugin, unsaved }) => [
      ...intervalProblems(draft.interval, plugin.refreshInterval),
      ...sourcesProblems(draft.sources, { plugin: plugin.name, keynames: keynamesOf(plugin, unsaved) }, demoMode()),
    ],
  }
}

const ADDED_KEY = /^added-(\d+)$/

function nextAddedKey(sources: DataSourceDraft[]) {
  const counted = sources.map(row => Number(ADDED_KEY.exec(row.key)?.[1] ?? 0))
  return `added-${Math.max(0, ...counted) + 1}`
}

function freeName(sources: DataSourceDraft[]) {
  const taken = new Set(kept(sources).map(row => row.name.trim()))
  const candidates = ['source', ...sources.map((_, index) => `source_${index + 2}`), `source_${sources.length + 2}`]
  return candidates.find(name => !taken.has(name))!
}

/** What "Add a Data Source" appends: a GET fetch named `source`, or the next free `source_n`. */
export function addedDataSource(sources: DataSourceDraft[]): DataSourceDraft {
  return {
    key: nextAddedKey(sources),
    id: null,
    name: freeName(sources),
    mode: 'fetch',
    method: 'GET',
    url: '',
    headers: '',
    body: '',
    transformJs: '',
    literalValue: '',
    removed: false,
  }
}
