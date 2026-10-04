import type { DeviceDetail, DeviceModelRead, FirmwareRead, InstanceFacts, InstanceSettingsResponse, PaletteRead, UpdateDeviceInput } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { userEvent } from 'vitest/browser'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceModel, buildDeviceModelList, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { buildFirmware, buildFirmwareList } from '@/testing/fixtures/firmware'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'

const NOW = '2026-10-03T07:35:00.000Z'

const PALETTES: PaletteRead[] = [
  buildPalette({ id: 'bw', name: 'Black and white', grays: 2 }),
  buildPalette({ id: 'gray-4', name: 'Greyscale, 4 levels' }),
  buildPalette({ id: 'gray-16', name: 'Greyscale, 16 levels', grays: 16 }),
  buildPalette({ id: 'warm', name: 'Warm paper', kind: 'custom' }),
]

export const MODELS: DeviceModelRead[] = [
  buildDeviceModel({ name: 'og_plus', label: 'TRMNL OG (2-bit)', width: 800, height: 480, paletteIds: ['gray-4', 'bw', 'warm'] }),
  buildDeviceModel({ name: 'v2', label: 'TRMNL X', width: 1872, height: 1404, paletteIds: ['gray-16', 'gray-4', 'bw'] }),
  buildDeviceModel({ name: 'kindle_4', label: 'Kindle 4', width: 600, height: 800, paletteIds: ['bw'], deprecated: true }),
]

const FIRMWARE: FirmwareRead[] = [
  buildFirmware({ id: 'fw-x', version: '2.0.1', compatibleModels: ['v2'] }),
  buildFirmware({ id: 'fw-custom', version: '1.8.0-rc2', kind: 'custom', label: 'Kitchen test build', syncedAt: null, uploadedAt: '2026-10-01T09:00:00.000Z' }),
  buildFirmware({ id: 'fw-official', version: '1.7.9', compatibleModels: ['og_png', 'og_plus'] }),
  buildFirmware({ id: 'fw-retired', version: '1.6.9', compatibleModels: ['og_png', 'og_plus'], deprecated: true }),
]

export const KITCHEN = buildDeviceDetail({
  id: 'kitchen',
  name: 'Kitchen',
  mac: 'A4:CF:12:4F:2A:1C',
  apikey: 'kq3ZpT8w1vYcN5hLx0a91e',
  palette: { id: 'gray-4', name: 'Greyscale, 4 levels', kind: 'official' },
  screenCount: 6,
})

const HH_MM = 'HH:MM'.length
const timeOfDay = (seconds: number) => new Date(seconds * 1000).toISOString().slice(11, 11 + HH_MM)

function targetOf(firmwareId: string | null, firmware: FirmwareRead[]): DeviceDetail['targetFirmware'] {
  const chosen = firmware.find(candidate => candidate.id === firmwareId)
  return chosen ? { id: chosen.id, version: chosen.version, kind: chosen.kind, label: chosen.label, deprecated: chosen.deprecated } : null
}

interface Reference {
  models: DeviceModelRead[]
  palettes: PaletteRead[]
  firmware: FirmwareRead[]
}

/** The Device after a write, as the server would answer it: enough of its rules for the page to follow its own saves. */
function written(device: DeviceDetail, input: UpdateDeviceInput, { models, palettes, firmware }: Reference): DeviceDetail {
  const model = models.find(candidate => candidate.name === input.deviceModelName)
  const paletteId = input.paletteId ?? model?.paletteIds[0]
  const palette = palettes.find(candidate => candidate.id === paletteId)
  const mirror = {
    enabled: input.mirrorEnabled ?? device.mirror.enabled,
    mac: input.mirrorMac?.toUpperCase() ?? device.mirror.mac,
    apikeySet: device.mirror.apikeySet || input.mirrorApikey !== undefined,
  }
  return {
    ...device,
    name: input.name ?? device.name,
    refreshRate: input.refreshRate ?? device.refreshRate,
    deviceModel: model ? { name: model.name, label: model.label, width: model.width, height: model.height, deprecated: model.deprecated } : device.deviceModel,
    palette: palette ? { id: palette.id, name: palette.name, kind: palette.kind } : device.palette,
    sleep: {
      ...device.sleep,
      enabled: input.sleepModeEnabled ?? device.sleep.enabled,
      start: typeof input.sleepStartTime === 'number' ? timeOfDay(input.sleepStartTime) : device.sleep.start,
      end: typeof input.sleepEndTime === 'number' ? timeOfDay(input.sleepEndTime) : device.sleep.end,
      whileAsleep: input.sleepScreenEnabled === undefined ? device.sleep.whileAsleep : input.sleepScreenEnabled ? 'fallback' : 'keep',
    },
    mirror,
    isMirrored: mirror.enabled,
    isProxied: mirror.enabled && mirror.mac === device.mac,
    targetFirmware: input.targetFirmwareId === undefined ? device.targetFirmware : targetOf(input.targetFirmwareId, firmware),
    pending: {
      specialFunction: input.specialFunction === undefined ? device.pending.specialFunction : input.specialFunction === 'none' ? null : input.specialFunction,
      deviceReset: input.resetDevice ?? device.pending.deviceReset,
      firmwarePush: input.updateFirmware ?? device.pending.firmwarePush,
    },
  }
}

export interface FakedSettings {
  /** The Device on the server. A test changes it and the next read sees it. */
  device: DeviceDetail
  /** The body of every `PATCH /api/devices/kitchen`, in order. */
  writes: UpdateDeviceInput[]
  /** How often the Device was deleted. */
  deleted: number
  /** While set, every write is answered with it. */
  refusing?: Response
  /** While set, a write is not answered until it resolves. */
  holding?: Promise<unknown>
}

interface Faked {
  device?: DeviceDetail
  models?: DeviceModelRead[]
  palettes?: PaletteRead[]
  firmware?: FirmwareRead[]
  settings?: InstanceSettingsResponse
  instance?: InstanceFacts
}

/** Fakes what Kitchen's Settings read and take, with a Device that changes as the server would change it. */
export function fakeKitchenSettings({ device = KITCHEN, models = MODELS, palettes = PALETTES, firmware = FIRMWARE, settings = buildInstanceSettings(), instance }: Faked = {}): FakedSettings {
  const faked: FakedSettings = { device, writes: [], deleted: 0 }
  let devices = [device]
  freezeTime(NOW)
  holdTabVisible()
  fakeShellReads({ instance })
  api.use(
    http.get(apiUrl('devices'), () => HttpResponse.json(devices.map(listed => listed.id === faked.device.id ? faked.device : listed))),
    http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(faked.device)),
    http.get(apiUrl('devices/kitchen/screens'), () => HttpResponse.json([])),
    http.get(apiUrl('device-models'), () => HttpResponse.json(buildDeviceModelList({ models }))),
    http.get(apiUrl('device-models/palettes'), () => HttpResponse.json(palettes)),
    http.get(apiUrl('firmware'), () => HttpResponse.json(buildFirmwareList({ firmware }))),
    http.get(apiUrl('settings'), () => HttpResponse.json(settings)),
    http.patch(apiUrl('devices/kitchen'), async ({ request }) => {
      const input = await request.json() as UpdateDeviceInput
      faked.writes.push(input)
      await faked.holding
      if (faked.refusing)
        return faked.refusing.clone()
      faked.device = written(faked.device, input, { models, palettes, firmware })
      return HttpResponse.json(faked.device)
    }),
    http.delete(apiUrl('devices/kitchen'), () => {
      faked.deleted += 1
      devices = []
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return faked
}

export type Screen = Awaited<ReturnType<typeof mountApp>>

export async function mountSettings(fragment = '') {
  const screen = await mountApp({ at: `/devices/kitchen/settings${fragment}` })
  await expect.element(screen.getByText('Changes save as you make them.')).toBeVisible()
  return screen
}

export const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** The row a control stands in, a Setting row or one that is only read. */
export function rowOf(screen: Screen, label: string) {
  return [...screen.getByRole('main').element().querySelectorAll('.setting-row, .read-row')].find(row => words(row.querySelector('.label')) === label)
}

export const noteOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.note'))
export const sideOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.source, .side'))
export const shownOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.shown'))
export const errorOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.under'))
/** What the row's save state says: "Saving", "Saved", "Not saved. …", or nothing. */
export const stateOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.save-state [role="status"]'))

export async function choose(screen: Screen, select: string, option: string) {
  await screen.getByRole('combobox', { name: select }).click()
  await screen.getByRole('option', { name: option, exact: true }).click()
}

/** The labels a select offers, in order, and closes it again. */
export async function offeredBy(screen: Screen, select: string) {
  await screen.getByRole('combobox', { name: select }).click()
  await expect.element(screen.getByRole('listbox')).toBeVisible()
  const labels = screen.getByRole('option').elements().map(option => words(option))
  await userEvent.keyboard('{Escape}')
  return labels
}

/** A promise a test settles itself, for a write the server has not answered yet. */
export function held() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
