import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, onTestFinished } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildDeviceModel, buildDeviceModelList, buildPalette } from '@/testing/fixtures/device-models'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { fakeKitchen, kitchenScreen, openedRow, SCREENS_OF_EVERY_KIND } from './screensViewHarness'

type Mounted = Awaited<ReturnType<typeof mountApp>>

const FRIDGE_NOTE = kitchenScreen({ id: 'fridge', name: 'Fridge note', order: 6, kind: 'html', plugin: null, html: '<p>Back at six.</p>\n<p>{{ soup }}</p>' })

function fakeModels() {
  api.use(
    http.get(apiUrl('device-models'), () => HttpResponse.json(buildDeviceModelList({ models: [buildDeviceModel({ cssClasses: ['screen--og_plus', 'screen--md'] })] }))),
    http.get(apiUrl('device-models/palettes'), () => HttpResponse.json([buildPalette()])),
  )
}

function fakeFridgeNote() {
  const faked = fakeKitchen({ screens: [...SCREENS_OF_EVERY_KIND, FRIDGE_NOTE] })
  fakeModels()
  return faked
}

const editor = (screen: Mounted) => screen.getByRole('textbox', { name: 'HTML of Fridge note', exact: true })

const code = (screen: Mounted) => [...editor(screen).element().querySelectorAll('.cm-line')].map(line => line.textContent).join('\n')

/** Types at the end of the markup. The editor closes an HTML tag itself, so a test types words. */
async function type(screen: Mounted, keys: string) {
  await editor(screen).click()
  await userEvent.keyboard(`{Control>}{End}{/Control}${keys}`)
}

/** The document the preview plate drew last. */
const previewed = () => [...document.querySelectorAll('iframe')].at(-1)?.srcdoc ?? ''

const saveHtml = (screen: Mounted) => screen.getByRole('button', { name: 'Save HTML' })

const path = (screen: Mounted) => screen.router.currentRoute.value.fullPath

async function mountEditHtml(screenId = 'fridge') {
  const screen = await mountApp({ at: `/devices/kitchen/screens/${screenId}/html` })
  return screen
}

async function mountFridgeNote() {
  const screen = await mountEditHtml()
  await expect.element(editor(screen)).toBeVisible()
  return screen
}

describe('edit HTML', () => {
  it('loads the Screen\'s markup into the editor under the back link and the heading', async () => {
    fakeFridgeNote()
    const screen = await mountFridgeNote()

    await expect.element(screen.getByRole('heading', { level: 2, name: 'Edit Fridge note' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
    expect(code(screen)).toBe('<p>Back at six.</p>\n<p>{{ soup }}</p>')
  })

  it('shows the facts of what the preview is for, and what it is not', async () => {
    fakeFridgeNote()
    const screen = await mountFridgeNote()

    await expect.element(screen.getByText('Preview for Kitchen · TRMNL OG (2-bit) · 800 × 480 · Greyscale, 4 levels')).toBeVisible()
    await expect.element(screen.getByText('Your browser draws this. Kitchen shows it in 4 grays.')).toBeVisible()
    await expect.element(screen.getByRole('group', { name: 'Preview for Kitchen · TRMNL OG (2-bit) · 800 × 480 · Greyscale, 4 levels' })).toBeVisible()
  })

  it('previews the markup as it is typed, in the screen shell, and sends nothing', async () => {
    const faked = fakeFridgeNote()
    const screen = await mountFridgeNote()
    await expect.poll(previewed).toContain('<div class="view view--full"><p>Back at six.</p>')

    await type(screen, ' Soup')

    await expect.poll(previewed).toContain('<p>{{ soup }}</p> Soup</div>')
    expect(faked.writes).toEqual([])
  })

  it('saves the markup alone with "Save HTML" and opens the Screen\'s row', async () => {
    const faked = fakeFridgeNote()
    const screen = await mountFridgeNote()

    await type(screen, ' Soup')
    await saveHtml(screen).click()

    await expect.poll(() => path(screen)).toBe('/devices/kitchen?screen=fridge')
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/fridge', body: { html: '<p>Back at six.</p>\n<p>{{ soup }}</p> Soup' } }])
    await openedRow(screen, 'Fridge note')
    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('saves with Ctrl S in the editor', async () => {
    const faked = fakeFridgeNote()
    const screen = await mountFridgeNote()

    await type(screen, ' Soup')
    await userEvent.keyboard('{Control>}s{/Control}')

    await expect.poll(() => path(screen)).toBe('/devices/kitchen?screen=fridge')
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/fridge', body: { html: '<p>Back at six.</p>\n<p>{{ soup }}</p> Soup' } }])
  })

  it('names its mode "HTML" in the strip and shows Liquid\'s braces as written, unmarked', async () => {
    fakeFridgeNote()
    const screen = await mountFridgeNote()

    await expect.element(screen.getByText('HTML', { exact: true })).toBeVisible()
    expect(code(screen)).toContain('{{ soup }}')
    expect(editor(screen).element().closest('.code-editor')?.hasAttribute('data-invalid')).toBe(false)
    expect(editor(screen).element()).not.toHaveAttribute('aria-invalid')
  })

  it('returns to the Screen\'s row on "Cancel" without a request', async () => {
    const faked = fakeFridgeNote()
    const screen = await mountFridgeNote()

    await screen.getByRole('link', { name: 'Cancel' }).click()

    await expect.poll(() => path(screen)).toBe('/devices/kitchen?screen=fridge')
    expect(faked.writes).toEqual([])
  })

  describe('leaving with unsaved changes', () => {
    it('asks on a route change, stays on "Keep editing" with the text kept, and leaves on "Leave"', async () => {
      fakeFridgeNote()
      const screen = await mountFridgeNote()

      await type(screen, ' Soup')
      await screen.getByRole('link', { name: 'Kitchen\'s Screens' }).click()

      const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      await expect.element(question.getByText('Your changes to Fridge note\'s HTML.')).toBeVisible()
      await question.getByRole('button', { name: 'Keep editing' }).click()
      expect(path(screen)).toBe('/devices/kitchen/screens/fridge/html')
      expect(code(screen)).toBe('<p>Back at six.</p>\n<p>{{ soup }}</p> Soup')

      await screen.getByRole('link', { name: 'Kitchen\'s Screens' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()

      await expect.poll(() => path(screen)).toBe('/devices/kitchen')
    })

    it('does not ask without changes', async () => {
      fakeFridgeNote()
      const screen = await mountFridgeNote()

      await screen.getByRole('link', { name: 'Kitchen\'s Screens' }).click()

      await expect.poll(() => path(screen)).toBe('/devices/kitchen')
      expect(screen.getByRole('alertdialog').elements()).toEqual([])
    })
  })

  it('keeps the markup when the save is refused, says why and tries again', async () => {
    const faked = fakeFridgeNote()
    let refusing = true
    api.use(http.patch(apiUrl('screens/:id'), () => refusing ? apiErrorResponse({ statusCode: 403, code: 'demo-mode' }) : undefined))
    const screen = await mountFridgeNote()

    await type(screen, ' Soup')
    await saveHtml(screen).click()

    await expect.element(screen.getByText(/^Not saved\. /)).toBeVisible()
    expect(path(screen)).toBe('/devices/kitchen/screens/fridge/html')
    expect(code(screen)).toBe('<p>Back at six.</p>\n<p>{{ soup }}</p> Soup')

    refusing = false
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(() => path(screen)).toBe('/devices/kitchen?screen=fridge')
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/fridge', body: { html: '<p>Back at six.</p>\n<p>{{ soup }}</p> Soup' } }])
  })

  it('sends no empty markup', async () => {
    const faked = fakeFridgeNote()
    const screen = await mountFridgeNote()

    await editor(screen).click()
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}')
    await saveHtml(screen).click()

    await expect.element(screen.getByText('Not saved. Write the HTML this Screen is rendered from.')).toBeVisible()
    expect(faked.writes).toEqual([])
  })

  it.each([['a File Screen', 'photo'], ['a Screen that does not exist', 'gone']])('shows the empty state and no editor for %s', async (_, screenId) => {
    fakeFridgeNote()
    const screen = await mountEditHtml(screenId)

    await expect.element(screen.getByRole('heading', { level: 2, name: 'No HTML Screen here' })).toBeVisible()
    await expect.element(screen.getByRole('main').getByRole('link', { name: 'Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
    expect(document.querySelector('.code-editor')).toBeNull()
    await expectAccessible()
  })

  it('says so when the Screens cannot be read', async () => {
    fakeFridgeNote()
    api.use(http.get(apiUrl('devices/kitchen/screens'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    const screen = await mountEditHtml()

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load Kitchen\'s Screens. Something went wrong on the server.')
    expect(document.querySelector('.code-editor')).toBeNull()
  })

  it('stacks the editor above the preview on a phone', async () => {
    fakeFridgeNote()
    const screen = await mountFridgeNote()
    onTestFinished(resetViewport)

    await resizeTo(375)

    const editorBox = editor(screen).element().closest('.code-editor')!.getBoundingClientRect()
    const plateBox = screen.getByRole('group', { name: 'Preview of Fridge note' }).element().getBoundingClientRect()
    expect(editorBox.bottom).toBeLessThanOrEqual(plateBox.top)
    expect(editorBox.width).toBeGreaterThan(300)
    expect(plateBox.width).toBeGreaterThan(300)
  })

  it('shows the loading line while the Screens are on their way', async () => {
    fakeFridgeNote()
    api.use(http.get(apiUrl('devices/kitchen/screens'), async () => {
      await delay('infinite')
    }))
    const screen = await mountEditHtml()

    await expect.element(screen.getByText('Loading Kitchen\'s Screens')).toBeVisible()
  })

  it('is accessible and does not overflow', async () => {
    fakeFridgeNote()
    await mountFridgeNote()
    await arrived()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
