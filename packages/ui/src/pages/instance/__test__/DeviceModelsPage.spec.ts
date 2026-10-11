import type { Screen } from '@/pages/devices/__test__/deviceSettingsHarness'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { held, words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { DEVICE_MODELS, fakeDeviceModels, KOBO_AURA, MODELS_PATH, mountDeviceModels, mountLoadedDeviceModels, TRMNL_PALETTES, UNUSED } from './deviceModelsHarness'
import { DEVICES, NOW, rowsOf } from './firmwareHarness'

/** A list item's own text, with its decorative `aria-hidden` separator stripped: what a screen reader announces for it. */
function itemText(li: Element) {
  const clone = li.cloneNode(true) as Element
  clone.querySelectorAll('[aria-hidden="true"]').forEach(hidden => hidden.remove())
  return words(clone)
}

const main = (screen: Screen) => screen.getByRole('main').element()
const tucked = (screen: Screen, id: string) => main(screen).querySelector(`#${id}`)
const section = (screen: Screen) => screen.getByRole('region', { name: 'Custom Palettes' }).element()
const swatchesOf = (row: Element) => [...row.querySelectorAll<HTMLElement>('.swatches > *')].map(square => getComputedStyle(square).backgroundColor)

describe('the Device Models and Palettes page', () => {
  it('is in the Instance frame\'s page list, and says what the page is for', async () => {
    fakeDeviceModels()
    const screen = await mountLoadedDeviceModels()

    await expect.element(screen.getByRole('navigation', { name: 'Instance' }).getByRole('link', { name: 'Device Models and Palettes' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByText('What Kuroshiro knows about Device Models and Palettes. A Device Model sets an image\'s size, a Palette the greys or colours it is reduced to. Which ones a Device uses is chosen in that Device\'s Settings.')).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro syncs both from TRMNL when it starts and every day at 04:00, server time. Without a connection it uses the list it was shipped with.')).toBeVisible()
  })

  describe('custom Palettes', () => {
    it('come first, one row per custom Palette by name, with its Palette Family in words and its Devices', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      const section = screen.getByRole('region', { name: 'Custom Palettes' }).element()

      expect(rowsOf(section)).toEqual([
        ['Soft red', 'Black, white and red', 'Edit Delete'],
        ['Study panel, measured', 'Six colours', 'Study Edit Delete'],
      ])
      const sections = [...main(screen).querySelectorAll('section')].map(found => found.getAttribute('id'))
      expect(sections).toEqual(['custom-palettes', 'device-models'])
    })

    it('shows a custom Palette\'s own colours as swatches', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      const [softRed] = screen.getByRole('region', { name: 'Custom Palettes' }).element().querySelectorAll('.library-row')

      expect(swatchesOf(softRed!)).toEqual(['rgb(17, 17, 17)', 'rgb(181, 58, 48)', 'rgb(242, 240, 234)'])
    })

    it('says what a custom Palette is for where there is none', async () => {
      fakeDeviceModels({ palettes: TRMNL_PALETTES })
      const screen = await mountLoadedDeviceModels()
      const section = screen.getByRole('region', { name: 'Custom Palettes' })

      await expect.element(section.getByText('None yet. A colour panel rarely shows the exact red or yellow TRMNL\'s Palette assumes. A custom Palette holds the colours your panel really shows, so images are reduced to those.')).toBeVisible()
      expect(rowsOf(section.element())).toEqual([])
    })
  })

  describe('device models', () => {
    it('lists only the Device Models in use, each with its size, the Palettes it supports and its Devices by name', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      const section = screen.getByRole('region', { name: 'Device Models' })

      expect(rowsOf(section.element())).toEqual([
        ['Seeed reTerminal E1002', '800 × 480 · Black & White (1-bit), Color (6 colors), Study panel, measured · custom', 'Study'],
        ['TRMNL OG', '800 × 480 · Black & White (1-bit), 4 Grays (2-bit)', 'Hallway and Kitchen'],
      ])
    })

    it('lists a Device Model\'s Palettes as separate items, so assistive technology counts them', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      const [seeed] = screen.getByRole('region', { name: 'Device Models' }).element().querySelectorAll('.library-row')

      const items = [...seeed!.querySelectorAll('.palettes li')]
      expect(items).toHaveLength(3)
      expect(words(seeed!.querySelector('.palettes')!)).toBe('Black & White (1-bit), Color (6 colors), Study panel, measured · custom')
      // Each item's own text excludes the visual ", " separator, so a screen reader announces the Palette alone, not a leading comma.
      expect(items.map(itemText)).toEqual(['Black & White (1-bit)', 'Color (6 colors)', 'Study panel, measured · custom'])
    })

    it('leads from a Device it names to where that Device\'s Device Model and Palette are chosen', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()

      await expect.element(screen.getByRole('region', { name: 'Device Models' }).getByRole('link', { name: 'Hallway' })).toHaveAttribute('href', '/devices/hallway/settings#display')
      await expect.element(screen.getByRole('region', { name: 'Custom Palettes' }).getByRole('link', { name: 'Study' })).toHaveAttribute('href', '/devices/study/settings#display')
    })

    it('says how many there are from TRMNL and when TRMNL was last checked', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()

      await expect.element(screen.getByText('7 from TRMNL, checked 3 h ago')).toBeVisible()
    })

    it('says nothing about a check where TRMNL was never asked', async () => {
      fakeDeviceModels({ lastSync: null })
      const screen = await mountLoadedDeviceModels()

      await expect.element(screen.getByText('7 from TRMNL', { exact: true })).toBeVisible()
    })

    it('says that the last check of TRMNL failed, not that it was checked, and shows nothing red', async () => {
      fakeDeviceModels({ lastSync: { ranAt: '2026-10-03T04:00:00.000Z', ok: false, error: 'TRMNL did not answer' } })
      const screen = await mountLoadedDeviceModels()

      await expect.element(screen.getByText('7 from TRMNL, last check failed 3 h ago')).toBeVisible()
      expect(screen.getByText('checked', { exact: false }).elements()).toEqual([])
      expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
      await expectAccessible()
    })

    it('says of a deprecated Device Model in use that TRMNL no longer lists it', async () => {
      fakeDeviceModels({ models: [{ ...KOBO_AURA, usedBy: [DEVICES.kitchen] }] })
      const screen = await mountLoadedDeviceModels()

      expect(rowsOf(screen.getByRole('region', { name: 'Device Models' }).element())).toEqual([
        ['Kobo Aura', '758 × 1024 · Black & White (1-bit), 16 Grays (4-bit) TRMNL no longer lists this Device Model.', 'Kitchen'],
      ])
    })

    it('says that no Device uses one yet on an Instance without a Device, and tucks all of them away', async () => {
      fakeDeviceModels(UNUSED)
      const screen = await mountLoadedDeviceModels()
      const section = screen.getByRole('region', { name: 'Device Models' })

      await expect.element(section.getByText('No Device uses one yet. A Device is given its Device Model from what it reports at its first poll.')).toBeVisible()
      expect(rowsOf(section.element())).toEqual([])
      await expect.element(screen.getByRole('button', { name: 'All 7 Device Models' })).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('the other Device Models', () => {
    const open = async (screen: Screen) => {
      await screen.getByRole('button', { name: 'The other 5 Device Models' }).click()
      await expect.element(screen.getByRole('searchbox', { name: 'Find a Device Model' })).toBeVisible()
    }
    const labels = (screen: Screen) => rowsOf(tucked(screen, 'other-device-models')).map(([label]) => label)

    it('are tucked away closed, with the same rows', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      await expect.element(screen.getByRole('button', { name: 'The other 5 Device Models' })).toHaveAttribute('aria-expanded', 'false')

      await open(screen)

      expect(rowsOf(tucked(screen, 'other-device-models'))).toEqual([
        ['Inkplate 10', '1200 × 825 · Black & White (1-bit), 4 Grays (2-bit)'],
        ['Kindle Paperwhite 7', '1236 × 1648 · Black & White (1-bit), 4 Grays (2-bit), 16 Grays (4-bit)'],
        ['Kobo Aura', '758 × 1024 · Black & White (1-bit), 16 Grays (4-bit) TRMNL no longer lists this Device Model.'],
        ['TRMNL OG (1-bit)', '800 × 480 · Black & White (1-bit)'],
        ['TRMNL X', '1872 × 1404 · Black & White (1-bit), 4 Grays (2-bit), 16 Grays (4-bit)'],
      ])
    })

    it('are filtered by label as "Find a Device Model" is typed in', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      await open(screen)
      const find = screen.getByRole('searchbox', { name: 'Find a Device Model' })

      await find.fill('k')
      await expect.poll(() => labels(screen)).toEqual(['Inkplate 10', 'Kindle Paperwhite 7', 'Kobo Aura'])

      await find.fill('kindle')
      await expect.poll(() => labels(screen)).toEqual(['Kindle Paperwhite 7'])

      await find.fill('')
      await expect.poll(() => labels(screen)).toHaveLength(5)
    })

    it('says that no Device Model is called what was typed', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      await open(screen)

      await screen.getByRole('searchbox', { name: 'Find a Device Model' }).fill('nook')

      await expect.element(screen.getByText('No Device Model is called “nook”.')).toBeVisible()
      expect(labels(screen)).toEqual([])
    })

    it('is not there where every Device Model is in use', async () => {
      fakeDeviceModels({ models: DEVICE_MODELS.filter(model => model.usedBy.length > 0) })
      const screen = await mountLoadedDeviceModels()

      expect(screen.getByRole('button', { name: /Device Models$/ }).elements()).toEqual([])
    })
  })

  describe('the Palettes synced from TRMNL', () => {
    it('are tucked away closed: the name, the swatches with the id, and the Devices set to it', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      const trigger = screen.getByRole('button', { name: 'TRMNL\'s Palettes (5)' })
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')

      await trigger.click()

      await expect.element(screen.getByText('Synced from TRMNL and not editable. Each Device Model lists the ones it supports.')).toBeVisible()
      const palettes = tucked(screen, 'trmnl-palettes')
      expect(rowsOf(palettes)).toEqual([
        ['Black & White (1-bit)', 'bw'],
        ['4 Grays (2-bit)', 'gray-4', 'Kitchen'],
        ['16 Grays (4-bit)', 'gray-16'],
        ['Color (3 colors)', 'color-3bwr'],
        ['Color (6 colors)', 'color-6a'],
      ])
      const [blackAndWhite, , , threeColours] = palettes!.querySelectorAll('.library-row')
      expect(swatchesOf(blackAndWhite!)).toEqual(['rgb(0, 0, 0)', 'rgb(255, 255, 255)'])
      expect(swatchesOf(threeColours!)).toEqual(['rgb(0, 0, 0)', 'rgb(255, 0, 0)', 'rgb(255, 255, 255)'])
    })
  })

  it('offers custom Palettes as the only thing to add, change or delete; everything else is read', async () => {
    fakeDeviceModels()
    const screen = await mountLoadedDeviceModels(`${MODELS_PATH}#trmnl-palettes`)
    await screen.getByRole('button', { name: 'The other 5 Device Models' }).click()
    await expect.element(screen.getByRole('searchbox', { name: 'Find a Device Model' })).toBeVisible()

    const actions = [...main(screen).querySelectorAll('.page-heading button, .body :is(button, a.button)')].map(action => action.getAttribute('aria-label') ?? words(action))
    expect(actions).toEqual(['Sync from TRMNL', 'Add a custom Palette', 'Edit Soft red', 'Delete Soft red', 'Edit Study panel, measured', 'Delete Study panel, measured', 'The other 5 Device Models', 'TRMNL\'s Palettes (5)'])
    const controls = [...main(screen).querySelectorAll('.body :is(input, select, textarea, [contenteditable])')]
    expect(controls.map(control => control.getAttribute('aria-label'))).toEqual(['Find a Device Model'])
  })

  describe('adding a custom Palette', () => {
    const form = (screen: Screen) => screen.getByRole('form', { name: 'New custom Palette' })
    const colourValues = (screen: Screen) => [...form(screen).element().querySelectorAll<HTMLInputElement>('.colour-row input')].map(input => input.value)

    it('opens the form under the section heading on "Add a custom Palette", starting from TRMNL\'s black, white and red, and hides the empty text', async () => {
      fakeDeviceModels({ palettes: TRMNL_PALETTES })
      const screen = await mountLoadedDeviceModels()

      await screen.getByRole('link', { name: 'Add a custom Palette' }).click()

      await expect.element(form(screen)).toBeVisible()
      await expect.poll(() => screen.router.currentRoute.value.fullPath).toBe(`${MODELS_PATH}?palette=new`)
      await expect.element(form(screen).getByRole('textbox', { name: 'Name' })).toHaveValue('')
      await expect.element(form(screen).getByRole('combobox', { name: 'Palette Family' })).toHaveTextContent('Black, white and red · 3bwr')
      await expect.element(form(screen).getByText('The inks the panel has. It decides which Device Models can use this Palette.', { exact: true })).toBeVisible()
      expect(colourValues(screen)).toEqual(['#000000', '#FF0000', '#FFFFFF'])
      expect(screen.getByText(/^None yet\./).elements()).toEqual([])
      expect(form(screen).element().closest('.instance-section > *')?.previousElementSibling?.tagName).toBe('HEADER')
    })

    it('adds the Palette with its name, family and colours, closes the form and lists it', async () => {
      const faked = fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)

      await form(screen).getByRole('textbox', { name: 'Name' }).fill('Hallway panel, measured')
      await form(screen).getByRole('textbox', { name: 'Colour 2' }).fill('#c0392b')
      await form(screen).getByRole('button', { name: 'Remove colour 3' }).click()
      await form(screen).getByRole('button', { name: 'Add a colour' }).click()
      await expect.element(form(screen).getByRole('textbox', { name: 'Colour 3' })).toHaveFocus()
      await form(screen).getByRole('textbox', { name: 'Colour 3' }).fill('#F2F0EA')
      await form(screen).getByRole('button', { name: 'Add Palette' }).click()

      await expect.poll(() => faked.writes).toEqual([{ method: 'POST', path: 'device-models/palettes', body: { name: 'Hallway panel, measured', frameworkClass: 'screen--color-3bwr', colors: ['#000000', '#c0392b', '#F2F0EA'] } }])
      await expect.poll(() => rowsOf(section(screen)).map(([name]) => name)).toEqual(['Hallway panel, measured', 'Soft red', 'Study panel, measured'])
      expect(screen.getByRole('form').elements()).toEqual([])
      expect(screen.router.currentRoute.value.fullPath).toBe(MODELS_PATH)
    })

    it('takes TRMNL\'s colours of another Palette Family while the colours are untouched', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)

      await form(screen).getByRole('combobox', { name: 'Palette Family' }).click()
      await screen.getByRole('option', { name: 'Six colours · 6a' }).click()

      await expect.poll(() => colourValues(screen)).toEqual(['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'])
    })

    it('refuses an empty name, an invalid colour and an empty colour list without sending', async () => {
      const faked = fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)

      await form(screen).getByRole('textbox', { name: 'Colour 2' }).fill('#B53A3')
      await form(screen).getByRole('button', { name: 'Add Palette' }).click()

      await expect.element(form(screen).getByText('A Palette needs a name.')).toBeVisible()
      await expect.element(form(screen).getByText('Enter a colour like #B53A30.')).toBeVisible()
      await expect.element(form(screen).getByRole('textbox', { name: 'Colour 2' })).toHaveAttribute('aria-invalid', 'true')
      await expect.element(form(screen).getByRole('textbox', { name: 'Colour 1' })).not.toHaveAttribute('aria-invalid')

      for (const _ of [1, 2, 3])
        await form(screen).getByRole('button', { name: 'Remove colour 1' }).click()
      await form(screen).getByRole('textbox', { name: 'Name' }).fill('Hallway')
      await form(screen).getByRole('button', { name: 'Add Palette' }).click()

      await expect.element(form(screen).getByText('A Palette needs at least one colour.')).toBeVisible()
      expect(faked.writes).toEqual([])
    })

    it('words a name another custom Palette has on the Name field', async () => {
      fakeDeviceModels()
      api.use(http.post(apiUrl('device-models/palettes'), () => apiErrorResponse({ statusCode: 409, code: 'palette-name-taken' })))
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)

      await form(screen).getByRole('textbox', { name: 'Name' }).fill('soft red')
      await form(screen).getByRole('button', { name: 'Add Palette' }).click()

      await expect.element(form(screen).getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription('There is already a custom Palette called soft red. Give this one a name that tells them apart.')
      await expect.element(form(screen)).toBeVisible()
    })

    it('says why nothing was added when the server fails, and keeps what was entered', async () => {
      fakeDeviceModels()
      api.use(http.post(apiUrl('device-models/palettes'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)

      await form(screen).getByRole('textbox', { name: 'Name' }).fill('Hallway')
      await form(screen).getByRole('button', { name: 'Add Palette' }).click()

      await expect.element(form(screen).getByText(/^Not added\. /)).toBeVisible()
      await expect.element(form(screen).getByRole('textbox', { name: 'Name' })).toHaveValue('Hallway')
    })

    it('closes on "Cancel" and clears the query', async () => {
      const faked = fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)

      await form(screen).getByRole('link', { name: 'Cancel' }).click()

      await expect.poll(() => screen.router.currentRoute.value.fullPath).toBe(MODELS_PATH)
      expect(screen.getByRole('form').elements()).toEqual([])
      expect(faked.writes).toEqual([])
    })
  })

  describe('editing a custom Palette', () => {
    const form = (screen: Screen, name: string) => screen.getByRole('form', { name: `Edit ${name}` })

    it('opens its form under its row from the address, filled in, one form at a time', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=soft-red`)
      const edited = form(screen, 'Soft red')

      await expect.element(edited.getByRole('textbox', { name: 'Name' })).toHaveValue('Soft red')
      await expect.element(edited.getByRole('combobox', { name: 'Palette Family' })).toBeEnabled()
      expect([...edited.element().querySelectorAll<HTMLInputElement>('.colour-row input')].map(input => input.value)).toEqual(['#111111', '#B53A30', '#F2F0EA'])
      expect(edited.element().closest('.library-row')?.querySelector('.name')?.textContent).toBe('Soft red')
      await expect.element(edited.getByRole('button', { name: 'Save Palette' })).toBeVisible()

      await screen.getByRole('link', { name: 'Edit Study panel, measured' }).click()

      await expect.element(form(screen, 'Study panel, measured')).toBeVisible()
      expect(screen.getByRole('form').elements()).toHaveLength(1)
      expect(screen.router.currentRoute.value.fullPath).toBe(`${MODELS_PATH}?palette=study-panel`)
    })

    it('saves the change, closes and shows it in the row', async () => {
      const faked = fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=soft-red`)

      await form(screen, 'Soft red').getByRole('textbox', { name: 'Name' }).fill('Softer red')
      await form(screen, 'Soft red').getByRole('button', { name: 'Save Palette' }).click()

      await expect.poll(() => faked.writes).toEqual([{ method: 'PATCH', path: 'device-models/palettes/soft-red', body: { name: 'Softer red', frameworkClass: 'screen--color-3bwr', colors: ['#111111', '#B53A30', '#F2F0EA'] } }])
      await expect.poll(() => rowsOf(section(screen))[0]).toEqual(['Softer red', 'Black, white and red', 'Edit Delete'])
      expect(screen.router.currentRoute.value.fullPath).toBe(MODELS_PATH)
    })

    it('holds the Palette Family still and says whose images a save converts while a Device uses it', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=study-panel`)
      const edited = form(screen, 'Study panel, measured')

      await expect.element(edited.getByRole('combobox', { name: 'Palette Family' })).toBeDisabled()
      await expect.element(edited.getByText('The inks the panel has. It decides which Device Models can use this Palette, and cannot be changed while a Device uses it.')).toBeVisible()
      await expect.element(edited.getByText('Saving converts Study\'s stored images again.')).toBeVisible()
    })

    it('says why it was not saved when the server refuses', async () => {
      fakeDeviceModels()
      api.use(http.patch(apiUrl('device-models/palettes/:id'), () => apiErrorResponse({ statusCode: 409, code: 'palette-in-use' })))
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=study-panel`)

      await form(screen, 'Study panel, measured').getByRole('button', { name: 'Save Palette' }).click()

      await expect.element(form(screen, 'Study panel, measured').getByText('Not saved. The Palette Family cannot be changed while a Device uses the Palette.')).toBeVisible()
    })

    it('opens no form for a Palette that is not a custom one', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=gray-4`)

      expect(screen.getByRole('form').elements()).toEqual([])
    })
  })

  describe('switching which custom Palette\'s form is open', () => {
    const newForm = (screen: Screen) => screen.getByRole('form', { name: 'New custom Palette' })
    const editForm = (screen: Screen, name: string) => screen.getByRole('form', { name: `Edit ${name}` })

    it('asks before leaving the new Palette form for an existing one, and keeps both on "Keep editing"', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)
      await newForm(screen).getByRole('textbox', { name: 'Name' }).fill('Hallway panel')

      await screen.getByRole('link', { name: 'Edit Soft red' }).click()

      const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      await expect.element(question).toBeVisible()
      await expect.element(question.getByText('What you entered for the new Palette.')).toBeVisible()
      await expect.element(question.getByRole('button', { name: 'Keep editing' })).toHaveFocus()
      expect(screen.router.currentRoute.value.fullPath).toBe(`${MODELS_PATH}?palette=new`)

      await question.getByRole('button', { name: 'Keep editing' }).click()

      await expect.element(question).not.toBeInTheDocument()
      await expect.element(newForm(screen).getByRole('textbox', { name: 'Name' })).toHaveValue('Hallway panel')
      expect(screen.router.currentRoute.value.fullPath).toBe(`${MODELS_PATH}?palette=new`)
    })

    it('opens the other Palette\'s form on "Leave"', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)
      await newForm(screen).getByRole('textbox', { name: 'Name' }).fill('Hallway panel')

      await screen.getByRole('link', { name: 'Edit Soft red' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click()

      await expect.element(editForm(screen, 'Soft red')).toBeVisible()
      expect(screen.getByRole('form').elements()).toHaveLength(1)
      expect(screen.router.currentRoute.value.fullPath).toBe(`${MODELS_PATH}?palette=soft-red`)
    })

    it('asks before leaving an edited Palette\'s form for "Add a custom Palette", naming that Palette', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=soft-red`)
      await editForm(screen, 'Soft red').getByRole('textbox', { name: 'Name' }).fill('Softer red')

      await screen.getByRole('link', { name: 'Add a custom Palette' }).click()

      const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
      await expect.element(question).toBeVisible()
      await expect.element(question.getByText('Your changes to the Palette Soft red.')).toBeVisible()
      expect(screen.router.currentRoute.value.fullPath).toBe(`${MODELS_PATH}?palette=soft-red`)

      await question.getByRole('button', { name: 'Leave' }).click()

      await expect.element(newForm(screen)).toBeVisible()
      expect(screen.router.currentRoute.value.fullPath).toBe(`${MODELS_PATH}?palette=new`)
    })

    it('does not ask when switching forms without changes', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=new`)

      await screen.getByRole('link', { name: 'Edit Soft red' }).click()

      await expect.element(editForm(screen, 'Soft red')).toBeVisible()
      expect(screen.getByRole('alertdialog').elements()).toEqual([])
    })
  })

  describe('deleting a custom Palette', () => {
    const lostAndStays = (dialog: Element) => [...dialog.querySelectorAll('dl > div')].map(line => [...line.children].map(words).join(' '))

    it('asks first, naming the Palette its Device goes back to, and deletes on "Delete Palette"', async () => {
      const faked = fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()

      await screen.getByRole('button', { name: 'Delete Study panel, measured' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Delete the Palette Study panel, measured?' })
      await expect.element(dialog).toBeVisible()
      expect(lostAndStays(dialog.element())).toEqual([
        'Lost The custom Palette and its 6 colours.',
        'Stays Study, which goes back to its Device Model\'s richest Palette, Color (6 colors). Its stored images are converted again.',
      ])

      await dialog.getByRole('button', { name: 'Delete Palette' }).click()

      await expect.poll(() => faked.writes).toEqual([{ method: 'DELETE', path: 'device-models/palettes/study-panel' }])
      await expect.poll(() => rowsOf(section(screen)).map(([name]) => name)).toEqual(['Soft red'])
    })

    it('says that nothing else changes where no Device uses it', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()

      await screen.getByRole('button', { name: 'Delete Soft red' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Delete the Palette Soft red?' })
      await expect.element(dialog).toBeVisible()
      expect(lostAndStays(dialog.element())).toEqual([
        'Lost The custom Palette and its 3 colours.',
        'Stays Everything else. No Device uses it.',
      ])
    })
  })

  describe('sync from TRMNL', () => {
    const syncButton = (screen: Screen) => screen.getByRole('button', { name: 'Sync from TRMNL' })
    const syncLine = (screen: Screen) => words(main(screen).querySelector('.sync-line'))

    it('disables the button and says what it asks TRMNL while it runs', async () => {
      const faked = fakeDeviceModels()
      const sync = held()
      faked.holding = sync.promise
      const screen = await mountLoadedDeviceModels()
      const region = main(screen).querySelector('.sync-line')

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Asking TRMNL for its Device Models and Palettes')
      await expect.element(syncButton(screen)).toBeDisabled()
      expect(main(screen).querySelector('.sync-line')).toBe(region)

      sync.release()

      await expect.element(syncButton(screen)).toBeEnabled()
      expect(faked.syncs).toBe(1)
    })

    it('shows the counts, the Device Models TRMNL no longer lists, and that TRMNL was checked just now', async () => {
      const faked = fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Synced: 38 Device Models and 11 Palettes. 1 Device Model is no longer listed by TRMNL and stays usable.')
      await expect.element(screen.getByText('7 from TRMNL, checked just now')).toBeVisible()
      expect(faked.syncs).toBe(1)
    })

    it('shows what the sync changed, and no sentence about dropped Device Models where there is none', async () => {
      const faked = fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      faked.list = { ...faked.list, models: DEVICE_MODELS.filter(model => !model.deprecated) }

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Synced: 38 Device Models and 11 Palettes.')
      await expect.element(screen.getByText('6 from TRMNL, checked just now')).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'The other 4 Device Models' })).toBeVisible()
    })

    it('cannot be asked for before the page has loaded', async () => {
      fakeDeviceModels()
      api.use(http.get(apiUrl('device-models'), () => new Promise<never>(() => {})))
      const screen = await mountDeviceModels()

      await expect.element(syncButton(screen)).toBeDisabled()
    })

    it('says with the server\'s reason that it could not sync and where what is shown is from, keeps the lists, and syncs on "Try again"', async () => {
      const faked = fakeDeviceModels()
      faked.syncAnswer = apiErrorResponse({ statusCode: 502, code: 'upstream-unreachable', details: { reason: 'usetrmnl.com did not answer within 15 seconds.' } })
      const screen = await mountLoadedDeviceModels()
      faked.list = { ...faked.list, lastSync: { ranAt: NOW, ok: false, error: 'usetrmnl.com did not answer within 15 seconds.' } }

      await syncButton(screen).click()

      await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not sync from TRMNL. usetrmnl.com did not answer within 15 seconds. What you see is from 3 h ago.')
      await expect.element(screen.getByText('7 from TRMNL, last check failed just now')).toBeVisible()
      expect(syncLine(screen)).toBe('')
      expect(rowsOf(screen.getByRole('region', { name: 'Device Models' }).element()).map(([label]) => label)).toEqual(['Seeed reTerminal E1002', 'TRMNL OG'])
      expect(rowsOf(screen.getByRole('region', { name: 'Custom Palettes' }).element())).toHaveLength(2)
      await expect.element(syncButton(screen)).toBeEnabled()

      faked.syncAnswer = { models: 38, palettes: 11, deprecatedModels: 0, deprecatedPalettes: 0, ranAt: NOW }
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.poll(() => syncLine(screen)).toContain('Synced: 38 Device Models and 11 Palettes.')
      expect(screen.getByRole('alert').elements()).toEqual([])
      expect(faked.syncs).toBe(2)
    })
  })

  describe('loading and failed', () => {
    it('says what it is loading while the answer takes long', async () => {
      fakeDeviceModels()
      api.use(http.get(apiUrl('device-models/palettes'), () => new Promise<never>(() => {})))
      const screen = await mountDeviceModels()

      await expect.element(screen.getByText('Loading the Device Models and Palettes')).toBeVisible()
    })

    it('says that it could not load them, and loads on "Try again"', async () => {
      fakeDeviceModels()
      api.use(http.get(apiUrl('device-models/palettes'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
      const screen = await mountDeviceModels()

      await expect.element(screen.getByText('Could not load the Device Models and Palettes.')).toBeVisible()
      expect(screen.getByRole('region', { name: 'Device Models' }).elements()).toEqual([])

      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(screen.getByRole('region', { name: 'Device Models' })).toBeVisible()
      expect(screen.getByText('Could not load the Device Models and Palettes.').elements()).toEqual([])
    })
  })

  it('is accessible and does not overflow, with everything opened', async () => {
    fakeDeviceModels()
    const screen = await mountLoadedDeviceModels(`${MODELS_PATH}#trmnl-palettes`)
    await screen.getByRole('button', { name: 'The other 5 Device Models' }).click()
    await expect.element(screen.getByRole('searchbox', { name: 'Find a Device Model' })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it.each([
    ['a new custom Palette', 'new'],
    ['a custom Palette a Device uses', 'study-panel'],
  ])('is accessible and does not overflow with the form of %s open', async (_, palette) => {
    fakeDeviceModels()
    const screen = await mountLoadedDeviceModels(`${MODELS_PATH}?palette=${palette}`)
    await expect.element(screen.getByRole('form')).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is accessible and does not overflow on an Instance without a Device or a custom Palette', async () => {
    fakeDeviceModels({ ...UNUSED, palettes: TRMNL_PALETTES })
    await mountLoadedDeviceModels()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
