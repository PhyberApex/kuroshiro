import type { Mounted } from './pluginPageHarness'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { API_KEY, fakeWeather, field, leave, LOCATION, read, save, SHOW_WIND, UNITS } from './pluginFieldsHarness'
import { fakePlugin, mountPlugin, refresh, saveBar } from './pluginPageHarness'

const section = (screen: Mounted) => screen.getByRole('heading', { name: 'Field Values', level: 2 })
const rowOf = (screen: Mounted, label: string) => screen.getByText(label, { exact: true }).element().closest('.field-value-row')!
const noteOf = (screen: Mounted, label: string) => read(rowOf(screen, label).querySelector('.note'))
const labelsOf = () => [...document.querySelectorAll('#values .field-value-row label.label')].map(read)

describe('the Field Values of a Plugin', () => {
  describe('the section', () => {
    it('is absent for a Plugin without Plugin Fields', async () => {
      fakePlugin()
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('heading', { name: 'Data Sources' })).toBeVisible()
      await expect.element(section(screen)).not.toBeInTheDocument()
      expect(document.getElementById('values')).toBeNull()
    })

    it('has one row per Plugin Field in their order, with what it says about the whole section', async () => {
      fakeWeather([LOCATION, UNITS, SHOW_WIND, API_KEY], { location: 'Lindenplatz' })
      const screen = await mountPlugin()

      await expect.element(section(screen)).toBeVisible()
      expect(document.getElementById('values')).toBe(section(screen).element().closest('section'))
      expect(labelsOf()).toEqual(['Location', 'Units', 'Show wind', 'API key'])
      await expect.element(screen.getByText('Every Device and every Mashup shows Weather with these values. To show it with other values somewhere, duplicate the Plugin.')).toBeVisible()
    })

    it('says "required" under the label of a required Plugin Field and shows its help text under the control', async () => {
      fakeWeather([LOCATION, UNITS], { location: 'Lindenplatz' })
      const screen = await mountPlugin()

      await expect.element(section(screen)).toBeVisible()
      expect(read(rowOf(screen, 'Location').querySelector('.required'))).toBe('required')
      expect(rowOf(screen, 'Units').querySelector('.required')).toBeNull()
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveAccessibleDescription('required A place name or a postcode.')
    })

    it('calls a Plugin Field without a label by its keyname', async () => {
      fakeWeather([field('station', { label: '' })])
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('textbox', { name: 'station' })).toBeVisible()
    })

    it('shows an author_bio Plugin Field as a line under the section, without a row', async () => {
      fakeWeather([LOCATION, field('author_bio', { label: 'About', type: 'author_bio', helpText: 'Made by Mika from the harbour office.' })])
      const screen = await mountPlugin()

      await expect.element(screen.getByText('Made by Mika from the harbour office.')).toBeVisible()
      expect(labelsOf()).toEqual(['Location'])
    })
  })

  describe('the control of each type', () => {
    it('is a text input with the default as its placeholder for single-line text, a url and a type Kuroshiro does not know', async () => {
      fakeWeather([field('place', { default: 'Hamburg' }), field('feed', { type: 'url' }), field('zone', { type: 'time_zone' })], { feed: 'https://feed.test' })
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('textbox', { name: 'place' })).toHaveAttribute('placeholder', 'Hamburg')
      await expect.element(screen.getByRole('textbox', { name: 'feed' })).toHaveValue('https://feed.test')
      await expect.element(screen.getByRole('textbox', { name: 'zone' })).toHaveValue('')
    })

    it('is a textarea for multi-line text and a number input for a number', async () => {
      fakeWeather([field('greeting', { type: 'text' }), field('days', { type: 'number' })], { greeting: 'Moin\nmoin', days: '3' })
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('textbox', { name: 'greeting' })).toHaveValue('Moin\nmoin')
      expect(screen.getByRole('textbox', { name: 'greeting' }).element().tagName).toBe('TEXTAREA')
      await expect.element(screen.getByRole('spinbutton', { name: 'days' })).toHaveValue(3)
    })

    it('is a switch that reads "On" or "Off" for on or off, and saves what it is switched to', async () => {
      const faked = fakeWeather([SHOW_WIND])
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('switch', { name: 'Show wind' })).not.toBeChecked()
      expect(read(rowOf(screen, 'Show wind').querySelector('.control-cell'))).toBe('Off')

      await screen.getByRole('switch', { name: 'Show wind' }).click()
      await expect.poll(() => read(rowOf(screen, 'Show wind').querySelector('.control-cell'))).toBe('On')
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { show_wind: 'true' } }])
    })

    it('is a select that lists the options, showing the default while nothing is chosen', async () => {
      const faked = fakeWeather([UNITS])
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('combobox', { name: 'Units' })).toHaveTextContent('Metric')
      await screen.getByRole('combobox', { name: 'Units' }).click()
      await expect.poll(() => screen.getByRole('option').elements().map(read)).toEqual(['Metric', 'Imperial'])

      await screen.getByRole('option', { name: 'Imperial' }).click()
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { units: 'imperial' } }])
    })
  })

  describe('a value', () => {
    it('is saved with "Save Plugin" and kept', async () => {
      const faked = fakeWeather([LOCATION, UNITS], { location: 'Lindenplatz' })
      const screen = await mountPlugin()

      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the Field Values. The preview already shows them.')).toBeVisible()
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { location: 'Marktplatz', units: null } }])
      await expect.element(saveBar(screen).getByRole('button', { name: 'Save Plugin' })).not.toBeInTheDocument()
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Marktplatz')
    })

    it('is cleared by emptying it, so that the default applies again', async () => {
      const faked = fakeWeather([field('place', { default: 'Hamburg' })], { place: 'Kiel' })
      const screen = await mountPlugin()

      await screen.getByRole('textbox', { name: 'place' }).fill('')
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { place: null } }])
      await expect.poll(() => noteOf(screen, 'place')).toBe('The default')
    })

    it('stays as entered when the server refuses the save', async () => {
      fakeWeather([LOCATION], { location: 'Lindenplatz' })
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({ statusCode: 400, code: 'bad-request' })))
      const screen = await mountPlugin()

      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await save(screen)

      await expect.element(saveBar(screen).getByRole('button', { name: 'Try again' })).toBeVisible()
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Marktplatz')
    })

    it('follows a re-read while it has no unsaved change, and is left alone while it has one', async () => {
      const faked = fakeWeather([LOCATION, field('place')], { location: 'Lindenplatz' })
      const screen = await mountPlugin()

      await screen.getByRole('textbox', { name: 'place' }).fill('Kiel')
      leave()
      faked.plugin = { ...faked.plugin, fieldValues: { ...faked.plugin.fieldValues, location: { secret: false, value: 'Rathaus' } } }
      refresh()
      await new Promise(resolve => setTimeout(resolve, 300))
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Lindenplatz')

      await saveBar(screen).getByRole('button', { name: 'Discard changes' }).click()
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Rathaus')
    })
  })

  describe('"Clear"', () => {
    it('shows for a select Field Value that is set, and empties it so the default applies again', async () => {
      const faked = fakeWeather([UNITS], { units: 'imperial' })
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('combobox', { name: 'Units' })).toHaveTextContent('Imperial')
      await screen.getByRole('button', { name: 'Clear Units' }).click()

      await expect.element(screen.getByRole('combobox', { name: 'Units' })).toHaveTextContent('Metric')
      await expect.poll(() => noteOf(screen, 'Units')).toBe('The default')
      expect(screen.getByRole('button', { name: 'Clear Units' }).query()).toBeNull()

      await save(screen)
      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { units: null } }])
    })

    it('shows for an on/off Field Value that is set, and empties it so the default applies again', async () => {
      const faked = fakeWeather([field('alerts', { type: 'boolean', default: 'true', label: 'Alerts' })], { alerts: 'false' })
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('switch', { name: 'Alerts' })).not.toBeChecked()
      await screen.getByRole('button', { name: 'Clear Alerts' }).click()

      await expect.element(screen.getByRole('switch', { name: 'Alerts' })).toBeChecked()
      await expect.poll(() => noteOf(screen, 'Alerts')).toBe('The default')
      expect(screen.getByRole('button', { name: 'Clear Alerts' }).query()).toBeNull()

      await save(screen)
      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { alerts: null } }])
    })

    it('is absent while the value is already empty, and for text, number or password rows', async () => {
      fakeWeather([UNITS, SHOW_WIND, LOCATION, field('days', { type: 'number' }), API_KEY])
      const screen = await mountPlugin()

      expect(screen.getByRole('button', { name: /^Clear /i }).query()).toBeNull()
    })

    it('reads "Empty" for a required select Field Value with no default, and sends null', async () => {
      const faked = fakeWeather([field('zone', { type: 'select', label: 'Zone', required: true, options: [{ label: 'North', value: 'north' }, { label: 'South', value: 'south' }] })], { zone: 'north' })
      const screen = await mountPlugin()

      await screen.getByRole('button', { name: 'Clear Zone' }).click()

      await expect.poll(() => noteOf(screen, 'Zone')).toBe('Empty')
      await save(screen)
      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { zone: null } }])
    })

    it('leaves the focus on the control once it is cleared', async () => {
      fakeWeather([UNITS], { units: 'imperial' })
      const screen = await mountPlugin()

      await screen.getByRole('button', { name: 'Clear Units' }).click()

      await expect.element(screen.getByRole('combobox', { name: 'Units' })).toHaveFocus()
    })
  })

  describe('a password', () => {
    it('that is stored shows dots and "Replace", and is left out of a save that did not touch it', async () => {
      const faked = fakeWeather([LOCATION, API_KEY], { location: 'Lindenplatz', api_key: 'stored-secret' })
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('button', { name: 'Replace API key' })).toBeVisible()
      expect(noteOf(screen, 'API key')).toBe('Set. A secret is never shown again.')
      expect(document.body.innerHTML).not.toContain('stored-secret')

      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { location: 'Marktplatz' } }])
    })

    it('is sent once "Replace" was pressed and another was typed', async () => {
      const faked = fakeWeather([API_KEY], { api_key: 'stored-secret' })
      const screen = await mountPlugin()

      await screen.getByRole('button', { name: 'Replace API key' }).click()
      await userEvent.keyboard('hunter2')
      await expect.poll(() => noteOf(screen, 'API key')).toBeUndefined()
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { api_key: 'hunter2' } }])
      await expect.element(screen.getByRole('button', { name: 'Replace API key' })).toBeVisible()
    })

    it('that was replaced and emptied again keeps the stored one', async () => {
      fakeWeather([API_KEY], { api_key: 'stored-secret' })
      const screen = await mountPlugin()

      await screen.getByRole('button', { name: 'Replace API key' }).click()
      await userEvent.keyboard('h{Backspace}')
      leave()

      await expect.element(screen.getByRole('button', { name: 'Replace API key' })).toBeVisible()
      await expect.element(saveBar(screen).getByRole('button', { name: 'Save Plugin' })).not.toBeInTheDocument()
    })

    it('that is not stored is a password input reading "Not set"', async () => {
      fakeWeather([field('token', { type: 'password' })])
      const screen = await mountPlugin()

      const input = document.getElementById('plugin-fieldValues-token') as HTMLInputElement
      await expect.element(screen.getByText('token', { exact: true })).toBeVisible()
      expect([input.type, input.placeholder]).toEqual(['password', 'Not set'])
    })
  })

  describe('the note at the right', () => {
    it('reads "The default" while the value equals the default', async () => {
      fakeWeather([UNITS, field('place', { default: 'Hamburg' })], { place: 'Kiel' })
      const screen = await mountPlugin()

      await expect.element(section(screen)).toBeVisible()
      expect(noteOf(screen, 'Units')).toBe('The default')
      expect(noteOf(screen, 'place')).toBeUndefined()

      await screen.getByRole('textbox', { name: 'place' }).fill('Hamburg')
      await expect.poll(() => noteOf(screen, 'place')).toBe('The default')
    })

    it('marks a required Plugin Field with neither a value nor a default as "Empty", in ink, and the Plugin still saves', async () => {
      const faked = fakeWeather([LOCATION, API_KEY, field('place')], {}, { needsValues: true })
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveAttribute('aria-invalid', 'true')
      expect(noteOf(screen, 'Location')).toBe('Empty')
      expect(noteOf(screen, 'API key')).toBe('Empty')
      expect(rowOf(screen, 'Location').querySelector('.note svg')).not.toBeNull()
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveAccessibleDescription('required Empty A place name or a postcode.')
      expect(elementsInSealColour(document.getElementById('values')!)).toEqual([])

      await screen.getByRole('textbox', { name: 'place' }).fill('Kiel')
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ fieldValues: { location: null, place: 'Kiel' } }])
    })
  })

  it('is accessible and does not scroll sideways', async () => {
    fakeWeather([LOCATION, UNITS, SHOW_WIND, API_KEY, field('greeting', { type: 'text', label: 'Greeting' }), field('days', { type: 'number', label: 'Days' }), field('token', { type: 'password', label: 'Token' })], { api_key: 'stored-secret', units: 'imperial', show_wind: 'true' }, { needsValues: true })
    const screen = await mountPlugin()

    await expect.element(section(screen)).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
