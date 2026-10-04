import type { PluginSummary } from 'kuroshiro-shared'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { buildPalette } from '@/testing/fixtures/device-models'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { mountAddScreen, nameField, OPENED_ON_THE_NEW_SCREEN, path } from './addScreenHarness'
import { codeIn, fakeHtmlPreviewLibrary, previewed, typeAtEnd } from './htmlScreenHarness'
import { fakeKitchen, openedRow } from './screensViewHarness'

const PLUGINS: PluginSummary[] = [
  buildPluginSummary({ id: 'bins', name: 'Bin day', devices: [] }),
  buildPluginSummary({ id: 'calendar', name: 'Calendar', devices: [] }),
  buildPluginSummary({ id: 'weather', name: 'Weather', devices: [{ id: 'kitchen', name: 'Kitchen' }] }),
]

type Mounted = Awaited<ReturnType<typeof mountAddScreen>>

const addScreen = (screen: Mounted) => screen.getByRole('button', { name: 'Add Screen' })
const urlField = (screen: Mounted) => screen.getByRole('textbox', { name: 'Image URL' })
const fetching = (screen: Mounted, name: string) => screen.getByRole('radiogroup', { name: 'Fetching' }).getByRole('radio', { name, exact: true })
const layout = (screen: Mounted, name: string) => screen.getByRole('radiogroup', { name: 'Layout' }).getByRole('radio', { name, exact: true })
const slot = (screen: Mounted, name: string) => screen.getByRole('combobox', { name, exact: true })
const htmlField = (screen: Mounted) => screen.getByRole('textbox', { name: 'HTML', exact: true })
const htmlCode = (screen: Mounted) => codeIn(htmlField(screen))

const typeHtml = (screen: Mounted, keys: string) => typeAtEnd(htmlField(screen), keys)

const fileInput = (screen: Mounted) => screen.getByLabelText('Choose file')

async function fill(screen: Mounted, slotName: string, pluginName: string) {
  await slot(screen, slotName).click()
  await screen.getByRole('option', { name: pluginName, exact: true }).click()
}

const png = (name: string) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' })

describe('add Screen, by kind', () => {
  describe('an External link', () => {
    it('adds a kept image with the name and the address trimmed, and opens its new row', async () => {
      const faked = fakeKitchen()
      const screen = await mountAddScreen('link')

      await expect.element(fetching(screen, 'Fetch once and keep')).toBeChecked()
      await expect.element(fetching(screen, 'Fetch once and keep')).toHaveAccessibleDescription('Kuroshiro keeps the converted image until you refresh it.')
      await expect.element(fetching(screen, 'Fetch on every poll')).toHaveAccessibleDescription('Kuroshiro downloads and converts it each time this Screen\'s turn comes.')
      await nameField(screen).fill(' Tide table ')
      await urlField(screen).fill(' https://tides.example/today.png ')
      await addScreen(screen).click()

      await expect.poll(() => path(screen)).toBe(OPENED_ON_THE_NEW_SCREEN)
      expect(faked.writes).toEqual([{ method: 'POST', path: 'screens', body: { kind: 'external', deviceId: 'kitchen', name: 'Tide table', url: 'https://tides.example/today.png', fetchManual: true } }])
      await openedRow(screen, 'Tide table')
    })

    it('adds an image that is fetched on every poll', async () => {
      const faked = fakeKitchen()
      const screen = await mountAddScreen('link')

      await nameField(screen).fill('Harbour webcam')
      await urlField(screen).fill('http://harbour.local/cam.jpg')
      await fetching(screen, 'Fetch on every poll').click()
      await addScreen(screen).click()

      await expect.poll(() => path(screen)).toBe(OPENED_ON_THE_NEW_SCREEN)
      expect(faked.writes[0]?.body).toEqual({ kind: 'external', deviceId: 'kitchen', name: 'Harbour webcam', url: 'http://harbour.local/cam.jpg', fetchManual: false })
    })

    it('sends nothing without a name or with an address that is not a web address', async () => {
      const faked = fakeKitchen()
      const screen = await mountAddScreen('link')

      await urlField(screen).fill('ftp://tides.example/today.png')
      await addScreen(screen).click()

      await expect.element(nameField(screen)).toHaveAccessibleDescription('A Screen needs a name.')
      await expect.element(urlField(screen)).toHaveAccessibleDescription('Enter an address that starts with http:// or https://.')
      expect(faked.writes).toEqual([])
    })

    it('adds no Screen when a kept image cannot be fetched: the form stays filled and the field says why', async () => {
      fakeKitchen()
      api.use(http.post(apiUrl('screens'), async () => {
        await delay(50)
        return apiErrorResponse({ statusCode: 422, code: 'image-fetch-failed', message: 'The image could not be fetched: the address answered 404.' })
      }))
      const screen = await mountAddScreen('link')

      await nameField(screen).fill('Tide table')
      await urlField(screen).fill('https://tides.example/gone.png')
      await addScreen(screen).click()

      await expect.element(urlField(screen)).toHaveAccessibleDescription('Kuroshiro could not fetch an image from this address. the address answered 404.')
      await expect.element(nameField(screen)).toHaveValue('Tide table')
      await expect.element(urlField(screen)).toHaveValue('https://tides.example/gone.png')
      expect(path(screen)).toBe('/devices/kitchen/screens/new?kind=link')
    })

    it('says at the address when what it answers is no image', async () => {
      fakeKitchen()
      api.use(http.post(apiUrl('screens'), () => apiErrorResponse({ statusCode: 422, code: 'image-unreadable' })))
      const screen = await mountAddScreen('link')

      await nameField(screen).fill('Tide table')
      await urlField(screen).fill('https://tides.example/today.html')
      await addScreen(screen).click()

      await expect.element(urlField(screen)).toHaveAccessibleDescription('This address does not answer with an image Kuroshiro can read. It has to be PNG, JPEG, BMP, GIF, TIFF or WebP.')
    })

    it('says under the buttons why nothing was added when the server refuses for another reason', async () => {
      fakeKitchen()
      api.use(http.post(apiUrl('screens'), () => apiErrorResponse({ statusCode: 404, code: 'device-not-found' })))
      const screen = await mountAddScreen('link')

      await nameField(screen).fill('Tide table')
      await urlField(screen).fill('https://tides.example/today.png')
      await addScreen(screen).click()

      await expect.element(screen.getByText('Not added. That Device does not exist.')).toBeVisible()
    })
  })

  describe('a Mashup', () => {
    it('adds the layout with the Plugins in slot order once the name and every slot are filled', async () => {
      const faked = fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('mashup')

      await expect.element(layout(screen, 'Left and right')).toBeChecked()
      await expect.element(screen.getByText('Any Plugin can fill a slot, whether or not it is assigned to Kitchen. A Plugin fills one slot at most.')).toBeVisible()
      await layout(screen, 'One left, two right').click()
      await nameField(screen).fill(' Weekend board ')
      await fill(screen, 'Left', 'Weather')
      await fill(screen, 'Bottom right', 'Bin day')
      await expect.element(addScreen(screen)).toBeDisabled()
      await fill(screen, 'Top right', 'Calendar')
      await addScreen(screen).click()

      await expect.poll(() => path(screen)).toBe(OPENED_ON_THE_NEW_SCREEN)
      expect(faked.writes).toEqual([{ method: 'POST', path: 'mashup', body: { deviceId: 'kitchen', name: 'Weekend board', layout: '1Lx2R', pluginIds: ['weather', 'calendar', 'bins'] } }])
      await openedRow(screen, 'Weekend board')
    })

    it('offers a Plugin in one slot at most, and keeps what is placed when the layout changes', async () => {
      fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('mashup')

      await fill(screen, 'Left', 'Weather')
      await slot(screen, 'Right').click()
      await expect.element(screen.getByRole('option', { name: /^Weather/ })).toHaveAttribute('aria-disabled', 'true')
      await screen.getByRole('option', { name: 'Calendar', exact: true }).click()

      await layout(screen, 'Top and bottom').click()
      await expect.element(slot(screen, 'Top')).toHaveTextContent('Weather')
      await expect.element(slot(screen, 'Bottom')).toHaveTextContent('Calendar')
    })

    it('stays disabled without a name, and says a Screen needs one once the name is cleared', async () => {
      const faked = fakeKitchen({ plugins: PLUGINS })
      const screen = await mountAddScreen('mashup')

      await fill(screen, 'Left', 'Weather')
      await fill(screen, 'Right', 'Calendar')
      await expect.element(addScreen(screen)).toBeDisabled()

      await nameField(screen).fill('Weekend board')
      await expect.element(addScreen(screen)).toBeEnabled()
      await nameField(screen).fill('')

      await expect.element(nameField(screen)).toHaveAccessibleDescription('A Screen needs a name.')
      await expect.element(addScreen(screen)).toBeDisabled()
      await addScreen(screen).click({ force: true })
      expect(faked.writes).toEqual([])
    })

    it('says so when the Plugins cannot be loaded, and loads them on "Try again"', async () => {
      fakeKitchen({ plugins: PLUGINS })
      let fails = true
      api.use(http.get(apiUrl('plugins'), () => fails ? apiErrorResponse({ statusCode: 500, code: 'internal' }) : HttpResponse.json(PLUGINS)))
      const screen = await mountAddScreen('mashup')

      await expect.element(screen.getByText('Could not load the Plugins.')).toBeVisible()
      fails = false
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(slot(screen, 'Left')).toBeVisible()
    })
  })

  describe('a File', () => {
    it('names the six formats, the limit and what the image is converted for', async () => {
      fakeKitchen()
      const screen = await mountAddScreen('file')

      await expect.element(screen.getByText('Drop an image here. PNG, JPEG, BMP, GIF, TIFF or WebP, up to 10 MB.')).toBeVisible()
      await expect.element(screen.getByText('It is converted for TRMNL OG (2-bit), Greyscale, 4 levels.')).toBeVisible()
    })

    it('fills the name from the file\'s name, and uploads the file under the name as it was edited', async () => {
      const faked = fakeKitchen()
      const screen = await mountAddScreen('file')

      await userEvent.upload(fileInput(screen), png('harbour.png'))
      await expect.element(nameField(screen)).toHaveValue('harbour')
      await nameField(screen).fill('Harbour photo')
      await addScreen(screen).click()

      await expect.poll(() => path(screen)).toBe(OPENED_ON_THE_NEW_SCREEN)
      expect(faked.writes).toEqual([{ method: 'POST', path: 'screens', body: { kind: 'file', deviceId: 'kitchen', name: 'Harbour photo', file: 'harbour.png' } }])
      await openedRow(screen, 'Harbour photo')
    })

    it('keeps a name the admin entered when a file is chosen afterwards', async () => {
      fakeKitchen()
      const screen = await mountAddScreen('file')

      await nameField(screen).fill('Alps in March')
      await userEvent.upload(fileInput(screen), png('IMG_2041.png'))

      await expect.element(screen.getByText('IMG_2041.png')).toBeVisible()
      await expect.element(nameField(screen)).toHaveValue('Alps in March')
    })

    it('sends nothing without a name or without a file', async () => {
      const faked = fakeKitchen()
      const screen = await mountAddScreen('file')

      await addScreen(screen).click()

      await expect.element(nameField(screen)).toHaveAccessibleDescription('A Screen needs a name.')
      await expect.element(screen.getByText('Choose an image to upload.')).toBeVisible()
      expect(faked.writes).toEqual([])
    })

    it('says at the file why it was not added when the server cannot read it', async () => {
      fakeKitchen()
      api.use(http.post(apiUrl('screens'), () => apiErrorResponse({ statusCode: 422, code: 'image-unreadable' })))
      const screen = await mountAddScreen('file')

      await userEvent.upload(fileInput(screen), png('harbour.png'))
      await addScreen(screen).click()

      await expect.element(screen.getByText('This file is not an image Kuroshiro can read. Use PNG, JPEG, BMP, GIF, TIFF or WebP.')).toBeVisible()
      await expect.element(nameField(screen)).toHaveValue('harbour')
      expect(path(screen)).toBe('/devices/kitchen/screens/new?kind=file')
    })
  })

  describe('a File, refused for its size', () => {
    it('says at the file how large a file the Instance accepts', async () => {
      fakeKitchen()
      api.use(http.post(apiUrl('screens'), () => apiErrorResponse({ statusCode: 413, code: 'upload-too-large', details: { limitBytes: 10 * 1024 * 1024 } })))
      const screen = await mountAddScreen('file')

      await userEvent.upload(fileInput(screen), png('harbour.png'))
      await addScreen(screen).click()

      await expect.element(screen.getByText('That file is larger than the 10 MB this Instance accepts.')).toBeVisible()
    })
  })

  describe('an HTML Screen', () => {
    it('adds the markup as it was written, and opens its new row', async () => {
      const faked = fakeKitchen()
      fakeHtmlPreviewLibrary()
      const screen = await mountAddScreen('html')

      await nameField(screen).fill('Fridge note')
      await typeHtml(screen, 'Milk, eggs{Enter}')
      expect(document.querySelector('textarea')).toBeNull()
      await addScreen(screen).click()

      await expect.poll(() => path(screen)).toBe(OPENED_ON_THE_NEW_SCREEN)
      expect(faked.writes).toEqual([{ method: 'POST', path: 'screens', body: { kind: 'html', deviceId: 'kitchen', name: 'Fridge note', html: 'Milk, eggs\n' } }])
      await openedRow(screen, 'Fridge note')
    })

    it('previews the markup as it is typed, in the screen shell of the Device\'s Device Model and Palette', async () => {
      fakeKitchen()
      fakeHtmlPreviewLibrary()
      const screen = await mountAddScreen('html')

      await expect.element(screen.getByText('as Kitchen renders it: TRMNL OG (2-bit), Greyscale, 4 levels')).toBeVisible()
      await typeHtml(screen, 'Milk')
      await expect.poll(previewed).toContain('<div class="screen screen--og_plus screen--md screen--2bit" style="--screen-w: 800px;"><div class="view view--full">Milk</div></div>')

      await typeHtml(screen, ', eggs')
      await expect.poll(previewed).toContain('<div class="view view--full">Milk, eggs</div>')
      expect(htmlCode(screen)).toBe('Milk, eggs')
      await expect.element(screen.getByRole('group', { name: 'Preview of the new Screen' })).toBeVisible()
    })

    it('adds the Screen with Ctrl S in the editor', async () => {
      const faked = fakeKitchen()
      fakeHtmlPreviewLibrary()
      const screen = await mountAddScreen('html')

      await nameField(screen).fill('Fridge note')
      await typeHtml(screen, 'Milk')
      await userEvent.keyboard('{Control>}s{/Control}')

      await expect.poll(() => path(screen)).toBe(OPENED_ON_THE_NEW_SCREEN)
      expect(faked.writes).toEqual([{ method: 'POST', path: 'screens', body: { kind: 'html', deviceId: 'kitchen', name: 'Fridge note', html: 'Milk' } }])
    })

    it('sends nothing without a name or without markup', async () => {
      const faked = fakeKitchen()
      fakeHtmlPreviewLibrary()
      const screen = await mountAddScreen('html')

      await typeHtml(screen, '  ')
      await addScreen(screen).click()

      await expect.element(nameField(screen)).toHaveAccessibleDescription('A Screen needs a name.')
      await expect.element(htmlField(screen)).toHaveAccessibleDescription('Write the HTML this Screen is rendered from.')
      expect(faked.writes).toEqual([])
    })

    it('still takes the markup when the Device Models cannot be loaded, and says there is no preview', async () => {
      const faked = fakeKitchen()
      api.use(http.get(apiUrl('device-models'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })), http.get(apiUrl('device-models/palettes'), () => HttpResponse.json([buildPalette()])))
      const screen = await mountAddScreen('html')

      await expect.element(screen.getByText('Could not load the preview.')).toBeVisible()
      await nameField(screen).fill('Fridge note')
      await typeHtml(screen, 'Milk')
      await addScreen(screen).click()

      await expect.poll(() => faked.writes.length).toBe(1)
    })
  })

  it.each(['mashup', 'link', 'file', 'html'])('the %s kind is accessible and does not overflow', async (kind) => {
    fakeKitchen({ plugins: PLUGINS })
    fakeHtmlPreviewLibrary()
    const screen = await mountAddScreen(kind)
    await expect.element(addScreen(screen)).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
