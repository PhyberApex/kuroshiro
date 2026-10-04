import type { DeviceModelRead, FirmwareList, FirmwareRead, FirmwareSyncResult, InstanceSettingsResponse, UpdateInstanceSettingsInput } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceModel, buildDeviceModelList } from '@/testing/fixtures/device-models'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildFirmware, buildFirmwareList } from '@/testing/fixtures/firmware'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { freezeTime } from '@/testing/time'

export const NOW = '2026-10-03T07:35:00.000Z'

/** The three Devices of the Instance, as a Firmware refers to them. */
export const DEVICES = {
  kitchen: { id: 'kitchen', name: 'Kitchen' },
  hallway: { id: 'hallway', name: 'Hallway' },
  study: { id: 'study', name: 'Study' },
}
const { kitchen: KITCHEN, hallway: HALLWAY, study: STUDY } = DEVICES

const MODELS: DeviceModelRead[] = [
  buildDeviceModel({ name: 'og_png', label: 'TRMNL OG (1-bit)' }),
  buildDeviceModel({ name: 'og_plus', label: 'TRMNL OG' }),
  buildDeviceModel({ name: 'v2', label: 'TRMNL X' }),
  buildDeviceModel({ name: 'kindle_4', label: 'Kindle 4', deprecated: true }),
]

export const OFFICIAL = buildFirmware({
  id: 'official',
  version: '1.7.9',
  compatibleModels: ['og_png', 'og_plus'],
  syncedAt: '2026-09-30T04:00:00.000Z',
  targetOf: [{ ...HALLWAY, pushPending: true }, { ...STUDY, pushPending: false }],
  runningOn: [KITCHEN, STUDY],
})

const RELEASE_CANDIDATE = buildFirmware({
  id: 'candidate',
  version: '1.8.0-rc2',
  kind: 'custom',
  label: 'Release candidate, battery fix',
  compatibleModels: ['og_plus'],
  syncedAt: null,
  uploadedAt: '2026-10-02T09:12:00.000Z',
  targetOf: [{ ...STUDY, pushPending: true }],
})

const WITHOUT_FILE = buildFirmware({
  id: 'x-build',
  version: '2.0.3',
  kind: 'custom',
  label: 'TRMNL X build',
  compatibleModels: ['v2'],
  syncedAt: null,
  uploadedAt: '2026-09-12T18:40:00.000Z',
  filePresent: false,
})

export const EARLIER = [
  buildFirmware({ id: 'earlier-1', version: '1.6.9', compatibleModels: ['og_png', 'og_plus'], deprecated: true, syncedAt: '2026-09-02T04:00:00.000Z' }),
  buildFirmware({ id: 'earlier-2', version: '1.6.8', compatibleModels: ['og_png', 'og_plus'], deprecated: true, syncedAt: '2026-08-11T04:00:00.000Z' }),
]

const LIBRARY: FirmwareRead[] = [RELEASE_CANDIDATE, OFFICIAL, WITHOUT_FILE, ...EARLIER]

export const AUTO_UPDATE_ON = buildInstanceSettings({ firmwareAutoUpdate: { override: true, value: true, fallbackSource: 'default', fallbackValue: false } })

export interface FakedFirmware {
  /** The library on the server. A test changes it and the next read sees it. */
  library: FirmwareList
  settings: InstanceSettingsResponse
  /** The body of every `PATCH /api/settings`, in order. */
  settingsWrites: UpdateInstanceSettingsInput[]
  /** How often a sync was asked for. */
  syncs: number
  /** What the next sync answers: a result, or a refusal. */
  syncAnswer: FirmwareSyncResult | Response
  /** While set, a sync is not answered until it resolves. */
  holding?: Promise<unknown>
  /** The ids of the Firmware that were deleted, in order. */
  deleted: string[]
  /** Every upload the server took, in order: the file by its name and the fields as they were sent. */
  uploads: { file: string | undefined, version: unknown, label: unknown, compatibleModels: unknown }[]
}

interface Faked {
  firmware?: FirmwareRead[]
  lastSync?: FirmwareList['lastSync']
  settings?: InstanceSettingsResponse
  models?: DeviceModelRead[]
}

/** Fakes what the Firmware page reads and takes, with a library and Settings that change as the server would change them. */
export function fakeFirmware({ firmware = LIBRARY, lastSync = { ranAt: '2026-10-03T04:00:00.000Z', ok: true, error: null }, settings = buildInstanceSettings(), models = MODELS }: Faked = {}): FakedFirmware {
  const faked: FakedFirmware = {
    library: buildFirmwareList({ firmware, lastSync }),
    settings,
    settingsWrites: [],
    syncs: 0,
    syncAnswer: { ranAt: NOW, inserted: false, version: '1.7.9', assigned: [] },
    deleted: [],
    uploads: [],
  }
  freezeTime(NOW)
  fakeShellReads({ devices: [KITCHEN, HALLWAY, STUDY].map(device => buildDeviceSummary(device)) })
  api.use(
    http.get(apiUrl('firmware'), () => HttpResponse.json(faked.library)),
    http.get(apiUrl('device-models'), () => HttpResponse.json(buildDeviceModelList({ models }))),
    http.get(apiUrl('settings'), () => HttpResponse.json(faked.settings)),
    http.patch(apiUrl('settings'), async ({ request }) => {
      const input = await request.json() as UpdateInstanceSettingsInput
      faked.settingsWrites.push(input)
      const on = input.firmwareAutoUpdate ?? false
      faked.settings = { ...faked.settings, firmwareAutoUpdate: { ...faked.settings.firmwareAutoUpdate, override: input.firmwareAutoUpdate ?? null, value: on } }
      return HttpResponse.json(faked.settings)
    }),
    http.post(apiUrl('firmware/sync'), async () => {
      faked.syncs += 1
      await faked.holding
      if (faked.syncAnswer instanceof Response)
        return faked.syncAnswer.clone()
      faked.library = { ...faked.library, lastSync: { ranAt: faked.syncAnswer.ranAt, ok: true, error: null } }
      return HttpResponse.json(faked.syncAnswer)
    }),
    http.post(apiUrl('firmware/upload'), async ({ request }) => {
      const form = await request.formData()
      const file = form.get('file')
      const compatibleModels = JSON.parse(String(form.get('compatibleModels'))) as string[]
      faked.uploads.push({ file: file instanceof File ? file.name : undefined, version: form.get('version'), label: form.get('label'), compatibleModels })
      const uploaded = buildFirmware({
        id: 'uploaded',
        version: String(form.get('version')),
        kind: 'custom',
        label: String(form.get('label') ?? (file as File).name),
        compatibleModels,
        syncedAt: null,
        uploadedAt: NOW,
      })
      faked.library = { ...faked.library, firmware: [uploaded, ...faked.library.firmware] }
      return HttpResponse.json(uploaded, { status: 201 })
    }),
    http.delete(apiUrl('firmware/:id'), ({ params }) => {
      faked.deleted.push(String(params.id))
      faked.library = { ...faked.library, firmware: faked.library.firmware.filter(candidate => candidate.id !== params.id) }
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return faked
}

export async function mountFirmware() {
  const screen = await mountApp({ at: '/instance/firmware' })
  await expect.element(screen.getByRole('heading', { level: 2, name: 'Firmware' })).toBeVisible()
  return screen
}

/** Mounts the page and waits until its body has loaded. */
export async function mountLoadedFirmware() {
  const screen = await mountFirmware()
  await expect.element(screen.getByRole('switch', { name: 'Firmware Auto-Update' })).toBeVisible()
  return screen
}

export async function mountUpload() {
  const screen = await mountApp({ at: '/instance/firmware/upload' })
  await expect.element(screen.getByRole('heading', { level: 2, name: 'Upload Firmware' })).toBeVisible()
  await expect.element(screen.getByRole('radiogroup', { name: 'Fits' })).toBeVisible()
  return screen
}

/** A cell's lines, joined by a space: `textContent` alone joins two paragraphs without one. */
function cellSays(cell: Element) {
  const lines = [...cell.querySelectorAll(':scope > p')]
  return lines.length > 0 ? lines.map(words).join(' ') : words(cell)
}

/** What each row of a list says, cell by cell: the name, what it is, the date and actions. */
export function rowsOf(list: Element | null | undefined) {
  return [...list?.querySelectorAll('.library-row') ?? []].map(row => [...row.querySelector('.cells')!.children].map(cellSays))
}
