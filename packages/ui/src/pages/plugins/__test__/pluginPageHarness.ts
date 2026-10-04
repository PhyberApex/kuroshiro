import type { DeviceModelRead, PaletteRead, PluginDetail, PreviewData, PreviewDataInput, PreviewName, UpdatePluginInput } from 'kuroshiro-shared'
import { delay, http, HttpResponse } from 'msw'
import { expect, onTestFinished } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceModel, buildDeviceModelList, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail, buildPreviewData } from '@/testing/fixtures/plugins'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'

/** What the specs of the Plugin page and of its sections share: the faked Plugin, the mounted page and the save bar. */

export const WEATHER = buildPluginDetail({ id: 'weather', name: 'Weather' })

const KITCHEN = { id: buildDeviceSummary().id, name: 'Kitchen' }

export const NOW = '2026-10-03T07:35:00.000Z'

/** The `{hh:mm}` of a sentence, which is in the timezone of the browser the spec runs in. */
export const clock = (at: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at))

export interface Faked {
  plugin: PluginDetail
  /** What the page asked the server to save, in order. */
  saves: UpdatePluginInput[]
  /** Every request for the preview's data, in order. */
  previews: PreviewDataInput[]
  /** What a fetch-mode Data Source answers the preview, by its name: its result, or an error marker. Left out, an empty object. */
  fetched: Record<string, unknown>
  /** The Sensors of the Devices the preview may be for, by the Device's id. */
  sensors: Record<string, Record<string, { value: number, unit: string }>>
}

const HIDDEN_FIELD_VALUE = '••••••••'

function fieldValuesAsRendered(plugin: PluginDetail, unsaved: Record<string, string | null> = {}) {
  return Object.fromEntries([...plugin.fields].sort((a, b) => a.order - b.order).map(({ keyname, type, default: fallback }) => {
    const stored = plugin.fieldValues[keyname]
    const storedSecret = stored?.secret === true && stored.set ? HIDDEN_FIELD_VALUE : null
    const saved = stored?.secret === false ? stored.value : storedSecret
    const value = (keyname in unsaved ? unsaved[keyname] : saved) || fallback || ''
    return [keyname, value && type === 'password' ? HIDDEN_FIELD_VALUE : value]
  }))
}

const isErrorMarker = (value: unknown): value is { error: true, message: string } => typeof value === 'object' && value !== null && (value as { error?: unknown }).error === true

function dataAsRendered({ plugin, fetched }: Faked, input: PreviewDataInput): Record<string, unknown> {
  if (plugin.kind === 'Webhook')
    return (plugin.webhook?.payload ?? {}) as Record<string, unknown>
  return Object.fromEntries((input.dataSources ?? plugin.dataSources).map(source =>
    [source.name, source.mode === 'literal' ? source.literalValue : fetched[source.name] ?? {}]))
}

/** The preview's data as the server answers it for what is faked and what the form sent. A Webhook Payload that is a list is not modelled. */
function previewDataOf(faked: Faked, input: PreviewDataInput): PreviewData {
  const values = fieldValuesAsRendered(faked.plugin, input.fieldValues)
  const data = dataAsRendered(faked, input)
  const withoutData = {
    ...values,
    trmnl: {
      system: { timestamp_utc: Math.floor(Date.now() / 1000) },
      plugin_settings: { instance_name: input.name ?? faked.plugin.name, strategy: 'polling', dark_mode: 'no', no_screen_padding: 'no', custom_fields_values: values },
      user: { id: 'kuroshiro-user', locale: 'en' },
    },
    sensors: input.deviceId ? faked.sensors[input.deviceId] ?? {} : {},
  }
  const isBuiltIn = (name: string) => name === 'sensors' || name === 'trmnl'
  return buildPreviewData({
    context: { ...withoutData, ...data },
    names: [
      ...Object.keys(values).filter(name => !(name in data) && !isBuiltIn(name)).map((name): PreviewName => ({ name, origin: 'fieldValue', error: null })),
      ...Object.entries(data).map(([name, value]): PreviewName => ({ name, origin: faked.plugin.kind === 'Webhook' ? 'webhookPayload' : 'dataSource', error: isErrorMarker(value) ? value.message : null })),
      ...(['sensors', 'trmnl'] as const).filter(name => !(name in data)).map((name): PreviewName => ({ name, origin: name, error: null })),
    ],
    fetchedAt: new Date().toISOString(),
    webhookPayloadReceivedAt: faked.plugin.webhook?.payloadReceivedAt ?? null,
  })
}

/** The Plugin as a save answers it by default: the name, the description and the refresh interval that were sent, laid over what was there. */
function withScalarsSaved(plugin: PluginDetail, { name, description, refreshInterval }: UpdatePluginInput): PluginDetail {
  return {
    ...plugin,
    name: name ?? plugin.name,
    description: description === undefined ? plugin.description : description,
    refreshInterval: refreshInterval ?? plugin.refreshInterval,
  }
}

/**
 * Fakes the Plugin's read, its save and the data of its preview, and the Instance Settings a section reads a threshold from. What it holds is read on every request, so a test
 * changes it and asks for a refresh. A section whose collection the answer must hold passes
 * its own `answer`, which maps what was sent to the read model.
 */
export function fakePlugin(plugin: PluginDetail = WEATHER, answer = withScalarsSaved): Faked {
  const faked: Faked = { plugin, saves: [], previews: [], fetched: {}, sensors: {} }
  fakeShellReads()
  fakePreviewLibrary()
  api.use(
    http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
    http.get(apiUrl(`plugins/${plugin.id}`), () => HttpResponse.json(faked.plugin)),
    http.patch(apiUrl(`plugins/${plugin.id}`), async ({ request }) => {
      const input = await request.json() as UpdatePluginInput
      faked.saves.push(input)
      faked.plugin = answer(faked.plugin, input)
      return HttpResponse.json(faked.plugin)
    }),
    http.post(apiUrl(`plugins/${plugin.id}/preview-data`), async ({ request }) => {
      const input = await request.json() as PreviewDataInput
      faked.previews.push(input)
      return HttpResponse.json(previewDataOf(faked, input))
    }),
  )
  return faked
}

/** The Device Models and Palettes the Template section sizes its preview by. Left out: TRMNL OG with the one Palette Kitchen is set to. */
export function fakePreviewLibrary(models: DeviceModelRead[] = [buildDeviceModel()], palettes: PaletteRead[] = [buildPalette({ usedBy: [KITCHEN] })]) {
  api.use(
    http.get(apiUrl('device-models'), () => HttpResponse.json(buildDeviceModelList({ models }))),
    http.get(apiUrl('device-models/palettes'), () => HttpResponse.json(palettes)),
  )
}

/**
 * Leaves the read of the Device Models unanswered, so the Template section's plate stays in its rendering state: a drawn
 * preview loads TRMNL's framework from the network, which a screenshot must not depend on.
 */
export function holdPreviewLibrary() {
  api.use(
    http.get(apiUrl('device-models'), async () => {
      await delay('infinite')
      return HttpResponse.json(buildDeviceModelList())
    }),
    http.get(apiUrl('device-models/palettes'), () => HttpResponse.json([])),
  )
}

/** Answers every fetch of a Plugin's preview data with `data`, for a page that is not faked with `fakePlugin`: a `*.shots.ts` file of the Plugin page. */
export function fakePreviewData(data: PreviewData = buildPreviewData(), pluginId = WEATHER.id) {
  api.use(http.post(apiUrl(`plugins/${pluginId}/preview-data`), () => HttpResponse.json(data)))
}

export async function mountPlugin(name = 'Weather', at = '/plugins/weather') {
  freezeTime(NOW)
  holdTabVisible()
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { name, level: 1 })).toBeVisible()
  return screen
}

export type Mounted = Awaited<ReturnType<typeof mountPlugin>>

/** Has the page read the Plugin again, as it does every 30 seconds. A re-read is held back while a typed-in control has the focus. */
export const refresh = () => window.dispatchEvent(new Event('focus'))

export const saveBar = (screen: Mounted) => screen.getByRole('region', { name: 'Unsaved changes' })

/** Catches what the page has the browser download, in place of the download. */
export function catchDownloads() {
  const addresses: string[] = []
  const hold = (event: MouseEvent) => {
    if (event.target instanceof HTMLAnchorElement && event.target.hasAttribute('download')) {
      event.preventDefault()
      addresses.push(event.target.href)
    }
  }
  document.addEventListener('click', hold, true)
  onTestFinished(() => document.removeEventListener('click', hold, true))
  return addresses
}
