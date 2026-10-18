import { http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { buildScreen } from '@/testing/fixtures/screens'
import { resetViewport } from '@/testing/viewport'
import { fakeKitchen, openedRow, SCREENS_OF_EVERY_KIND, words } from './screensViewHarness'

const dialog = () => document.querySelector('[role="alertdialog"]')
const outcome = () => [...dialog()!.querySelectorAll('.outcome > div')].map(part => `${words(part.querySelector('dt'))} ${words(part.querySelector('dd'))}`)
const rowNames = () => [...document.querySelectorAll('.screen-row .trigger')].map(words)
const rowOf = (name: string) => [...document.querySelectorAll('.screen-row')].find(row => words(row.querySelector('.trigger')) === name)!

afterEach(() => resetViewport())

describe('rename', () => {
  it('saves the name alone on Enter, and gives "Rename" the focus back', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const row = await openedRow(screen, 'Harbour photo')

    expect([...document.querySelector('#screen-photo .naming')!.children].filter(part => part.checkVisibility()).map(words)).toEqual(['Harbour photo', 'File'])
    await row.getByRole('button', { name: 'Rename' }).click()
    const input = screen.getByRole('textbox', { name: 'Name of Harbour photo' })
    await expect.element(input).toHaveFocus()
    await input.fill('Harbour at dusk')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('button', { name: 'Harbour at dusk', exact: true })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/photo', body: { name: 'Harbour at dusk' } }])
    await expect.element(screen.getByRole('button', { name: 'Rename' })).toHaveFocus()
  })

  it('cancels on Escape without a call, and gives "Rename" the focus back', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const row = await openedRow(screen, 'Harbour photo')

    await row.getByRole('button', { name: 'Rename' }).click()
    await screen.getByRole('textbox', { name: 'Name of Harbour photo' }).fill('Something else')
    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('button', { name: 'Harbour photo', exact: true })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Rename' })).toHaveFocus()
    expect(faked.writes).toEqual([])
  })

  it('refuses an empty name without a call', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=notes' })
    const row = await openedRow(screen, 'Notes')

    await row.getByRole('button', { name: 'Rename' }).click()
    await screen.getByRole('textbox', { name: 'Name of Notes' }).fill('  ')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByText('A Screen needs a name.')).toBeVisible()
    expect(faked.writes).toEqual([])
  })

  it('keeps what was entered when the save fails, and saves on a second try', async () => {
    const faked = fakeKitchen()
    api.use(http.patch(apiUrl('screens/webcam'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const row = await openedRow(screen, 'Harbour webcam')

    await row.getByRole('button', { name: 'Rename' }).click()
    const input = screen.getByRole('textbox', { name: 'Name of Harbour webcam' })
    await input.fill('Quay webcam')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByText('Something went wrong on the server.')).toBeVisible()
    await expect.element(input).toHaveValue('Quay webcam')
    await screen.getByRole('button', { name: 'Save' }).click()
    await expect.element(screen.getByRole('button', { name: 'Quay webcam', exact: true })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/webcam', body: { name: 'Quay webcam' } }])
  })

  it('closes without a call when the name entered is the one the Screen already has', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const row = await openedRow(screen, 'Harbour photo')

    await row.getByRole('button', { name: 'Rename' }).click()
    await screen.getByRole('textbox', { name: 'Name of Harbour photo' }).fill('  Harbour photo  ')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('button', { name: 'Rename' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Name of Harbour photo' }).query()).toBeNull()
    expect(faked.writes).toEqual([])
  })

  it('shows the server\'s reason for a refused name under the field, and clears it once the name is typed again', async () => {
    fakeKitchen()
    api.use(http.patch(apiUrl('screens/webcam'), () => apiErrorResponse({ statusCode: 404, code: 'screen-not-found' })))
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const row = await openedRow(screen, 'Harbour webcam')

    await row.getByRole('button', { name: 'Rename' }).click()
    const input = screen.getByRole('textbox', { name: 'Name of Harbour webcam' })
    await input.fill('Quay webcam')
    await userEvent.keyboard('{Enter}')

    await expect.element(input).toHaveAccessibleDescription('That Screen does not exist.')
    await userEvent.keyboard('!')
    await expect.element(input).not.toHaveAccessibleDescription('That Screen does not exist.')
    expect(screen.getByText('That Screen does not exist.').query()).toBeNull()
  })

  it('says "The name could not be saved." for a refusal that gives no reason', async () => {
    fakeKitchen()
    // A code worded by the server's own message, sent without one.
    api.use(http.patch(apiUrl('screens/webcam'), () => apiErrorResponse({ statusCode: 503, code: 'device-preview-busy', message: '' })))
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const row = await openedRow(screen, 'Harbour webcam')

    await row.getByRole('button', { name: 'Rename' }).click()
    await screen.getByRole('textbox', { name: 'Name of Harbour webcam' }).fill('Quay webcam')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('textbox', { name: 'Name of Harbour webcam' })).toHaveAccessibleDescription('The name could not be saved.')
  })

  it('starts from an empty input for a Screen that was saved without a name', async () => {
    fakeKitchen({ screens: [buildScreen({ id: 'nameless', name: '', kind: 'html', plugin: null, html: '<p></p>' })] })
    const screen = await mountApp({ at: '/devices/kitchen?screen=nameless' })
    const row = await openedRow(screen, 'Unnamed Screen')

    await row.getByRole('button', { name: 'Rename' }).click()

    await expect.element(screen.getByRole('textbox', { name: 'Name of Unnamed Screen' })).toHaveValue('')
  })
})

describe('deleting and unassigning', () => {
  it.for([
    { id: 'photo', name: 'Harbour photo', lost: 'Lost The Screen, its Schedule and the uploaded image.' },
    { id: 'webcam', name: 'Harbour webcam', lost: 'Lost The Screen, its Schedule and the link.' },
    { id: 'notes', name: 'Notes', lost: 'Lost The Screen, its Schedule and the HTML written for it.' },
  ])('"Delete Screen" names what is lost with $name, and deletes it', async ({ id, name, lost }) => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: `/devices/kitchen?screen=${id}` })
    const row = await openedRow(screen, name)

    await row.getByRole('button', { name: 'Delete Screen' }).click()
    await expect.element(screen.getByRole('alertdialog', { name: `Delete ${name}?` })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(outcome()).toEqual([lost, 'Stays Kitchen\'s other Screens, which move up in the Order.'])
    await screen.getByRole('button', { name: 'Delete Screen' }).click()

    await expect.poll(rowNames).toEqual(SCREENS_OF_EVERY_KIND.map(kept => kept.name).filter(kept => kept !== name))
    expect(faked.writes).toEqual([{ method: 'DELETE', path: `screens/${id}` }])
  })

  it('deleting a Mashup says its Plugins stay', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=weekend' })
    const row = await openedRow(screen, 'Weekend board')

    await row.getByRole('button', { name: 'Delete Screen' }).click()
    await expect.element(screen.getByRole('alertdialog', { name: 'Delete Weekend board?' })).toBeVisible()
    expect(outcome()).toEqual(['Lost The Screen, its Schedule and the Mashup\'s layout.', 'Stays The Plugins in its slots.'])
    await screen.getByRole('button', { name: 'Delete Screen' }).click()

    await expect.poll(rowNames).not.toContain('Weekend board')
    expect(screen.router.currentRoute.value.query.screen).toBeUndefined()
    expect(faked.writes).toEqual([{ method: 'DELETE', path: 'screens/weekend' }])
  })

  it('"Unassign Plugin" is worded as unassigning, lists what stays and unassigns', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=weather' })
    const row = await openedRow(screen, 'Weather')

    await row.getByRole('button', { name: 'Unassign Plugin' }).click()
    await expect.element(screen.getByRole('alertdialog', { name: 'Unassign Weather from Kitchen?' })).toBeVisible()
    expect(outcome()).toEqual([
      'Lost This Screen on Kitchen and its Schedule.',
      'Stays The Plugin Weather, with its template, its Data Sources and its place in any Mashup.',
    ])
    expect(words(dialog())).not.toMatch(/delete/i)
    await screen.getByRole('button', { name: 'Unassign Plugin' }).click()

    await expect.poll(rowNames).not.toContain('Weather')
    expect(faked.writes).toEqual([{ method: 'DELETE', path: 'plugins/weather/assignments/kitchen' }])
  })

  it('a Plugin Screen has no "Rename" and no "Delete Screen", and every other kind no "Unassign Plugin"', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=weather' })
    const plugin = await openedRow(screen, 'Weather')

    await expect.element(plugin.getByRole('button', { name: 'Unassign Plugin' })).toBeVisible()
    expect(plugin.getByRole('button', { name: 'Rename' }).query()).toBeNull()
    expect(plugin.getByRole('button', { name: 'Delete Screen' }).query()).toBeNull()

    for (const other of SCREENS_OF_EVERY_KIND.filter(kept => kept.kind !== 'plugin')) {
      await screen.router.replace({ query: { screen: other.id } })
      const row = await openedRow(screen, other.name)
      await expect.element(row.getByRole('button', { name: 'Rename' })).toBeVisible()
      await expect.element(row.getByRole('button', { name: 'Delete Screen' })).toBeVisible()
      expect(row.getByRole('button', { name: 'Unassign Plugin' }).query()).toBeNull()
    }
  })

  it('keeps the confirmation open with the reason when the server refuses, and shows the empty state once the last Screen is gone', async () => {
    const faked = fakeKitchen({ screens: SCREENS_OF_EVERY_KIND.slice(4) })
    api.use(http.delete(apiUrl('screens/notes'), () => apiErrorResponse({ statusCode: 403, code: 'demo-mode' }), { once: true }))
    const screen = await mountApp({ at: '/devices/kitchen?screen=notes' })
    const row = await openedRow(screen, 'Notes')

    await row.getByRole('button', { name: 'Delete Screen' }).click()
    await screen.getByRole('button', { name: 'Delete Screen' }).click()
    await expect.element(screen.getByText('Not available in the demo.')).toBeVisible()
    await screen.getByRole('button', { name: 'Delete Screen' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Add Kitchen\'s first Screen' })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'DELETE', path: 'screens/notes' }])
  })
})

describe('showing next and back to order', () => {
  it('"Show next" is offered only on an opened row Rotation could show next, not the Active Screen or already Up next', async () => {
    fakeKitchen({ screens: SCREENS_OF_EVERY_KIND.map(screen => screen.id === 'photo' ? { ...screen, state: 'upNext' as const } : screen) })
    const screen = await mountApp({ at: '/devices/kitchen?screen=weather' })
    const active = await openedRow(screen, 'Weather')

    expect(active.getByRole('button', { name: 'Show next' }).query()).toBeNull()
    expect(active.getByRole('button', { name: 'Back to Order' }).query()).toBeNull()

    await screen.router.replace({ query: { screen: 'photo' } })
    const upNext = await openedRow(screen, 'Harbour photo')
    expect(upNext.getByRole('button', { name: 'Show next' }).query()).toBeNull()

    await screen.router.replace({ query: { screen: 'webcam' } })
    const eligible = await openedRow(screen, 'Harbour webcam')
    await expect.element(eligible.getByRole('button', { name: 'Show next' })).toBeVisible()
  })

  it('picks the Screen without a confirmation: the row reads "Up next · picked by hand" and offers "Back to Order"', async () => {
    const faked = fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const row = await openedRow(screen, 'Harbour webcam')

    await row.getByRole('button', { name: 'Show next' }).click()

    await expect.element(row.getByRole('button', { name: 'Back to Order' })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PUT', path: 'devices/kitchen/picked-screen', body: { screenId: 'webcam' } }])
    await expect.poll(() => words(rowOf('Harbour webcam').querySelector('.state'))).toBe('Up next · picked by hand')
    expect(words(row.element())).toContain('Picked by hand: shows at the next poll, around')
  })

  it('picking another Screen replaces the pick', async () => {
    const faked = fakeKitchen({ screens: SCREENS_OF_EVERY_KIND.map(screen => screen.id === 'webcam' ? { ...screen, state: 'upNext' as const, picked: true } : screen) })
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const row = await openedRow(screen, 'Harbour photo')

    await row.getByRole('button', { name: 'Show next' }).click()

    await expect.element(row.getByRole('button', { name: 'Back to Order' })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PUT', path: 'devices/kitchen/picked-screen', body: { screenId: 'photo' } }])
    await expect.poll(() => words(rowOf('Harbour webcam').querySelector('.state'))).toBe('')
  })

  it('"Back to Order" clears the pick, and the row returns to waiting its turn', async () => {
    const faked = fakeKitchen({ screens: SCREENS_OF_EVERY_KIND.map(screen => screen.id === 'webcam' ? { ...screen, state: 'upNext' as const, picked: true } : screen) })
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const row = await openedRow(screen, 'Harbour webcam')

    await row.getByRole('button', { name: 'Back to Order' }).click()

    await expect.element(row.getByRole('button', { name: 'Show next' })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'DELETE', path: 'devices/kitchen/picked-screen' }])
    await expect.poll(() => words(rowOf('Harbour webcam').querySelector('.state'))).toBe('')
  })

  it('shows the API\'s refusal the way the page shows other failed actions, and picks on a second try', async () => {
    const faked = fakeKitchen()
    api.use(http.put(apiUrl('devices/kitchen/picked-screen'), () => apiErrorResponse({ statusCode: 409, code: 'picked-screen-ineligible' }), { once: true }))
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const row = await openedRow(screen, 'Harbour webcam')

    await row.getByRole('button', { name: 'Show next' }).click()
    await expect.element(screen.getByText('Not saved. Rotation could not show that Screen at the next poll.')).toBeVisible()
    expect(faked.writes).toEqual([])

    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.element(row.getByRole('button', { name: 'Back to Order' })).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PUT', path: 'devices/kitchen/picked-screen', body: { screenId: 'webcam' } }])
  })

  it.each([
    ['a mirrored Device', { isMirrored: true }],
    ['a Proxied Device', { isMirrored: true, isProxied: true }],
  ])('is offered on neither %s', async (_name, deviceOverrides) => {
    fakeKitchen({ device: buildDeviceDetail({ id: 'kitchen', name: 'Kitchen', ...deviceOverrides }) })
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const row = await openedRow(screen, 'Harbour webcam')

    expect(row.getByRole('button', { name: 'Show next' }).query()).toBeNull()
    expect(row.getByRole('button', { name: 'Back to Order' }).query()).toBeNull()
  })
})
