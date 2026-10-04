import type { DeviceDetail, DeviceSummary, ScreenRead } from 'kuroshiro-shared'
import type { DisplayAnswer, SetupAnswer } from '@/api/deviceCalls'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildScreen } from '@/testing/fixtures/screens'

const SIMULATOR = '/instance/simulator'
/** An address the server builds for a Device: absolute, on the server's own address. */
const served = (path: string) => new URL(path.replace(/^\/+/, ''), document.baseURI).href

const kitchenScreens = [
  buildScreen({ id: 'weather', name: 'Weather', deviceId: 'kitchen' }),
  buildScreen({ id: 'calendar', name: 'Calendar', deviceId: 'kitchen' }),
  buildScreen({ id: 'photos', name: 'Photos', deviceId: 'kitchen' }),
]

function onScreen(screen: ScreenRead) {
  return {
    kind: 'screen' as const,
    screenId: screen.id,
    name: screen.name,
    imagePath: `/screens/devices/${screen.deviceId}/${screen.id}.png`,
    renderedAt: '2026-10-03T07:31:00.000Z',
    servedAt: '2026-10-03T07:31:00.000Z',
    paused: false,
    holding: false,
  }
}

export const PLAYED_KITCHEN = buildDeviceDetail({
  id: 'kitchen',
  name: 'Kitchen',
  mac: 'A4:C1:38:5F:0B:9D',
  apikey: 'kitchen-key',
  currentScreen: onScreen(kitchenScreens[0]!),
  reported: { batteryVoltage: '4.05', rssi: '-61', firmwareVersion: '1.7.8', model: 'og_plus', width: 800, height: 480 },
  sensors: [{ kind: 'temperature', value: 21.5, unit: 'C' }],
})

export const PLAYED_HALLWAY = buildDeviceDetail({
  id: 'hallway',
  name: 'Hallway',
  friendlyId: '7B3E90',
  mac: 'A4:C1:38:11:22:33',
  apikey: 'hallway-key',
  reported: { batteryVoltage: '3.71', rssi: '-74', firmwareVersion: '1.7.6', model: 'og', width: 800, height: 480 },
  currentScreen: { kind: 'fallback', fallback: 'noScreen', reason: 'noScreens', screenId: null, imagePath: '/screens/fallback/noScreen.png', servedAt: '2026-10-03T07:20:00.000Z' },
  screenCount: 0,
})

const PLAYED_STUDY = buildDeviceDetail({
  id: 'study',
  name: 'Study',
  friendlyId: 'C41D02',
  mac: 'A4:C1:38:44:55:66',
  apikey: 'study-key',
  reported: { batteryVoltage: '3.98', rssi: '-55', firmwareVersion: '1.7.8', model: 'og_plus', width: 800, height: 480 },
  currentScreen: { kind: 'fallback', fallback: 'noScreen', reason: 'noScreens', screenId: null, imagePath: '/screens/fallback/noScreen.png', servedAt: '2026-10-03T07:22:00.000Z' },
  screenCount: 0,
})

export const FIRMWARE_1_8_0 = { id: 'fw-180', version: '1.8.0', kind: 'official-synced', label: null, deprecated: false } as const

/** The headers of one call to a Device-facing route, by their lower-case names. */
export type SentHeaders = Record<string, string>

export interface FakedSimulator {
  devices: DeviceDetail[]
  screens: Record<string, ScreenRead[]>
  /** Every poll's headers, in order. */
  polls: SentHeaders[]
  /** Every setup's headers, in order. */
  setups: SentHeaders[]
  /** Answers the next poll in place of the server's own answer, once. */
  refuseNextPoll?: Response
}

const SUMMARY_KEYS = Object.keys(buildDeviceSummary()) as (keyof DeviceSummary)[]
const summaryOf = (device: DeviceDetail) => Object.fromEntries(SUMMARY_KEYS.map(key => [key, device[key]])) as unknown as DeviceSummary

const headersOf = (request: Request): SentHeaders => Object.fromEntries([...request.headers.entries()].filter(([name]) => name !== 'accept'))

const NEW_FRIENDLY_ID = '9D0E4A'

function nextScreenOf(device: DeviceDetail, screens: ScreenRead[]) {
  if (screens.length === 0)
    return { kind: 'fallback' as const, fallback: 'noScreen' as const, reason: 'noScreens' as const, screenId: null, imagePath: '/screens/fallback/noScreen.png', servedAt: '2026-10-03T07:35:00.000Z' }
  const at = device.currentScreen.kind === 'screen' ? screens.findIndex(screen => screen.id === (device.currentScreen as { screenId: string }).screenId) : -1
  return onScreen(screens[(at + 1) % screens.length]!)
}

/** The answer the server gives a poll, and the Device as the poll leaves it: what was pending is taken. */
function polled(device: DeviceDetail, screens: ScreenRead[]): { answer: DisplayAnswer, after: DeviceDetail } {
  const shown = nextScreenOf(device, screens)
  const answer: DisplayAnswer = {
    action: device.pending.specialFunction ?? 'none',
    filename: shown.kind === 'screen' ? shown.screenId : 'noScreen.png',
    firmware_url: device.pending.firmwarePush ? served(`api/firmware/${device.targetFirmware?.id}/file`) : '',
    image_url: served(shown.imagePath),
    refresh_rate: device.refreshRate,
    reset_firmware: device.pending.deviceReset,
    special_function: device.pending.specialFunction ?? 'none',
    temperature_profile: 'default',
    update_firmware: device.pending.firmwarePush,
  }
  const after: DeviceDetail = {
    ...device,
    currentScreen: shown,
    lastSeenAt: '2026-10-03T07:35:00.000Z',
    pending: { firmwarePush: false, deviceReset: false, specialFunction: null },
  }
  return { answer, after }
}

/**
 * Fakes the admin API the Device Simulator reads (the Devices, one Device, its Screens) and the two
 * Device-facing routes it calls, which answer as the server does: a poll takes what is pending and moves
 * the Rotation on, setup with a MAC address nobody registered adds a Device.
 */
export function fakeSimulator({ devices = [PLAYED_KITCHEN, PLAYED_HALLWAY, PLAYED_STUDY], screens = { kitchen: kitchenScreens } }: { devices?: DeviceDetail[], screens?: Record<string, ScreenRead[]> } = {}): FakedSimulator {
  const faked: FakedSimulator = { devices: [...devices], screens, polls: [], setups: [] }
  const byId = (id: unknown) => faked.devices.find(device => device.id === id)
  const byMac = (mac: string | null) => faked.devices.find(device => device.mac === mac)

  fakeShellReads()
  api.use(
    http.get(apiUrl('devices'), () => HttpResponse.json(faked.devices.map(summaryOf))),
    http.get(apiUrl('devices/:id'), ({ params }) => {
      const device = byId(params.id)
      return device ? HttpResponse.json(device) : HttpResponse.json({ statusCode: 404, code: 'device-not-found', message: 'No Device here.' }, { status: 404 })
    }),
    http.get(apiUrl('devices/:id/screens'), ({ params }) => HttpResponse.json(faked.screens[String(params.id)] ?? [])),
    http.get(apiUrl('setup'), ({ request }) => {
      const headers = headersOf(request)
      faked.setups.push(headers)
      const known = byMac(headers.id ?? null)
      const device = known ?? buildDeviceDetail({
        id: 'new-device',
        name: NEW_FRIENDLY_ID,
        friendlyId: NEW_FRIENDLY_ID,
        mac: headers.id!,
        apikey: 'new-device-key',
        lastSeenAt: null,
        currentScreen: { kind: 'fallback', fallback: 'welcome', reason: 'neverPolled', screenId: null, imagePath: '/screens/fallback/welcome.png', servedAt: null },
        reported: { batteryVoltage: null, rssi: null, firmwareVersion: headers['fw-version'] ?? null, model: headers.model ?? null, width: null, height: null },
        screenCount: 0,
      })
      if (!known)
        faked.devices.push(device)
      const answer: SetupAnswer = { status: 200, image_url: served('screens/fallback/welcome.png'), message: 'Welcome to Kuroshiro', api_key: device.apikey, friendly_id: device.friendlyId }
      return HttpResponse.json(answer)
    }),
    http.get(apiUrl('display'), ({ request }) => {
      const headers = headersOf(request)
      faked.polls.push(headers)
      const refusal = faked.refuseNextPoll
      if (refusal) {
        faked.refuseNextPoll = undefined
        return refusal
      }
      const device = byMac(headers.id ?? null)
      if (!device)
        return HttpResponse.json({ statusCode: 404, message: 'Device not found', error: 'Not Found' }, { status: 404 })
      if (device.apikey !== headers['access-token'])
        return HttpResponse.json({ statusCode: 401, message: 'Invalid API key', error: 'Unauthorized' }, { status: 401 })
      const { answer, after } = polled(device, faked.screens[device.id] ?? [])
      faked.devices = faked.devices.map(each => each.id === device.id ? after : each)
      return HttpResponse.json(answer)
    }),
  )
  return faked
}

export async function mountSimulator(at = SIMULATOR) {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { level: 2, name: 'Device Simulator' })).toBeVisible()
  return screen
}
