import type { AssignPluginInput, PluginAssignmentRead, PluginDetail } from 'kuroshiro-shared'
import type { Faked, Mounted } from './pluginPageHarness'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginDetail, buildPluginPlace } from '@/testing/fixtures/plugins'
import { buildScreen } from '@/testing/fixtures/screens'
import { withCoarsePointer } from '@/testing/media'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { fakePlugin, mountPlugin, saveBar } from './pluginPageHarness'

afterEach(() => resetViewport())

const HALLWAY = buildDeviceSummary({ id: 'hallway', name: 'Hallway' })
const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })
const STUDY = buildDeviceSummary({ id: 'study', name: 'Study' })

function onKitchen(overrides: Partial<PluginAssignmentRead> = {}): PluginAssignmentRead {
  return {
    deviceId: 'kitchen',
    deviceName: 'Kitchen',
    screenId: 'weather-on-kitchen',
    order: 2,
    screenCount: 6,
    state: null,
    ...overrides,
  }
}

function fakeWeather(overrides: Partial<PluginDetail> = {}, devices = [HALLWAY, KITCHEN, STUDY]) {
  const faked = fakePlugin(buildPluginDetail({ id: 'weather', assignments: [onKitchen()], ...overrides }))
  fakeShellReads({ devices })
  return faked
}

/** Answers an assign as the server does: the Plugin joins the end of the Device's Order, which held two Screens. */
function fakeAssign(faked: Faked) {
  const sent: AssignPluginInput[] = []
  api.use(http.post(apiUrl('plugins/weather/assign'), async ({ request }) => {
    const input = await request.json() as AssignPluginInput
    sent.push(input)
    const device = [HALLWAY, KITCHEN, STUDY].find(({ id }) => id === input.deviceId)!
    const screenId = `weather-on-${device.id}`
    faked.plugin = { ...faked.plugin, assignments: [...faked.plugin.assignments, { deviceId: device.id, deviceName: device.name, screenId, order: 3, screenCount: 3, state: null }] }
    return HttpResponse.json(buildScreen({ id: screenId, deviceId: device.id, order: 3 }), { status: 201 })
  }))
  return sent
}

/** Answers an unassign as the server does, and keeps the Devices it was asked for. */
function fakeUnassign(faked: Faked) {
  const unassigned: string[] = []
  api.use(http.delete(apiUrl('plugins/weather/assignments/:deviceId'), ({ params }) => {
    unassigned.push(String(params.deviceId))
    faked.plugin = { ...faked.plugin, assignments: faked.plugin.assignments.filter(({ deviceId }) => deviceId !== params.deviceId) }
    return new HttpResponse(null, { status: 204 })
  }))
  return unassigned
}

const confirmation = (screen: Mounted) => screen.getByRole('alertdialog')

const button = (screen: Mounted, name: string) => screen.getByRole('button', { name, exact: true })

const read = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim()

/** Each row of the section as its three cells read: the name, where the Plugin stands, the button or link. */
function rows() {
  return [...document.querySelectorAll('#devices .place-row')].map(row =>
    [read(row.querySelector('.name')), read(row.querySelector('.standing')), read(row.querySelector('.act'))])
}

describe('the Devices of a Plugin', () => {
  it('has one row per Device by name, saying where the Plugin stands there', async () => {
    fakeWeather()
    await mountPlugin()

    await expect.poll(rows).toEqual([
      ['Hallway', 'Not assigned', 'Assign to Hallway'],
      ['Kitchen', 'Assigned · Order 2 of 6', 'Unassign'],
      ['Study', 'Not assigned', 'Assign to Study'],
    ])
    const links = [...document.querySelectorAll<HTMLAnchorElement>('#devices .place-row .name a')].map(link => link.getAttribute('href'))
    expect(links).toEqual(['/devices/hallway', '/devices/kitchen', '/devices/study'])
  })

  it('assigns the Plugin to a Device at once, without asking, and shows it at the end of the Order', async () => {
    const faked = fakeWeather()
    const sent = fakeAssign(faked)
    const screen = await mountPlugin()

    await button(screen, 'Assign to Hallway').click()

    await expect.poll(rows).toEqual([
      ['Hallway', 'Assigned · Order 3 of 3', 'Unassign'],
      ['Kitchen', 'Assigned · Order 2 of 6', 'Unassign'],
      ['Study', 'Not assigned', 'Assign to Study'],
    ])
    expect(sent).toEqual([{ deviceId: 'hallway' }])
    expect(screen.getByRole('alertdialog').query()).toBeNull()
    expect(read(document.querySelector('main .plugin-facts'))).toContain('On Kitchen and Hallway')
  })

  it('keeps the button busy until the fresh read shows the Plugin assigned', async () => {
    const faked = fakeWeather()
    fakeAssign(faked)
    api.use(http.get(apiUrl('plugins/weather'), async () => {
      await delay(400)
      return HttpResponse.json(faked.plugin)
    }))
    const screen = await mountPlugin()

    await button(screen, 'Assign to Study').click()

    await expect.element(button(screen, 'Assign to Study')).toHaveAttribute('aria-busy', 'true')
    await expect.poll(rows).toContainEqual(['Study', 'Assigned · Order 3 of 3', 'Unassign'])
  })

  it('leaves the row "Not assigned" with the reason and "Try again" when the assign fails, and assigns on "Try again"', async () => {
    const faked = fakeWeather()
    const sent = fakeAssign(faked)
    api.use(http.post(apiUrl('plugins/weather/assign'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
    const screen = await mountPlugin()

    await button(screen, 'Assign to Study').click()

    await expect.poll(() => rows()[2]).toEqual(['Study', 'Not assigned. Something went wrong on the server. Try again', 'Assign to Study'])
    await expectAccessible()
    await button(screen, 'Try again').click()

    await expect.poll(() => rows()[2]).toEqual(['Study', 'Assigned · Order 3 of 3', 'Unassign'])
    expect(sent).toEqual([{ deviceId: 'study' }])
  })

  it('takes "already assigned" as done and shows the Plugin where the server has it', async () => {
    const faked = fakeWeather()
    api.use(http.post(apiUrl('plugins/weather/assign'), () => {
      faked.plugin = { ...faked.plugin, assignments: [...faked.plugin.assignments, { deviceId: 'study', deviceName: 'Study', screenId: 's', order: 1, screenCount: 3, state: 'active' }] }
      return apiErrorResponse({ statusCode: 409, code: 'plugin-already-assigned' })
    }))
    const screen = await mountPlugin()

    await button(screen, 'Assign to Study').click()

    await expect.poll(() => rows()[2]).toEqual(['Study', 'Assigned · Order 1 of 3 · Active Screen', 'Unassign'])
  })

  it('unassigns the Plugin from a Device once the confirmation names both and is confirmed', async () => {
    const faked = fakeWeather()
    const unassigned = fakeUnassign(faked)
    const screen = await mountPlugin()

    await button(screen, 'Unassign').click()

    await expect.element(confirmation(screen)).toHaveAccessibleName('Unassign Weather from Kitchen?')
    await expect.element(confirmation(screen).getByText('This Screen on Kitchen and its Schedule.')).toBeVisible()
    await expect.element(confirmation(screen).getByText('The Plugin Weather, with its template, its Data Sources and its place in any Mashup.')).toBeVisible()
    await expect.element(confirmation(screen).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(unassigned).toEqual([])

    await confirmation(screen).getByRole('button', { name: 'Unassign Plugin' }).click()

    await expect.poll(() => rows()[1]).toEqual(['Kitchen', 'Not assigned', 'Assign to Kitchen'])
    expect(unassigned).toEqual(['kitchen'])
    expect(read(document.querySelector('main .plugin-facts'))).toContain('Not on a Device')
    await expect.element(button(screen, 'Assign to Kitchen')).toHaveFocus()
  })

  it('says that the Webhook URL stays when a Webhook-kind Plugin is unassigned', async () => {
    const webhook = { token: 'tok', url: 'https://kuroshiro.test/api/webhook/tok', mergeStrategy: 'standard' as const, streamLimit: null, payload: null, payloadReceivedAt: null }
    fakeWeather({ kind: 'Webhook', refreshInterval: null, dataSources: [], webhook })
    const screen = await mountPlugin()

    await button(screen, 'Unassign').click()

    await expect.element(confirmation(screen).getByText('The Plugin Weather, with its template, its Webhook URL and its place in any Mashup.')).toBeVisible()
  })

  it('takes an assignment the server no longer has as unassigned', async () => {
    const faked = fakeWeather()
    api.use(http.delete(apiUrl('plugins/weather/assignments/kitchen'), () => {
      faked.plugin = { ...faked.plugin, assignments: [] }
      return apiErrorResponse({ statusCode: 404, code: 'assignment-not-found' })
    }))
    const screen = await mountPlugin()

    await button(screen, 'Unassign').click()
    await confirmation(screen).getByRole('button', { name: 'Unassign Plugin' }).click()

    await expect.poll(() => rows()[1]).toEqual(['Kitchen', 'Not assigned', 'Assign to Kitchen'])
    expect(confirmation(screen).query()).toBeNull()
  })

  it('keeps the confirmation open with the reason when the unassign fails', async () => {
    fakeWeather()
    api.use(http.delete(apiUrl('plugins/weather/assignments/kitchen'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const screen = await mountPlugin()

    await button(screen, 'Unassign').click()
    await confirmation(screen).getByRole('button', { name: 'Unassign Plugin' }).click()

    await expect.element(confirmation(screen).getByText('Something went wrong on the server.')).toBeVisible()
    expect(rows()[1]).toEqual(['Kitchen', 'Assigned · Order 2 of 6', 'Unassign'])
  })

  it('says that an assigned Screen is the Active Screen, or that its Schedule is off, and nothing of the other states', async () => {
    fakeWeather({ assignments: [
      onKitchen({ order: 1, state: 'active' }),
      { ...onKitchen({ order: 4, screenCount: 4, state: 'scheduleOff' }), deviceId: 'hallway', deviceName: 'Hallway' },
      { ...onKitchen({ order: 2, screenCount: 3, state: 'notToday' }), deviceId: 'study', deviceName: 'Study' },
    ] })
    await mountPlugin()

    await expect.poll(() => rows().map(([, standing]) => standing)).toEqual([
      'Assigned · Order 4 of 4 · Schedule off',
      'Assigned · Order 1 of 6 · Active Screen',
      'Assigned · Order 2 of 3',
    ])
  })

  it('has a row for every Mashup the Plugin fills a slot in, after the Devices, opening that Mashup on its Device', async () => {
    fakeWeather({ mashups: [buildPluginPlace({ screenId: 'board', name: 'Weekend board', deviceId: 'kitchen', deviceName: 'Kitchen' })] })
    const screen = await mountPlugin()

    await expect.poll(() => rows()[3]).toEqual(['Weekend board', 'A Mashup on Kitchen. Weather fills one of its slots.', 'Open the Mashup'])
    await expect.element(screen.getByRole('link', { name: 'Open the Mashup' })).toHaveAttribute('href', '/devices/kitchen?screen=board')
    await expect.element(screen.getByText('Assigning adds Weather to the end of that Device\'s Order as a Screen, always shown until you give it a Schedule there.')).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('says that there is nothing to assign to while no Device is connected', async () => {
    fakeWeather({ assignments: [] }, [])
    const screen = await mountPlugin()

    await expect.element(screen.getByText('No Device is connected yet, so there is nothing to assign Weather to.')).toBeVisible()
    const connect = [...document.querySelectorAll('#devices a')].find(link => read(link) === 'Connect a Device')
    expect(connect?.getAttribute('href')).toBe('/connect')
    expect(rows()).toEqual([])
    expect(screen.getByText(/^Assigning adds/).query()).toBeNull()
    await expectAccessible()
  })

  it('keeps unsaved changes and the save bar when assigning', async () => {
    const faked = fakeWeather()
    fakeAssign(faked)
    const screen = await mountPlugin()
    await screen.getByRole('button', { name: 'Name and description' }).click()
    await screen.getByRole('textbox', { name: 'Name' }).fill('Weather at home')
    await expect.element(saveBar(screen).getByText('Unsaved changes to the name. The preview already shows them.')).toBeVisible()

    await button(screen, 'Assign to Study').click()

    await expect.poll(() => rows()[2]).toEqual(['Study', 'Assigned · Order 3 of 3', 'Unassign'])
    expect(screen.getByRole('alertdialog').query()).toBeNull()
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Weather at home')
    await expect.element(saveBar(screen).getByText('Unsaved changes to the name. The preview already shows them.')).toBeVisible()
    expect(faked.saves).toEqual([])
  })

  it('shows the notice when the Devices cannot be loaded, and the rows once "Try again" works', async () => {
    fakeWeather()
    api.use(http.get(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
    const screen = await mountPlugin()

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Devices. Something went wrong on the server.')
    await expectAccessible()

    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(rows).toEqual([
      ['Hallway', 'Not assigned', 'Assign to Hallway'],
      ['Kitchen', 'Assigned · Order 2 of 6', 'Unassign'],
      ['Study', 'Not assigned', 'Assign to Study'],
    ])
    expect(screen.getByRole('alert').query()).toBeNull()
  })

  it('still shows a Mashup row while the Devices read has failed', async () => {
    fakeWeather({ mashups: [buildPluginPlace({ screenId: 'board', name: 'Weekend board', deviceId: 'kitchen', deviceName: 'Kitchen' })] })
    api.use(http.get(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const screen = await mountPlugin()

    await expect.element(screen.getByRole('alert')).toBeVisible()
    await expect.poll(() => rows()[0]).toEqual(['Weekend board', 'A Mashup on Kitchen. Weather fills one of its slots.', 'Open the Mashup'])
    await expect.element(screen.getByRole('link', { name: 'Open the Mashup' })).toHaveAttribute('href', '/devices/kitchen?screen=board')
  })

  it('shows the loading line, not a bare heading, while the Devices read is held', async () => {
    fakeWeather()
    api.use(http.get(apiUrl('devices'), async () => {
      await delay('infinite')
      return HttpResponse.json([])
    }))
    const screen = await mountPlugin()

    await expect.element(screen.getByText('Loading the Devices')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Devices' }).query()).toBeTruthy()
    expect(rows()).toEqual([])
  })

  it('assigns and unassigns on a phone, with touch targets of 44 px', async () => {
    const faked = fakeWeather()
    fakeAssign(faked)
    fakeUnassign(faked)
    await resizeTo(375, 812)
    const screen = await mountPlugin()
    await expect.poll(rows).toHaveLength(3)

    await withCoarsePointer(async () => {
      const targets = [...document.querySelectorAll<HTMLElement>('#devices .place-row :is(a, button)')]
      expect(targets.map(target => target.getBoundingClientRect().height).every(height => height >= 44)).toBe(true)

      await button(screen, 'Assign to Hallway').click()
      await expect.poll(() => rows()[0]).toEqual(['Hallway', 'Assigned · Order 3 of 3', 'Unassign'])
      await button(screen, 'Unassign').first().click()
      await confirmation(screen).getByRole('button', { name: 'Unassign Plugin' }).click()
      await expect.poll(() => rows()[0]).toEqual(['Hallway', 'Not assigned', 'Assign to Hallway'])
    })
    await expectNoHorizontalOverflow()
  })
})
