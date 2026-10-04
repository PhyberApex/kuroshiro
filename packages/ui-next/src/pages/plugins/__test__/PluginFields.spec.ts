import type { Mounted } from './pluginPageHarness'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { API_KEY, fakeWeather, field, leave, LOCATION, read, save, UNITS } from './pluginFieldsHarness'
import { mountPlugin, saveBar } from './pluginPageHarness'

const title = (screen: Mounted, count?: number) => screen.getByRole('button', { name: count === undefined ? 'Plugin Fields' : `Plugin Fields · ${count}`, exact: true })

async function mountOpened(count?: number) {
  const screen = await mountPlugin()
  await title(screen, count).click()
  await expect.element(screen.getByRole('button', { name: 'Add a Plugin Field' })).toBeVisible()
  return screen
}

const rowsOf = () => [...document.querySelectorAll('#fields .plugin-field-row')]
const keynamesOf = () => rowsOf().map(row => read(row.querySelector('.keyname')))
const rowOf = (keyname: string) => rowsOf().find(row => read(row.querySelector('.keyname')) === keyname)!
const lineOf = (keyname: string) => [...rowOf(keyname).querySelectorAll('.line > :is(.keyname, .label, .type, .removal)')].map(read)
const valueLabels = () => [...document.querySelectorAll('#values .field-value-row label.label')].map(read)

const edit = (screen: Mounted, keyname: string) => screen.getByRole('button', { name: `Edit ${keyname}`, exact: true })
const form = (screen: Mounted, keyname: string) => screen.getByRole('region', { name: `Plugin Field ${keyname}`, exact: true })

async function open(screen: Mounted, keyname: string) {
  await edit(screen, keyname).click()
  await expect.element(form(screen, keyname)).toBeVisible()
  return form(screen, keyname)
}

const sentFields = (saves: { fields?: { keyname: string }[] }[]) => saves.map(sent => sent.fields?.map(one => one.keyname))

describe('the Plugin Fields of a Plugin', () => {
  describe('the tucked section', () => {
    it('is closed, counts the Plugin Fields in its title and says what a Plugin Field is', async () => {
      fakeWeather([LOCATION, UNITS, API_KEY])
      const screen = await mountPlugin()

      await expect.element(title(screen, 3)).toHaveAttribute('aria-expanded', 'false')
      await title(screen, 3).click()

      await expect.element(screen.getByText('A Plugin Field is one input this Plugin asks you to fill in. What you enter is its Field Value, which templates and Data Sources read by the keyname.')).toBeVisible()
      expect(document.getElementById('fields')).toBe(title(screen, 3).element().closest('.tucked-section'))
      expect(document.getElementById('fields')!.textContent).not.toContain('These arrived with the Recipe')
    })

    it('says of a Recipe\'s Plugin that its Plugin Fields arrived with the Recipe', async () => {
      fakeWeather([LOCATION], {}, { recipe: { id: '41120', name: 'Weather', importedAt: '2026-09-12T09:20:00.000Z', snapshotTakenAt: null } })
      const screen = await mountOpened(1)

      expect(read(document.querySelector('#fields .about'))).toBe('A Plugin Field is one input this Plugin asks you to fill in. What you enter is its Field Value, which templates and Data Sources read by the keyname. These arrived with the Recipe; a Recipe Update Check may offer changes to them.')
      await expect.element(screen.getByRole('button', { name: 'Add a Plugin Field' })).toBeVisible()
    })

    it('reads "{Plugin} declares none." for a Plugin without one, and its title has no count', async () => {
      fakeWeather([])
      const screen = await mountOpened()

      await expect.element(screen.getByText('Weather declares none.')).toBeVisible()
      expect(rowsOf()).toEqual([])
    })
  })

  describe('a row', () => {
    it('shows the keyname, the label with "· required", the type and "Edit"', async () => {
      fakeWeather([LOCATION, UNITS, field('feed', { type: 'url', label: '' }), field('author_bio', { type: 'author_bio', label: 'About' })])
      const screen = await mountOpened(4)

      expect(lineOf('location')).toEqual(['location', 'Location · required', 'Single-line text'])
      expect(lineOf('units')).toEqual(['units', 'Units', 'Select'])
      expect(lineOf('feed')).toEqual(['feed', 'no label', 'Single-line text'])
      expect(lineOf('author_bio')).toEqual(['author_bio', 'About', 'Credit, read-only'])
      await expect.element(edit(screen, 'location')).toBeVisible()
    })

    it('opens its form in place with "Edit", which becomes "Done"', async () => {
      fakeWeather([LOCATION, UNITS])
      const screen = await mountOpened(2)

      const opened = await open(screen, 'units')

      await expect.element(opened.getByRole('textbox', { name: 'Keyname' })).toHaveValue('units')
      await expect.element(opened.getByRole('textbox', { name: 'Keyname' })).toHaveAccessibleDescription('Templates and Data Sources read {{ units }}. Changing it starts the Field Value over.')
      await expect.element(opened.getByRole('textbox', { name: 'Label' })).toHaveValue('Units')
      await expect.element(opened.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Select')
      await expect.element(opened.getByRole('textbox', { name: 'Default' })).toHaveValue('metric')
      await expect.element(opened.getByRole('textbox', { name: 'Options' })).toHaveValue('Metric\nImperial')
      await expect.element(opened.getByRole('textbox', { name: 'Options' })).toHaveAccessibleDescription('One per line.')
      await expect.element(opened.getByRole('textbox', { name: 'Help text' })).toHaveValue('')
      await expect.element(opened.getByRole('checkbox', { name: 'Required' })).not.toBeChecked()

      const done = screen.getByRole('button', { name: 'Done editing units', exact: true })
      await expect.element(done).toHaveTextContent('Done')
      await done.click()
      await expect.element(edit(screen, 'units')).toHaveTextContent('Edit')
    })

    it('offers the six types, a Default only where there is one to give and Options only for a Select', async () => {
      fakeWeather([LOCATION])
      const screen = await mountOpened(1)
      const opened = await open(screen, 'location')

      expect(opened.getByRole('textbox', { name: 'Options' }).elements()).toEqual([])
      await opened.getByRole('combobox', { name: 'Type' }).click()
      await expect.poll(() => screen.getByRole('option').elements().map(read)).toEqual(['Single-line text', 'Multi-line text', 'Number', 'On or off', 'Password', 'Select'])

      await screen.getByRole('option', { name: 'Password' }).click()
      await expect.poll(() => opened.getByRole('textbox', { name: 'Default' }).elements()).toEqual([])
    })

    it('of an author_bio Plugin Field cannot change its type', async () => {
      fakeWeather([field('author_bio', { type: 'author_bio', label: 'About' })])
      const screen = await mountOpened(1)
      const opened = await open(screen, 'author_bio')

      await expect.element(opened.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Credit, read-only')
      await expect.element(opened.getByRole('combobox', { name: 'Type' })).toBeDisabled()
    })
  })

  describe('a change', () => {
    it('to the label, the type and the help text shows under Field Values at once, and is saved as the whole set', async () => {
      const faked = fakeWeather([LOCATION, UNITS], { location: 'Lindenplatz' })
      const screen = await mountOpened(2)
      const opened = await open(screen, 'location')

      await opened.getByRole('textbox', { name: 'Label' }).fill('Place')
      await opened.getByRole('textbox', { name: 'Help text' }).fill('Where you are.')
      await opened.getByRole('combobox', { name: 'Type' }).click()
      await screen.getByRole('option', { name: 'Multi-line text' }).click()

      await expect.poll(valueLabels).toEqual(['Place', 'Units'])
      await expect.element(screen.getByRole('textbox', { name: 'Place' })).toHaveAccessibleDescription('required Where you are.')
      expect(screen.getByRole('textbox', { name: 'Place' }).element().tagName).toBe('TEXTAREA')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the Plugin Fields.')).toBeVisible()

      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{
        fields: [
          { keyname: 'location', name: 'Place', fieldType: 'text', description: 'Where you are.', options: null, required: true, order: 0 },
          { keyname: 'units', name: 'Units', fieldType: 'select', defaultValue: 'metric', options: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }], required: false, order: 1 },
        ],
      }])
      await expect.element(screen.getByRole('textbox', { name: 'Place' })).toHaveValue('Lindenplatz')
    })

    it('of the keyname starts the Field Value over, and the value comes back with the keyname', async () => {
      const faked = fakeWeather([LOCATION], { location: 'Lindenplatz' })
      const screen = await mountOpened(1)
      const opened = await open(screen, 'location')

      await opened.getByRole('textbox', { name: 'Keyname' }).fill('place')
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('')

      await screen.getByRole('region', { name: 'Plugin Field place' }).getByRole('textbox', { name: 'Keyname' }).fill('location')
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Lindenplatz')
      await expect.element(saveBar(screen).getByRole('button', { name: 'Save Plugin' })).not.toBeInTheDocument()

      await opened.getByRole('textbox', { name: 'Keyname' }).fill('place')
      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the Field Values and Plugin Fields.')).toBeVisible()
      await save(screen)

      await expect.poll(() => sentFields(faked.saves)).toEqual([['place']])
      expect(faked.saves[0]!.fieldValues).toEqual({ place: 'Marktplatz' })
    })

    it('of a stored password to another type clears the password at the save, so it is never read back', async () => {
      const faked = fakeWeather([API_KEY], { api_key: 'stored-secret' })
      const screen = await mountOpened(1)
      const opened = await open(screen, 'api_key')

      await opened.getByRole('combobox', { name: 'Type' }).click()
      await screen.getByRole('option', { name: 'Single-line text' }).click()

      await expect.element(screen.getByRole('textbox', { name: 'API key' })).toHaveValue('')
      expect(read(document.querySelector('#values .note'))).toBe('Empty')
      await save(screen)

      await expect.poll(() => faked.saves.map(sent => sent.fieldValues)).toEqual([{ api_key: null }])
      expect(faked.saves[0]!.fields![0]!.fieldType).toBe('string')
    })

    it('of a stored password to another type and back keeps the password', async () => {
      fakeWeather([API_KEY], { api_key: 'stored-secret' })
      const screen = await mountOpened(1)
      const opened = await open(screen, 'api_key')

      await opened.getByRole('combobox', { name: 'Type' }).click()
      await screen.getByRole('option', { name: 'Single-line text' }).click()
      await expect.element(screen.getByRole('textbox', { name: 'API key' })).toBeVisible()
      await opened.getByRole('combobox', { name: 'Type' }).click()
      await screen.getByRole('option', { name: 'Password' }).click()

      await expect.element(screen.getByRole('button', { name: 'Replace API key' })).toBeVisible()
      await expect.element(saveBar(screen).getByRole('button', { name: 'Save Plugin' })).not.toBeInTheDocument()
    })

    it('to a Select lists the options it was given under Field Values', async () => {
      fakeWeather([LOCATION])
      const screen = await mountOpened(1)
      const opened = await open(screen, 'location')

      await opened.getByRole('combobox', { name: 'Type' }).click()
      await screen.getByRole('option', { name: 'Select' }).click()
      await opened.getByRole('textbox', { name: 'Options' }).fill('Lindenplatz\nMarktplatz')
      leave()

      await screen.getByRole('combobox', { name: 'Location' }).click()
      await expect.poll(() => screen.getByRole('option').elements().map(read)).toEqual(['Lindenplatz', 'Marktplatz'])
    })
  })

  describe('"Add a Plugin Field"', () => {
    it('appends an opened Single-line text with its keyname selected, which has its row under Field Values before it is saved', async () => {
      const faked = fakeWeather([LOCATION], { location: 'Lindenplatz' })
      const screen = await mountOpened(1)

      await screen.getByRole('button', { name: 'Add a Plugin Field' }).click()

      const keyname = form(screen, 'field').getByRole('textbox', { name: 'Keyname' })
      await expect.element(keyname).toHaveFocus()
      await expect.element(form(screen, 'field').getByRole('combobox', { name: 'Type' })).toHaveTextContent('Single-line text')
      await expect.element(title(screen, 2)).toBeVisible()
      await userEvent.keyboard('station')
      await expect.poll(valueLabels).toEqual(['Location', 'station'])

      await screen.getByRole('textbox', { name: 'station', exact: true }).fill('Hbf')
      await save(screen)

      await expect.poll(() => sentFields(faked.saves)).toEqual([['location', 'station']])
      expect(faked.saves[0]!.fields![1]).toEqual({ keyname: 'station', name: '', fieldType: 'string', options: null, required: false, order: 1 })
      expect(faked.saves[0]!.fieldValues).toEqual({ location: 'Lindenplatz', station: 'Hbf' })
      await expect.element(form(screen, 'station')).toBeVisible()
      await expect.element(screen.getByRole('textbox', { name: 'station', exact: true })).toHaveValue('Hbf')
    })

    it('gives a Plugin without Plugin Fields its Field Values section', async () => {
      fakeWeather([])
      const screen = await mountOpened()

      await screen.getByRole('button', { name: 'Add a Plugin Field' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Field Values', level: 2 })).toBeVisible()
      await expect.poll(valueLabels).toEqual(['field'])
      expect(document.getElementById('fields')!.textContent).not.toContain('declares none')
    })
  })

  describe('"Remove Plugin Field"', () => {
    it('strikes the row through until the save, takes its row from the Field Values, and "Put back" restores both', async () => {
      const faked = fakeWeather([LOCATION, UNITS], { location: 'Lindenplatz' })
      const screen = await mountOpened(2)
      const opened = await open(screen, 'location')

      await opened.getByRole('button', { name: 'Remove Plugin Field' }).click()

      await expect.poll(() => lineOf('location')).toEqual(['location', 'Location · required', 'Removed when you save, with its Field Value · Put back'])
      expect(getComputedStyle(rowOf('location').querySelector('.keyname')!).textDecorationLine).toBe('line-through')
      expect(valueLabels()).toEqual(['Units'])
      await expect.element(title(screen, 1)).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'Put back location' })).toHaveFocus()

      await screen.getByRole('button', { name: 'Put back location' }).click()
      await expect.poll(valueLabels).toEqual(['Location', 'Units'])
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Lindenplatz')
      await expect.element(saveBar(screen).getByRole('button', { name: 'Save Plugin' })).not.toBeInTheDocument()

      await open(screen, 'location')
      await form(screen, 'location').getByRole('button', { name: 'Remove Plugin Field' }).click()
      await save(screen)

      await expect.poll(() => sentFields(faked.saves)).toEqual([['units']])
      expect(faked.saves[0]!.fields![0]!.order).toBe(0)
      await expect.poll(keynamesOf).toEqual(['units'])
    })

    it('takes a Plugin Field that was never saved out at once', async () => {
      fakeWeather([LOCATION])
      const screen = await mountOpened(1)

      await screen.getByRole('button', { name: 'Add a Plugin Field' }).click()
      await form(screen, 'field').getByRole('button', { name: 'Remove Plugin Field' }).click()

      await expect.poll(keynamesOf).toEqual(['location'])
      await expect.element(saveBar(screen).getByRole('button', { name: 'Save Plugin' })).not.toBeInTheDocument()
      await expect.element(screen.getByRole('button', { name: 'Add a Plugin Field' })).toHaveFocus()
    })
  })

  describe('the rules', () => {
    it('of a keyname and of a Select stop the save, each with its message, and "Show the first" opens the section and the row', async () => {
      const faked = fakeWeather([LOCATION, UNITS, API_KEY, field('feed'), field('station')])
      const screen = await mountOpened(5)

      await (await open(screen, 'location')).getByRole('textbox', { name: 'Keyname' }).fill('2 fast')
      await (await open(screen, 'units')).getByRole('textbox', { name: 'Options' }).fill('')
      await form(screen, 'units').getByRole('textbox', { name: 'Keyname' }).fill('trmnl')
      await (await open(screen, 'feed')).getByRole('textbox', { name: 'Keyname' }).fill('api_key')
      await (await open(screen, 'station')).getByRole('textbox', { name: 'Keyname' }).fill('')
      await title(screen, 5).click()
      await save(screen)

      await expect.element(saveBar(screen).getByText('5 things to fix before this can be saved.')).toBeVisible()
      expect(faked.saves).toEqual([])

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()
      const first = screen.getByRole('region', { name: 'Plugin Field 2 fast' })
      await expect.element(first.getByRole('textbox', { name: 'Keyname' })).toHaveFocus()
      await expect.element(first.getByText('Use letters, digits and underscores, starting with a letter.')).toBeVisible()

      await open(screen, 'trmnl')
      await expect.element(screen.getByText('`trmnl` is taken by Kuroshiro.')).toBeVisible()
      await expect.element(screen.getByText('A Select needs at least one option.')).toBeVisible()
      await edit(screen, 'api_key').last().click()
      await expect.element(screen.getByText('Another Plugin Field is called api_key.')).toBeVisible()
    })

    it('refuse a keyname that is the name of a Data Source, on both sides', async () => {
      const faked = fakeWeather([LOCATION])
      const screen = await mountOpened(1)

      await (await open(screen, 'location')).getByRole('textbox', { name: 'Keyname' }).fill('forecast')
      await save(screen)

      await expect.element(saveBar(screen).getByText('2 things to fix before this can be saved.')).toBeVisible()
      await expect.element(form(screen, 'forecast').getByText('forecast is already the name of a Data Source.')).toBeVisible()
      expect(faked.saves).toEqual([])

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()
      await expect.element(screen.getByText('forecast is already the keyname of a Plugin Field.')).toBeVisible()
    })

    it('show what the server refuses a keyname for under it, and keep what was entered', async () => {
      fakeWeather([LOCATION])
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({
        statusCode: 400,
        code: 'validation',
        fields: [{ path: 'fields.0.keyname', message: 'Plugin field keyname "sky" collides with a data source\'s name' }],
      })))
      const screen = await mountOpened(1)
      const opened = await open(screen, 'location')

      await opened.getByRole('textbox', { name: 'Keyname' }).fill('sky')
      await save(screen)

      const refused = form(screen, 'sky')
      await expect.element(refused.getByText('Plugin field keyname "sky" collides with a data source\'s name')).toBeVisible()
      await expect.element(refused.getByRole('textbox', { name: 'Keyname' })).toHaveValue('sky')
    })
  })

  describe('reordering', () => {
    it('by keyboard: the grip lifts the row, the arrows move it and say its place, and the saved Plugin Fields carry the order', async () => {
      const faked = fakeWeather([LOCATION, UNITS, API_KEY])
      const screen = await mountOpened(3)
      const grip = screen.getByRole('button', { name: 'Move location', exact: true })

      grip.element().focus()
      await expect.element(grip).toHaveAccessibleDescription(/Space or Enter lifts the row/)
      await userEvent.keyboard(' ')
      await userEvent.keyboard('{ArrowDown}')
      await expect.element(screen.getByText('location, place 2 of 3')).toBeInTheDocument()
      await userEvent.keyboard(' ')

      await expect.poll(keynamesOf).toEqual(['units', 'location', 'api_key'])
      expect(valueLabels()).toEqual(['Units', 'Location', 'API key'])
      await expect.element(grip).toHaveFocus()
      await save(screen)

      await expect.poll(() => faked.saves.map(sent => sent.fields?.map(one => [one.keyname, one.order]))).toEqual([[['units', 0], ['location', 1], ['api_key', 2]]])
      expect(faked.saves[0]).not.toHaveProperty('fieldValues')
    })

    it('by dragging a row by its grip', async () => {
      const faked = fakeWeather([LOCATION, UNITS, API_KEY])
      const screen = await mountOpened(3)
      const target = rowOf('api_key')
      target.scrollIntoView({ block: 'center' })

      await userEvent.dragAndDrop(screen.getByRole('button', { name: 'Move location', exact: true }), target, {
        targetPosition: { x: 40, y: target.getBoundingClientRect().height - 1 },
      })

      await expect.poll(keynamesOf).toEqual(['units', 'api_key', 'location'])
      await save(screen)
      await expect.poll(() => sentFields(faked.saves)).toEqual([['units', 'api_key', 'location']])
    })

    it('on a phone: two buttons move a row a place earlier or later', async () => {
      fakeWeather([LOCATION, UNITS, API_KEY])
      await resizeTo(375)
      try {
        const screen = await mountOpened(3)

        await expect.element(screen.getByRole('button', { name: 'Move location earlier' })).toBeDisabled()
        await screen.getByRole('button', { name: 'Move location later' }).click()

        await expect.poll(keynamesOf).toEqual(['units', 'location', 'api_key'])
      }
      finally {
        await resetViewport()
      }
    })
  })

  it('is accessible and does not scroll sideways, with a row opened and one removed', async () => {
    fakeWeather([LOCATION, UNITS, API_KEY])
    const screen = await mountOpened(3)
    await (await open(screen, 'location')).getByRole('button', { name: 'Remove Plugin Field' }).click()
    await open(screen, 'units')

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
