import type { ScreenPluginReference } from 'kuroshiro-shared'
import type { MountedApp } from './screensViewHarness'
import { http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { clockTime } from '@/patterns/time'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { fakeKitchen, imagePath, kitchenScreen, lines, openedRow, RENDERED_AT, SCREENS_OF_EVERY_KIND, words } from './screensViewHarness'

afterEach(() => resetViewport())

const rendered = clockTime(new Date(RENDERED_AT))

function pluginScreen(plugin: Partial<ScreenPluginReference> = {}) {
  return kitchenScreen({
    id: 'weather',
    name: 'Weather',
    imagePath: imagePath('weather'),
    renderedAt: RENDERED_AT,
    plugin: { id: 'weather', name: 'Weather', kind: 'Poll', requiredFieldEmpty: false, fetchAlertFiring: false, ...plugin },
  })
}

describe('a Plugin Screen', () => {
  it('links its Plugin, says when it was last rendered and where it is edited, and nothing more', async () => {
    fakeKitchen({ screens: [pluginScreen()] })
    const screen = await mountApp({ at: '/devices/kitchen?screen=weather' })
    const source = (await openedRow(screen, 'Weather')).getByRole('group', { name: 'Plugin' })

    await expect.element(source.getByRole('link', { name: 'Weather' })).toHaveAttribute('href', '/plugins/weather')
    expect(lines(source.element())).toEqual([
      'Plugin',
      `Rendered from the Plugin Weather, last at ${rendered}.`,
      'Its name, template and Data Sources are edited on the Plugin and apply to every Device it is assigned to.',
    ])
    expect(elementsInSealColour(source.element())).toEqual([])
  })

  it('says of a Webhook-kind Plugin that it renders when its Webhook URL receives data', async () => {
    fakeKitchen({ screens: [pluginScreen({ kind: 'Webhook' })] })
    const screen = await mountApp({ at: '/devices/kitchen?screen=weather' })
    const source = (await openedRow(screen, 'Weather')).getByRole('group', { name: 'Plugin' })

    await expect.element(source.getByText('It renders again whenever its Webhook URL receives data.')).toBeVisible()
    expect(source.getByRole('list').query()).toBeNull()
  })

  it('points at a required Plugin Field that is empty', async () => {
    fakeKitchen({ screens: [pluginScreen({ requiredFieldEmpty: true })] })
    const screen = await mountApp({ at: '/devices/kitchen?screen=weather' })
    const source = (await openedRow(screen, 'Weather')).getByRole('group', { name: 'Plugin' })

    await expect.element(source.getByText('A required Plugin Field is empty.')).toBeVisible()
    await expect.element(source.getByRole('link', { name: 'Fill it in on the Plugin' })).toHaveAttribute('href', '/plugins/weather')
    expect(words(source.element())).not.toContain('Webhook')
    expect(words(source.element())).not.toContain('Alert')
    expect(elementsInSealColour(source.element())).toEqual([])
  })

  it('shows a firing fetch Alert as the only red, linking to the Plugin', async () => {
    fakeKitchen({ screens: [pluginScreen({ fetchAlertFiring: true })] })
    const screen = await mountApp({ at: '/devices/kitchen?screen=weather' })
    const source = (await openedRow(screen, 'Weather')).getByRole('group', { name: 'Plugin' })

    const alert = source.getByText('Alert: a Data Source of this Plugin keeps failing')
    await expect.element(alert).toBeVisible()
    await expect.element(source.getByRole('link', { name: 'See it on the Plugin' })).toHaveAttribute('href', '/plugins/weather')
    expect(elementsInSealColour(source.element()).every(element => element.closest('.said.alert') !== null)).toBe(true)
    expect(elementsInSealColour(source.element()).length).toBeGreaterThan(0)
    expect(words(source.element())).not.toContain('required Plugin Field')
  })
})

describe('an HTML Screen', () => {
  it('says what it is rendered from and links to Edit HTML', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=notes' })
    const source = (await openedRow(screen, 'Notes')).getByRole('group', { name: 'HTML' })

    await expect.element(source.getByText('Rendered from HTML written here, on every poll.')).toBeVisible()
    await expect.element(source.getByRole('link', { name: 'Edit HTML' })).toHaveAttribute('href', '/devices/kitchen/screens/notes/html')
  })
})

describe('a File Screen', () => {
  it('shows the file\'s name and its facts', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const source = (await openedRow(screen, 'Harbour photo')).getByRole('group', { name: 'File' })

    await expect.element(source.getByText('harbour.png')).toBeVisible()
    await expect.element(source.getByText('1600 × 960 · 412 KB · uploaded 12 September 2026. Converted for TRMNL OG (2-bit), Greyscale, 4 levels.')).toBeVisible()
  })

  it('leaves out what a Screen uploaded earlier does not have', async () => {
    const earlier = { ...SCREENS_OF_EVERY_KIND[3]!, file: { originalName: null, width: null, height: null, bytes: null, uploadedAt: '2026-09-12T10:00:00.000Z' } }
    fakeKitchen({ screens: [earlier] })
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const source = (await openedRow(screen, 'Harbour photo')).getByRole('group', { name: 'File' })

    await expect.element(source.getByRole('button', { name: 'Replace file' })).toBeVisible()
    expect(lines(source.element())).toEqual(['File', 'Uploaded 12 September 2026. Converted for TRMNL OG (2-bit), Greyscale, 4 levels.', 'Replace file'])
  })
})

describe('an External link Screen', () => {
  async function openedWebcam() {
    const screen = await mountApp({ at: '/devices/kitchen?screen=webcam' })
    const source = (await openedRow(screen, 'Harbour webcam')).getByRole('group', { name: 'External link' })
    return { screen, source, url: source.getByRole('textbox', { name: 'Image URL' }) }
  }

  it('saves a new address as changed, sending the address alone', async () => {
    const faked = fakeKitchen()
    const { source, url } = await openedWebcam()

    await expect.element(url).toHaveValue('https://harbour.example/cam.jpg')
    await url.fill('https://harbour.example/quay.jpg')
    await userEvent.keyboard('{Enter}')

    await expect.element(source.getByText('Saved')).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/webcam', body: { url: 'https://harbour.example/quay.jpg' } }])
  })

  it('never sends an address that is not http or https', async () => {
    const faked = fakeKitchen()
    const { source, url } = await openedWebcam()

    await url.fill('ftp://harbour.example/cam.jpg')
    await userEvent.keyboard('{Enter}')

    await expect.element(source.getByText('Enter an address that starts with http:// or https://.')).toBeVisible()
    await expect.element(url).toHaveAttribute('aria-invalid', 'true')
    expect(faked.writes).toEqual([])
  })

  it('saves the fetch choice as changed, sending the choice alone', async () => {
    const faked = fakeKitchen()
    const { source } = await openedWebcam()

    await expect.element(source.getByRole('radio', { name: 'Fetch once and keep' })).toBeChecked()
    await expect.element(source.getByText('Kuroshiro keeps the converted image until you refresh it.')).toBeVisible()
    await expect.element(source.getByText('Kuroshiro downloads and converts it each time this Screen\'s turn comes.')).toBeVisible()
    await source.getByRole('radio', { name: 'Fetch on every poll' }).click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'PATCH', path: 'screens/webcam', body: { fetchManual: false } }])
    await expect.element(source.getByRole('radio', { name: 'Fetch on every poll' })).toBeChecked()
    await expect.poll(() => source.getByRole('button', { name: 'Refresh image' }).query()).toBeNull()
  })

  it('"Refresh image" fetches the kept image again and says when it was fetched', async () => {
    const faked = fakeKitchen()
    const { source } = await openedWebcam()

    await expect.element(source.getByText('Fetched 4 min ago')).toBeVisible()
    await source.getByRole('button', { name: 'Refresh image' }).click()

    await expect.element(source.getByText('Fetched just now')).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'POST', path: 'screens/webcam/refresh' }])
  })

  it('shows the server\'s reason under the field when "Refresh image" cannot fetch, and keeps the earlier image', async () => {
    fakeKitchen()
    api.use(http.post(apiUrl('screens/webcam/refresh'), () => apiErrorResponse({ statusCode: 422, code: 'image-fetch-failed', message: 'The address did not answer with an image Kuroshiro can read.' })))
    const { screen, source, url } = await openedWebcam()

    await source.getByRole('button', { name: 'Refresh image' }).click()

    await expect.element(source.getByText('Kuroshiro could not fetch an image from this address. The address did not answer with an image Kuroshiro can read.')).toBeVisible()
    await expect.element(url).toHaveAccessibleDescription(/could not fetch an image/)
    await expect.element(source.getByText('Fetched 4 min ago')).toBeVisible()
    await expect.element(screen.getByRole('img', { name: 'Harbour webcam, as rendered for Kitchen' })).toHaveAttribute('src', expect.stringContaining(imagePath('webcam')))
  })

  it('keeps the address that was entered when its fetch fails, says why and saves on "Try again"', async () => {
    const faked = fakeKitchen()
    api.use(http.patch(apiUrl('screens/webcam'), () => apiErrorResponse({ statusCode: 422, code: 'image-fetch-failed', message: 'The image could not be fetched: 404.' }), { once: true }))
    const { source, url } = await openedWebcam()

    await url.fill('https://harbour.example/gone.jpg')
    await userEvent.keyboard('{Enter}')

    await expect.element(source.getByText('Kuroshiro could not fetch an image from this address. 404.')).toBeVisible()
    await expect.element(url).toHaveAttribute('aria-invalid', 'true')
    await expect.element(source.getByText('Not saved.', { exact: true })).toBeVisible()
    await expect.element(url).toHaveValue('https://harbour.example/gone.jpg')
    await source.getByRole('button', { name: 'Try again' }).click()

    await expect.element(source.getByText('Saved')).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/webcam', body: { url: 'https://harbour.example/gone.jpg' } }])
  })
})

describe('"Replace file" on a File Screen', () => {
  const alps = () => new File(['alps'], 'alps.jpg', { type: 'image/jpeg' })

  async function replacing() {
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const source = (await openedRow(screen, 'Harbour photo')).getByRole('group', { name: 'File' })
    await source.getByRole('button', { name: 'Replace file' }).click()
    const input = source.getByLabelText('Choose file')
    await expect.element(input).toHaveFocus()
    return { screen, source, input }
  }

  it('shows the new image beside the current one, and replaces it on "Replace image"', async () => {
    const faked = fakeKitchen()
    const { source, input } = await replacing()

    await expect.element(source.getByText('Drop an image here. PNG, JPEG, BMP, GIF, TIFF or WebP, up to 10 MB.')).toBeVisible()
    await userEvent.upload(input, alps())

    await expect.element(source.getByRole('img', { name: 'Harbour photo, as it is now' })).toBeVisible()
    await expect.element(source.getByRole('img', { name: 'alps.jpg, converted for Kitchen' })).toBeVisible()
    expect([...source.element().querySelectorAll('figcaption')].map(words)).toEqual(['Now', 'New: alps.jpg'])
    await expect.element(source.getByText('The current image is deleted. The Screen keeps its name, its Order and its Schedule.')).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'POST', path: 'screens/photo/image-preview', body: 'alps.jpg' }])

    await source.getByRole('button', { name: 'Replace image' }).click()

    await expect.element(source.getByRole('button', { name: 'Replace file' })).toHaveFocus()
    await expect.element(source.getByText('alps.jpg')).toBeVisible()
    expect(faked.writes.at(-1)).toEqual({ method: 'PUT', path: 'screens/photo/image', body: 'alps.jpg' })
    expect(faked.writes).toHaveLength(2)
  })

  it('stores nothing on "Keep the current image"', async () => {
    const faked = fakeKitchen()
    const { source, input } = await replacing()

    await userEvent.upload(input, alps())
    await source.getByRole('button', { name: 'Keep the current image' }).click()

    await expect.element(source.getByRole('button', { name: 'Replace file' })).toHaveFocus()
    await expect.element(source.getByText('harbour.png')).toBeVisible()
    expect(faked.writes.map(write => write.path)).toEqual(['screens/photo/image-preview'])
  })

  it('closes on "Cancel" without a call', async () => {
    const faked = fakeKitchen()
    const { source } = await replacing()

    await source.getByRole('button', { name: 'Cancel' }).click()

    await expect.element(source.getByRole('button', { name: 'Replace file' })).toHaveFocus()
    expect(faked.writes).toEqual([])
  })

  it('says of a file the server cannot read that it is no image, and takes another', async () => {
    fakeKitchen()
    api.use(http.post(apiUrl('screens/photo/image-preview'), () => apiErrorResponse({ statusCode: 400, code: 'image-unreadable' }), { once: true }))
    const { source, input } = await replacing()

    await userEvent.upload(input, new File(['not an image'], 'notes.png', { type: 'image/png' }))
    await expect.element(source.getByText('This file is not an image Kuroshiro can read. Use PNG, JPEG, BMP, GIF, TIFF or WebP.')).toBeVisible()
    expect(source.getByRole('button', { name: 'Replace image' }).query()).toBeNull()

    await userEvent.upload(input, alps())
    await expect.element(source.getByRole('button', { name: 'Replace image' })).toBeVisible()
  })

  it('keeps the two images and says why when the replacing is refused', async () => {
    fakeKitchen()
    api.use(http.put(apiUrl('screens/photo/image'), () => apiErrorResponse({ statusCode: 413, code: 'upload-too-large', details: { limitBytes: 10 * 1024 * 1024 } })))
    const { source, input } = await replacing()

    await userEvent.upload(input, alps())
    await source.getByRole('button', { name: 'Replace image' }).click()

    await expect.element(source.getByText('That file is larger than the 10 MB this Instance accepts.')).toBeVisible()
    await expect.element(source.getByRole('button', { name: 'Replace image' })).toBeVisible()
  })

  it('is disabled in demo mode, and says so', async () => {
    fakeKitchen({ instance: buildInstanceFacts({ demoMode: true }) })
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const source = (await openedRow(screen, 'Harbour photo')).getByRole('group', { name: 'File' })

    await expect.element(source.getByRole('button', { name: 'Replace file' })).toBeDisabled()
    await expect.element(source.getByRole('button', { name: 'Replace file' })).toHaveAccessibleDescription('Not available in the demo.')
    await expect.element(source.getByText('Not available in the demo.')).toBeVisible()
  })
})

describe('a Mashup Screen', () => {
  const threeSlots = { ...SCREENS_OF_EVERY_KIND[1]!, mashup: {
    layout: '1Lx2R' as const,
    slots: [
      { position: 'left', size: 'half_vertical' as const, pluginId: 'weather', pluginName: 'Weather' },
      { position: 'top-right', size: 'quadrant' as const, pluginId: 'calendar', pluginName: 'Calendar' },
      { position: 'bottom-right', size: 'quadrant' as const, pluginId: 'trains', pluginName: 'Train departures' },
    ],
  } }

  async function openedWeekend() {
    const screen = await mountApp({ at: '/devices/kitchen?screen=weekend' })
    const source = (await openedRow(screen, 'Weekend board')).getByRole('group', { name: 'Mashup' })
    await expect.element(source.getByRole('combobox', { name: 'Left', exact: true })).toBeVisible()
    return { screen, source }
  }

  const slots = (root: Element) => [...root.querySelectorAll('.slot')].map(slot => [words(slot.querySelector('.slot-name')), words(slot.querySelector('[role="combobox"]'))])

  async function choose(screen: MountedApp, select: ReturnType<MountedApp['getByRole']>, plugin: string) {
    await select.click()
    await screen.getByRole('option', { name: plugin, exact: true }).click()
  }

  it('shows the layout\'s drawing and name, and each slot\'s Plugin', async () => {
    fakeKitchen()
    const { source } = await openedWeekend()

    await expect.element(source.getByText('Left and right')).toBeVisible()
    expect(source.element().querySelectorAll('.layout svg rect')).toHaveLength(2)
    expect(slots(source.element())).toEqual([['Left', 'Weather'], ['Right', 'Calendar']])
  })

  it('a Slot Change lists every Plugin, with the one in another slot disabled, and saves the whole list with one swapped', async () => {
    const faked = fakeKitchen()
    const { screen, source } = await openedWeekend()

    await source.getByRole('combobox', { name: 'Right', exact: true }).click()
    await expect.element(screen.getByRole('listbox')).toBeVisible()
    expect(screen.getByRole('option').elements().map(option => words(option.querySelector('span')))).toEqual(['Weather', 'Calendar', 'Train departures', 'Bin day'])
    await expect.element(screen.getByRole('option', { name: /^Weather/ })).toHaveAttribute('aria-disabled', 'true')
    await screen.getByRole('option', { name: 'Train departures', exact: true }).click()

    await expect.poll(() => faked.writes).toEqual([{ method: 'PATCH', path: 'mashup/weekend', body: { pluginIds: ['weather', 'trains'] } }])
    await expect.element(source.getByText('Saved')).toBeVisible()
    expect(slots(source.element())).toEqual([['Left', 'Weather'], ['Right', 'Train departures']])
  })

  it('shows the rendering plate after a Slot Change until the Mashup is rendered again', async () => {
    const faked = fakeKitchen()
    const { screen, source } = await openedWeekend()
    await expect.element(screen.getByRole('img', { name: 'Weekend board, as rendered for Kitchen', exact: true })).toBeVisible()

    await choose(screen, source.getByRole('combobox', { name: 'Right', exact: true }), 'Bin day')
    await expect.element(screen.getByRole('img', { name: 'Weekend board, as rendered for Kitchen: rendering' })).toBeVisible()

    faked.screens = faked.screens.map(kept => kept.id === 'weekend' ? { ...kept, renderedAt: '2026-10-03T07:35:00.000Z', imagePath: `${imagePath('weekend')}2` } : kept)
    // A refresh is held back while a select has the focus.
    ;(document.activeElement as HTMLElement).blur()
    window.dispatchEvent(new Event('focus'))
    await expect.element(screen.getByRole('img', { name: 'Weekend board, as rendered for Kitchen', exact: true })).toBeVisible()
  })

  it('keeps the chosen Plugin when the save fails, and saves on "Try again"', async () => {
    const faked = fakeKitchen()
    api.use(http.patch(apiUrl('mashup/weekend'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
    const { screen, source } = await openedWeekend()

    await choose(screen, source.getByRole('combobox', { name: 'Left', exact: true }), 'Bin day')

    await expect.element(source.getByText('Not saved. Something went wrong on the server.')).toBeVisible()
    expect(slots(source.element())).toEqual([['Left', 'Bin day'], ['Right', 'Calendar']])
    await source.getByRole('button', { name: 'Try again' }).click()

    await expect.element(source.getByText('Saved')).toBeVisible()
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'mashup/weekend', body: { pluginIds: ['bins', 'calendar'] } }])
  })

  it('drops a Slot Change that was not saved when the layout form is opened and cancelled', async () => {
    const faked = fakeKitchen()
    api.use(http.patch(apiUrl('mashup/weekend'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const { screen, source } = await openedWeekend()

    await choose(screen, source.getByRole('combobox', { name: 'Left', exact: true }), 'Bin day')
    await expect.element(source.getByRole('button', { name: 'Try again' })).toBeVisible()
    await source.getByRole('button', { name: 'Change layout' }).click()
    await source.getByRole('button', { name: 'Cancel' }).click()

    await expect.element(source.getByRole('button', { name: 'Change layout' })).toHaveFocus()
    expect(slots(source.element())).toEqual([['Left', 'Weather'], ['Right', 'Calendar']])
    expect(source.getByRole('button', { name: 'Try again' }).query()).toBeNull()
    expect(faked.writes).toEqual([])
  })

  it('"Change layout" carries the Plugins over, starts a new slot at "Choose" and saves the layout with the whole list once every slot is filled', async () => {
    const faked = fakeKitchen()
    const { screen, source } = await openedWeekend()

    await source.getByRole('button', { name: 'Change layout' }).click()
    const form = source.getByRole('group', { name: 'Change layout' })
    await expect.element(form.getByRole('radio', { name: 'Left and right' })).toBeChecked()
    expect(form.getByRole('radio').elements()).toHaveLength(7)
    await form.getByRole('radio', { name: 'One left, two right' }).click()

    await expect.poll(() => slots(form.element())).toEqual([['Left', 'Weather'], ['Top right', 'Calendar'], ['Bottom right', 'Choose']])
    await expect.element(form.getByRole('button', { name: 'Save layout' })).toBeDisabled()
    await choose(screen, form.getByRole('combobox', { name: 'Bottom right', exact: true }), 'Bin day')
    await form.getByRole('button', { name: 'Save layout' }).click()

    await expect.element(source.getByText('One left, two right')).toBeVisible()
    await expect.element(source.getByRole('button', { name: 'Change layout' })).toHaveFocus()
    expect(slots(source.element())).toEqual([['Left', 'Weather'], ['Top right', 'Calendar'], ['Bottom right', 'Bin day']])
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'mashup/weekend', body: { layout: '1Lx2R', pluginIds: ['weather', 'calendar', 'bins'] } }])
  })

  it('names the Plugin a layout with fewer slots has no slot for, and "Cancel" restores the row', async () => {
    const faked = fakeKitchen({ screens: [threeSlots] })
    const { source } = await openedWeekend()

    await source.getByRole('button', { name: 'Change layout' }).click()
    const form = source.getByRole('group', { name: 'Change layout' })
    await form.getByRole('radio', { name: 'Top and bottom' }).click()

    await expect.element(form.getByText('Train departures no longer has a slot. The Plugin itself stays.')).toBeVisible()
    expect(slots(form.element())).toEqual([['Top', 'Weather'], ['Bottom', 'Calendar']])
    await form.getByRole('button', { name: 'Cancel' }).click()

    await expect.element(source.getByText('One left, two right')).toBeVisible()
    await expect.element(source.getByRole('button', { name: 'Change layout' })).toHaveFocus()
    expect(slots(source.element())).toEqual([['Left', 'Weather'], ['Top right', 'Calendar'], ['Bottom right', 'Train departures']])
    expect(faked.writes).toEqual([])
  })

  it('keeps the layout form open with the reason when the save is refused', async () => {
    fakeKitchen()
    api.use(http.patch(apiUrl('mashup/weekend'), () => apiErrorResponse({ statusCode: 403, code: 'demo-mode' })))
    const { source } = await openedWeekend()

    await source.getByRole('button', { name: 'Change layout' }).click()
    const form = source.getByRole('group', { name: 'Change layout' })
    await form.getByRole('radio', { name: 'Top and bottom' }).click()
    await form.getByRole('button', { name: 'Save layout' }).click()

    await expect.element(form.getByText('Not available in the demo.')).toBeVisible()
    await expect.element(form.getByRole('radio', { name: 'Top and bottom' })).toBeChecked()
  })

  it('still names the slots\' Plugins, and says so, when the Plugins cannot be loaded', async () => {
    fakeKitchen()
    api.use(http.get(apiUrl('plugins'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const { source } = await openedWeekend()

    await expect.element(source.getByText('Could not load the Plugins. Something went wrong on the server.')).toBeVisible()
    expect(slots(source.element())).toEqual([['Left', 'Weather'], ['Right', 'Calendar']])
  })
})

describe('an opened Screen as a whole', () => {
  const pluginWithTrouble = { ...SCREENS_OF_EVERY_KIND[0]!, plugin: { id: 'weather', name: 'Weather', kind: 'Webhook' as const, requiredFieldEmpty: true, fetchAlertFiring: true } }
  const screens = [pluginWithTrouble, ...SCREENS_OF_EVERY_KIND.slice(1)]

  it.for(screens.map(({ id, name }) => ({ id, name })))('is accessible in both themes and does not scroll sideways with $name opened', async ({ id, name }) => {
    fakeKitchen({ screens })
    const screen = await mountApp({ at: `/devices/kitchen?screen=${id}` })
    await openedRow(screen, name)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is accessible and does not scroll sideways while a name is edited, a file replaced and a layout changed', async () => {
    fakeKitchen()
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    const photo = await openedRow(screen, 'Harbour photo')
    await photo.getByRole('button', { name: 'Replace file' }).click()
    await userEvent.upload(photo.getByLabelText('Choose file'), new File(['alps'], 'alps-in-the-first-snow-of-the-year.jpg'))
    await expect.element(photo.getByRole('button', { name: 'Replace image' })).toBeVisible()
    await photo.getByRole('button', { name: 'Rename' }).click()
    await expect.element(screen.getByRole('textbox', { name: 'Name of Harbour photo' })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()

    await screen.router.replace({ query: { screen: 'weekend' } })
    const weekend = await openedRow(screen, 'Weekend board')
    await weekend.getByRole('button', { name: 'Change layout' }).click()
    await weekend.getByRole('radio', { name: 'Four quarters' }).click()
    await expect.element(weekend.getByRole('combobox', { name: 'Bottom right' })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('on phone: a Screen is renamed, its slot changed and its layout form opened from the opened row', async () => {
    const faked = fakeKitchen()
    await resizeTo(375)
    const screen = await mountApp({ at: '/devices/kitchen?screen=weekend' })
    const row = await openedRow(screen, 'Weekend board')

    await row.getByRole('button', { name: 'Rename' }).click()
    await screen.getByRole('textbox', { name: 'Name of Weekend board' }).fill('Weekend')
    await screen.getByRole('button', { name: 'Save' }).click()
    const renamed = await openedRow(screen, 'Weekend')
    await renamed.getByRole('combobox', { name: 'Right', exact: true }).click()
    await screen.getByRole('option', { name: 'Bin day', exact: true }).click()
    await expect.element(renamed.getByText('Saved')).toBeVisible()
    await renamed.getByRole('button', { name: 'Change layout' }).click()
    await expect.element(renamed.getByRole('radio', { name: 'Four quarters' })).toBeVisible()

    expect(faked.writes).toEqual([
      { method: 'PATCH', path: 'screens/weekend', body: { name: 'Weekend' } },
      { method: 'PATCH', path: 'mashup/weekend', body: { pluginIds: ['weather', 'bins'] } },
    ])
  })
})
