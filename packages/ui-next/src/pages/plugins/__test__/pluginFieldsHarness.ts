import type { FieldValueRead, PluginDetail, PluginFieldRead, UpdatePluginInput } from 'kuroshiro-shared'
import type { Mounted } from './pluginPageHarness'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { fakePlugin, saveBar } from './pluginPageHarness'

/** What the specs of the Field Values and of the Plugin Fields share: a Plugin with Plugin Fields, and a server that saves them. */

export function field(keyname: string, overrides: Partial<PluginFieldRead> = {}): PluginFieldRead {
  return {
    id: `${keyname}-id`,
    keyname,
    label: keyname,
    type: 'string',
    helpText: null,
    default: null,
    required: false,
    order: 0,
    options: null,
    ...overrides,
  }
}

export const LOCATION = field('location', { label: 'Location', required: true, helpText: 'A place name or a postcode.' })
export const UNITS = field('units', {
  label: 'Units',
  type: 'select',
  default: 'metric',
  options: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }],
})
export const SHOW_WIND = field('show_wind', { label: 'Show wind', type: 'boolean' })
export const API_KEY = field('api_key', { label: 'API key', type: 'password', required: true })

const stored = (value: string | null): FieldValueRead => ({ secret: false, value })

function weatherWith(fields: PluginFieldRead[], values: Record<string, string> = {}, overrides: Partial<PluginDetail> = {}) {
  return buildPluginDetail({
    id: 'weather',
    name: 'Weather',
    fields: fields.map((given, order) => ({ ...given, order })),
    fieldValues: Object.fromEntries(fields.map(({ keyname, type }) =>
      [keyname, type === 'password' ? { secret: true, set: keyname in values } : stored(values[keyname] ?? null)])),
    ...overrides,
  })
}

type Sent = NonNullable<UpdatePluginInput['fields']>[number]

function savedField(plugin: PluginDetail, sent: Sent, order: number): PluginFieldRead {
  return {
    id: plugin.fields.find(kept => kept.keyname === sent.keyname)?.id ?? `saved-${sent.keyname}`,
    keyname: sent.keyname,
    label: sent.name,
    type: sent.fieldType ?? 'string',
    helpText: sent.description ?? null,
    default: sent.defaultValue ?? null,
    required: sent.required ?? false,
    order,
    options: sent.options ?? null,
  }
}

function savedValue(before: FieldValueRead | undefined, type: string, sent: string | null | undefined): FieldValueRead {
  if (type === 'password')
    return { secret: true, set: sent === undefined ? before?.secret === true && before.set : Boolean(sent) }
  return stored(sent === undefined ? (before?.secret === false ? before.value : null) : sent || null)
}

/** The Plugin as the server answers a save of its Plugin Fields and Field Values: matched by keyname, a value going with its Plugin Field. */
function withFieldsSaved(plugin: PluginDetail, input: UpdatePluginInput): PluginDetail {
  const fields = input.fields?.map((sent, order) => savedField(plugin, sent, order)) ?? plugin.fields
  return {
    ...plugin,
    name: input.name ?? plugin.name,
    fields,
    fieldValues: Object.fromEntries(fields.map(({ keyname, type }) =>
      [keyname, savedValue(plugin.fieldValues[keyname], type, input.fieldValues?.[keyname])])),
  }
}

export function fakeWeather(fields: PluginFieldRead[], values: Record<string, string> = {}, overrides: Partial<PluginDetail> = {}) {
  return fakePlugin(weatherWith(fields, values, overrides), withFieldsSaved)
}

export const read = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim()

export const leave = () => (document.activeElement as HTMLElement).blur()

export async function save(screen: Mounted) {
  await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()
}
