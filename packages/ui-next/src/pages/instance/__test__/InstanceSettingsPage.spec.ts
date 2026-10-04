import type { DeviceSummary, InstanceFacts, InstanceSettingsResponse, SettingKey } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts, buildInstanceSettings } from '@/testing/fixtures/instance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'

type Screen = Awaited<ReturnType<typeof mountApp>>
type SettingsPatch = Partial<Record<SettingKey, number | null>>

const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })
const HALLWAY = buildDeviceSummary({ id: 'hallway', name: 'Hallway' })

const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** Answers the Instance Settings and takes their changes as the server does: a number overrides, `null` falls back. */
function fakeSettings(initial: InstanceSettingsResponse = buildInstanceSettings()) {
  let settings = initial
  const patches: SettingsPatch[] = []
  api.use(
    http.get(apiUrl('settings'), () => HttpResponse.json(settings)),
    http.patch(apiUrl('settings'), async ({ request }) => {
      const patch = await request.json() as SettingsPatch
      patches.push(patch)
      const changed = (Object.entries(patch) as [SettingKey, number | null][])
        .map(([key, override]) => [key, { ...settings[key], override, value: override ?? settings[key].fallbackValue }])
      settings = { ...settings, ...Object.fromEntries(changed) }
      return HttpResponse.json(settings)
    }),
  )
  return patches
}

interface Mounted {
  instance?: InstanceFacts
  devices?: DeviceSummary[]
  at?: string
}

async function mountSettings({ instance, devices = [KITCHEN], at = '/instance/settings' }: Mounted = {}) {
  fakeShellReads({ instance, devices })
  api.use(http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(buildDeviceDetail({ ...KITCHEN, refreshRate: 900 }))))
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { level: 3, name: 'Alert Rules' })).toBeVisible()
  return screen
}

const WITH_NOTIFICATIONS = buildInstanceFacts({ notifications: { configured: true, appriseUrl: 'http://apprise:8000' } })

function readRowOf(screen: Screen, label: string) {
  return [...screen.getByRole('main').element().querySelectorAll('.read-row')].find(row => words(row.querySelector('.label')) === label)
}
function readRowSays(screen: Screen, label: string) {
  const row = readRowOf(screen, label)
  return { shown: words(row?.querySelector('.shown')), side: words(row?.querySelector('.side')), note: words(row?.querySelector('.note')) }
}
const testNotificationSays = (screen: Screen) => words(readRowOf(screen, 'Test Notification')?.querySelector('[role="status"]'))

const field = (screen: Screen, label: string) => screen.getByRole('spinbutton', { name: label })
const rowOf = (screen: Screen, label: string) => field(screen, label).element().closest('.setting-row')
const sourceOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.source'))
const noteOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.note'))

async function enter(screen: Screen, label: string, value: string) {
  await field(screen, label).fill(value)
  await userEvent.keyboard('{Enter}')
}

describe('instance Settings', () => {
  describe('alert Rules', () => {
    it('shows each threshold in a sentence with where its value comes from', async () => {
      fakeSettings(buildInstanceSettings({
        offlineMultiplier: { override: null, value: 5, fallbackSource: 'env', fallbackValue: 5 },
        fetchFailureThreshold: { override: 6, value: 6, fallbackSource: 'default', fallbackValue: 3 },
      }))
      const screen = await mountSettings()

      await expect.element(field(screen, 'Battery low')).toHaveValue(20)
      expect(words(rowOf(screen, 'Battery low')?.querySelector('.control-cell'))).toBe('below %')
      expect(sourceOf(screen, 'Battery low')).toBe('Built-in default')
      expect(noteOf(screen, 'Battery low')).toBe('Fires when a Device\'s battery is below 20 %, and resolves once it is back at 25 %.')
      expect(sourceOf(screen, 'Offline')).toBe('From KUROSHIRO_ALERT_OFFLINE_MULTIPLIER')
      expect(sourceOf(screen, 'Fetch Failure Streak')).toBe('Set here · Reset to 3')
      expect(noteOf(screen, 'Fetch Failure Streak')).toBe('An Alert fires when the streak reaches 6. A Plugin that fetches every 15 minutes gets there after 90 minutes.')
      await expect.element(screen.getByText('A change applies at the next Alert Sweep, within 5 minutes.')).toBeVisible()
      await expect.element(screen.getByRole('main').getByRole('link', { name: 'Alerts', exact: true })).toHaveAttribute('href', '/alerts')
    })

    it('sends a threshold entered in range alone and reads "Set here" with the way back', async () => {
      const patches = fakeSettings()
      const screen = await mountSettings()

      await enter(screen, 'Battery low', '15')

      await expect.poll(() => sourceOf(screen, 'Battery low'), { timeout: 5000 }).toBe('Set here · Reset to 20')
      expect(patches).toEqual([{ lowBatteryPercent: 15 }])
      expect(noteOf(screen, 'Battery low')).toBe('Fires when a Device\'s battery is below 15 %, and resolves once it is back at 20 %.')
    })

    it('says "Saved" in the source\'s place once the server has it', async () => {
      fakeSettings()
      const screen = await mountSettings()

      await enter(screen, 'Battery low', '15')

      await expect.poll(() => words(rowOf(screen, 'Battery low')?.querySelector('[role="status"]'))).toBe('Saved')
    })

    it('resets by sending null, and the field shows the fallback', async () => {
      const patches = fakeSettings(buildInstanceSettings({
        offlineMultiplier: { override: 4, value: 4, fallbackSource: 'default', fallbackValue: 3 },
      }))
      const screen = await mountSettings()

      await screen.getByRole('button', { name: 'Reset to 3' }).click()

      await expect.element(field(screen, 'Offline')).toHaveValue(3)
      await expect.poll(() => sourceOf(screen, 'Offline'), { timeout: 5000 }).toBe('Built-in default')
      expect(patches).toEqual([{ offlineMultiplier: null }])
      await expect.element(field(screen, 'Offline')).toHaveFocus()
    })

    it.for([
      ['Battery low', '101', 'Enter a whole number from 1 to 100.'],
      ['Battery low', '', 'Enter a whole number from 1 to 100.'],
      ['Offline', '1', 'Enter a whole number, 2 or more.'],
      ['Fetch Failure Streak', '2.5', 'Enter a whole number, 1 or more.'],
    ] as const)('does not send %s as "%s" and says the range in the explanation\'s place', async ([label, value, range]) => {
      const patches = fakeSettings()
      const screen = await mountSettings()

      await enter(screen, label, value)

      await expect.element(field(screen, label)).toHaveAttribute('aria-invalid', 'true')
      await expect.element(field(screen, label)).toHaveAccessibleDescription(range)
      expect(rowOf(screen, label)?.querySelector('.note')).toBeNull()
      expect(patches).toEqual([])
    })

    it('takes the range message away once the value is in range again, and saves it', async () => {
      const patches = fakeSettings()
      const screen = await mountSettings()
      await enter(screen, 'Offline', '1')
      await expect.element(field(screen, 'Offline')).toHaveAttribute('aria-invalid', 'true')

      await enter(screen, 'Offline', '6')

      await expect.element(field(screen, 'Offline')).not.toHaveAttribute('aria-invalid')
      await expect.poll(() => patches).toEqual([{ offlineMultiplier: 6 }])
    })

    it('shows a fallback from the environment as it is, even out of range', async () => {
      fakeSettings(buildInstanceSettings({
        offlineMultiplier: { override: null, value: 1, fallbackSource: 'env', fallbackValue: 1 },
      }))
      const screen = await mountSettings()

      await expect.element(field(screen, 'Offline')).toHaveValue(1)
      await expect.element(field(screen, 'Offline')).not.toHaveAttribute('aria-invalid')
      expect(sourceOf(screen, 'Offline')).toBe('From KUROSHIRO_ALERT_OFFLINE_MULTIPLIER')
    })

    it('words the Offline row with the one Device\'s refresh rate', async () => {
      fakeSettings()
      const screen = await mountSettings({ devices: [KITCHEN] })

      await expect.poll(() => noteOf(screen, 'Offline')).toBe('Fires when a Device has not polled for 3 times its refresh rate. Kitchen polls every 15 minutes, so that is 45 minutes without a poll. Sleep Mode\'s window does not count.')
    })

    it.for([
      ['no Device', []],
      ['several Devices', [KITCHEN, HALLWAY]],
    ] as const)('words the Offline row with a Device polling every 15 minutes when there is %s', async ([, devices]) => {
      fakeSettings()
      const screen = await mountSettings({ devices: [...devices] })

      await expect.poll(() => noteOf(screen, 'Offline')).toBe('Fires when a Device has not polled for 3 times its refresh rate. For a Device polling every 15 minutes that is 45 minutes without a poll. Sleep Mode\'s window does not count.')
    })

    it('keeps what was entered and says why when a save fails, and saves it on "Try again"', async () => {
      const patches = fakeSettings()
      const screen = await mountSettings()
      api.use(http.patch(apiUrl('settings'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))

      await enter(screen, 'Battery low', '15')

      await expect.poll(() => words(rowOf(screen, 'Battery low')?.querySelector('[role="status"]'))).toBe('Not saved. Something went wrong on the server.')
      await expect.element(field(screen, 'Battery low')).toHaveValue(15)
      expect(sourceOf(screen, 'Battery low')).toBe('Built-in default')

      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.poll(() => sourceOf(screen, 'Battery low'), { timeout: 5000 }).toBe('Set here · Reset to 20')
      expect(patches).toEqual([{ lowBatteryPercent: 15 }])
    })
  })

  describe('notifications', () => {
    it('shows where Notifications go and offers the Test Notification when they are set up', async () => {
      fakeSettings()
      const screen = await mountSettings({ instance: WITH_NOTIFICATIONS })

      expect(readRowSays(screen, 'Apprise')).toEqual({
        shown: 'http://apprise:8000',
        side: 'From KUROSHIRO_APPRISE_URL',
        note: 'Each Alert is announced there when it fires and again when it resolves. Which channels it reaches is set in Apprise.',
      })
      expect(words(readRowOf(screen, 'Test Notification')?.querySelector('.note'))).toBe('Travels the same way as a real Notification and belongs to no Alert.')
      await expect.element(screen.getByRole('button', { name: 'Send a Test Notification' })).toBeEnabled()
      expect(testNotificationSays(screen)).toBe('')
    })

    it('says "Sending" with the button disabled, then that it was sent, for as long as the page stays open', async () => {
      fakeSettings()
      let accept = () => {}
      api.use(http.post(apiUrl('alerts/test-notification'), async () => {
        await new Promise<void>((resolve) => {
          accept = resolve
        })
        return HttpResponse.json({ message: 'Test notification sent successfully.' })
      }))
      const screen = await mountSettings({ instance: WITH_NOTIFICATIONS })
      const region = readRowOf(screen, 'Test Notification')?.querySelector('[role="status"]')
      const button = screen.getByRole('button', { name: 'Send a Test Notification' })

      await button.click()

      await expect.poll(() => testNotificationSays(screen)).toBe('Sending, up to 15 seconds')
      await expect.element(button).toBeDisabled()

      accept()

      await expect.poll(() => testNotificationSays(screen)).toBe('Sent. Look for it in your channels.')
      expect(readRowOf(screen, 'Test Notification')?.querySelector('[role="status"]')).toBe(region)
      await expect.element(button).toBeEnabled()
    })

    it('says "Not sent" and what to check when Apprise did not accept it', async () => {
      fakeSettings()
      api.use(http.post(apiUrl('alerts/test-notification'), () => apiErrorResponse({ statusCode: 503, code: 'notification-failed' })))
      const screen = await mountSettings({ instance: WITH_NOTIFICATIONS })

      await screen.getByRole('button', { name: 'Send a Test Notification' }).click()

      await expect.poll(() => testNotificationSays(screen)).toBe('Not sent')
      expect(words(readRowOf(screen, 'Test Notification')?.querySelector('.note'))).toBe('Apprise did not accept it. Check that the Apprise sidecar is running, and its logs.')
      expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
      await expect.element(screen.getByRole('button', { name: 'Send a Test Notification' })).toBeEnabled()
    })

    it('words the refusal of an Instance whose Notifications were switched off meanwhile', async () => {
      fakeSettings()
      api.use(http.post(apiUrl('alerts/test-notification'), () => apiErrorResponse({ statusCode: 400, code: 'notifications-off' })))
      const screen = await mountSettings({ instance: WITH_NOTIFICATIONS })

      await screen.getByRole('button', { name: 'Send a Test Notification' }).click()

      await expect.poll(() => testNotificationSays(screen)).toBe('Not sent')
      expect(words(readRowOf(screen, 'Test Notification')?.querySelector('.note'))).toBe('Notifications are off on this Instance.')
    })

    it('says that Notifications are off and how to turn them on, with no rows, when they are not set up', async () => {
      fakeSettings()
      const screen = await mountSettings({ instance: buildInstanceFacts({ notifications: { configured: false, appriseUrl: null } }) })
      const section = screen.getByRole('region', { name: 'Notifications' })

      expect([...section.element().querySelectorAll('p')].map(words)).toEqual([
        'Notifications are off. Alerts still fire and show here; nothing is sent anywhere.',
        'To turn them on, run an Apprise sidecar, set KUROSHIRO_APPRISE_URL to its address and restart Kuroshiro. Alerts that fired while Notifications were off are announced then.',
      ])
      expect(screen.getByRole('button', { name: 'Send a Test Notification' }).query()).toBeNull()
      expect(section.element().querySelector('.read-row')).toBeNull()
    })
  })

  describe('retention', () => {
    it('shows the two ages with their source and the copy for an age above 0', async () => {
      fakeSettings(buildInstanceSettings({
        deviceLogRetentionDays: { override: null, value: 14, fallbackSource: 'env', fallbackValue: 14 },
      }))
      const screen = await mountSettings()

      await expect.element(field(screen, 'Resolved Alerts')).toHaveValue(90)
      expect(words(rowOf(screen, 'Resolved Alerts')?.querySelector('.control-cell'))).toBe('kept for days')
      expect(sourceOf(screen, 'Resolved Alerts')).toBe('Built-in default')
      expect(noteOf(screen, 'Resolved Alerts')).toBe('A firing Alert is never removed.')
      await expect.element(field(screen, 'Device Log entries')).toHaveValue(14)
      expect(sourceOf(screen, 'Device Log entries')).toBe('From KUROSHIRO_DEVICE_LOG_RETENTION_DAYS')
      expect(noteOf(screen, 'Device Log entries')).toBe('0 keeps them until you clear a Device\'s Logs.')
      await expect.element(screen.getByText('Retention runs every day at 04:00, server time. A change applies at the next run.')).toBeVisible()
      await expect.element(screen.getByRole('region', { name: 'Retention' }).getByRole('link', { name: 'Housekeeping' })).toHaveAttribute('href', '/instance/housekeeping')
    })

    it('saves an age as it is changed, 0 included, with the copy for 0', async () => {
      const patches = fakeSettings()
      const screen = await mountSettings()

      await enter(screen, 'Resolved Alerts', '0')
      await expect.poll(() => noteOf(screen, 'Resolved Alerts'), { timeout: 5000 }).toBe('Resolved Alerts are kept for good.')
      await enter(screen, 'Device Log entries', '0')
      await expect.poll(() => noteOf(screen, 'Device Log entries'), { timeout: 5000 }).toBe('Device Log entries are kept until you clear a Device\'s Logs.')

      expect(patches).toEqual([{ alertRetentionDays: 0 }, { deviceLogRetentionDays: 0 }])
      await expect.poll(() => sourceOf(screen, 'Device Log entries'), { timeout: 5000 }).toBe('Set here · Reset to 30')
    })

    it('clears an age by sending null', async () => {
      const patches = fakeSettings(buildInstanceSettings({
        alertRetentionDays: { override: 7, value: 7, fallbackSource: 'default', fallbackValue: 90 },
      }))
      const screen = await mountSettings()

      await screen.getByRole('button', { name: 'Reset to 90' }).click()

      await expect.element(field(screen, 'Resolved Alerts')).toHaveValue(90)
      await expect.poll(() => patches).toEqual([{ alertRetentionDays: null }])
    })

    it('does not send an age below 0 and says what is allowed', async () => {
      const patches = fakeSettings()
      const screen = await mountSettings()

      await enter(screen, 'Device Log entries', '-1')

      await expect.element(field(screen, 'Device Log entries')).toHaveAccessibleDescription('Enter a whole number of days, or 0 to keep them for good.')
      expect(patches).toEqual([])
    })
  })

  describe('set where Kuroshiro is started', () => {
    it('reads the four facts of the environment, the Metrics address among them', async () => {
      fakeSettings()
      const screen = await mountSettings({ instance: buildInstanceFacts({ serverUrl: 'http://kuroshiro.lan:3000', timezone: 'Europe/Berlin', demoMode: false }) })
      const section = screen.getByRole('region', { name: 'Set where Kuroshiro is started' })

      await expect.element(section.getByText('Read from the environment at start. To change one, change the variable and restart Kuroshiro.')).toBeVisible()
      expect(readRowSays(screen, 'Server URL')).toMatchObject({ shown: 'http://kuroshiro.lan:3000', note: 'The address every Device is given for its images and Firmware. KUROSHIRO_API_URL' })
      expect(readRowSays(screen, 'Timezone')).toMatchObject({ shown: 'Europe/Berlin', note: 'Schedules, Sleep Mode and the 04:00 jobs run on this clock. TZ' })
      expect(readRowSays(screen, 'Metrics')).toMatchObject({ shown: 'http://kuroshiro.lan:3000/metrics', note: 'For Prometheus: battery, signal and last seen per Device, firing Alerts per kind. Anyone who can reach this server can read it.' })
      expect(readRowSays(screen, 'Demo mode')).toMatchObject({ shown: 'Off', note: 'While on, image uploads are refused. KUROSHIRO_DEMO_MODE' })
      expect(section.getByRole('spinbutton').elements()).toEqual([])
    })

    it('reads demo mode as on from the Instance facts', async () => {
      fakeSettings()
      const screen = await mountSettings({ instance: buildInstanceFacts({ demoMode: true }) })

      expect(readRowSays(screen, 'Demo mode')).toMatchObject({ shown: 'On', note: 'Image uploads are refused and Kuroshiro only fetches public addresses. KUROSHIRO_DEMO_MODE' })
    })

    it('ends by sending Firmware Auto-Update to the Firmware page', async () => {
      fakeSettings()
      const screen = await mountSettings()
      const lastLine = [...screen.getByRole('main').element().querySelectorAll('p')].find(line => words(line).startsWith('Firmware Auto-Update'))

      expect(words(lastLine)).toBe('Firmware Auto-Update is an Instance Setting too. It is switched on the Firmware page.')
      expect(lastLine?.querySelector('a')?.getAttribute('href')).toBe('/instance/firmware')
      expect(screen.getByRole('main').getByRole('switch').elements()).toEqual([])
    })
  })

  describe('the page', () => {
    it('opens with what it is for', async () => {
      fakeSettings()
      const screen = await mountSettings()

      await expect.element(screen.getByText('Values for this whole Instance. Changes save as you make them.')).toBeVisible()
    })

    it.for(['alert-rules', 'notifications', 'retention', 'fixed'])('has a section that answers to #%s', async (fragment) => {
      fakeSettings()
      await mountSettings({ at: `/instance/settings#${fragment}` })

      await expect.poll(() => document.getElementById(fragment)?.tagName).toBe('SECTION')
    })

    it('shows "Loading the Instance Settings" under its heading while the answer takes long', async () => {
      fakeShellReads()
      let answer = () => {}
      api.use(http.get(apiUrl('settings'), async () => {
        await new Promise<void>((resolve) => {
          answer = resolve
        })
        return HttpResponse.json(buildInstanceSettings())
      }))
      const screen = await mountApp({ at: '/instance/settings' })

      await expect.element(screen.getByRole('heading', { level: 2, name: 'Instance Settings' })).toBeVisible()
      await expect.element(screen.getByText('Loading the Instance Settings')).toBeVisible()
      expect(screen.getByRole('spinbutton').elements()).toEqual([])
      expect(screen.getByRole('main').element().querySelectorAll('.wash-bar').length).toBeGreaterThan(0)

      answer()

      await expect.element(field(screen, 'Battery low')).toHaveValue(20)
      expect(screen.getByText('Loading the Instance Settings').query()).toBeNull()
    })

    it('shows the notice when the Instance Settings cannot be loaded, and the page once "Try again" works', async () => {
      fakeShellReads()
      let answers = false
      api.use(http.get(apiUrl('settings'), () => answers
        ? HttpResponse.json(buildInstanceSettings())
        : apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountApp({ at: '/instance/settings' })

      await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Instance Settings. Something went wrong on the server.')
      expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])

      answers = true
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(field(screen, 'Battery low')).toHaveValue(20)
      expect(screen.getByRole('alert').query()).toBeNull()
    })

    it('is accessible and does not overflow, with a value out of range and a Test Notification not sent', async () => {
      fakeSettings(buildInstanceSettings({
        offlineMultiplier: { override: 4, value: 4, fallbackSource: 'default', fallbackValue: 3 },
        deviceLogRetentionDays: { override: null, value: 14, fallbackSource: 'env', fallbackValue: 14 },
      }))
      api.use(http.post(apiUrl('alerts/test-notification'), () => apiErrorResponse({ statusCode: 503, code: 'notification-failed' })))
      const screen = await mountSettings({ instance: WITH_NOTIFICATIONS })
      await enter(screen, 'Battery low', '0')
      await screen.getByRole('button', { name: 'Send a Test Notification' }).click()
      await expect.poll(() => testNotificationSays(screen)).toBe('Not sent')

      await expectAccessible()
      await expectNoHorizontalOverflow()
    })

    it('is accessible and does not overflow with Notifications off', async () => {
      fakeSettings()
      await mountSettings()

      await expectAccessible()
      await expectNoHorizontalOverflow()
    })
  })
})
