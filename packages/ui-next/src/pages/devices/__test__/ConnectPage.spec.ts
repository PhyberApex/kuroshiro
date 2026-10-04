import type { CreateDeviceInput, DeviceSummary, UpdateDeviceInput } from 'kuroshiro-shared'
import { MAC_ADDRESS_PATTERN } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { fakeScreenImages } from '@/testing/images'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'

const NOW = '2026-10-03T07:35:00.000Z'

/** The page asks for the Devices every 3 seconds, on a real timer. */
const WITHIN_A_FEW_POLLS = { timeout: 10_000 }

const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })

function calledIn(id: string, friendlyId: string, overrides: Partial<DeviceSummary> = {}) {
  return buildDeviceSummary({
    id,
    name: friendlyId,
    friendlyId,
    firmwareVersion: '1.6.9',
    lastSeenAt: null,
    nextPollAt: null,
    batteryPercent: null,
    rssi: null,
    currentScreen: { kind: 'fallback', fallback: 'welcome', reason: 'neverPolled', screenId: null, imagePath: '/screens/welcome.png?v=1', servedAt: null },
    ...overrides,
  })
}

interface Faked {
  /** What `GET /api/devices` answers, read on every request. `null` is a server that cannot be reached. */
  devices: DeviceSummary[] | null
  registered: CreateDeviceInput[]
  renamed: { id: string, input: UpdateDeviceInput }[]
}

function fakeInstance({ devices = [] as DeviceSummary[], serverUrl = 'http://kuroshiro.lan:3000', serverUrlIsLoopback = false } = {}): Faked {
  const faked: Faked = { devices, registered: [], renamed: [] }
  freezeTime(NOW)
  holdTabVisible()
  fakeScreenImages()
  api.use(
    http.get(apiUrl('instance'), () => HttpResponse.json(buildInstanceFacts({ serverUrl, serverUrlIsLoopback }))),
    http.get(apiUrl('alerts'), () => HttpResponse.json(buildAlertsList())),
    http.get(apiUrl('devices'), () => faked.devices ? HttpResponse.json(faked.devices) : HttpResponse.error()),
    http.patch(apiUrl('devices/:id'), async ({ request, params }) => {
      const input = await request.json() as UpdateDeviceInput
      faked.renamed.push({ id: String(params.id), input })
      faked.devices = faked.devices!.map(device => device.id === params.id ? { ...device, name: input.name! } : device)
      return HttpResponse.json(buildDeviceDetail({ id: String(params.id), name: input.name }))
    }),
  )
  return faked
}

type Screen = Awaited<ReturnType<typeof mountApp>>

const words = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const main = (screen: Screen) => screen.getByRole('main')
const blocks = (screen: Screen) => [...main(screen).element().querySelectorAll('.called-in')]
const listening = (screen: Screen) => words(main(screen).element().querySelector('.listening'))

async function openByHand(screen: Screen) {
  await screen.getByRole('button', { name: 'Register a Device by hand' }).click()
  await expect.element(screen.getByRole('button', { name: 'Register Device' })).toBeVisible()
}

describe('connect a Device', () => {
  it('on an Instance with no Devices, is titled "Connect your Device" and shows the server URL, the waiting line, the three steps and the way in for a Configuration Archive', async () => {
    fakeInstance()
    const screen = await mountApp({ at: '/connect' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Connect your Device' })).toBeVisible()
    await expect.element(screen.getByText('Enter this server URL on the Device\'s Wi-Fi setup page. The Device shows up here the moment it calls in.')).toBeVisible()
    await expect.element(screen.getByText('http://kuroshiro.lan:3000')).toBeVisible()
    expect(listening(screen)).toBe('Waiting for a Device to call in')
    expect([...main(screen).element().querySelectorAll('ol > li')].map(words)).toEqual([
      'Put the Device into Wi-Fi setup. A new Device starts there. Otherwise hold its button for five seconds.',
      'Join its Wi-Fi network from your phone or laptop. It is called TRMNL. The setup page opens by itself.',
      'Enter your Wi-Fi and the server URL above. The URL goes into the custom server field. The Device restarts and calls in.',
    ])
    expect(words(main(screen).element().querySelector('.moving'))).toBe('Moving from another Instance? Import a Configuration Archive to bring its Devices, Screens and Plugins along.')
    await expect.element(screen.getByRole('link', { name: 'Import a Configuration Archive' })).toHaveAttribute('href', '/instance/archive')
  })

  it('on an Instance that has Devices, is titled "Connect a Device" and does not mention the Configuration Archive', async () => {
    fakeInstance({ devices: [KITCHEN] })
    const screen = await mountApp({ at: '/connect' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Connect a Device' })).toBeVisible()
    await expect.element(screen.getByText('http://kuroshiro.lan:3000')).toBeVisible()
    expect(main(screen).element().querySelector('.moving')).toBeNull()
    expect(blocks(screen)).toEqual([])
  })

  it('copies the server URL with "Copy URL"', async () => {
    fakeInstance()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const screen = await mountApp({ at: '/connect' })

    await screen.getByRole('button', { name: 'Copy URL' }).click()

    expect(writeText).toHaveBeenCalledWith('http://kuroshiro.lan:3000')
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible()
  })

  it.each([
    ['http://localhost:3000', 'localhost'],
    ['http://127.0.0.1:3000', '127.0.0.1'],
  ])('warns that a Device cannot reach %s', async (serverUrl, host) => {
    fakeInstance({ serverUrl, serverUrlIsLoopback: true })
    const screen = await mountApp({ at: '/connect' })

    await expect.element(screen.getByText(`A Device cannot reach “${host}”.`, { exact: false })).toBeVisible()
    expect(words(main(screen).element().querySelector('.unreachable'))).toBe(`A Device cannot reach “${host}”. Set KUROSHIRO_API_URL to this machine's address on your network and restart Kuroshiro.`)
  })

  it('does not warn about an address a Device can reach', async () => {
    fakeInstance({ serverUrl: 'http://192.168.1.20:3000' })
    const screen = await mountApp({ at: '/connect' })

    await expect.element(screen.getByText('http://192.168.1.20:3000')).toBeVisible()
    expect(main(screen).element().querySelector('.unreachable')).toBeNull()
  })

  it('says so when the server URL cannot be loaded, and shows it once "Try again" works', async () => {
    fakeInstance()
    api.use(http.get(apiUrl('instance'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
    const screen = await mountApp({ at: '/connect' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the server URL. Something went wrong on the server.')
    expect(listening(screen)).toBe('Waiting for a Device to call in')

    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.element(screen.getByText('http://kuroshiro.lan:3000')).toBeVisible()
    expect(screen.getByRole('alert').query()).toBeNull()
  })

  it('shows a block for a Device that calls in after the page opened, and a second block for a second one', async () => {
    const faked = fakeInstance({ devices: [KITCHEN] })
    const screen = await mountApp({ at: '/connect' })
    await expect.poll(() => listening(screen)).toBe('Waiting for a Device to call in')

    faked.devices = [KITCHEN, calledIn('new-1', '4F2A1C')]

    await expect.poll(() => blocks(screen).length, WITHIN_A_FEW_POLLS).toBe(1)
    const [first] = blocks(screen)
    expect(words(first!.querySelector('.label'))).toBe('A Device called in')
    expect(words(first!.querySelector('.identity'))).toBe('4F2A1C · Firmware 1.6.9 · TRMNL OG (2-bit)')
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('4F2A1C')
    await expect.element(screen.getByRole('link', { name: 'Open 4F2A1C' })).toHaveAttribute('href', '/devices/new-1')
    expect(listening(screen)).toBe('Still listening, in case there is another one')

    faked.devices = [KITCHEN, calledIn('new-2', '0B9D3E'), calledIn('new-1', '4F2A1C')]

    await expect.poll(() => blocks(screen).length, WITHIN_A_FEW_POLLS).toBe(2)
    expect(blocks(screen).map(block => words(block.querySelector('.identity')))).toEqual([
      '4F2A1C · Firmware 1.6.9 · TRMNL OG (2-bit)',
      '0B9D3E · Firmware 1.6.9 · TRMNL OG (2-bit)',
    ])
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Connect a Device' })).toBeVisible()
  })

  it('names a Device that called in, saving as changed, and opens it under its new name', async () => {
    const faked = fakeInstance()
    const screen = await mountApp({ at: '/connect' })
    await expect.poll(() => listening(screen)).toBe('Waiting for a Device to call in')
    faked.devices = [calledIn('new-1', '4F2A1C')]
    const name = screen.getByRole('textbox', { name: 'Name' })
    await expect.element(name).toHaveValue('4F2A1C')

    await name.fill('Kitchen')
    await name.element().blur()

    await expect.element(screen.getByRole('link', { name: 'Open Kitchen' })).toHaveAttribute('href', '/devices/new-1')
    expect(faked.renamed).toEqual([{ id: 'new-1', input: { name: 'Kitchen' } }])
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Connect your Device' })).toBeVisible()
  })

  it('does not send an empty name for a Device that called in', async () => {
    const faked = fakeInstance()
    const screen = await mountApp({ at: '/connect' })
    await expect.poll(() => listening(screen)).toBe('Waiting for a Device to call in')
    faked.devices = [calledIn('new-1', '4F2A1C')]
    const name = screen.getByRole('textbox', { name: 'Name' })
    await expect.element(name).toHaveValue('4F2A1C')

    await name.fill('   ')
    await name.element().blur()

    await expect.element(screen.getByText('A Device needs a name.')).toBeVisible()
    await expect.element(name).toHaveAttribute('aria-invalid', 'true')
    expect(faked.renamed).toEqual([])
  })

  it('says that the server is not answering on the waiting line, and keeps asking until it does', async () => {
    const faked = fakeInstance({ devices: [KITCHEN] })
    const screen = await mountApp({ at: '/connect' })
    await expect.poll(() => listening(screen)).toBe('Waiting for a Device to call in')

    faked.devices = null

    await expect.poll(() => listening(screen), WITHIN_A_FEW_POLLS).toBe('Kuroshiro\'s server is not answering.')
    expect(elementsInSealColour(main(screen).element())).toEqual([])

    faked.devices = [KITCHEN, calledIn('new-1', '4F2A1C')]

    await expect.poll(() => blocks(screen).length, WITHIN_A_FEW_POLLS).toBe(1)
    expect(listening(screen)).toBe('Still listening, in case there is another one')
  })

  describe('registering a Device by hand', () => {
    function fakeRegistering(faked: Faked) {
      api.use(
        http.post(apiUrl('devices'), async ({ request }) => {
          const input = await request.json() as CreateDeviceInput
          faked.registered.push(input)
          const device = buildDeviceDetail({ id: 'by-hand', name: input.name, mac: input.mac, lastSeenAt: null })
          faked.devices = [...faked.devices!, buildDeviceSummary({ id: 'by-hand', name: input.name, lastSeenAt: null })]
          return HttpResponse.json(device, { status: 201 })
        }),
        http.get(apiUrl('devices/by-hand'), () => HttpResponse.json(buildDeviceDetail({ id: 'by-hand', name: 'Hallway', lastSeenAt: null, screenCount: 0 }))),
        http.get(apiUrl('devices/by-hand/screens'), () => HttpResponse.json([])),
      )
    }

    it('is tucked away and explains itself once opened', async () => {
      fakeInstance()
      const screen = await mountApp({ at: '/connect' })

      await expect.element(screen.getByRole('button', { name: 'Register a Device by hand' })).toHaveAttribute('aria-expanded', 'false')
      await openByHand(screen)

      await expect.element(screen.getByText('For a Device that cannot call the setup address itself, or to try Kuroshiro with the Device Simulator. A Device registered here appears at once and waits for its first poll.')).toBeVisible()
      await expect.element(screen.getByText('Six pairs of hex digits. Make one up only for a Device that has no real one.')).toBeVisible()
    })

    it('registers the Device and opens its Screens view', async () => {
      const faked = fakeInstance({ devices: [KITCHEN] })
      fakeRegistering(faked)
      const screen = await mountApp({ at: '/connect' })
      await openByHand(screen)

      await screen.getByRole('textbox', { name: 'Name' }).fill('  Hallway ')
      await screen.getByRole('textbox', { name: 'MAC address' }).fill('a4:c1:38:5f:0b:9d')
      await screen.getByRole('button', { name: 'Register Device' }).click()

      await expect.poll(() => screen.router.currentRoute.value.path).toBe('/devices/by-hand')
      expect(faked.registered).toEqual([{ name: 'Hallway', mac: 'a4:c1:38:5f:0b:9d' }])
      await expect.element(screen.getByRole('heading', { level: 1, name: 'Hallway' })).toBeVisible()
      await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Hallway' })).toBeVisible()
    })

    it('fills in a random MAC address with "Make one up"', async () => {
      fakeInstance()
      const screen = await mountApp({ at: '/connect' })
      await openByHand(screen)

      await screen.getByRole('button', { name: 'Make one up' }).click()

      const made = (screen.getByRole('textbox', { name: 'MAC address' }).element() as HTMLInputElement).value
      expect(made).toMatch(MAC_ADDRESS_PATTERN)

      await screen.getByRole('button', { name: 'Make one up' }).click()
      expect((screen.getByRole('textbox', { name: 'MAC address' }).element() as HTMLInputElement).value).not.toBe(made)
    })

    it.each(['A4:C1:38:5F:0B', 'A4C1385F0B9D', 'G4:C1:38:5F:0B:9D', ''])('never sends %j as a MAC address, and says what is allowed', async (mac) => {
      const faked = fakeInstance()
      fakeRegistering(faked)
      const screen = await mountApp({ at: '/connect' })
      await openByHand(screen)

      await screen.getByRole('textbox', { name: 'Name' }).fill('Hallway')
      await screen.getByRole('textbox', { name: 'MAC address' }).fill(mac)
      await screen.getByRole('button', { name: 'Register Device' }).click()

      await expect.element(screen.getByText('Enter six pairs of hex digits, like A4:C1:38:5F:0B:9D.')).toBeVisible()
      await expect.element(screen.getByRole('textbox', { name: 'MAC address' })).toHaveAttribute('aria-invalid', 'true')
      expect(faked.registered).toEqual([])
      expect(screen.router.currentRoute.value.path).toBe('/connect')
    })

    it('never sends a Device without a name', async () => {
      const faked = fakeInstance()
      fakeRegistering(faked)
      const screen = await mountApp({ at: '/connect' })
      await openByHand(screen)

      await screen.getByRole('textbox', { name: 'MAC address' }).fill('A4:C1:38:5F:0B:9D')
      await screen.getByRole('button', { name: 'Register Device' }).click()

      await expect.element(screen.getByText('A Device needs a name.')).toBeVisible()
      expect(faked.registered).toEqual([])
    })

    it('says on the field that a MAC address is already registered, in ink', async () => {
      fakeInstance({ devices: [KITCHEN] })
      api.use(http.post(apiUrl('devices'), () => apiErrorResponse({ statusCode: 409, code: 'device-mac-taken' })))
      const screen = await mountApp({ at: '/connect' })
      await openByHand(screen)

      await screen.getByRole('textbox', { name: 'Name' }).fill('Hallway')
      await screen.getByRole('textbox', { name: 'MAC address' }).fill('A4:C1:38:5F:0B:9D')
      await screen.getByRole('button', { name: 'Register Device' }).click()

      await expect.element(screen.getByText('A Device with this MAC address is already registered.')).toBeVisible()
      await expect.element(screen.getByRole('textbox', { name: 'MAC address' })).toHaveAttribute('aria-invalid', 'true')
      await expect.element(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-invalid')
      expect(screen.router.currentRoute.value.path).toBe('/connect')
      expect(elementsInSealColour(main(screen).element())).toEqual([])
    })

    it('says why when the server cannot register the Device', async () => {
      fakeInstance({ devices: [KITCHEN] })
      api.use(http.post(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountApp({ at: '/connect' })
      await openByHand(screen)

      await screen.getByRole('textbox', { name: 'Name' }).fill('Hallway')
      await screen.getByRole('textbox', { name: 'MAC address' }).fill('A4:C1:38:5F:0B:9D')
      await screen.getByRole('button', { name: 'Register Device' }).click()

      await expect.element(screen.getByText('Not registered. Something went wrong on the server.')).toBeVisible()
    })
  })

  it('is accessible in both themes and does not overflow at phone, tablet or desktop width, with a Device that called in and the form open', async () => {
    const faked = fakeInstance({ serverUrl: 'http://localhost:3000', serverUrlIsLoopback: true })
    const screen = await mountApp({ at: '/connect' })
    await expect.poll(() => listening(screen)).toBe('Waiting for a Device to call in')
    faked.devices = [calledIn('new-1', '4F2A1C')]
    await expect.poll(() => blocks(screen).length, WITHIN_A_FEW_POLLS).toBe(1)
    await openByHand(screen)
    await screen.getByRole('button', { name: 'Register Device' }).click()
    await expect.element(screen.getByText('Enter six pairs of hex digits, like A4:C1:38:5F:0B:9D.')).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
