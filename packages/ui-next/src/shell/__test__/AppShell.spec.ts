import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { holdTabVisible } from '@/testing/visibility'

const devicesNamed = (...names: string[]) => names.map((name, index) => buildDeviceSummary({ id: `device-${index + 1}`, name }))

const DEMO_LINE = 'This is the Kuroshiro demo. Image uploads are off, and anyone can change what you see here.'

afterEach(() => resetViewport())

type Screen = Awaited<ReturnType<typeof mountApp>>

const bar = (screen: Screen) => screen.getByRole('banner').getByRole('navigation', { name: 'Main' })
const currentLinks = (screen: Screen) => [...bar(screen).element().querySelectorAll('a[aria-current="page"]')]
const shownText = (link: { element: () => Element }) => link.element().textContent?.trim()
const linkNames = (screen: Screen) => bar(screen).getByRole('link').elements().map(link => link.getAttribute('aria-label') ?? link.textContent?.trim())

describe('the bar', () => {
  it('links the seal and wordmark to the landing route', async () => {
    fakeShellReads()
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kuroshiro' })).toHaveAttribute('href', '/')
  })

  it('with no Devices, has "Connect a Device" as its only Device entry', async () => {
    fakeShellReads({ devices: [] })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(bar(screen).getByRole('link', { name: 'Connect a Device' })).toHaveAttribute('href', '/connect')
    expect(linkNames(screen)).toEqual(['Connect a Device', 'Plugins', 'Instance'])
  })

  it('names one Device, then "Connect a Device", Plugins and Instance', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen') })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen' })).toHaveAttribute('href', '/devices/device-1')
    expect(linkNames(screen)).toEqual(['Kitchen', 'Connect a Device', 'Plugins', 'Instance'])
  })

  it('names four Devices by name, whatever their case and the order the server gave them in', async () => {
    fakeShellReads({ devices: devicesNamed('study', 'Kitchen', 'Hallway', 'attic') })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen' })).toBeVisible()
    expect(linkNames(screen)).toEqual(['attic', 'Hallway', 'Kitchen', 'study', 'Connect a Device', 'Plugins', 'Instance'])
  })

  it('carries a single "Devices" entry from five Devices on, and no "Connect a Device"', async () => {
    fakeShellReads({ devices: devicesNamed('Attic', 'Hallway', 'Kitchen', 'Porch', 'Study') })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(bar(screen).getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices')
    expect(linkNames(screen)).toEqual(['Devices', 'Plugins', 'Instance'])
  })

  it('cuts a name over 16 characters and keeps the full name as tooltip and accessible name', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen by the window') })
    const screen = await mountApp({ at: '/plugins' })
    const link = bar(screen).getByRole('link', { name: 'Kitchen by the window' })

    await expect.poll(() => shownText(link)).toBe('Kitchen by the w…')

    await link.hover()
    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toHaveTextContent('Kitchen by the window')
  })

  it('leaves a name of 16 characters whole, with no tooltip', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen by a bar') })
    const screen = await mountApp({ at: '/plugins' })

    await expect.poll(() => shownText(bar(screen).getByRole('link', { name: 'Kitchen by a bar' }))).toBe('Kitchen by a bar')
    expect(bar(screen).getByRole('link', { name: 'Kitchen by a bar' }).element().hasAttribute('aria-label')).toBe(false)
  })

  it('falls back to the single "Devices" entry when four names do not fit on one line, and never wraps or scrolls', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen by the window', 'Hallway upstairs left', 'Study under the roof', 'Porch facing the garden') })
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen by the window' })).toBeVisible()

    await resizeTo(900)

    await expect.element(bar(screen).getByRole('link', { name: 'Devices' })).toBeVisible()
    expect(linkNames(screen)).toEqual(['Devices', 'Plugins', 'Instance'])
    const banner = screen.getByRole('banner').element()
    expect(banner.scrollWidth).toBeLessThanOrEqual(banner.clientWidth)
    expect(banner.getBoundingClientRect().height).toBe(52)

    await resizeTo(1280)
    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen by the window' })).toBeVisible()
  })

  it.each([
    ['/devices/device-1', 'Kitchen'],
    ['/devices/device-1/settings', 'Kitchen'],
    ['/devices/device-2/screens/new', 'Study'],
    ['/connect', 'Connect a Device'],
    ['/plugins', 'Plugins'],
    ['/plugins/new', 'Plugins'],
    ['/plugins/7/update', 'Plugins'],
    ['/instance/settings', 'Instance'],
    ['/instance/firmware/upload', 'Instance'],
  ])('on %s, marks "%s" as the current entry', async (at, current) => {
    fakeShellReads({ devices: devicesNamed('Kitchen', 'Study') })
    const screen = await mountApp({ at })

    await expect.element(bar(screen).getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page')
    expect(currentLinks(screen)).toHaveLength(1)
  })

  it('draws the current entry\'s 2 px ink underline', async () => {
    fakeShellReads()
    const screen = await mountApp({ at: '/plugins' })
    const underlineOf = (name: string) => getComputedStyle(bar(screen).getByRole('link', { name }).element()).borderBottom

    await expect.poll(() => underlineOf('Plugins')).toBe('2px solid rgb(18, 18, 18)')
    expect(underlineOf('Instance')).toBe('2px solid rgba(0, 0, 0, 0)')
  })

  it.each(['/devices', '/devices/device-3/logs', '/connect'])('with five Devices, marks "Devices" as current on %s', async (at) => {
    fakeShellReads({ devices: devicesNamed('Attic', 'Hallway', 'Kitchen', 'Porch', 'Study') })
    const screen = await mountApp({ at })

    await expect.element(bar(screen).getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks no section as current on the Alerts page, but the indicator', async () => {
    fakeShellReads({ alerts: buildAlertsList({ active: [buildAlert()] }) })
    const screen = await mountApp({ at: '/alerts' })

    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toHaveAttribute('aria-current', 'page')
    expect(currentLinks(screen)).toHaveLength(0)
  })
})

describe('the Alert indicator', () => {
  it('is absent while no Alert fires', async () => {
    fakeShellReads({ alerts: buildAlertsList({ resolved: [buildAlert({ resolvedAt: '2026-10-03T07:00:00.000Z' })] }) })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: /firing/ })).not.toBeInTheDocument()
  })

  it('counts one firing Alert and links to the Alerts page', async () => {
    fakeShellReads({ alerts: buildAlertsList({ active: [buildAlert()] }) })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(screen.getByRole('banner').getByRole('link', { name: '1 Alert firing' })).toHaveAttribute('href', '/alerts')
  })

  it('counts several in the plural, and holds nothing red', async () => {
    fakeShellReads({ alerts: buildAlertsList({ active: [buildAlert({ id: 'a' }), buildAlert({ id: 'b', kind: 'device-offline' }), buildAlert({ id: 'c', kind: 'data-source-fetch-failing' })] }) })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(screen.getByRole('link', { name: '3 Alerts firing' })).toBeVisible()
    expect(elementsInSealColour(screen.container)).toEqual([])
  })
})

describe('the demo line', () => {
  it('shows under the bar while the server says the Instance is in demo mode', async () => {
    fakeShellReads({ instance: buildInstanceFacts({ demoMode: true }) })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(screen.getByText(DEMO_LINE)).toBeVisible()
  })

  it('does not show on any other Instance', async () => {
    fakeShellReads({ instance: buildInstanceFacts({ demoMode: false }) })
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await expect.element(screen.getByText(DEMO_LINE)).not.toBeInTheDocument()
  })
})

describe('the landing route', () => {
  it('opens Connect a Device when there are no Devices', async () => {
    fakeShellReads({ devices: [] })
    const screen = await mountApp({ at: '/' })

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/connect')
  })

  it('opens the Device when there is one', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen') })
    const screen = await mountApp({ at: '/' })

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/devices/device-1')
  })

  it('opens the Devices list when there are two or more', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen', 'Study') })
    const screen = await mountApp({ at: '/' })

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/devices')
  })

  it('says so when the Devices cannot be loaded, and lands once "Try again" works', async () => {
    fakeShellReads()
    api.use(http.get(apiUrl('devices'), () => HttpResponse.json({ statusCode: 500, code: 'internal', message: 'boom' }, { status: 500 }), { once: true }))
    const screen = await mountApp({ at: '/' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Devices. Something went wrong on the server.')

    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/devices/3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11')
  })
})

describe('the routes', () => {
  it.each([
    '/devices',
    '/devices/device-1',
    '/devices/device-1/screens/new',
    '/devices/device-1/screens/screen-1/html',
    '/devices/device-1/settings',
    '/devices/device-1/logs',
    '/connect',
    '/plugins',
    '/plugins/new',
    '/plugins/plugin-1',
    '/plugins/plugin-1/update',
    '/instance/settings',
    '/instance/firmware',
    '/instance/firmware/upload',
    '/instance/models',
    '/instance/archive',
    '/instance/housekeeping',
    '/instance/simulator',
    '/alerts',
  ])('knows %s', async (at) => {
    fakeShellReads()
    const screen = await mountApp({ at })

    await expect.element(screen.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()
    await expect.element(screen.getByText('No page here')).not.toBeInTheDocument()
  })

  it('sends /instance on to Instance Settings', async () => {
    fakeShellReads()
    const screen = await mountApp({ at: '/instance' })

    expect(screen.router.currentRoute.value.path).toBe('/instance/settings')
  })

  it('answers an unknown route with a whole-page empty state and a way back', async () => {
    fakeShellReads()
    const screen = await mountApp({ at: '/nowhere/at/all' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'No page here' })).toBeVisible()
    await expect.element(screen.getByRole('main').getByRole('link', { name: 'Go to the start' })).toHaveAttribute('href', '/')
  })
})

describe('the shell on a phone', () => {
  const tabs = (screen: Screen) => screen.getByRole('navigation', { name: 'Main' })
  const tabNames = (screen: Screen) => tabs(screen).getByRole('link').elements().map(link => link.textContent?.trim())

  it('keeps the seal, the wordmark and the Alert indicator in the bar and moves the sections to three bottom tabs', async () => {
    fakeShellReads({ alerts: buildAlertsList({ active: [buildAlert()] }) })
    const screen = await mountApp({ at: '/plugins' })
    await resizeTo(375, 812)

    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kuroshiro' })).toBeVisible()
    await expect.element(screen.getByRole('banner').getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    await expect.element(screen.getByRole('banner').getByRole('navigation')).not.toBeInTheDocument()
    await expect.element(tabs(screen).getByRole('link', { name: 'Plugins' })).toHaveAttribute('aria-current', 'page')
    expect(tabNames(screen)).toEqual(['Kitchen', 'Plugins', 'Instance'])
    expect(tabs(screen).element().getBoundingClientRect().bottom).toBe(812)
    expect(tabs(screen).element().getBoundingClientRect().height).toBe(48)
  })

  it.each([
    [[], 'Connect'],
    [['Kitchen'], 'Kitchen'],
    [['Kitchen', 'Study'], 'Devices'],
  ])('with the Devices %j, names the first tab "%s" and points it at the landing route', async (names, tab) => {
    fakeShellReads({ devices: devicesNamed(...names) })
    const screen = await mountApp({ at: '/plugins' })
    await resizeTo(375, 812)

    await expect.element(tabs(screen).getByRole('link', { name: tab })).toHaveAttribute('href', '/')
    expect(tabNames(screen)).toEqual([tab, 'Plugins', 'Instance'])
  })

  it('opens the Devices list when the first tab is tapped on a Device page', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen') })
    const screen = await mountApp({ at: '/devices/device-1/settings' })
    await resizeTo(375, 812)
    await expect.element(tabs(screen).getByRole('link', { name: 'Kitchen' })).toHaveAttribute('aria-current', 'page')

    await tabs(screen).getByRole('link', { name: 'Kitchen' }).click()

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/devices')
  })

  it.each(['/alerts', '/nowhere/at/all'])('marks no tab as current on %s', async (at) => {
    fakeShellReads({ alerts: buildAlertsList({ active: [buildAlert()] }) })
    const screen = await mountApp({ at })
    await resizeTo(375, 812)
    await expect.element(tabs(screen).getByRole('link', { name: 'Kitchen' })).toBeVisible()

    expect(tabs(screen).element().querySelectorAll('[aria-current]')).toHaveLength(0)
  })

  it('opens the Devices list when the first tab is tapped on Connect a Device', async () => {
    fakeShellReads({ devices: [] })
    const screen = await mountApp({ at: '/connect' })
    await resizeTo(375, 812)

    await expect.element(tabs(screen).getByRole('link', { name: 'Connect' })).toHaveAttribute('href', '/devices')
  })
})

describe('the shell\'s reads', () => {
  it('asks for the firing Alerts again when the window regains the focus', async () => {
    holdTabVisible()
    fakeShellReads()
    const answered: string[] = []
    api.events.on('response:mocked', ({ request }) => answered.push(new URL(request.url).pathname))
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen' })).toBeVisible()
    // A read that is still under way is not asked again, so the first answers are waited for.
    await expect.poll(() => answered).toEqual(expect.arrayContaining(['/api/alerts', '/api/devices']))
    api.events.removeAllListeners()

    fakeShellReads({ alerts: buildAlertsList({ active: [buildAlert()] }), devices: devicesNamed('Pantry') })
    window.dispatchEvent(new Event('focus'))

    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    await expect.element(bar(screen).getByRole('link', { name: 'Pantry' })).toBeVisible()
  })

  it('changes nothing in the page for an identical answer', async () => {
    fakeShellReads({ alerts: buildAlertsList({ active: [buildAlert()] }) })
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    const asked: string[] = []
    api.events.on('response:mocked', ({ request }) => asked.push(new URL(request.url).pathname))
    const changes: MutationRecord[] = []
    const observer = new MutationObserver(records => changes.push(...records))
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })

    window.dispatchEvent(new Event('focus'))
    await expect.poll(() => asked.filter(path => path.endsWith('/api/alerts') || path.endsWith('/api/devices'))).toHaveLength(2)
    await new Promise(resolve => setTimeout(resolve, 50))
    observer.disconnect()
    api.events.removeAllListeners()

    expect(changes).toEqual([])
  })

  it('keeps the bar standing when the server is not answering', async () => {
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kuroshiro' })).toBeVisible()
    await expect.element(bar(screen).getByRole('link', { name: 'Plugins' })).toBeVisible()
  })
})

describe('the shell as a whole', () => {
  it('is reachable by keyboard from the top: the lockup first, then the entries in order', async () => {
    fakeShellReads()
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen' })).toBeVisible()

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('link', { name: 'Kuroshiro' })).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(bar(screen).getByRole('link', { name: 'Kitchen' })).toHaveFocus()
  })

  it('is accessible in both themes, with an Alert firing and the demo line', async () => {
    fakeShellReads({
      instance: buildInstanceFacts({ demoMode: true }),
      devices: devicesNamed('Kitchen by the window', 'Study'),
      alerts: buildAlertsList({ active: [buildAlert()] }),
    })
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()

    await expectAccessible()
    await resizeTo(375, 812)
    await expectAccessible()
  })

  it('does not overflow at phone, tablet or desktop width', async () => {
    fakeShellReads({
      instance: buildInstanceFacts({ demoMode: true }),
      devices: devicesNamed('Kitchen by the window', 'Hallway upstairs left', 'Study under the roof', 'Porch facing the garden'),
      alerts: buildAlertsList({ active: [buildAlert(), buildAlert({ id: 'b' })] }),
    })
    const screen = await mountApp({ at: '/plugins' })
    await expect.element(screen.getByRole('link', { name: '2 Alerts firing' })).toBeVisible()

    await expectNoHorizontalOverflow()
  })
})
