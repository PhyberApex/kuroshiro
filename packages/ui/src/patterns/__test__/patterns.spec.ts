import type { RouteRecordRaw } from 'vue-router'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { h } from 'vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { withCoarsePointer } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { freezeTime } from '@/testing/time'
import DeviceExamplePage from './examples/DeviceExamplePage.vue'
import DevicesExamplePage from './examples/DevicesExamplePage.vue'
import FormExamplePage from './examples/FormExamplePage.vue'
import SkeletonExamplePage from './examples/SkeletonExamplePage.vue'
import TimesExample from './examples/TimesExample.vue'

const Elsewhere = { template: '<h1>Elsewhere</h1>' }

const routes: RouteRecordRaw[] = [
  { path: '/devices', component: DevicesExamplePage },
  { path: '/skeleton', component: SkeletonExamplePage },
  { path: '/devices/:deviceId', component: DeviceExamplePage },
  { path: '/form', component: FormExamplePage },
  { path: '/elsewhere', component: Elsewhere },
]

const fakeDevices = (...names: string[]) => HttpResponse.json(names.map((name, index) => buildDeviceSummary({ id: `device-${index}`, name })))

describe('a page that loads', () => {
  it('shows its title line at once, and the body when the answer arrives', async () => {
    api.use(http.get(apiUrl('devices'), async () => {
      await delay(400)
      return fakeDevices('Kitchen', 'Study')
    }))
    const screen = await mountPage({ routes, at: '/devices' })

    expect(screen.getByRole('heading', { level: 1, name: 'Devices' }).element()).toBeVisible()
    expect(screen.getByRole('button', { name: 'Connect a Device' }).element()).toBeVisible()
    expect(document.title).toBe('Devices · Kuroshiro')

    await expect.element(screen.getByText('Study')).toBeVisible()
  })

  it('shows no loading state for an answer within 300 ms', async () => {
    const seen: string[] = []
    const observer = new MutationObserver(() => seen.push(document.body.textContent ?? ''))
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    api.use(http.get(apiUrl('devices'), async () => {
      await delay(200)
      return fakeDevices('Kitchen')
    }))
    const screen = await mountPage({ routes, at: '/devices' })

    await expect.element(screen.getByText('Kitchen')).toBeVisible()
    observer.disconnect()

    expect(seen.filter(text => text.includes('Loading Devices'))).toEqual([])
  })

  it('shows the loading line and the body\'s skeleton for a slow answer, then the body in their place', async () => {
    api.use(http.get(apiUrl('devices'), async () => {
      await delay(900)
      return fakeDevices('Kitchen')
    }))
    const screen = await mountPage({ routes, at: '/skeleton' })

    await expect.element(screen.getByRole('status')).toHaveTextContent('Loading Devices')
    await expect.element(screen.getByTestId('bone')).toBeVisible()

    await expect.element(screen.getByText('1 Devices')).toBeVisible()
    await expect.element(screen.getByRole('status')).not.toBeInTheDocument()
    await expect.element(screen.getByTestId('bone')).not.toBeInTheDocument()
  })

  it('shows a refusal as a notice with the server\'s reason and "Try again", which loads again', async () => {
    api.use(http.get(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
    const screen = await mountPage({ routes, at: '/devices' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Devices. Something went wrong on the server.')
    expect(elementsInSealColour(screen.container)).toEqual([])

    api.use(http.get(apiUrl('devices'), () => fakeDevices('Kitchen')))
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.element(screen.getByText('Kitchen')).toBeVisible()
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps what an earlier load showed under the notice of a later failure', async () => {
    api.use(http.get(apiUrl('devices'), () => fakeDevices('Kitchen')))
    const screen = await mountPage({ routes, at: '/devices' })
    await expect.element(screen.getByText('Kitchen')).toBeVisible()

    api.use(http.get(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    window.dispatchEvent(new Event('focus'))

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Devices. Something went wrong on the server.')
    await expect.element(screen.getByText('Kitchen')).toBeVisible()
  })

  it('says that the server is not answering when it cannot be reached', async () => {
    const screen = await mountPage({ routes, at: '/devices' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Devices. Kuroshiro\'s server is not answering.')
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  it('answers a record that does not exist with a whole-page empty state and one link back', async () => {
    api.use(http.get(apiUrl('devices/42'), () => apiErrorResponse({ statusCode: 404, code: 'device-not-found' })))
    const screen = await mountPage({ routes, at: '/devices/42' })

    await expect.element(screen.getByRole('heading', { level: 1, name: 'No Device here' })).toBeVisible()
    await expect.element(screen.getByText('It may have been deleted.')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'All Devices' })).toHaveAttribute('href', '/devices')
    expect(screen.getByRole('link').elements()).toHaveLength(1)
    expect(document.title).toBe('No Device here · Kuroshiro')
  })

  it('loads the next record when the route moves on to it, under a title line with a link back', async () => {
    api.use(http.get(apiUrl('devices/:deviceId'), ({ params }) => HttpResponse.json(buildDeviceSummary({
      name: params.deviceId === '1' ? 'Kitchen' : 'Study',
      batteryPercent: params.deviceId === '1' ? 76 : 54,
    }))))
    const screen = await mountPage({ routes, at: '/devices/1' })
    await expect.element(screen.getByText('Battery 76 %')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices')

    await screen.router.push('/devices/2')

    await expect.element(screen.getByRole('heading', { level: 1, name: 'Study' })).toBeVisible()
    await expect.element(screen.getByText('Battery 54 %')).toBeVisible()
  })

  it('is accessible and does not overflow, loaded and failed', async () => {
    api.use(http.get(apiUrl('devices'), () => fakeDevices('Kitchen')))
    const screen = await mountPage({ routes, at: '/devices' })
    await expect.element(screen.getByText('Kitchen')).toBeVisible()
    api.use(http.get(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    window.dispatchEvent(new Event('focus'))
    await expect.element(screen.getByRole('alert')).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})

describe('a form with unsaved changes', () => {
  it('lets a route change through while nothing is changed', async () => {
    const screen = await mountPage({ routes, at: '/form' })

    await screen.getByRole('link', { name: 'Elsewhere' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Elsewhere' })).toBeVisible()
  })

  it('asks before a route change, and stays when the admin keeps editing', async () => {
    const screen = await mountPage({ routes, at: '/form' })
    await screen.getByRole('textbox', { name: 'HTML' }).fill('<h1>Hello</h1>')

    await screen.getByRole('link', { name: 'Elsewhere' }).click()

    const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect.element(question).toBeVisible()
    await expect.element(question.getByText('Your changes to Greeting\'s HTML.')).toBeVisible()
    await expect.element(question.getByRole('button', { name: 'Keep editing' })).toHaveFocus()
    expect(screen.router.currentRoute.value.path).toBe('/form')

    await question.getByRole('button', { name: 'Keep editing' }).click()

    await expect.element(question).not.toBeInTheDocument()
    expect(screen.router.currentRoute.value.path).toBe('/form')
    await expect.element(screen.getByRole('textbox', { name: 'HTML' })).toHaveValue('<h1>Hello</h1>')
  })

  it('stays when the question is closed with Escape', async () => {
    const screen = await mountPage({ routes, at: '/form' })
    await screen.getByRole('textbox', { name: 'HTML' }).fill('<h1>Hello</h1>')
    const leaving = screen.router.push('/elsewhere')
    await expect.element(screen.getByRole('alertdialog')).toBeVisible()

    await userEvent.keyboard('{Escape}')
    await leaving

    expect(screen.router.currentRoute.value.path).toBe('/form')
  })

  it('asks once for the route asked for last when a second route change comes while it is asking', async () => {
    const screen = await mountPage({ routes: [...routes, { path: '/third', component: { template: '<h1>Third</h1>' } }], at: '/form' })
    await screen.getByRole('textbox', { name: 'HTML' }).fill('<h1>Hello</h1>')
    const first = screen.router.push('/elsewhere')
    await expect.element(screen.getByRole('alertdialog')).toBeVisible()

    void screen.router.push('/third')
    await first
    await screen.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Third' })).toBeVisible()
  })

  it('has its loading line\'s live region in the page before it says anything', async () => {
    api.use(http.get(apiUrl('devices'), async () => {
      await delay(900)
      return fakeDevices('Kitchen')
    }))
    const screen = await mountPage({ routes, at: '/skeleton' })
    const region = screen.getByRole('status').element()
    expect(region.textContent).toBe('')

    await expect.element(screen.getByRole('status')).toHaveTextContent('Loading Devices')
    expect(screen.getByRole('status').element()).toBe(region)
  })

  it('leaves once the admin confirms', async () => {
    const screen = await mountPage({ routes, at: '/form' })
    await screen.getByRole('textbox', { name: 'HTML' }).fill('<h1>Hello</h1>')
    await screen.getByRole('link', { name: 'Elsewhere' }).click()

    await screen.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Elsewhere' })).toBeVisible()
    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('has the browser ask before the page is unloaded, and only while something is changed', async () => {
    const screen = await mountPage({ routes, at: '/form' })
    const unloading = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }

    expect(unloading()).toBe(false)

    await screen.getByRole('textbox', { name: 'HTML' }).fill('<h1>Hello</h1>')
    expect(unloading()).toBe(true)

    void screen.router.push('/elsewhere')
    await screen.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()
    await expect.element(screen.getByRole('heading', { name: 'Elsewhere' })).toBeVisible()
    expect(unloading()).toBe(false)
  })
})

describe('a time', () => {
  it('within the last day is relative, with the exact time as its tooltip', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    const at = '2026-10-03T07:31:00.000Z'
    const screen = await mount(TimesExample, { props: { at } })

    await expect.element(screen.getByText('4 min ago')).toHaveAttribute('datetime', at)

    await screen.getByText('4 min ago').hover()
    const exact = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toHaveTextContent(`3 Oct 2026, ${exact}`)
  })

  it('older than a day is a date and time', async () => {
    freezeTime('2026-10-03T12:00:00.000Z')
    const screen = await mount(TimesExample, { props: { at: '2026-09-28T12:00:00.000Z' } })

    await expect.element(screen.getByText(/^28 Sept? 2026, \d\d:00$/)).toBeVisible()
  })

  it('opens its tooltip on keyboard focus with the exact time, and closes it on Escape', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    const at = '2026-10-03T07:31:00.000Z'
    const screen = await mount(TimesExample, { props: { at } })
    const exact = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(at))

    await userEvent.keyboard('{Tab}')

    await expect.element(screen.getByText('4 min ago')).toHaveFocus()
    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toHaveTextContent(`3 Oct 2026, ${exact}`)

    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).not.toBeInTheDocument()
    await expect.element(screen.getByText('4 min ago')).toHaveFocus()
  })

  it('shows the exact time on a tap, inside a coarse pointer, and hides it on a second tap', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    const at = '2026-10-03T07:31:00.000Z'
    const screen = await mount(TimesExample, { props: { at } })
    const exact = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(at))

    await withCoarsePointer(async () => {
      await screen.getByText('4 min ago').click()
      await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toHaveTextContent(`3 Oct 2026, ${exact}`)

      await screen.getByText('4 min ago').click()
      await expect.element(screen.getByRole('tooltip', { includeHidden: true })).not.toBeInTheDocument()
    })
  })

  it('hides the exact time shown by a tap when the admin taps elsewhere', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    const at = '2026-10-03T07:31:00.000Z'
    const screen = await mount({
      render: () => h('div', [h(RelativeTime, { at }), h('button', { type: 'button' }, 'Elsewhere')]),
    })

    await withCoarsePointer(async () => {
      await screen.getByText('4 min ago').click()
      await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toBeInTheDocument()

      await screen.getByRole('button', { name: 'Elsewhere' }).click()

      await expect.element(screen.getByRole('tooltip', { includeHidden: true })).not.toBeInTheDocument()

      await screen.getByText('4 min ago').click()

      await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toBeInTheDocument()
    })
  })

  it('has the exact time as its accessible description while no tooltip is open', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    const at = '2026-10-03T07:31:00.000Z'
    const screen = await mount(TimesExample, { props: { at } })
    const exact = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(at))

    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).not.toBeInTheDocument()
    await expect.element(screen.getByText('4 min ago')).toHaveAccessibleDescription(`3 Oct 2026, ${exact}`)
  })

  it('is not focusable by itself inside a link or a button, and still describes the exact time', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    const at = '2026-10-03T07:31:00.000Z'
    const exact = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
    const screen = await mount({
      render: () => h('div', [
        h('a', { href: '#' }, ['Kitchen ', h(RelativeTime, { at })]),
        h('button', { type: 'button' }, ['Kitchen ', h(RelativeTime, { at })]),
      ]),
    })

    await expect.element(screen.getByRole('link')).not.toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('link')).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button')).toHaveFocus()

    for (const time of screen.getByText('4 min ago').elements()) {
      expect(time.textContent).toBe('4 min ago')
      expect(time).not.toHaveAttribute('tabindex')
      expect(time).toHaveAccessibleDescription(`3 Oct 2026, ${exact}`)
    }
  })

  it('moves on as time passes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: new Date('2026-10-03T07:35:00.000Z') })
    try {
      const screen = await mount(TimesExample, { props: { at: '2026-10-03T07:31:00.000Z' } })
      await expect.element(screen.getByText('4 min ago')).toBeVisible()

      vi.advanceTimersByTime(60_000)

      await expect.element(screen.getByText('5 min ago')).toBeVisible()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
