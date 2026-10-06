import type { DeviceSummary, PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import type { Mounted } from './pluginPageHarness'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, onTestFinished } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginDetail, buildPluginField } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { fakePlugin, fakePreviewLibrary, holdPreviewLibrary, mountPlugin, saveBar } from './pluginPageHarness'

const STARTER = `<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
</div>`

function weatherWith(overrides: Partial<PluginDetail> = {}) {
  return buildPluginDetail({
    id: 'weather',
    name: 'Weather',
    templates: [{ size: 'full', liquidMarkup: STARTER }],
    dataSources: [],
    ...overrides,
  })
}

/** The Plugin as the server answers a save of its Templates. */
function withTemplatesSaved(plugin: PluginDetail, input: UpdatePluginInput): PluginDetail {
  return { ...plugin, name: input.name ?? plugin.name, templates: input.templates ?? plugin.templates }
}

function fakeWeather(overrides: Partial<PluginDetail> = {}, devices?: DeviceSummary[]) {
  const faked = fakePlugin(weatherWith(overrides), withTemplatesSaved)
  if (devices)
    fakeShellReads({ devices })
  return faked
}

const editor = (screen: Mounted, size = 'Full') => screen.getByRole('textbox', { name: `Template of Weather, ${size}`, exact: true })

async function mountTemplate() {
  const screen = await mountPlugin()
  await expect.element(editor(screen)).toBeVisible()
  return screen
}

/** The document the plate drew last: the frame that arrived, or the one on its way. */
const drawn = () => [...document.querySelectorAll<HTMLIFrameElement>('#template iframe')].at(-1)?.srcdoc ?? ''

const read = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim()

const code = (screen: Mounted, size = 'Full') => [...editor(screen, size).element().querySelectorAll('.cm-line')].map(line => line.textContent).join('\n')

/** What the strip under the code says: the hint and the mode, a note, or the problem. */
const strip = () => read(document.querySelector('#template .code-editor .strip'))

/** Types at the end of the Template. The editor closes brackets and quotes itself. */
async function type(screen: Mounted, keys: string, size = 'Full') {
  await editor(screen, size).click()
  await userEvent.keyboard(`{Control>}{End}{/Control}${keys}`)
}

describe('the Template section of the Plugin page', () => {
  describe('editing the Liquid template', () => {
    it('marks the form as changed as it is typed, says that the preview shows it, and draws it', async () => {
      fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<span class="title">Weather</span>')

      await type(screen, '{Enter}Rain from 15:00')

      await expect.element(saveBar(screen).getByText('Unsaved changes to the template. The preview already shows them.')).toBeVisible()
      await expect.poll(drawn).toContain('Rain from 15:00')
    })

    it('saves the Plugin with Ctrl S in the editor, the Templates sent by size', async () => {
      const faked = fakeWeather()
      const screen = await mountTemplate()

      await type(screen, '{Enter}Rain')
      await userEvent.keyboard('{Control>}s{/Control}')

      await expect.poll(() => faked.saves).toEqual([{ templates: [{ size: 'full', liquidMarkup: `${STARTER}\nRain` }] }])
      await expect.element(screen.getByText(/^Saved at/)).toBeVisible()
    })

    it('sends no request while a Template is typed', async () => {
      fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<span class="title">Weather</span>')
      const asked: string[] = []
      const note = ({ request }: { request: Request }) => asked.push(`${request.method} ${new URL(request.url).pathname}`)
      api.events.on('request:start', note)
      onTestFinished(() => api.events.removeListener('request:start', note))

      await type(screen, '{Enter}Rain from 15:00')
      await expect.poll(drawn).toContain('Rain from 15:00')

      expect(asked).toEqual([])
    })

    it('draws the starter template with the Plugin\'s unsaved name', async () => {
      fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<span class="title">Weather</span>')

      await screen.router.push({ hash: '#name' })
      await screen.getByRole('textbox', { name: 'Name' }).fill('Forecast')

      await expect.poll(drawn).toContain('<span class="title">Forecast</span>')
    })

    it('draws a Field Value at once as it is changed in the form, a default where there is none and a password as dots', async () => {
      fakeWeather({
        templates: [{ size: 'full', liquidMarkup: '<p>{{ location }} in {{ trmnl.plugin_settings.custom_fields_values.units }}, key {{ api_key }}</p>' }],
        fields: [
          buildPluginField({ id: 'location', keyname: 'location', label: 'Location' }),
          buildPluginField({ id: 'units', keyname: 'units', label: 'Units', default: 'metric', order: 1 }),
          buildPluginField({ id: 'api_key', keyname: 'api_key', label: 'API key', type: 'password', order: 2 }),
        ],
        fieldValues: { location: { secret: false, value: 'Lindenplatz' }, units: { secret: false, value: null }, api_key: { secret: true, set: true } },
      })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>Lindenplatz in metric, key ••••••••</p>')

      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')

      await expect.poll(drawn, { timeout: 250 }).toContain('<p>Marktplatz in metric, key ••••••••</p>')
    })

    it('completes the names the preview reads and marks Kuroshiro\'s own filters', async () => {
      fakeWeather({
        fields: [buildPluginField({ keyname: 'location' })],
        fieldValues: { location: { secret: false, value: 'Lindenplatz' } },
      })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('Weather')
      const offered = () => [...document.querySelectorAll('.cm-tooltip-autocomplete li')].map(option => option.textContent)

      await type(screen, '{Enter}{{{{ loc')
      await expect.poll(offered).toContainEqual(expect.stringContaining('location'))

      await userEvent.keyboard('{Enter} | date_sh')
      await expect.poll(offered).toContainEqual(expect.stringMatching(/date_short.*Kuroshiro/))
    })
  })

  describe('the Templates a Plugin has', () => {
    const TWO = [
      { size: 'full' as const, liquidMarkup: '<p>full</p>' },
      { size: 'quadrant' as const, liquidMarkup: '<p>quarter</p>' },
    ]

    const lineOf = () => read(document.querySelector('#template .template-line .about'))
    const size = (screen: Mounted, name: string) => screen.getByRole('radiogroup', { name: 'Template' }).getByRole('radio', { name, exact: true })

    it('says one sentence for a Plugin with one Template, and offers one for a Mashup slot', async () => {
      fakeWeather()
      const screen = await mountTemplate()

      expect(lineOf()).toBe('One template. It is shown full screen and in every Mashup slot.')
      await expect.element(screen.getByRole('button', { name: 'Add a template for a Mashup slot' })).toBeVisible()
      expect(document.querySelector('#template [role="radiogroup"]')).toBeNull()
    })

    it('lists several in the order of the sizes and says what the chosen one is', async () => {
      fakeWeather({ templates: [TWO[1]!, { size: 'half_vertical', liquidMarkup: '<p>half</p>' }, TWO[0]!] })
      const screen = await mountTemplate()

      expect(screen.getByRole('radiogroup', { name: 'Template' }).getByRole('radio').elements().map(read)).toEqual(['Full', 'Half vertical', 'Quadrant'])
      expect(lineOf()).toBe('Full: the Screen on its own, and any Mashup slot that has no template of its own size.')

      await size(screen, 'Half vertical').click()
      await expect.element(editor(screen, 'Half vertical')).toBeVisible()
      expect(lineOf()).toBe('Half vertical: the left or right half of a Mashup. Remove this template')
      expect(code(screen, 'Half vertical')).toBe('<p>half</p>')
    })

    it('adds a missing size as a copy of Full, chosen and focused, edits it, removes it and puts it back, and saves the Templates by size', async () => {
      const faked = fakeWeather({ templates: [TWO[0]!] })
      const screen = await mountTemplate()

      await screen.getByRole('button', { name: 'Add a template for a Mashup slot' }).click()
      expect(screen.getByRole('menuitem').elements().map(read)).toEqual(['Half horizontal top or bottom', 'Half vertical left or right', 'Quadrant a quarter'])
      await screen.getByRole('menuitem', { name: 'Quadrant' }).click()

      await expect.element(editor(screen, 'Quadrant')).toHaveFocus()
      await expect.element(size(screen, 'Quadrant')).toBeChecked()
      expect(code(screen, 'Quadrant')).toBe('<p>full</p>')
      expect(lineOf()).toBe('Quadrant: a quarter of a Mashup. Remove this template')
      await expect.element(screen.getByRole('button', { name: 'Add a template', exact: true })).toBeVisible()

      await userEvent.keyboard('{Control>}{End}{/Control}{Enter}quarter')
      await expect.poll(drawn).toContain('<div class="view view--quadrant"><p>full</p>\nquarter</div>')

      await screen.getByRole('button', { name: 'Remove this template' }).click()
      await expect.element(screen.getByRole('button', { name: 'Put back' })).toHaveFocus()
      expect(lineOf()).toBe('Removed when you save. A quadrant slot then shows the full template. Put back')
      await expect.element(size(screen, 'Quadrant (removed)')).toBeChecked()
      await expect.element(editor(screen, 'Quadrant')).toHaveAttribute('aria-readonly', 'true')
      expect(strip()).toContain('This template is removed when you save.')
      expect(document.querySelector('[aria-label="Unsaved changes"]')).toBeNull()

      await screen.getByRole('button', { name: 'Put back' }).click()
      await expect.element(screen.getByRole('button', { name: 'Remove this template' })).toHaveFocus()
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.poll(() => faked.saves).toEqual([{ templates: [TWO[0], { size: 'quadrant', liquidMarkup: '<p>full</p>\nquarter' }] }])
      await expect.element(size(screen, 'Quadrant')).toBeChecked()
    })

    it('focuses the editor on the last size that was missing, when the menu goes with it', async () => {
      fakeWeather({ templates: [TWO[0]!, { size: 'half_horizontal', liquidMarkup: '<p>wide</p>' }, { size: 'half_vertical', liquidMarkup: '<p>tall</p>' }] })
      const screen = await mountTemplate()

      await screen.getByRole('button', { name: 'Add a template', exact: true }).click()
      await screen.getByRole('menuitem', { name: 'Quadrant' }).click()

      await expect.element(editor(screen, 'Quadrant')).toHaveFocus()
      expect(document.querySelector('#template .template-line [aria-haspopup="menu"]')).toBeNull()
    })

    it('leaves a removed Template out of the save, and the segment goes with it', async () => {
      const faked = fakeWeather({ templates: TWO })
      const screen = await mountTemplate()

      await size(screen, 'Quadrant').click()
      await screen.getByRole('button', { name: 'Remove this template' }).click()
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.poll(() => faked.saves).toEqual([{ templates: [TWO[0]] }])
      await expect.element(editor(screen, 'Full')).toBeVisible()
      await expect.poll(lineOf).toBe('One template. It is shown full screen and in every Mashup slot.')
    })

    it('keeps each Template\'s undo history while another one is shown', async () => {
      fakeWeather({ templates: TWO })
      const screen = await mountTemplate()

      await type(screen, ' sunny')
      await size(screen, 'Quadrant').click()
      await type(screen, ' cloudy', 'Quadrant')
      await size(screen, 'Full').click()
      await expect.element(editor(screen)).toBeVisible()
      expect(code(screen)).toBe('<p>full</p> sunny')

      await editor(screen).click()
      await userEvent.keyboard('{Control>}z{/Control}')

      await expect.poll(() => code(screen)).toBe('<p>full</p>')
      await size(screen, 'Quadrant').click()
      await expect.poll(() => code(screen, 'Quadrant')).toBe('<p>quarter</p> cloudy')
    })

    it('goes back to Full when the changes that added the chosen Template are discarded', async () => {
      fakeWeather({ templates: [TWO[0]!] })
      const screen = await mountTemplate()
      await screen.getByRole('button', { name: 'Add a template for a Mashup slot' }).click()
      await screen.getByRole('menuitem', { name: 'Half horizontal' }).click()
      await expect.element(editor(screen, 'Half horizontal')).toBeVisible()

      await saveBar(screen).getByRole('button', { name: 'Discard changes' }).click()

      await expect.element(editor(screen, 'Full')).toBeVisible()
      await expect.poll(lineOf).toBe('One template. It is shown full screen and in every Mashup slot.')
    })
  })

  describe('what the preview is for', () => {
    const kitchen = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })
    const hallway = buildDeviceSummary({ id: 'hallway', name: 'Hallway', deviceModel: { name: 'v2', label: 'TRMNL X', width: 1872, height: 1404, deprecated: false } })
    const bw = buildPalette({ id: 'bw', name: 'Black & White (1-bit)', grays: 2, frameworkClass: 'screen--1bit' })
    const gray4 = buildPalette({ id: 'gray-4', name: '4 Grays (2-bit)', grays: 4, frameworkClass: 'screen--2bit', usedBy: [{ id: 'kitchen', name: 'Kitchen' }] })
    const gray16 = buildPalette({ id: 'gray-16', name: '16 Grays (4-bit)', grays: 16, frameworkClass: 'screen--4bit', usedBy: [{ id: 'hallway', name: 'Hallway' }] })
    const og = buildDeviceModel({ name: 'og_plus', label: 'TRMNL OG (2-bit)', paletteIds: ['bw', 'gray-4'], cssClasses: ['screen--og_plus'] })
    const x = buildDeviceModel({ name: 'v2', label: 'TRMNL X', width: 1872, height: 1404, paletteIds: ['gray-16', 'gray-4', 'bw'], cssClasses: ['screen--v2'] })

    const assignedTo = (deviceId: string) => weatherWith().assignments.map(assignment => ({ ...assignment, deviceId }))

    function fakeHome(devices: DeviceSummary[], overrides: Partial<PluginDetail> = {}) {
      fakeWeather(overrides, devices)
      fakePreviewLibrary([x, og], [bw, gray4, gray16])
    }

    const previewFor = (screen: Mounted) => screen.getByRole('combobox', { name: 'Preview for' })
    const under = () => [...document.querySelectorAll('#template .preview-for > p')].map(read)

    async function choose(screen: Mounted, select: string, option: string) {
      await screen.getByRole('combobox', { name: select }).click()
      await screen.getByRole('option', { name: option, exact: true }).click()
    }

    it('starts for the first Device the Plugin is assigned to, with its facts and what the plate is not', async () => {
      fakeHome([hallway, kitchen], { assignments: assignedTo('kitchen') })
      const screen = await mountTemplate()

      await expect.element(previewFor(screen)).toHaveTextContent('Kitchen')
      expect(under()).toEqual(['TRMNL OG (2-bit) · 800 × 480 · 4 Grays (2-bit)', 'Your browser draws this. Kitchen shows it in 4 grays.'])
      await expect.poll(drawn).toContain('<div class="screen screen--og_plus screen--2bit"')
      await expect.element(screen.getByRole('group', { name: 'Preview of Weather' })).toBeVisible()
    })

    it('starts for the first Device there is when the Plugin is on none', async () => {
      fakeHome([hallway, kitchen], { assignments: [] })
      const screen = await mountTemplate()

      await expect.element(previewFor(screen)).toHaveTextContent('Hallway')
      expect(under()[0]).toBe('TRMNL X · 1872 × 1404 · 16 Grays (4-bit)')
    })

    it('draws for another Device, then for another Device Model and one of its Palettes, at that size', async () => {
      fakeHome([hallway, kitchen], { assignments: assignedTo('kitchen') })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<div class="screen screen--og_plus screen--2bit"')

      await choose(screen, 'Preview for', 'Hallway')
      await expect.poll(drawn).toContain('<div class="screen screen--v2 screen--4bit"')
      await expect.poll(under).toEqual(['TRMNL X · 1872 × 1404 · 16 Grays (4-bit)', 'Your browser draws this. Hallway shows it in 16 grays.'])

      await choose(screen, 'Preview for', 'Another Device Model')
      await expect.element(screen.getByRole('combobox', { name: 'Device Model' })).toHaveTextContent('TRMNL X')
      await expect.element(screen.getByRole('combobox', { name: 'Palette' })).toHaveTextContent('16 Grays (4-bit)')

      await choose(screen, 'Device Model', 'TRMNL OG (2-bit)')
      await expect.element(screen.getByRole('combobox', { name: 'Palette' })).toHaveTextContent('4 Grays (2-bit)')
      await choose(screen, 'Palette', 'Black & White (1-bit)')

      await expect.poll(drawn).toContain('<div class="screen screen--og_plus screen--1bit"')
      await expect.poll(under).toEqual(['800 × 480', 'Your browser draws this. The Device shows it in black and white.'])
      const frame = document.querySelector<HTMLIFrameElement>('#template iframe')!
      expect([frame.style.width, frame.style.height]).toEqual(['800px', '480px'])
      expect(document.querySelector('[aria-label="Unsaved changes"]')).toBeNull()
    })

    it('has no Device to choose with no Devices, and starts at TRMNL OG and 4 Grays', async () => {
      fakeHome([])
      const screen = await mountTemplate()

      await expect.element(screen.getByRole('combobox', { name: 'Device Model' })).toHaveTextContent('TRMNL OG (2-bit)')
      await expect.element(screen.getByRole('combobox', { name: 'Palette' })).toHaveTextContent('4 Grays (2-bit)')
      expect(document.querySelector('#template .preview-for')?.querySelectorAll('[role="combobox"]')).toHaveLength(2)
      expect(read(document.querySelector('#template .preview-for .label'))).toBe('Preview for')
      expect(under()).toEqual(['800 × 480', 'Your browser draws this. The Device shows it in 4 grays.'])
    })

    it('draws a slot size in its slot of a Mashup, the other slots empty, and says so', async () => {
      fakeHome([kitchen], { templates: [{ size: 'full', liquidMarkup: '<p>full</p>' }, { size: 'half_horizontal', liquidMarkup: '<p>half</p>' }] })
      const screen = await mountTemplate()

      await screen.getByRole('radio', { name: 'Half horizontal' }).click()

      await expect.poll(drawn).toContain('<div class="mashup mashup--1Tx1B"><div class="view view--half_horizontal"><p>half</p></div><div class="view view--half_horizontal"></div></div>')
      expect(under()[1]).toBe('Your browser draws this. Kitchen shows it in 4 grays, in the top or bottom half of a Mashup; the other slots are left empty here.')
    })

    describe('the device preview (ADR-0040)', () => {
      const seeItButton = (screen: Mounted) => screen.getByRole('button', { name: 'See it as Kitchen shows it' })

      it('draws it, then shows the image with the drawn-at line', async () => {
        fakeHome([kitchen], { assignments: assignedTo('kitchen') })
        let release = () => {}
        api.use(http.post(apiUrl('device-preview'), async () => {
          await new Promise<void>(resolve => (release = resolve))
          return new HttpResponse('png-bytes', { headers: { 'Content-Type': 'image/png', 'X-Render-Signal': 'none' } })
        }))
        const screen = await mountTemplate()
        await expect.poll(drawn).toContain('<span class="title">Weather</span>')

        await seeItButton(screen).click()

        await expect.element(screen.getByText('Drawing it as Kitchen shows it')).toBeVisible()
        await expect.element(seeItButton(screen)).toHaveAttribute('aria-busy', 'true')

        release()

        await expect.poll(drawn).toContain('<img src="data:image/png')
        await expect.poll(() => under().at(-1)).toMatch(/^As Kitchen shows it, in 4 grays, drawn at \d{2}:\d{2}\.$/)
        await expect.element(screen.getByRole('button', { name: 'Back to the browser drawing' })).toBeVisible()
      })

      it('reports a skip or hold Render Signal as a second line', async () => {
        fakeHome([kitchen], { assignments: assignedTo('kitchen') })
        api.use(http.post(apiUrl('device-preview'), () => new HttpResponse('png', { headers: { 'Content-Type': 'image/png', 'X-Render-Signal': 'hold' } })))
        const screen = await mountTemplate()

        await seeItButton(screen).click()

        await expect.element(screen.getByText('This content asks to keep its previous image.')).toBeVisible()
      })

      it('reads 429 as busy, and any other failure as "Could not draw it", offering "Try again"', async () => {
        fakeHome([kitchen], { assignments: assignedTo('kitchen') })
        let busy = true
        api.use(http.post(apiUrl('device-preview'), () => busy
          ? apiErrorResponse({ statusCode: 429, code: 'device-preview-busy' })
          : apiErrorResponse({ statusCode: 500, code: 'internal' })))
        const screen = await mountTemplate()

        await seeItButton(screen).click()
        await expect.element(screen.getByText('Another preview is being drawn. Try again in a moment.')).toBeVisible()

        busy = false
        await seeItButton(screen).click()
        await expect.element(screen.getByText('Could not draw it as Kitchen shows it.')).toBeVisible()
        await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
      })

      it('drops the device preview back to the browser drawing on an edit, and on "Back to the browser drawing"', async () => {
        fakeHome([kitchen], { assignments: assignedTo('kitchen') })
        api.use(http.post(apiUrl('device-preview'), () => new HttpResponse('png', { headers: { 'Content-Type': 'image/png' } })))
        const screen = await mountTemplate()
        await seeItButton(screen).click()
        await expect.poll(drawn).toContain('<img src="data:image/png')

        await type(screen, '{Enter}Rain')

        await expect.poll(drawn).toContain('Rain')
        expect(drawn()).not.toContain('<img src="data:image/png')
        await expect.element(seeItButton(screen)).toBeVisible()

        await seeItButton(screen).click()
        await expect.poll(drawn).toContain('<img src="data:image/png')
        await screen.getByRole('button', { name: 'Back to the browser drawing' }).click()

        await expect.poll(drawn).not.toContain('<img src="data:image/png')
        await expect.element(seeItButton(screen)).toBeVisible()
      })
    })
  })

  describe('a Template that cannot be parsed or rendered', () => {
    const note = () => read(document.querySelector('#template .plate .note'))
    const TWO = [
      { size: 'full' as const, liquidMarkup: '<p>full</p>' },
      { size: 'quadrant' as const, liquidMarkup: '<p>quarter</p>' },
    ]

    it('shows an unclosed tag 700 ms after the last keystroke and not before, keeps the last drawing dimmed, and leaves once it renders', async () => {
      fakeWeather({ templates: [TWO[0]!] })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>full</p>')

      await type(screen, '{Enter}{{% if rain')
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(strip()).toContain('Tab indents.')
      expect(note()).toBeUndefined()

      await expect.poll(strip).toBe('Line 2: tag {% if rain%} not closed Go to line 2')
      expect(note()).toBe('Not drawn. This is the last drawing.')
      await expect.poll(() => getComputedStyle(document.querySelector('#template iframe')!).opacity).toBe('0.4')
      expect(drawn()).toContain('<p>full</p></div>')
      await expect.element(editor(screen)).toHaveAttribute('aria-invalid', 'true')
      expect(elementsInSealColour(document.querySelector('#template')!)).toEqual([])

      await userEvent.keyboard('{Control>}{End}{/Control}{{% endif')
      await expect.poll(strip).toContain('Tab indents.')
      expect(note()).toBeUndefined()
      await expect.element(editor(screen)).not.toHaveAttribute('aria-invalid')
    })

    it('keeps the pause of a Template that is being typed when a Field Value changes meanwhile', async () => {
      fakeWeather({
        templates: [TWO[0]!],
        fields: [buildPluginField({ id: 'location', keyname: 'location', label: 'Location' })],
        fieldValues: { location: { secret: false, value: 'Lindenplatz' } },
      })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>full</p>')

      await type(screen, '{Enter}{{% if rain')
      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(strip()).toContain('Tab indents.')
      await expect.poll(strip).toContain('not closed')
    })

    it('blocks the save, counts in the save bar, and "Show the first" chooses that Template and puts the cursor at the place', async () => {
      const faked = fakeWeather({ templates: [TWO[0]!, { size: 'quadrant', liquidMarkup: '<p>quarter</p>\n{% if rain %}\n<p>umbrella</p>' }] })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>full</p>')
      await expect.element(screen.getByRole('radio', { name: 'Quadrant does not parse' })).toBeVisible()

      await type(screen, ' today')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(saveBar(screen).getByText('1 thing to fix before this can be saved.')).toBeVisible()
      expect(faked.saves).toEqual([])

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()

      await expect.element(editor(screen, 'Quadrant')).toHaveFocus()
      await expect.element(screen.getByRole('radio', { name: 'Quadrant does not parse' })).toBeChecked()
      await expect.poll(strip).toBe('Line 2: tag {% if rain %} not closed Go to line 2')
      await userEvent.keyboard('here ')
      await expect.poll(() => code(screen, 'Quadrant')).toBe('<p>quarter</p>\nhere {% if rain %}\n<p>umbrella</p>')
    })

    it('does not count a removed Template that cannot be parsed', async () => {
      const faked = fakeWeather({ templates: [TWO[0]!, { size: 'quadrant', liquidMarkup: '{% if rain %}' }] })
      const screen = await mountTemplate()

      await screen.getByRole('radio', { name: 'Quadrant does not parse' }).click()
      await screen.getByRole('button', { name: 'Remove this template' }).click()
      await expect.element(screen.getByRole('radio', { name: 'Quadrant (removed)' })).toBeChecked()
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.poll(() => faked.saves).toEqual([{ templates: [TWO[0]] }])
    })

    it('calls an empty Template invalid, with no line to go to and an empty plate where nothing was drawn', async () => {
      const faked = fakeWeather({ templates: [{ size: 'full', liquidMarkup: '' }] })
      const screen = await mountTemplate()

      await expect.poll(strip).toBe('A template cannot be empty.')
      expect(note()).toBe('Not drawn.')
      await expect.element(editor(screen)).toHaveAttribute('aria-invalid', 'true')

      await screen.router.push({ hash: '#name' })
      await screen.getByRole('textbox', { name: 'Name' }).fill('Forecast')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()
      await expect.element(saveBar(screen).getByText('1 thing to fix before this can be saved.')).toBeVisible()
      expect(faked.saves).toEqual([])
    })

    it('shows a Template that fails only at render as a problem, and lets it be saved', async () => {
      const faked = fakeWeather({ templates: [TWO[0]!] })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>full</p>')

      await type(screen, '{Enter}{{% render "shared"')

      await expect.poll(strip).toBe('Line 2: A template cannot render "shared": Kuroshiro has no partials. Go to line 2')
      expect(note()).toBe('Not drawn. This is the last drawing.')
      await expect.element(editor(screen)).not.toHaveAttribute('aria-invalid')

      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()
      await expect.poll(() => faked.saves).toEqual([{ templates: [{ size: 'full', liquidMarkup: '<p>full</p>\n{% render "shared"%}' }] }])
    })

    it('shows the server\'s template-invalid answer at the Template and the line it names, until that Template is edited', async () => {
      fakeWeather({ templates: TWO })
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({
        statusCode: 400,
        code: 'template-invalid',
        details: { size: 'quadrant', line: 1, message: 'the server reads Liquid more strictly' },
      })))
      const screen = await mountTemplate()

      await type(screen, ' today')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(saveBar(screen).getByText('1 thing to fix before this can be saved.')).toBeVisible()
      await expect.element(screen.getByRole('radio', { name: 'Quadrant does not parse' })).toBeVisible()
      expect(code(screen)).toBe('<p>full</p> today')

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()

      await expect.element(editor(screen, 'Quadrant')).toHaveFocus()
      await expect.poll(strip).toBe('Line 1: the server reads Liquid more strictly Go to line 1')
      await expect.element(editor(screen, 'Quadrant')).toHaveAttribute('aria-invalid', 'true')

      await userEvent.keyboard('x')
      await expect.poll(strip).toContain('Tab indents.')
      await expect.element(screen.getByRole('radio', { name: 'Quadrant', exact: true })).toBeChecked()
    })
  })

  describe('loading and failing', () => {
    it('holds the plate in its rendering state while the Device Models are on their way', async () => {
      fakeWeather()
      holdPreviewLibrary()
      const screen = await mountTemplate()

      await expect.element(screen.getByText('Loading the preview')).toBeVisible()
      expect(document.querySelector('#template iframe')).toBeNull()
      expect(document.querySelector('#template .preview-for')).toBeNull()
      expect(code(screen)).toBe(STARTER)
    })

    it('says that the preview could not be loaded, leaves the editor usable, and draws once "Try again" works', async () => {
      const faked = fakeWeather()
      api.use(http.get(apiUrl('device-models/palettes'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
      const screen = await mountTemplate()

      await expect.element(screen.getByText('Could not load the preview.')).toBeVisible()
      await type(screen, '{Enter}Rain')
      await userEvent.keyboard('{Control>}s{/Control}')
      await expect.poll(() => faked.saves).toHaveLength(1)

      await screen.getByRole('button', { name: 'Try again' }).click()
      await expect.poll(drawn).toContain('Rain')
    })

    it('keeps what was typed when a save fails, and says why in the save bar', async () => {
      fakeWeather()
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
      const screen = await mountTemplate()

      await type(screen, '{Enter}Rain')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.element(saveBar(screen).getByText(/^Not saved\. /)).toBeVisible()
      expect(code(screen)).toBe(`${STARTER}\nRain`)
      await expect.poll(drawn).toContain('Rain')
    })
  })

  it('is accessible and does not overflow, with a problem shown and a Template removed', async () => {
    fakeWeather({ templates: [{ size: 'full', liquidMarkup: '<p>full</p>\n{% if rain %}' }, { size: 'half_vertical', liquidMarkup: '<p>half</p>' }, { size: 'quadrant', liquidMarkup: '<p>quarter</p>' }] })
    const screen = await mountTemplate()
    await screen.getByRole('radio', { name: 'Quadrant' }).click()
    await screen.getByRole('button', { name: 'Remove this template' }).click()
    await screen.getByRole('radio', { name: 'Full does not parse' }).click()
    await expect.poll(strip).toContain('not closed')
    await arrived()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
