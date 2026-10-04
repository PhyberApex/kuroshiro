import type { CreateCustomPaletteInput, DeviceModelList, DeviceModelRead, DeviceModelSyncResult, DeviceReference, PaletteRead, UpdateCustomPaletteInput } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceModel, buildDeviceModelList, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { freezeTime } from '@/testing/time'
import { DEVICES, NOW } from './firmwareHarness'

const { kitchen, hallway, study } = DEVICES

const LAST_SYNCED = '2026-10-03T04:00:00.000Z'

const official = (id: string, name: string, overrides: Partial<PaletteRead> = {}) => buildPalette({ id, name, syncedAt: LAST_SYNCED, ...overrides })

export const TRMNL_PALETTES: PaletteRead[] = [
  official('bw', 'Black & White (1-bit)', { grays: 2 }),
  official('gray-4', '4 Grays (2-bit)', { grays: 4, usedBy: [kitchen] }),
  official('gray-16', '16 Grays (4-bit)', { grays: 16 }),
  official('color-3bwr', 'Color (3 colors)', { grays: 2, colors: ['#000000', '#FF0000', '#FFFFFF'], frameworkClass: 'screen--color-3bwr' }),
  official('color-6a', 'Color (6 colors)', { grays: 2, colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'], frameworkClass: 'screen--color-6a' }),
]

const STUDY_PANEL = buildPalette({
  id: 'study-panel',
  name: 'Study panel, measured',
  kind: 'custom',
  grays: 2,
  colors: ['#16141C', '#E6E6E0', '#9E2A22', '#3A6A3C', '#27407E', '#D8C13A'],
  frameworkClass: 'screen--color-6a',
  syncedAt: null,
  usedBy: [study],
})

const SOFT_RED = buildPalette({
  id: 'soft-red',
  name: 'Soft red',
  kind: 'custom',
  grays: 2,
  colors: ['#111111', '#B53A30', '#F2F0EA'],
  frameworkClass: 'screen--color-3bwr',
  syncedAt: null,
})

function model(name: string, label: string, paletteIds: string[], overrides: Partial<DeviceModelRead> = {}) {
  return buildDeviceModel({ name, label, paletteIds, defaultPaletteId: paletteIds.at(-1) ?? null, syncedAt: LAST_SYNCED, ...overrides })
}

export const KOBO_AURA = model('kobo_aura', 'Kobo Aura', ['bw', 'gray-16'], { width: 758, height: 1024, deprecated: true, syncedAt: '2026-09-02T04:00:00.000Z' })

/** Seven Device Models as the server orders them, two of them in use: Kitchen and Hallway on the TRMNL OG, Study on the Seeed. */
export const DEVICE_MODELS: DeviceModelRead[] = [
  model('inkplate_10', 'Inkplate 10', ['bw', 'gray-4'], { width: 1200, height: 825 }),
  model('kindle_pw_7', 'Kindle Paperwhite 7', ['bw', 'gray-4', 'gray-16'], { width: 1236, height: 1648 }),
  KOBO_AURA,
  model('seeed_e1002', 'Seeed reTerminal E1002', ['bw', 'color-6a', 'study-panel'], { defaultPaletteId: 'color-6a', usedBy: [study] }),
  model('og_plus', 'TRMNL OG', ['bw', 'gray-4'], { usedBy: [hallway, kitchen] }),
  model('og_png', 'TRMNL OG (1-bit)', ['bw']),
  model('v2', 'TRMNL X', ['bw', 'gray-4', 'gray-16'], { width: 1872, height: 1404 }),
]

/** The same Device Models and Palettes on an Instance without a Device. */
export const UNUSED = {
  models: DEVICE_MODELS.map(deviceModel => ({ ...deviceModel, usedBy: [] })),
  palettes: [...TRMNL_PALETTES, STUDY_PANEL, SOFT_RED].map(palette => ({ ...palette, usedBy: [] })),
  devices: [],
}

export interface FakedDeviceModels {
  /** The Device Models on the server. A test changes them and the next read sees it. */
  list: DeviceModelList
  palettes: PaletteRead[]
  /** How often a sync was asked for. */
  syncs: number
  /** What the next sync answers: a result, or a refusal. */
  syncAnswer: DeviceModelSyncResult | Response
  /** While set, a sync is not answered until it resolves. */
  holding?: Promise<unknown>
  /** Every write to a custom Palette, in order. */
  writes: { method: string, path: string, body?: unknown }[]
}

/** The id the server gives the custom Palette a test adds. */
const NEW_PALETTE_ID = 'f3a1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

interface Faked {
  models?: DeviceModelRead[]
  palettes?: PaletteRead[]
  lastSync?: DeviceModelList['lastSync']
  devices?: DeviceReference[]
}

/** Fakes what the Device Models and Palettes page reads and its sync, which is recorded as the server records it. */
export function fakeDeviceModels({
  models = DEVICE_MODELS,
  palettes = [...TRMNL_PALETTES, STUDY_PANEL, SOFT_RED],
  lastSync = { ranAt: LAST_SYNCED, ok: true, error: null },
  devices = Object.values(DEVICES),
}: Faked = {}): FakedDeviceModels {
  const faked: FakedDeviceModels = {
    list: buildDeviceModelList({ models, lastSync }),
    palettes,
    syncs: 0,
    syncAnswer: { models: 38, palettes: 11, deprecatedModels: 0, deprecatedPalettes: 0, ranAt: NOW },
    writes: [],
  }
  const written = (method: string, path: string, body?: unknown) => faked.writes.push({ method, path, ...(body === undefined ? {} : { body }) })
  freezeTime(NOW)
  fakeShellReads({ devices: devices.map(device => buildDeviceSummary(device)) })
  api.use(
    http.get(apiUrl('device-models'), () => HttpResponse.json(faked.list)),
    http.get(apiUrl('device-models/palettes'), () => HttpResponse.json(faked.palettes)),
    http.post(apiUrl('device-models/sync'), async () => {
      faked.syncs += 1
      await faked.holding
      if (faked.syncAnswer instanceof Response)
        return faked.syncAnswer.clone()
      faked.list = { ...faked.list, lastSync: { ranAt: faked.syncAnswer.ranAt, ok: true, error: null } }
      return HttpResponse.json(faked.syncAnswer)
    }),
    http.post(apiUrl('device-models/palettes'), async ({ request }) => {
      const body = await request.json() as CreateCustomPaletteInput
      written('POST', 'device-models/palettes', body)
      const created = buildPalette({ id: NEW_PALETTE_ID, kind: 'custom', grays: 2, colors: body.colors, name: body.name, frameworkClass: body.frameworkClass, grayscaleBitDepth: null, syncedAt: null })
      faked.palettes = [...faked.palettes, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.patch(apiUrl('device-models/palettes/:id'), async ({ request, params }) => {
      const body = await request.json() as UpdateCustomPaletteInput
      written('PATCH', `device-models/palettes/${params.id}`, body)
      faked.palettes = faked.palettes.map(palette => palette.id === params.id ? { ...palette, ...body } : palette)
      return HttpResponse.json(faked.palettes.find(palette => palette.id === params.id))
    }),
    http.delete(apiUrl('device-models/palettes/:id'), ({ params }) => {
      written('DELETE', `device-models/palettes/${params.id}`)
      faked.palettes = faked.palettes.filter(palette => palette.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return faked
}

export const MODELS_PATH = '/instance/models'

export async function mountDeviceModels(at = MODELS_PATH) {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { level: 2, name: 'Device Models and Palettes' })).toBeVisible()
  return screen
}

/** Mounts the page and waits until its body has loaded. */
export async function mountLoadedDeviceModels(at = MODELS_PATH) {
  const screen = await mountDeviceModels(at)
  await expect.element(screen.getByRole('region', { name: 'Device Models' })).toBeVisible()
  return screen
}
