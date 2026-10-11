import type { Screen } from '@/pages/devices/__test__/deviceSettingsHarness'
import { MAC_ADDRESS_PATTERN } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { choose, offeredBy, words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeScreenImages } from '@/testing/images'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { freezeTime } from '@/testing/time'
import { fakeSimulator, FIRMWARE_1_8_0, mountSimulator, PLAYED_HALLWAY, PLAYED_KITCHEN } from './simulatorHarness'

const NOW = '2026-10-03T07:35:00.000Z'

const pollAs = (screen: Screen) => screen.getByRole('combobox', { name: 'Poll as' })
const reportInput = (screen: Screen, label: string) => screen.getByRole('textbox', { name: label, exact: true })
const consequence = (screen: Screen) => words(screen.getByRole('main').element().querySelector('.consequence'))

/** The answer's label and value rows. */
function summaryOf(screen: Screen) {
  const rows = [...screen.getByRole('main').element().querySelectorAll('.summary-row')]
  return Object.fromEntries(rows.map(row => [words(row.querySelector('dt')), words(row.querySelector('dd'))]))
}

/** The confirmation's "Lost" and "Stays", each as the words of its value. */
function outcomeOf(dialog: Element) {
  const rows = [...dialog.querySelectorAll('dl > div')]
  return Object.fromEntries(rows.map(row => [words(row.querySelector('dt')), words(row.querySelector('dd'))]))
}

async function openSimulator(at?: string, faked: Parameters<typeof fakeSimulator>[0] = {}) {
  freezeTime(NOW)
  fakeScreenImages()
  const fake = fakeSimulator(faked)
  const screen = await mountSimulator(at)
  return { fake, screen }
}

async function openReports(screen: Screen) {
  await screen.getByRole('button', { name: 'What it reports' }).click()
}

describe('the Device Simulator', () => {
  it('is a page of the Instance frame with its lede', async () => {
    const { screen } = await openSimulator()

    await expect.element(screen.getByRole('navigation', { name: 'Instance' }).getByRole('link', { name: 'Device Simulator' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByText('Makes the two calls a Device\'s firmware makes, from this browser, and shows what the server answers. For finding out why a Device shows what it shows, without walking to it.')).toBeVisible()
    await expect.element(screen.getByText('Nothing polled yet')).toBeVisible()
  })

  describe('poll as', () => {
    it('offers the Devices by name, then a Device that is not registered, and chooses the first', async () => {
      const { screen } = await openSimulator()

      await expect.element(pollAs(screen)).toHaveTextContent('Hallway')
      expect(await offeredBy(screen, 'Poll as')).toEqual(['Hallway', 'Kitchen', 'Study', 'A Device that is not registered'])
    })

    it('chooses the Device the address names', async () => {
      const { screen } = await openSimulator('/instance/simulator?device=kitchen')

      await expect.element(pollAs(screen)).toHaveTextContent('Kitchen')
      await expect.element(screen.getByRole('button', { name: 'Poll as Kitchen' })).toBeVisible()
    })

    it('chooses a Device that is not registered when there are no Devices', async () => {
      const { screen } = await openSimulator(undefined, { devices: [] })

      await expect.element(pollAs(screen)).toHaveTextContent('A Device that is not registered')
      await expect.element(screen.getByRole('textbox', { name: 'MAC address' })).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'Poll', exact: true })).toBeDisabled()
    })
  })

  describe('what it reports', () => {
    it('is tucked, and holds what the chosen Device last reported with the header each is sent as', async () => {
      const { screen } = await openSimulator('/instance/simulator?device=kitchen')
      await expect.element(screen.getByRole('button', { name: 'What it reports' })).toHaveAttribute('aria-expanded', 'false')

      await openReports(screen)

      await expect.element(screen.getByText('Filled with what Kitchen last reported, so a poll leaves its facts as they are. Change one to see what the server does with it.')).toBeVisible()
      await expect.element(reportInput(screen, 'Battery voltage')).toHaveValue('4.05')
      await expect.element(reportInput(screen, 'Signal, dBm')).toHaveValue('-61')
      await expect.element(reportInput(screen, 'Firmware version')).toHaveValue('1.7.8')
      await expect.element(reportInput(screen, 'Model')).toHaveValue('og_plus')
      await expect.element(reportInput(screen, 'Width')).toHaveValue('800')
      await expect.element(reportInput(screen, 'Height')).toHaveValue('480')
      await expect.element(screen.getByText('Battery-Voltage', { exact: true })).toBeVisible()

      await choose(screen, 'Poll as', 'Hallway')
      await expect.element(reportInput(screen, 'Battery voltage')).toHaveValue('3.71')
    })
  })

  describe('a poll as a Device', () => {
    it('says what it does beforehand', async () => {
      const { screen } = await openSimulator('/instance/simulator?device=kitchen')

      await expect.poll(() => consequence(screen)).toBe('A poll here is a real poll. It moves Kitchen\'s Rotation on by one Screen, counts as Kitchen having been seen, and takes any pending Special Function, Device Reset or Firmware push, which then never reaches the Device.')
    })

    it('polls at once with the Device\'s key and what it last reported, and shows what the server answered', async () => {
      const { fake, screen } = await openSimulator('/instance/simulator?device=kitchen')

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()

      await expect.element(screen.getByRole('img', { name: 'The image this poll was given: Calendar, Order 2 of 3' })).toBeVisible()
      expect(fake.polls).toEqual([{
        'id': 'A4:C1:38:5F:0B:9D',
        'access-token': 'kitchen-key',
        'battery-voltage': '4.05',
        'rssi': '-61',
        'fw-version': '1.7.8',
        'model': 'og_plus',
        'width': '800',
        'height': '480',
        'sensors': 'kind=temperature;value=21.5;unit=C',
      }])
    })
  })

  describe('the answer to a poll', () => {
    it('lists what the Device was told, and the answer as the Device gets it with "Copy"', async () => {
      const written = vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async () => {})
      const { screen } = await openSimulator('/instance/simulator?device=kitchen')

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()

      await expect.poll(() => summaryOf(screen)).toEqual({
        'Shows': 'Calendar, Order 2 of 3',
        'Polls again in': '15 min',
        'Firmware': 'no update',
        'Special Function': 'none pending',
      })
      await expect.element(screen.getByRole('button', { name: 'The answer as the Device gets it' })).toHaveAttribute('aria-expanded', 'true')
      const code = words(screen.getByRole('main').element().querySelector('.raw pre'))
      expect(JSON.parse(code)).toMatchObject({ refresh_rate: 900, update_firmware: false, special_function: 'none', reset_firmware: false })

      await screen.getByRole('button', { name: 'Copy' }).click()
      expect(JSON.parse(written.mock.calls[0]![0])).toMatchObject({ refresh_rate: 900 })
      written.mockRestore()
    })

    it('reads the Devices again, so the bar and the chosen Device are current', async () => {
      const { fake, screen } = await openSimulator('/instance/simulator?device=kitchen')

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()
      await expect.poll(() => summaryOf(screen).Shows).toBe('Calendar, Order 2 of 3')

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()
      await expect.poll(() => summaryOf(screen).Shows).toBe('Photos, Order 3 of 3')
      expect(fake.polls).toHaveLength(2)
    })

    it('shows a refused poll as a notice with the status and reason, in place of the plate', async () => {
      const { fake, screen } = await openSimulator('/instance/simulator?device=kitchen')
      fake.refuseNextPoll = HttpResponse.json({ statusCode: 401, message: 'Invalid API key', error: 'Unauthorized' }, { status: 401 })

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()

      await expect.element(screen.getByText('The server refused the poll.')).toBeVisible()
      await expect.element(screen.getByText('401 Unauthorized: Invalid API key.')).toBeVisible()
      await expect.element(screen.getByText('Nothing polled yet')).not.toBeInTheDocument()
    })

    it('sends what was changed in "What it reports"', async () => {
      const { fake, screen } = await openSimulator('/instance/simulator?device=kitchen')
      await openReports(screen)

      await reportInput(screen, 'Battery voltage').fill('3.30')
      await reportInput(screen, 'Height').fill('')
      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()

      await expect.poll(() => fake.polls.length).toBe(1)
      expect(fake.polls[0]).toMatchObject({ 'battery-voltage': '3.30' })
      expect(fake.polls[0]).not.toHaveProperty('height')
    })
  })

  describe('a poll that takes something pending', () => {
    const PENDING_PUSH = { ...PLAYED_KITCHEN, targetFirmware: FIRMWARE_1_8_0, pending: { firmwarePush: true, deviceReset: false, deviceResetNewApikey: false, specialFunction: null } }

    it('names what it takes in ink', async () => {
      const { screen } = await openSimulator('/instance/simulator?device=kitchen', { devices: [PENDING_PUSH, PLAYED_HALLWAY] })

      await expect.poll(() => consequence(screen)).toContain('and takes the Firmware push of 1.8.0, which then never reaches the Device.')
      await expect.element(screen.getByRole('main').getByText('the Firmware push of 1.8.0', { exact: true })).toHaveClass('name')
    })

    it('confirms first, and takes it once confirmed', async () => {
      const { fake, screen } = await openSimulator('/instance/simulator?device=kitchen', { devices: [PENDING_PUSH, PLAYED_HALLWAY] })
      await expect.poll(() => consequence(screen)).toContain('the Firmware push of 1.8.0')

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Poll as Kitchen?' })
      await expect.element(dialog).toBeVisible()
      expect(outcomeOf(dialog.element())).toEqual({
        Lost: 'The pending Firmware push of 1.8.0. The simulator takes it and the Device never gets it.',
        Stays: 'Kitchen, its Screens and its Settings.',
      })
      expect(fake.polls).toHaveLength(0)

      await dialog.getByRole('button', { name: 'Poll as Kitchen' }).click()

      await expect.poll(() => summaryOf(screen).Firmware).toBe('told to update to 1.8.0')
      expect(fake.polls).toHaveLength(1)
      await expect.poll(() => consequence(screen)).toContain('and takes any pending Special Function, Device Reset or Firmware push')
    })

    it('keeps it pending when the confirmation is left', async () => {
      const { fake, screen } = await openSimulator('/instance/simulator?device=kitchen', { devices: [PENDING_PUSH, PLAYED_HALLWAY] })
      await expect.poll(() => consequence(screen)).toContain('the Firmware push of 1.8.0')

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Keep it pending' }).click()

      await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
      expect(fake.polls).toHaveLength(0)
    })

    it('shows a Device Reset only when the answer carries one', async () => {
      const resetting = { ...PLAYED_KITCHEN, pending: { firmwarePush: false, deviceReset: true, deviceResetNewApikey: false, specialFunction: 'identify' as const } }
      const { screen } = await openSimulator('/instance/simulator?device=kitchen', { devices: [resetting] })
      await expect.poll(() => consequence(screen)).toContain('the Device Reset and the Special Function identify')

      await screen.getByRole('button', { name: 'Poll as Kitchen' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Poll as Kitchen' }).click()

      await expect.poll(() => summaryOf(screen)['Device Reset']).toBe('told to reset')
      expect(summaryOf(screen)['Special Function']).toBe('identify')
    })
  })

  describe('setup', () => {
    it('answers a registered Device with what it has, and changes nothing', async () => {
      const { fake, screen } = await openSimulator('/instance/simulator?device=kitchen')

      await screen.getByRole('button', { name: 'Call setup' }).click()

      await expect.element(screen.getByText('Setup answered with Kitchen\'s API key and friendly id. Nothing changed.')).toBeVisible()
      expect(fake.setups).toEqual([{ id: 'A4:C1:38:5F:0B:9D' }])
      expect(fake.devices).toHaveLength(3)
    })

    it('registers a Device with a MAC address nobody registered, which the bar gains, and then polls as it', async () => {
      const { fake, screen } = await openSimulator(undefined, { devices: [] })
      await expect.poll(() => consequence(screen)).toBe('Setup here is a real setup. It registers a Device with this MAC address, and a poll gives it the welcome Fallback Screen.')
      await expect.element(screen.getByText('Calling setup with a MAC address nobody registered creates a Device. It stays until you delete it.')).toBeVisible()

      await screen.getByRole('button', { name: 'Make one up' }).click()
      const mac = (screen.getByRole('textbox', { name: 'MAC address' }).element() as HTMLInputElement).value
      expect(mac).toMatch(MAC_ADDRESS_PATTERN)
      await screen.getByRole('button', { name: 'Call setup' }).click()

      await expect.element(screen.getByText('It is called 9D0E4A until you name it, and has its API key.', { exact: false })).toBeVisible()
      expect(words(screen.getByRole('status').filter({ hasText: 'Setup registered' }).element())).toBe('Setup registered a Device. It is called 9D0E4A until you name it, and has its API key.')
      expect(fake.setups).toEqual([{ 'id': mac, 'fw-version': '1.7.8', 'model': 'og' }])
      await expect.element(screen.getByRole('banner').getByRole('link', { name: '9D0E4A' })).toBeVisible()

      await screen.getByRole('button', { name: 'Poll', exact: true }).click()

      await expect.poll(() => summaryOf(screen).Shows).toBe('The no-screen Fallback Screen')
      expect(fake.polls[0]).toMatchObject({ 'id': mac, 'access-token': 'new-device-key', 'battery-voltage': '4.10' })
    })

    it('needs setup again for another MAC address before it polls', async () => {
      const { screen } = await openSimulator(undefined, { devices: [] })
      await screen.getByRole('textbox', { name: 'MAC address' }).fill('02:00:00:00:00:01')
      await screen.getByRole('button', { name: 'Call setup' }).click()
      await expect.element(screen.getByRole('button', { name: 'Poll', exact: true })).toBeEnabled()

      await screen.getByRole('textbox', { name: 'MAC address' }).fill('02:00:00:00:00:02')

      await expect.element(screen.getByRole('button', { name: 'Poll', exact: true })).toBeDisabled()
    })
  })

  it('says so when the Devices could not be loaded', async () => {
    freezeTime(NOW)
    fakeSimulator()
    api.use(http.get(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const screen = await mountSimulator()

    await expect.element(screen.getByText('Could not load the Devices.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  it('is accessible and does not overflow', async () => {
    await openSimulator('/instance/simulator?device=kitchen')

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
