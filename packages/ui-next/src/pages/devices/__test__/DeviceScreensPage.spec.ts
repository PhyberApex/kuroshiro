import type { AlertSummary, DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { clockTime } from '@/patterns/time'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildSchedule, buildScreen } from '@/testing/fixtures/screens'
import { fakeScreenImages } from '@/testing/images'
import { withMotionAllowed } from '@/testing/media'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { freezeTime } from '@/testing/time'
import { resetViewport, resizeTo } from '@/testing/viewport'

const NOW = '2026-10-03T07:35:00.000Z'
const SERVED_AT = '2026-10-03T07:31:00.000Z'
const NEXT_POLL_AT = '2026-10-03T07:46:00.000Z'
const served = clockTime(new Date(SERVED_AT))
const nextPoll = clockTime(new Date(NEXT_POLL_AT))

const imagePath = (id: string) => `/screens/devices/kitchen/${id}.png?v=1`

const SCREENS: ScreenRead[] = [
  buildScreen({ id: 'weather', name: 'Weather', order: 1, imagePath: imagePath('weather') }),
  buildScreen({ id: 'calendar', name: 'Calendar', order: 2, state: 'active', imagePath: imagePath('calendar'), schedule: buildSchedule() }),
  buildScreen({ id: 'photo', name: 'Harbour photo', order: 3, kind: 'file', plugin: null, state: 'upNext', imagePath: imagePath('photo') }),
  buildScreen({ id: 'trains', name: 'Train departures', order: 4, state: 'scheduleOff', imagePath: imagePath('trains'), schedule: buildSchedule({ enabled: false, startTime: '06:30', endTime: '08:30' }) }),
  buildScreen({ id: 'weekend', name: 'Weekend board', order: 5, kind: 'mashup', plugin: null, state: 'notToday', stateCause: 'weekday', imagePath: imagePath('weekend'), schedule: buildSchedule({ weekdays: [0], startTime: null, endTime: null }) }),
]

function kitchen(overrides: Partial<DeviceDetail> = {}) {
  return buildDeviceDetail({
    id: 'kitchen',
    name: 'Kitchen',
    lastSeenAt: SERVED_AT,
    nextPollAt: NEXT_POLL_AT,
    screenCount: SCREENS.length,
    currentScreen: { kind: 'screen', screenId: 'calendar', name: 'Calendar', imagePath: imagePath('calendar'), renderedAt: SERVED_AT, servedAt: SERVED_AT, paused: false, holding: false },
    ...overrides,
  })
}

interface Faked {
  device: DeviceDetail
  screens: ScreenRead[]
  /** Every Order the page asked the server to save. */
  savedOrders: string[][]
}

/** Fakes what the Screens view reads. What it returns is read on every request, so a test changes it and asks for a refresh. */
function fakeKitchen({ device = kitchen(), screens = SCREENS, alerts = [] as AlertSummary[] } = {}): Faked {
  const faked: Faked = { device, screens, savedOrders: [] }
  freezeTime(NOW)
  fakeScreenImages()
  fakeShellReads({ devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })], alerts: buildAlertsList({ active: alerts }) })
  api.use(
    http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(faked.device)),
    http.get(apiUrl('devices/kitchen/screens'), () => HttpResponse.json(faked.screens)),
    http.put(apiUrl('devices/kitchen/screens/order'), async ({ request }) => {
      const { screenIds } = await request.json() as { screenIds: string[] }
      faked.savedOrders.push(screenIds)
      faked.screens = screenIds.map(id => faked.screens.find(screen => screen.id === id)!)
      return HttpResponse.json(faked.screens)
    }),
  )
  return faked
}

type Screen = Awaited<ReturnType<typeof mountApp>>

const words = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const hero = (screen: Screen) => screen.getByRole('region', { name: 'Current Screen', exact: true })
const rowsList = (screen: Screen) => screen.getByRole('region', { name: 'Screens in Order' })
const rowNames = (screen: Screen) => [...rowsList(screen).element().querySelectorAll('.trigger')].map(words)
const rowOf = (name: string) => [...document.querySelectorAll('.screen-row')].find(row => words(row.querySelector('.trigger')) === name)!
const factRows = (screen: Screen) => [...screen.getByRole('main').element().querySelectorAll('.fact')].map(fact => [words(fact.querySelector('dt')), words(fact.querySelector('dd'))])
const refresh = () => window.dispatchEvent(new Event('focus'))

async function opened(screen: Screen, name: string) {
  await screen.getByRole('button', { name, exact: true }).click()
  const region = screen.getByRole('region', { name, exact: true })
  await expect.element(region).toBeVisible()
  return region
}

afterEach(() => resetViewport())

describe('the plate and its column', () => {
  it('shows the Current Screen under the seal, with its place in the Order and what is up next', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('img', { name: 'On Kitchen: Calendar' })).toBeVisible()
    await expect.element(screen.getByRole('heading', { level: 2, name: 'Calendar' })).toBeVisible()
    expect(words(hero(screen).element())).toContain(`The Current Screen. Order 2 of 5, on the Device since the ${served} poll.`)
    expect(words(hero(screen).element())).toContain(`Up next: Harbour photo, at the poll around ${nextPoll}.`)
    expect(hero(screen).element().querySelector('.plate .seal')).not.toBeNull()
    await expect.element(screen.getByRole('link', { name: 'Add Screen' })).toHaveAttribute('href', '/devices/kitchen/screens/new')
  })

  it('shows an offline Device\'s last image without the seal, and the Alert as the only red', async () => {
    fakeKitchen({ device: kitchen({ lastSeenAt: '2026-10-03T04:10:00.000Z' }), alerts: [buildAlert({ kind: 'device-offline', deviceId: 'kitchen' })] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByText('It has not called in since.', { exact: false })).toBeVisible()
    expect(hero(screen).element().querySelector('.plate .seal')).toBeNull()
    expect(factRows(screen)[0]).toEqual(['Alert: offline', 'last seen 3 h ago'])
    const red = elementsInSealColour(hero(screen).element())
    expect(red.length).toBeGreaterThan(0)
    expect(red.every(element => element.closest('.fact.alert') !== null)).toBe(true)
  })

  it('says why a Device with failed Mirroring shows the error Fallback Screen, and links to Settings', async () => {
    fakeKitchen({ device: kitchen({
      isMirrored: true,
      currentScreen: { kind: 'fallback', fallback: 'error', reason: 'mirrorFailed', screenId: null, imagePath: '/screens/devices/kitchen/error.png?v=1', servedAt: SERVED_AT },
    }) })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Mirroring failed' })).toBeVisible()
    await expect.element(hero(screen).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/devices/kitchen/settings')
    await expect.element(screen.getByRole('img', { name: 'On Kitchen: Mirroring failed' })).toBeVisible()
  })
})

describe('the facts', () => {
  it('are last seen, battery, signal and Sleep Mode, with the exact time behind "4 min ago"', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByText('4 min ago')).toBeVisible()
    expect(factRows(screen)).toEqual([
      ['Last seen', '4 min ago'],
      ['Battery', '76 %'],
      ['Signal', '−61 dBm'],
      ['Sleep Mode', 'Off'],
    ])
    expect(elementsInSealColour(hero(screen).element().querySelector('.fact-rows')!)).toEqual([])

    await screen.getByText('4 min ago').hover()
    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toHaveTextContent(`3 Oct 2026, ${served}`)
  })

  it('leave the battery out for a Device that reports no voltage, and add Sensors, a size mismatch and what waits for the next poll', async () => {
    fakeKitchen({ device: kitchen({
      batteryPercent: null,
      sensors: [{ kind: 'temperature', value: 21.4, unit: '°C' }, { kind: 'carbon_dioxide', value: 612, unit: 'ppm' }],
      reported: { ...kitchen().reported, width: 1872, height: 1404 },
      pending: { specialFunction: 'identify', deviceReset: false, firmwarePush: false },
    }) })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByText('21.4 °C')).toBeVisible()
    expect(factRows(screen)).toEqual([
      ['Last seen', '4 min ago'],
      ['Signal', '−61 dBm'],
      ['Sleep Mode', 'Off'],
      ['Temperature', '21.4 °C'],
      ['CO₂', '612 ppm'],
      ['Device Model', 'reports another size'],
      ['Special Function', 'identify at the next poll'],
    ])
    await expect.element(screen.getByRole('link', { name: 'reports another size' })).toHaveAttribute('href', '/devices/kitchen/settings')
  })

  it('turn the battery row into the Alert while the low-battery Alert fires', async () => {
    fakeKitchen({ device: kitchen({ batteryPercent: 18 }), alerts: [buildAlert({ kind: 'device-low-battery', deviceId: 'kitchen' }), buildAlert({ id: 'other', kind: 'device-offline', deviceId: 'study' })] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByText('Alert: battery low')).toBeVisible()
    expect(factRows(screen).slice(0, 2)).toEqual([['Last seen', '4 min ago'], ['Alert: battery low', '18 %']])
  })
})

describe('the rows of Screens in Order', () => {
  it('lists the Screens in Order with their kind, Schedule summary and Screen State', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Screens in Order' })).toBeVisible()
    const rows = [...rowsList(screen).element().querySelectorAll('.screen-row')].map(row => [
      words(row.querySelector('.order')),
      words(row.querySelector('.trigger')),
      words(row.querySelector('.kind')),
      words(row.querySelector('.schedule .visually-hidden')) || words(row.querySelector('.schedule')),
      words(row.querySelector('.state')),
    ])
    expect(rows).toEqual([
      ['1', 'Weather', 'Plugin', 'Always shown', ''],
      ['2', 'Calendar', 'Plugin', 'Monday, Tuesday, Wednesday, Thursday, Friday, 06:00–09:00', 'Active Screen'],
      ['3', 'Harbour photo', 'File', 'Always shown', 'Up next'],
      ['4', 'Train departures', 'Plugin', 'Monday, Tuesday, Wednesday, Thursday, Friday, 06:30–08:30', 'Schedule off'],
      ['5', 'Weekend board', 'Mashup', 'Sunday, all day', 'Not today'],
    ])
    expect(words(rowOf('Calendar').querySelector('.schedule .days'))).toBe('MTWTF··')
    expect(getComputedStyle(rowOf('Train departures').querySelector('.schedule .hours')!).textDecorationLine).toBe('line-through')
    expect(rowOf('Calendar').querySelector('.state .seal')).not.toBeNull()
    expect(rowsList(screen).element().querySelector('.count')).toBeNull()
  })

  it('loads the thumbnails as they scroll into view, and shows the rendering plate for a Screen never rendered', async () => {
    fakeKitchen({ screens: [...SCREENS.slice(0, 4), buildScreen({ id: 'notes', name: 'Notes', kind: 'html', plugin: null, imagePath: null, renderedAt: null })] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('img', { name: 'Weather, as last rendered' })).toHaveAttribute('loading', 'lazy')
    await expect.element(screen.getByRole('img', { name: 'Notes, as last rendered: rendering' })).toBeVisible()
  })

  it('words "Skipping" as a Screen State and the `hold` Render Signal as a qualifier', async () => {
    fakeKitchen({ screens: [
      buildScreen({ id: 'calendar', name: 'Calendar', state: 'active', renderSignal: 'hold', imagePath: imagePath('calendar') }),
      buildScreen({ id: 'bins', name: 'Bin day', state: 'skipping', renderSignal: 'skip', imagePath: imagePath('bins') }),
      buildScreen({ id: 'moon', name: 'Moon phase', renderSignal: 'hold', imagePath: imagePath('moon') }),
    ] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByText('Skipping', { exact: true })).toBeVisible()
    expect(words(rowOf('Calendar').querySelector('.state'))).toBe('Active Screen · holding image')
    expect(words(rowOf('Moon phase').querySelector('.state'))).toBe('Holding image')

    const bins = await opened(screen, 'Bin day')
    await expect.element(bins.getByText('Skipping: this Screen\'s own content asked to be left out of Rotation for now. It returns by itself when the content changes.')).toBeVisible()
  })

  it('says under a Schedule reason that the Screen is also skipping', async () => {
    fakeKitchen({ screens: [
      SCREENS[1]!,
      buildScreen({ id: 'trains', name: 'Train departures', state: 'scheduleOff', renderSignal: 'skip', imagePath: imagePath('trains'), schedule: buildSchedule({ enabled: false }) }),
    ] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    const trains = await opened(screen, 'Train departures')
    await expect.element(trains.getByText('Its Schedule is switched off, so Rotation passes over it. The days and hours are kept.')).toBeVisible()
    await expect.element(trains.getByText('It is also skipping: its own content asked to be left out of Rotation.')).toBeVisible()
  })

  it('names a Screen that was saved without a name', async () => {
    fakeKitchen({ screens: [buildScreen({ id: 'blank', name: '', kind: 'external', plugin: null, imagePath: imagePath('blank') })] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('button', { name: 'Unnamed Screen', exact: true })).toBeVisible()
  })

  it('counts the Screens from nine on, and offers "Move to top" and "Move to end" in an opened row', async () => {
    const many = Array.from({ length: 9 }, (_, index) => buildScreen({ id: `screen-${index + 1}`, name: `Screen ${index + 1}`, order: index + 1, imagePath: imagePath(`screen-${index + 1}`) }))
    const faked = fakeKitchen({ screens: many })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Screens in Order 9' })).toBeVisible()
    const fifth = await opened(screen, 'Screen 5')
    await fifth.getByRole('button', { name: 'Move to top' }).click()

    await expect.poll(() => rowNames(screen)[0]).toBe('Screen 5')
    await expect.poll(() => faked.savedOrders).toEqual([['screen-5', 'screen-1', 'screen-2', 'screen-3', 'screen-4', 'screen-6', 'screen-7', 'screen-8', 'screen-9']])
    await expect.element(fifth.getByRole('button', { name: 'Move to top' })).toBeDisabled()
    await expect.element(fifth.getByRole('button', { name: 'Move up' })).toBeDisabled()
    await expect.element(fifth.getByRole('button', { name: 'Move down' })).toHaveFocus()

    await fifth.getByRole('button', { name: 'Move to end' }).click()

    await expect.poll(() => rowNames(screen).at(-1)).toBe('Screen 5')
  })

  it('shows the empty state for a Device with no Screens, which carries "Add Screen"', async () => {
    fakeKitchen({
      screens: [],
      device: kitchen({ screenCount: 0, currentScreen: { kind: 'fallback', fallback: 'noScreen', reason: 'noScreens', screenId: null, imagePath: '/screens/devices/kitchen/noScreen.png?v=1', servedAt: SERVED_AT } }),
    })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Add Kitchen\'s first Screen' })).toBeVisible()
    await expect.element(screen.getByText('A Screen is one thing the Device shows: a Plugin, a Mashup, an image from a link or a file, or HTML you write. With more than one, Kitchen steps through them in Order, one per poll.')).toBeVisible()
    await expect.element(screen.getByRole('heading', { level: 2, name: 'No Screens yet' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Add Screen' }).elements().map(link => link.getAttribute('href'))).toEqual(['/devices/kitchen/screens/new'])
    expect(screen.getByRole('heading', { name: 'Screens in Order' }).elements()).toEqual([])
    await expectAccessible()
  })

  it('keeps a mirrored Device\'s rows under a notice, without a Screen State or the seal', async () => {
    fakeKitchen({
      screens: SCREENS.slice(0, 2).map(screen => ({ ...screen, state: null })),
      device: kitchen({
        isMirrored: true,
        mirror: { enabled: true, mac: 'A4:CF:12:9B:01:7E', apikeySet: true },
        currentScreen: { kind: 'mirror', proxied: false, mirrorMac: 'A4:CF:12:9B:01:7E', imagePath: '/screens/devices/kitchen/mirror.png?v=1', fetchedAt: SERVED_AT },
      }),
    })
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Mirrored from TRMNL' })).toBeVisible()
    expect(words(rowsList(screen).element().querySelector('.paused'))).toBe('Rotation is paused while Mirroring is on. These Screens are kept and can still be edited; they return when you switch Mirroring off in Settings.')
    expect(rowNames(screen)).toEqual(['Weather', 'Calendar'])
    expect([...document.querySelectorAll('.screen-row .state')].map(words)).toEqual(['', ''])
    expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
    expect(factRows(screen)).toContainEqual(['Sleep Mode', 'Off while Mirroring'])
    await expect.poll(() => getComputedStyle(rowOf('Weather').querySelector('.trigger')!).color).toBe(getComputedStyle(rowOf('Weather').querySelector('.kind')!).color)

    const weather = await opened(screen, 'Weather')
    await expect.element(weather.getByText('Kept while Mirroring is on. It takes its place in Rotation again when Mirroring is switched off.')).toBeVisible()
    await expectAccessible()
  })
})

describe('reordering', () => {
  it('by dragging a row by its grip: saves the new Order once', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })
    const target = screen.getByRole('img', { name: 'Calendar, as last rendered' })
    await expect.element(target).toBeVisible()

    await userEvent.dragAndDrop(screen.getByRole('button', { name: 'Move Weather in the Order', exact: true }), target, {
      targetPosition: { x: 4, y: target.element().getBoundingClientRect().height - 1 },
    })

    await expect.poll(() => rowNames(screen)).toEqual(['Calendar', 'Weather', 'Harbour photo', 'Train departures', 'Weekend board'])
    await expect.poll(() => faked.savedOrders).toEqual([['calendar', 'weather', 'photo', 'trains', 'weekend']])
    await expect.element(rowsList(screen).getByText('Saved')).toBeVisible()
  })

  it('by keyboard: lifts, moves and drops a row, saying its place, and saves once', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })
    const grip = screen.getByRole('button', { name: 'Move Weather in the Order', exact: true })
    await expect.element(grip).toBeVisible()

    grip.element().focus()
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(rowsList(screen).getByText('Weather, Order 2 of 5')).toBeInTheDocument()
    expect(faked.savedOrders).toEqual([])
    await userEvent.keyboard(' ')

    await expect.poll(() => faked.savedOrders).toEqual([['calendar', 'weather', 'photo', 'trains', 'weekend']])
    expect(rowNames(screen)).toEqual(['Calendar', 'Weather', 'Harbour photo', 'Train departures', 'Weekend board'])
    await expect.element(grip).toHaveFocus()
  })

  it('on phone: the two buttons move a row and save once', async () => {
    const faked = fakeKitchen()
    await resizeTo(375)
    const screen = await mountApp({ at: '/devices/kitchen' })

    await screen.getByRole('button', { name: 'Move Calendar earlier in the Order' }).click()

    await expect.poll(() => faked.savedOrders).toEqual([['calendar', 'weather', 'photo', 'trains', 'weekend']])
    expect(rowNames(screen)).toEqual(['Calendar', 'Weather', 'Harbour photo', 'Train departures', 'Weekend board'])
  })

  it('from an opened row: "Move up" and "Move down" save once each', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    const calendar = await opened(screen, 'Calendar')
    expect(calendar.getByRole('button', { name: 'Move to top' }).elements()).toEqual([])
    await calendar.getByRole('button', { name: 'Move down' }).click()

    await expect.poll(() => faked.savedOrders).toEqual([['weather', 'photo', 'calendar', 'trains', 'weekend']])
    await expect.poll(() => rowNames(screen)).toEqual(['Weather', 'Harbour photo', 'Calendar', 'Train departures', 'Weekend board'])
    await expect.element(calendar.getByRole('button', { name: 'Move down' })).toHaveFocus()
  })

  it('puts the rows back when the save is refused, and saves on "Try again"', async () => {
    const faked = fakeKitchen()
    let refuse = true
    api.use(http.put(apiUrl('devices/kitchen/screens/order'), async ({ request }) => {
      const { screenIds } = await request.json() as { screenIds: string[] }
      if (refuse)
        return apiErrorResponse({ statusCode: 400, code: 'order-not-a-permutation' })
      faked.savedOrders.push(screenIds)
      faked.screens = screenIds.map(id => faked.screens.find(screen => screen.id === id)!)
      return HttpResponse.json(faked.screens)
    }))
    await resizeTo(375)
    const screen = await mountApp({ at: '/devices/kitchen' })

    await screen.getByRole('button', { name: 'Move Calendar earlier in the Order' }).click()

    await expect.element(screen.getByText('Not saved. The Order has to name every Screen once.')).toBeVisible()
    expect(rowNames(screen)).toEqual(['Weather', 'Calendar', 'Harbour photo', 'Train departures', 'Weekend board'])

    refuse = false
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(() => rowNames(screen)).toEqual(['Calendar', 'Weather', 'Harbour photo', 'Train departures', 'Weekend board'])
    expect(faked.savedOrders).toEqual([['calendar', 'weather', 'photo', 'trains', 'weekend']])
  })
})

describe('an opened row', () => {
  it('opens in place, one at a time, and the address follows it', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    const calendar = await opened(screen, 'Calendar')
    await expect.element(calendar.getByText(`On the Device since the ${served} poll.`)).toBeVisible()
    expect(screen.router.currentRoute.value.query).toEqual({ screen: 'calendar' })

    await opened(screen, 'Harbour photo')

    await expect.element(calendar).not.toBeInTheDocument()
    expect(screen.router.currentRoute.value.query).toEqual({ screen: 'photo' })

    await screen.getByRole('button', { name: 'Harbour photo', exact: true }).click()

    await expect.poll(() => screen.router.currentRoute.value.query).toEqual({})
  })

  it('opens the row the address names and scrolls to it', async () => {
    const many = Array.from({ length: 30 }, (_, index) => buildScreen({ id: `screen-${index + 1}`, name: `Screen ${index + 1}`, order: index + 1, imagePath: imagePath(`screen-${index + 1}`) }))
    fakeKitchen({ screens: many })
    const screen = await mountApp({ at: '/devices/kitchen?screen=screen-12' })

    await expect.element(screen.getByRole('region', { name: 'Screen 12', exact: true })).toBeVisible()
    const barBottom = document.querySelector('[data-shell-bar]')!.getBoundingClientRect().bottom
    await expect.poll(() => window.scrollY).toBeGreaterThan(0)
    await expect.poll(() => Math.round(rowOf('Screen 12').getBoundingClientRect().top - barBottom)).toBe(16)
  })

  it.each([
    ['Weather', 'Plugin', buildScreen({ id: 'one', name: 'Weather', imagePath: imagePath('one'), renderedAt: SERVED_AT }), 'Rendered 4 min ago'],
    ['Weekend board', 'Mashup', buildScreen({ id: 'one', name: 'Weekend board', kind: 'mashup', plugin: null, mashup: { layout: '1Lx1R', slots: [] }, imagePath: imagePath('one'), renderedAt: SERVED_AT }), 'Rendered 4 min ago'],
    ['Tide table', 'External link', buildScreen({ id: 'one', name: 'Tide table', kind: 'external', plugin: null, external: { url: 'https://tides.example/harbour.png', fetchManual: true }, imagePath: imagePath('one'), renderedAt: '2026-09-12T09:14:00.000Z' }), `Rendered 12 Sept 2026, ${clockTime(new Date('2026-09-12T09:14:00.000Z'))}`],
    ['Harbour photo', 'File', buildScreen({ id: 'one', name: 'Harbour photo', kind: 'file', plugin: null, imagePath: imagePath('one') }), 'The converted image'],
    ['Fridge note', 'HTML', buildScreen({ id: 'one', name: 'Fridge note', kind: 'html', plugin: null, html: '<p>Back at six.</p>', imagePath: imagePath('one') }), 'As Kitchen renders it'],
  ])('previews %s, a %s Screen, with its caption', async (name, _kind, shown, caption) => {
    fakeKitchen({ screens: [shown] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    const row = await opened(screen, name)
    await expect.element(row.getByRole('img', { name: `${name}, as rendered for Kitchen` })).toBeVisible()
    await expect.poll(() => words(row.element().querySelector('figcaption'))).toBe(caption)
    await expect.element(row.getByText('Waiting its turn.')).toBeVisible()
  })

  it.each([
    ['Plugin', buildScreen({ id: 'one', name: 'Pollen count', imagePath: null, renderedAt: null })],
    ['Mashup', buildScreen({ id: 'one', name: 'Pollen count', kind: 'mashup', plugin: null, mashup: null, imagePath: null, renderedAt: null })],
  ])('shows the rendering plate and "Not rendered yet" for a %s Screen never rendered', async (_kind, shown) => {
    fakeKitchen({ screens: [shown] })
    const screen = await mountApp({ at: '/devices/kitchen' })

    const row = await opened(screen, 'Pollen count')
    await expect.element(row.getByRole('img', { name: 'Pollen count, as rendered for Kitchen: rendering' })).toBeVisible()
    await expect.element(row.getByText('Not rendered yet. It renders when its turn first comes.')).toBeVisible()
  })
})

describe('loading and fresh data', () => {
  it('shows the rendering plate and "Loading Kitchen\'s Screens" while the answer takes its time', async () => {
    const faked = fakeKitchen()
    let answer = () => {}
    const held = new Promise<void>((resolve) => {
      answer = resolve
    })
    api.use(http.get(apiUrl('devices/kitchen/screens'), async () => {
      await held
      return HttpResponse.json(faked.screens)
    }))
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('status').filter({ hasText: 'Loading Kitchen\'s Screens' })).toBeVisible()
    await expect.element(screen.getByRole('img', { name: 'On Kitchen: rendering' })).toBeVisible()
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Kitchen' })).toBeVisible()
    await expectAccessible()

    answer()

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Calendar' })).toBeVisible()
    expect(screen.getByText('Loading Kitchen\'s Screens').elements()).toEqual([])
  })

  it('shows the notice above what was loaded before when a refresh fails', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })
    await expect.element(screen.getByRole('heading', { level: 2, name: 'Calendar' })).toBeVisible()

    api.use(http.get(apiUrl('devices/kitchen/screens'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    refresh()

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load Kitchen\'s Screens. Something went wrong on the server.')
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(rowNames(screen)).toEqual(['Weather', 'Calendar', 'Harbour photo', 'Train departures', 'Weekend board'])
    expect(elementsInSealColour(screen.getByRole('alert').element())).toEqual([])
  })

  it('changes nothing in the page when a refresh brings the same answer', async () => {
    const faked = fakeKitchen()
    let reads = 0
    api.use(http.get(apiUrl('devices/kitchen/screens'), () => {
      reads++
      return HttpResponse.json(faked.screens)
    }))
    const screen = await mountApp({ at: '/devices/kitchen' })
    await expect.element(screen.getByRole('img', { name: 'On Kitchen: Calendar' })).toBeVisible()
    await expect.poll(() => reads).toBe(1)
    const changes: MutationRecord[] = []
    const observer = new MutationObserver(records => changes.push(...records))
    observer.observe(screen.getByRole('main').element(), { subtree: true, childList: true, attributes: true, characterData: true })

    refresh()

    await expect.poll(() => reads).toBe(2)
    await new Promise(resolve => setTimeout(resolve, 50))
    observer.disconnect()
    expect(changes).toEqual([])
  })

  it('stamps the seal once when a refresh brings another Active Screen, and not where motion is reduced', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })
    await expect.element(screen.getByRole('img', { name: 'On Kitchen: Calendar' })).toBeVisible()
    const sealOf = () => document.querySelector('.plate.current .seal')!
    expect(sealOf().classList.contains('stamps')).toBe(false)

    faked.device = kitchen({ currentScreen: { ...kitchen().currentScreen, kind: 'screen', screenId: 'photo', name: 'Harbour photo', imagePath: imagePath('photo'), renderedAt: SERVED_AT, servedAt: NEXT_POLL_AT, paused: false, holding: false } })
    faked.screens = SCREENS.map(shown => ({ ...shown, state: shown.id === 'photo' ? 'active' as const : shown.id === 'calendar' ? null : shown.state }))
    refresh()

    await expect.element(screen.getByRole('img', { name: 'On Kitchen: Harbour photo' })).toBeVisible()
    await expect.poll(() => sealOf().classList.contains('stamps')).toBe(true)
    expect(getComputedStyle(sealOf()).animationName).toBe('none')
    await withMotionAllowed(async () => expect(getComputedStyle(sealOf()).animationName).not.toBe('none'))
    const stamped = sealOf()

    refresh()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(sealOf()).toBe(stamped)
  })
})

describe('the Screens view as a whole', () => {
  it('is accessible in both themes with a row opened, and does not scroll sideways', async () => {
    fakeKitchen({ alerts: [buildAlert({ kind: 'device-low-battery', deviceId: 'kitchen' })] })
    const screen = await mountApp({ at: '/devices/kitchen?screen=weekend' })

    await expect.element(screen.getByRole('region', { name: 'Weekend board', exact: true })).toBeVisible()
    await expect.element(screen.getByText('Its Schedule leaves out Saturdays, so Rotation passes over it today.')).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
