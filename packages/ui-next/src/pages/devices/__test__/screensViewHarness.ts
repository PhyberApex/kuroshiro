import type { DeviceDetail, InstanceFacts, PluginSummary, ScheduleInput, ScreenRead, UpdateMashupInput, UpdateScreenInput } from 'kuroshiro-shared'
import type { mountApp } from '@/testing/app'
import { MASHUP_LAYOUTS } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { screenArt } from '@/gallery/screenArt'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads } from '@/testing/app'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { buildSchedule, buildScreen } from '@/testing/fixtures/screens'
import { fakeScreenImages } from '@/testing/images'
import { freezeTime } from '@/testing/time'

const NOW = '2026-10-03T07:35:00.000Z'
export const RENDERED_AT = '2026-10-03T07:31:00.000Z'

export const imagePath = (id: string) => `/screens/devices/kitchen/${id}.png?v=1`

const PLUGIN_NAMES = { weather: 'Weather', calendar: 'Calendar', trains: 'Train departures', bins: 'Bin day' }

const PLUGINS: PluginSummary[] = Object.entries(PLUGIN_NAMES).map(([id, name]) => buildPluginSummary({ id, name }))

function mashupSlot(position: string, pluginId: keyof typeof PLUGIN_NAMES) {
  return { position, size: 'half_vertical' as const, pluginId, pluginName: PLUGIN_NAMES[pluginId] }
}

/** A Screen of Kitchen's. */
export const kitchenScreen = (screen: Parameters<typeof buildScreen>[0]) => buildScreen({ deviceId: 'kitchen', ...screen })

/** One Screen of each kind, in the Order the kinds are named in. */
export const SCREENS_OF_EVERY_KIND: ScreenRead[] = [
  kitchenScreen({ id: 'weather', name: 'Weather', order: 1, state: 'active', imagePath: imagePath('weather'), plugin: { id: 'weather', name: 'Weather', kind: 'Poll', requiredFieldEmpty: false, fetchAlertFiring: false } }),
  kitchenScreen({ id: 'weekend', name: 'Weekend board', order: 2, kind: 'mashup', plugin: null, imagePath: imagePath('weekend'), mashup: { layout: '1Lx1R', slots: [mashupSlot('left', 'weather'), mashupSlot('right', 'calendar')] } }),
  kitchenScreen({ id: 'webcam', name: 'Harbour webcam', order: 3, kind: 'external', plugin: null, imagePath: imagePath('webcam'), external: { url: 'https://harbour.example/cam.jpg', fetchManual: true } }),
  kitchenScreen({ id: 'photo', name: 'Harbour photo', order: 4, kind: 'file', plugin: null, imagePath: imagePath('photo'), file: { originalName: 'harbour.png', width: 1600, height: 960, bytes: 421_888, uploadedAt: '2026-09-12T10:00:00.000Z' } }),
  kitchenScreen({ id: 'notes', name: 'Notes', order: 5, kind: 'html', plugin: null, imagePath: imagePath('notes'), html: '<h1>Notes</h1>' }),
]

const ALWAYS: ScheduleInput = { enabled: true, weekdays: null, startTime: null, endTime: null, startDate: null, endDate: null }

/** The Screen with the Schedule a write leaves it, and the one Screen State the fake works out: a Schedule that is off. */
function scheduled(screen: ScreenRead, input: ScheduleInput): ScreenRead {
  const schedule = { ...buildSchedule(ALWAYS), ...screen.schedule, ...input }
  const stateWithoutSchedule = screen.state === 'scheduleOff' ? null : screen.state
  return { ...screen, schedule, state: schedule.enabled ? stateWithoutSchedule : 'scheduleOff' }
}

/** A write the page made: its method, its path under `/api/` and what it sent. An upload is recorded by its file's name. */
export interface Write {
  method: string
  path: string
  body?: unknown
}

export interface FakedKitchen {
  device: DeviceDetail
  screens: ScreenRead[]
  writes: Write[]
}

interface KitchenOptions {
  device?: DeviceDetail
  screens?: ScreenRead[]
  plugins?: PluginSummary[]
  instance?: InstanceFacts
}

/**
 * Fakes the Device Kitchen with what its Screens view reads and every write an opened Screen makes.
 * A write changes `screens` as the server would and is kept in `writes`; a test that needs a refusal
 * adds its own handler afterwards.
 */
export function fakeKitchen({
  device = buildDeviceDetail({ id: 'kitchen', name: 'Kitchen', lastSeenAt: RENDERED_AT, screenCount: SCREENS_OF_EVERY_KIND.length }),
  screens = SCREENS_OF_EVERY_KIND,
  plugins = PLUGINS,
  instance = buildInstanceFacts(),
}: KitchenOptions = {}): FakedKitchen {
  const faked: FakedKitchen = { device, screens, writes: [] }
  const answerChanged = (id: string, change: (screen: ScreenRead) => ScreenRead) => {
    faked.screens = faked.screens.map(screen => screen.id === id ? change(screen) : screen)
    return HttpResponse.json(faked.screens.find(screen => screen.id === id))
  }
  const removed = (keeps: (screen: ScreenRead) => boolean) => {
    faked.screens = faked.screens.filter(keeps)
    faked.device = { ...faked.device, screenCount: faked.screens.length }
    return new HttpResponse(null, { status: 204 })
  }
  const uploadedName = async (request: Request) => ((await request.formData()).get('file') as File).name

  freezeTime(NOW)
  fakeScreenImages()
  fakeShellReads({ instance, devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })] })
  api.use(
    http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(faked.device)),
    http.get(apiUrl('devices/kitchen/screens'), () => HttpResponse.json(faked.screens)),
    http.get(apiUrl('plugins'), () => HttpResponse.json(plugins)),
    http.patch(apiUrl('screens/:id'), async ({ request, params }) => {
      const body = await request.json() as UpdateScreenInput
      const { name, html, ...external } = body
      faked.writes.push({ method: 'PATCH', path: `screens/${params.id}`, body })
      return answerChanged(String(params.id), screen => ({
        ...screen,
        name: name ?? screen.name,
        html: html ?? screen.html,
        external: screen.external && { ...screen.external, ...external },
      }))
    }),
    http.post(apiUrl('screens/:id/refresh'), ({ params }) => {
      faked.writes.push({ method: 'POST', path: `screens/${params.id}/refresh` })
      return answerChanged(String(params.id), screen => ({ ...screen, renderedAt: new Date().toISOString() }))
    }),
    http.post(apiUrl('screens/:id/image-preview'), async ({ request, params }) => {
      faked.writes.push({ method: 'POST', path: `screens/${params.id}/image-preview`, body: await uploadedName(request) })
      const drawing = decodeURIComponent(screenArt(800, 480).replace('data:image/svg+xml,', ''))
      return new HttpResponse(drawing, { headers: { 'Content-Type': 'image/svg+xml' } })
    }),
    http.put(apiUrl('screens/:id/image'), async ({ request, params }) => {
      const originalName = await uploadedName(request)
      faked.writes.push({ method: 'PUT', path: `screens/${params.id}/image`, body: originalName })
      return answerChanged(String(params.id), screen => ({ ...screen, file: screen.file && { ...screen.file, originalName } }))
    }),
    http.delete(apiUrl('screens/:id'), ({ params }) => {
      faked.writes.push({ method: 'DELETE', path: `screens/${params.id}` })
      return removed(screen => screen.id !== params.id)
    }),
    http.patch(apiUrl('mashup/:id'), async ({ request, params }) => {
      const body = await request.json() as UpdateMashupInput
      faked.writes.push({ method: 'PATCH', path: `mashup/${params.id}`, body })
      return answerChanged(String(params.id), (screen) => {
        const layout = MASHUP_LAYOUTS.find(known => known.id === (body.layout ?? screen.mashup?.layout))!
        const slots = layout.slots.map((slot, index) => {
          const plugin = plugins.find(known => known.id === body.pluginIds[index])!
          return { ...slot, pluginId: plugin.id, pluginName: plugin.name }
        })
        return { ...screen, mashup: { layout: layout.id, slots } }
      })
    }),
    http.post(apiUrl('screens/:id/schedule'), async ({ request, params }) => {
      const body = await request.json() as ScheduleInput
      faked.writes.push({ method: 'POST', path: `screens/${params.id}/schedule`, body })
      return answerChanged(String(params.id), screen => scheduled(screen, body))
    }),
    http.patch(apiUrl('screens/:id/schedule'), async ({ request, params }) => {
      const body = await request.json() as ScheduleInput
      faked.writes.push({ method: 'PATCH', path: `screens/${params.id}/schedule`, body })
      return answerChanged(String(params.id), screen => scheduled(screen, body))
    }),
    http.delete(apiUrl('screens/:id/schedule'), ({ params }) => {
      faked.writes.push({ method: 'DELETE', path: `screens/${params.id}/schedule` })
      return answerChanged(String(params.id), screen => ({ ...screen, schedule: null, state: screen.state === 'scheduleOff' ? null : screen.state }))
    }),
    http.delete(apiUrl('plugins/:pluginId/assignments/kitchen'), ({ params }) => {
      faked.writes.push({ method: 'DELETE', path: `plugins/${params.pluginId}/assignments/kitchen` })
      return removed(screen => screen.plugin?.id !== params.pluginId)
    }),
  )
  return faked
}

export type MountedApp = Awaited<ReturnType<typeof mountApp>>

export const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** What stands under `root`, one entry per child. */
export const lines = (root: Element) => [...root.children].map(words)

/** The opened row of the Screen the address names. */
export async function openedRow(screen: MountedApp, name: string) {
  const region = screen.getByRole('region', { name, exact: true })
  await expect.element(region).toBeVisible()
  return region
}
