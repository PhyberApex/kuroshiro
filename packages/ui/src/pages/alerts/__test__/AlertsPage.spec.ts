import type { AlertsList, AlertSummary, InstanceFacts, InstanceSettingsResponse } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { clockTime } from '@/patterns/time'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildInstanceFacts, buildInstanceSettings } from '@/testing/fixtures/instance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'

/** A Saturday morning; "yesterday" and "Wednesday" below hold in every timezone a spec runs in. */
const NOW = '2026-10-03T07:35:00.000Z'
const TODAY_0610 = '2026-10-03T06:10:00.000Z'
const TODAY_0431 = '2026-10-03T04:31:00.000Z'
const YESTERDAY_1935 = '2026-10-02T19:35:00.000Z'
const WEDNESDAY_NOON = '2026-09-30T12:00:00.000Z'

const clock = (at: string) => clockTime(new Date(at))

const FETCH_SUBJECT = { deviceId: undefined, deviceName: undefined, pluginId: 'trains', pluginName: 'Train departures', dataSourceId: 'departures-id', dataSourceName: 'departures' }

const FETCH_FIRING = buildAlert({ id: 'fetch', kind: 'data-source-fetch-failing', ...FETCH_SUBJECT, openedAt: TODAY_0610, details: { streak: 5, lastError: '503 Service Unavailable' } })
const BATTERY_FIRING = buildAlert({ id: 'battery', kind: 'device-low-battery', deviceId: 'hallway', deviceName: 'Hallway', openedAt: YESTERDAY_1935, details: { percent: 14 } })
const OFFLINE_FIRING = buildAlert({ id: 'offline', kind: 'device-offline', deviceId: 'study', deviceName: 'Study', openedAt: TODAY_0610, details: { lastSeen: TODAY_0431 } })

const OFFLINE_RESOLVED = buildAlert({ id: 'was-offline', kind: 'device-offline', deviceId: 'kitchen', deviceName: 'Kitchen', openedAt: WEDNESDAY_NOON, resolvedAt: '2026-09-30T13:30:00.000Z', details: { lastSeen: '2026-09-30T10:55:00.000Z' } })
const FETCH_RESOLVED = buildAlert({ id: 'was-failing', kind: 'data-source-fetch-failing', ...FETCH_SUBJECT, pluginId: 'weather', pluginName: 'Weather', dataSourceName: 'forecast', openedAt: YESTERDAY_1935, resolvedAt: '2026-10-02T20:20:00.000Z', details: { streak: 3, lastError: 'getaddrinfo ENOTFOUND api.open-meteo.com' } })
const BATTERY_RESOLVED = buildAlert({ id: 'was-low', kind: 'device-low-battery', deviceId: 'study', deviceName: 'Study', openedAt: TODAY_0431, resolvedAt: TODAY_0610, details: { percent: 17 } })

type Screen = Awaited<ReturnType<typeof mountApp>>

const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

function rowsOf(screen: Screen, list: string) {
  return [...screen.getByRole('list', { name: list }).element().querySelectorAll('.alert-row')].map(row => ({
    kind: words(row.querySelector('.kind')),
    subject: words(row.querySelector('.subject')),
    opens: row.querySelector('.subject a')?.getAttribute('href'),
    why: words(row.querySelector('.why')),
    when: words(row.querySelector('.when')),
  }))
}

const FIRING = 'Firing Alerts'
const RESOLVED = 'Resolved in the last 7 days'

interface Mounted {
  alerts?: AlertsList
  instance?: InstanceFacts
  settings?: InstanceSettingsResponse
}

async function mountAlerts({ alerts = buildAlertsList(), instance, settings = buildInstanceSettings() }: Mounted = {}) {
  freezeTime(NOW)
  fakeShellReads({ alerts, instance })
  api.use(http.get(apiUrl('settings'), () => HttpResponse.json(settings)))
  const screen = await mountApp({ at: '/alerts' })
  await expect.element(screen.getByRole('heading', { level: 2, name: /^Resolved in the last 7 days/ })).toBeVisible()
  return screen
}

const main = (screen: Screen) => screen.getByRole('main')

describe('the Alerts page', () => {
  it('lists each firing Alert in red with its subject as a link, why it fires and since when', async () => {
    const settings = buildInstanceSettings({ lowBatteryPercent: { override: 25, value: 25, fallbackSource: 'default', fallbackValue: 20 } })
    const screen = await mountAlerts({ alerts: buildAlertsList({ active: [FETCH_FIRING, OFFLINE_FIRING, BATTERY_FIRING] }), settings })

    expect(rowsOf(screen, FIRING)).toEqual([
      {
        kind: 'Alert: a Data Source keeps failing',
        subject: 'Train departures · departures',
        opens: '/plugins/trains?source=departures',
        why: '5 fetches failed in a row. The last answer: 503 Service Unavailable',
        when: `since ${clock(TODAY_0610)}`,
      },
      {
        kind: 'Alert: offline',
        subject: 'Study',
        opens: '/devices/study',
        why: `Last seen ${clock(TODAY_0431)}, 3 h 4 min ago`,
        when: `since ${clock(TODAY_0610)}`,
      },
      {
        kind: 'Alert: battery low',
        subject: 'Hallway',
        opens: '/devices/hallway',
        why: 'Battery at 14 %, below 25 %',
        when: `since yesterday, ${clock(YESTERDAY_1935)}`,
      },
    ])
    const firing = screen.getByRole('list', { name: FIRING }).element()
    expect(elementsInSealColour(firing).map(words)).toEqual([
      'Alert: a Data Source keeps failing',
      '',
      'Alert: offline',
      '',
      'Alert: battery low',
      '',
    ])
    await expect.element(main(screen).getByRole('link', { name: 'Train departures · departures' })).toBeVisible()
  })

  it('lists what resolved in the last 7 days with the kind in the past, why it fired, when and for how long, and nothing in red', async () => {
    const screen = await mountAlerts({ alerts: buildAlertsList({ resolved: [BATTERY_RESOLVED, FETCH_RESOLVED, OFFLINE_RESOLVED] }) })

    expect(rowsOf(screen, RESOLVED)).toEqual([
      {
        kind: 'Battery low',
        subject: 'Study',
        opens: '/devices/study',
        why: 'Battery at 17 %',
        when: `Today ${clock(TODAY_0431)}, for 1 h 39 min`,
      },
      {
        kind: 'A Data Source kept failing',
        subject: 'Weather · forecast',
        opens: '/plugins/weather?source=forecast',
        why: '3 fetches failed in a row: getaddrinfo ENOTFOUND api.open-meteo.com',
        when: `Yesterday ${clock(YESTERDAY_1935)}, for 45 min`,
      },
      {
        kind: 'Offline',
        subject: 'Kitchen',
        opens: '/devices/kitchen',
        why: 'No poll for 1 h 5 min',
        when: `Wednesday ${clock(WEDNESDAY_NOON)}, for 1 h 30 min`,
      },
    ])
    expect(elementsInSealColour(main(screen).element())).toEqual([])
    await expect.element(main(screen).getByText('newest first')).toBeVisible()
    expect(main(screen).getByText('The 50 most recent.').query()).toBeNull()
  })

  it('says "The 50 most recent." under 50 resolved rows', async () => {
    const resolved = Array.from({ length: 50 }, (_, index) => ({ ...BATTERY_RESOLVED, id: `resolved-${index}` }))
    const screen = await mountAlerts({ alerts: buildAlertsList({ resolved }) })

    expect(rowsOf(screen, RESOLVED)).toHaveLength(50)
    await expect.element(main(screen).getByText('The 50 most recent.')).toBeVisible()
  })

  it('says that no Alert is firing and that nothing resolved when there is nothing at all', async () => {
    const screen = await mountAlerts()

    await expect.element(main(screen).getByText('No Alert is firing.')).toBeVisible()
    await expect.element(main(screen).getByText('Nothing resolved in the last 7 days.')).toBeVisible()
    expect(main(screen).getByRole('list').query()).toBeNull()
    expect(main(screen).getByText('newest first').query()).toBeNull()
    expect(elementsInSealColour(main(screen).element())).toEqual([])
  })

  it('says what is watched with the three thresholds in force and links to the Alert Rules', async () => {
    const settings = buildInstanceSettings({
      lowBatteryPercent: { override: 15, value: 15, fallbackSource: 'default', fallbackValue: 20 },
      offlineMultiplier: { override: null, value: 4, fallbackSource: 'env', fallbackValue: 4 },
      fetchFailureThreshold: { override: 6, value: 6, fallbackSource: 'default', fallbackValue: 3 },
    })
    const screen = await mountAlerts({ settings })

    expect(words(main(screen).element().querySelector('.watched'))).toBe(
      'Every 5 minutes Kuroshiro checks each Device for a battery below 15 % and for 4 missed polls, and each Data Source for a Fetch Failure Streak of 6. An Alert resolves by itself once its cause is gone; there is nothing to dismiss. Change the Alert Rules',
    )
    await expect.element(main(screen).getByRole('link', { name: 'Change the Alert Rules' })).toHaveAttribute('href', '/instance/settings#alert-rules')
  })

  it('says how an Alert is announced while Notifications are set up, and that it only shows here while they are off', async () => {
    const off = await mountAlerts()

    expect(words(main(off).element().querySelector('.announced'))).toBe('Notifications are off, so an Alert only shows here, on its Device and on its Plugin. Notifications')
    await expect.element(main(off).getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/instance/settings#notifications')
    off.unmount()

    const on = await mountAlerts({ instance: buildInstanceFacts({ notifications: { configured: true, appriseUrl: 'http://apprise:8000' } }) })

    expect(words(main(on).element().querySelector('.announced'))).toBe('Each Alert is announced through Apprise when it fires and when it resolves. Notifications')
    await expect.element(main(on).getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/instance/settings#notifications')
  })

  it('has nothing that dismisses, acknowledges or resolves an Alert', async () => {
    const screen = await mountAlerts({ alerts: buildAlertsList({ active: [BATTERY_FIRING], resolved: [OFFLINE_RESOLVED] }) })

    expect(main(screen).getByRole('button').query()).toBeNull()
  })

  it('asks again when the window regains the focus, moves nothing for the same answer and shows a new one', async () => {
    holdTabVisible()
    let answer: AlertSummary[] = [BATTERY_FIRING]
    let asked = 0
    freezeTime(NOW)
    fakeShellReads()
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('alerts'), () => {
        asked += 1
        return HttpResponse.json(buildAlertsList({ active: answer }))
      }),
    )
    const screen = await mountApp({ at: '/alerts' })
    await expect.poll(() => rowsOf(screen, FIRING).length).toBe(1)
    const row = main(screen).element().querySelector('.alert-row')
    const askedAtFirst = asked

    window.dispatchEvent(new Event('focus'))
    await expect.poll(() => asked).toBe(askedAtFirst + 1)
    expect(main(screen).element().querySelector('.alert-row')).toBe(row)

    answer = [OFFLINE_FIRING, BATTERY_FIRING]
    window.dispatchEvent(new Event('focus'))
    // The second focus triggers another real fetch-then-render round trip; on a loaded CI runner under
    // coverage, that has taken past the default 5 s poll before both rows land.
    await expect.poll(() => rowsOf(screen, FIRING).map(({ kind }) => kind), { timeout: 15_000 })
      .toEqual(['Alert: offline', 'Alert: battery low'])
    await expect.element(screen.getByRole('banner').getByRole('link', { name: '2 Alerts firing' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the notice when the Alerts cannot be loaded, with nothing in red, and the page once "Try again" works', async () => {
    freezeTime(NOW)
    let answers = false
    fakeShellReads()
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('alerts'), () => answers ? HttpResponse.json(buildAlertsList({ active: [BATTERY_FIRING] })) : apiErrorResponse({ statusCode: 500, code: 'internal' })),
    )
    const screen = await mountApp({ at: '/alerts' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Alerts. Something went wrong on the server.')
    expect(elementsInSealColour(main(screen).element())).toEqual([])

    answers = true
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(() => rowsOf(screen, FIRING).length).toBe(1)
    expect(screen.getByRole('alert').query()).toBeNull()
  })

  it('shows "Loading Alerts" over two empty rows while the answer takes long', async () => {
    freezeTime(NOW)
    let answer = () => {}
    const held = new Promise<void>((resolve) => {
      answer = resolve
    })
    fakeShellReads()
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('alerts'), async () => {
        await held
        return HttpResponse.json(buildAlertsList())
      }),
    )
    const screen = await mountApp({ at: '/alerts' })

    await expect.element(main(screen).getByRole('status')).toHaveTextContent('Loading Alerts')
    expect(main(screen).element().querySelectorAll('.loading-row')).toHaveLength(2)

    answer()
    await expect.element(main(screen).getByText('No Alert is firing.')).toBeVisible()
  })

  it('is accessible in both themes and does not overflow at phone, tablet or desktop width', async () => {
    const screen = await mountAlerts({
      alerts: buildAlertsList({ active: [FETCH_FIRING, OFFLINE_FIRING, BATTERY_FIRING], resolved: [BATTERY_RESOLVED, FETCH_RESOLVED, OFFLINE_RESOLVED] }),
    })
    expect(rowsOf(screen, FIRING)).toHaveLength(3)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
