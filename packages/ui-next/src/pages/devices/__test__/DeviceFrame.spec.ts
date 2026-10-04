import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildScreen } from '@/testing/fixtures/screens'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { freezeTime } from '@/testing/time'

const NOW = '2026-10-03T07:35:00.000Z'

function fakeKitchen() {
  api.use(
    http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(buildDeviceDetail({ id: 'kitchen', name: 'Kitchen' }))),
    http.get(apiUrl('devices/kitchen/screens'), () => HttpResponse.json([buildScreen({ state: 'active' })])),
  )
}

const devicesNamed = (...names: string[]) => names.map(name => buildDeviceSummary({ id: name.toLowerCase(), name }))

type Screen = Awaited<ReturnType<typeof mountApp>>

const tabs = (screen: Screen) => screen.getByRole('navigation', { name: 'Kitchen' })
const currentTabs = (screen: Screen) => [...tabs(screen).element().querySelectorAll('[aria-current="page"]')].map(tab => tab.textContent?.trim())

describe('the Device page frame', () => {
  it('titles the page with the Device\'s name and links its three views', async () => {
    freezeTime(NOW)
    fakeShellReads({ devices: devicesNamed('Kitchen') })
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Kitchen' })).toBeVisible()
    await expect.element(tabs(screen).getByRole('link', { name: 'Screens' })).toHaveAttribute('href', '/devices/kitchen')
    await expect.element(tabs(screen).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/devices/kitchen/settings')
    await expect.element(tabs(screen).getByRole('link', { name: 'Logs' })).toHaveAttribute('href', '/devices/kitchen/logs')
    expect(document.title).toBe('Kitchen · Kuroshiro')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it.each([
    ['/devices/kitchen', 'Screens'],
    ['/devices/kitchen/screens/new', 'Screens'],
    ['/devices/kitchen/screens/notes/html', 'Screens'],
    ['/devices/kitchen/settings', 'Settings'],
    ['/devices/kitchen/logs', 'Logs'],
  ])('at %s marks "%s" as the current view', async (at, current) => {
    freezeTime(NOW)
    fakeShellReads({ devices: devicesNamed('Kitchen') })
    fakeKitchen()
    const screen = await mountApp({ at })

    await expect.element(tabs(screen).getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page')
    expect(currentTabs(screen)).toEqual([current])
  })

  it('holds a page under the Screens tab with the frame around it and without "Add Screen"', async () => {
    fakeShellReads({ devices: devicesNamed('Kitchen') })
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen/screens/notes/html' })

    await expect.element(screen.getByRole('heading', { level: 2, name: 'No HTML Screen here' })).toBeVisible()
    await expect.element(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kitchen')
    expect(screen.getByRole('link', { name: 'Add Screen' }).elements()).toEqual([])
  })

  it('has no back link while the bar names the Devices', async () => {
    freezeTime(NOW)
    fakeShellReads({ devices: devicesNamed('Attic', 'Hallway', 'Kitchen', 'Porch') })
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Kitchen' })).toBeVisible()
    expect(screen.getByRole('main').getByRole('link', { name: 'Devices' }).elements()).toEqual([])
  })

  it('carries the "Devices" back link above its title from five Devices on', async () => {
    freezeTime(NOW)
    fakeShellReads({ devices: devicesNamed('Attic', 'Hallway', 'Kitchen', 'Porch', 'Study') })
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen' })

    await expect.element(screen.getByRole('main').getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices')
  })

  it.each(['/devices/gone', '/devices/gone/settings', '/devices/gone/logs'])('at %s shows "No Device here" for a Device that does not exist', async (at) => {
    fakeShellReads({ devices: devicesNamed('Kitchen') })
    api.use(
      http.get(apiUrl('devices/gone'), () => apiErrorResponse({ statusCode: 404, code: 'device-not-found' })),
      http.get(apiUrl('devices/gone/screens'), () => apiErrorResponse({ statusCode: 404, code: 'device-not-found' })),
    )
    const screen = await mountApp({ at })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'No Device here' })).toBeVisible()
    await expect.element(screen.getByText('It may have been deleted.')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'All Devices' })).toHaveAttribute('href', '/devices')
    expect(screen.getByRole('navigation', { name: 'Device' }).elements()).toEqual([])
    await expectAccessible()
  })
})
