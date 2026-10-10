import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, onTestFinished } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { codeIn, fakeHtmlPreviewLibrary, previewed, replaceAll, typeAtEnd } from './htmlScreenHarness'
import { fakeKitchen, kitchenScreen, openedRow, SCREENS_OF_EVERY_KIND } from './screensViewHarness'

type Mounted = Awaited<ReturnType<typeof mountApp>>

const FRIDGE_NOTE = kitchenScreen({ id: 'fridge', name: 'Fridge note', order: 6, kind: 'html', plugin: null, html: '<p>Back at six.</p>\n<p>{{ soup }}</p>' })

function fakeFridgeNote() {
  const faked = fakeKitchen({ screens: [...SCREENS_OF_EVERY_KIND, FRIDGE_NOTE] })
  fakeHtmlPreviewLibrary()
  return faked
}

const editor = (screen: Mounted) => screen.getByRole('textbox', { name: 'HTML of Fridge note', exact: true })

const code = (screen: Mounted) => codeIn(editor(screen))

const type = (screen: Mounted, keys: string) => typeAtEnd(editor(screen), keys)

const saveHtml = (screen: Mounted) => screen.getByRole('button', { name: 'Save HTML' })

const path = (screen: Mounted) => screen.router.currentRoute.value.fullPath

function mountEditHtml(screenId = 'fridge') {
  return mountApp({ at: `/devices/kitchen/screens/${screenId}/html` })
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

  it('blocks "Save HTML" on empty markup, checked in the browser, and clears once markup is written again', async () => {
    const faked = fakeFridgeNote()
    const screen = await mountFridgeNote()

    await replaceAll(editor(screen), '  ')
    await saveHtml(screen).click()

    await expect.element(editor(screen)).toHaveAccessibleDescription('Write the HTML this Screen is rendered from.')
    expect(editor(screen).element().closest('.code-editor')).toHaveAttribute('data-invalid')
    expect(faked.writes).toEqual([])

    await replaceAll(editor(screen), 'Milk')
    await saveHtml(screen).click()

    await expect.poll(() => path(screen)).toBe('/devices/kitchen?screen=fridge')
    expect(faked.writes).toEqual([{ method: 'PATCH', path: 'screens/fridge', body: { html: 'Milk' } }])
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

  describe('the device preview (ADR-0040)', () => {
    const seeItButton = (screen: Mounted) => screen.getByRole('button', { name: 'See it as Kitchen shows it' })
    const honest = () => document.querySelector('.html-preview .honest')?.textContent

    it('draws it, then shows the image with the Render Signal none raises no second line', async () => {
      fakeFridgeNote()
      let release = () => {}
      api.use(http.post(apiUrl('device-preview'), async () => {
        await new Promise<void>(resolve => (release = resolve))
        return new HttpResponse('png-bytes', { headers: { 'Content-Type': 'image/png', 'X-Render-Signal': 'none' } })
      }))
      const screen = await mountFridgeNote()
      await expect.poll(previewed).toContain('<p>Back at six.</p>')

      await seeItButton(screen).click()

      await expect.element(screen.getByText('Drawing it as Kitchen shows it')).toBeVisible()
      await expect.element(seeItButton(screen)).toHaveAttribute('aria-busy', 'true')

      release()

      // Turning the response into the data: URL shown in the preview is a real FileReader round trip; on a
      // loaded CI runner under coverage, that has taken past the default 1 s poll.
      await expect.poll(() => previewed(), { timeout: 5000 }).toContain('<img src="data:image/png')
      await expect.poll(honest).toMatch(/^As Kitchen shows it, in 4 grays, drawn at \d{2}:\d{2}\.$/)
      expect(document.querySelector('.html-preview .honest + .honest')).toBeNull()
      await expect.element(screen.getByRole('button', { name: 'Back to the browser drawing' })).toBeVisible()
    })

    it('reports a skip or hold Render Signal as a second line', async () => {
      fakeFridgeNote()
      api.use(http.post(apiUrl('device-preview'), () => new HttpResponse('png', { headers: { 'Content-Type': 'image/png', 'X-Render-Signal': 'skip' } })))
      const screen = await mountFridgeNote()

      await seeItButton(screen).click()

      await expect.element(screen.getByText('This content asks to be skipped.')).toBeVisible()
    })

    it('reads 429 as busy, and any other failure as "Could not draw it", offering "Try again"', async () => {
      fakeFridgeNote()
      let busy = true
      api.use(http.post(apiUrl('device-preview'), () => busy
        ? apiErrorResponse({ statusCode: 429, code: 'device-preview-busy' })
        : apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountFridgeNote()

      await seeItButton(screen).click()
      await expect.element(screen.getByText('Another preview is being drawn. Try again in a moment.')).toBeVisible()

      busy = false
      await seeItButton(screen).click()
      await expect.element(screen.getByText('Could not draw it as Kitchen shows it.')).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    })

    it('drops the device preview back to the browser drawing on an edit, and on "Back to the browser drawing"', async () => {
      fakeFridgeNote()
      api.use(http.post(apiUrl('device-preview'), () => new HttpResponse('png', { headers: { 'Content-Type': 'image/png' } })))
      const screen = await mountFridgeNote()
      await seeItButton(screen).click()
      await expect.poll(() => previewed()).toContain('<img src="data:image/png')

      await type(screen, ' Soup')

      await expect.poll(honest).toBe('Your browser draws this. Kitchen shows it in 4 grays.')
      await expect.poll(previewed).not.toContain('<img src="data:image/png')

      await seeItButton(screen).click()
      await expect.poll(() => previewed()).toContain('<img src="data:image/png')
      await screen.getByRole('button', { name: 'Back to the browser drawing' }).click()

      await expect.poll(honest).toBe('Your browser draws this. Kitchen shows it in 4 grays.')
      await expect.poll(previewed).not.toContain('<img src="data:image/png')
    })
  })
})
