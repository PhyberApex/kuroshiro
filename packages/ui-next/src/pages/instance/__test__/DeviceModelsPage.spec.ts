import type { Screen } from '@/pages/devices/__test__/deviceSettingsHarness'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { held, words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { DEVICE_MODELS, fakeDeviceModels, KOBO_AURA, MODELS_PATH, mountDeviceModels, mountLoadedDeviceModels, TRMNL_PALETTES, UNUSED } from './deviceModelsHarness'
import { DEVICES, NOW, rowsOf } from './firmwareHarness'

const main = (screen: Screen) => screen.getByRole('main').element()
const tucked = (screen: Screen, id: string) => main(screen).querySelector(`#${id}`)
const swatchesOf = (row: Element) => [...row.querySelectorAll<HTMLElement>('.swatches > *')].map(square => getComputedStyle(square).backgroundColor)

describe('the Device Models and Palettes page', () => {
  it('is in the Instance frame\'s page list, and says what the page is for', async () => {
    fakeDeviceModels()
    const screen = await mountLoadedDeviceModels()

    await expect.element(screen.getByRole('navigation', { name: 'Instance' }).getByRole('link', { name: 'Device Models and Palettes' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByText('What Kuroshiro knows about panels. A Device Model sets an image\'s size, a Palette the greys or colours it is reduced to. Which ones a Device uses is chosen in that Device\'s Settings.')).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro syncs both from TRMNL when it starts and every day at 04:00, server time. Without a connection it uses the list it was shipped with.')).toBeVisible()
  })

  describe('custom Palettes', () => {
    it('come first, one row per custom Palette by name, with its Palette Family in words and its Devices', async () => {
      fakeDeviceModels()
      const screen = await mountLoadedDeviceModels()
      const section = screen.getByRole('region', { name: 'Custom Palettes' }).element()

      expect(rowsOf(section)).toEqual([
        ['Soft red', 'Black, white and red'],
        ['Study panel, measured', 'Six colours', 'Study'],
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
        ['Seeed reTerminal E1002', '800 × 480 · Black & White (1-bit), Color (6 colors), Study panel, measured', 'Study'],
        ['TRMNL OG', '800 × 480 · Black & White (1-bit), 4 Grays (2-bit)', 'Hallway and Kitchen'],
      ])
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

  it('offers nothing to edit: the sync is its only action', async () => {
    fakeDeviceModels()
    const screen = await mountLoadedDeviceModels(`${MODELS_PATH}#trmnl-palettes`)
    await screen.getByRole('button', { name: 'The other 5 Device Models' }).click()
    await expect.element(screen.getByRole('searchbox', { name: 'Find a Device Model' })).toBeVisible()

    const buttons = [...main(screen).querySelectorAll('.page-heading button, .body button')].map(words)
    expect(buttons).toEqual(['Sync from TRMNL', 'The other 5 Device Models', 'TRMNL\'s Palettes (5)'])
    const controls = [...main(screen).querySelectorAll('.body :is(input, select, textarea, [contenteditable])')]
    expect(controls.map(control => control.getAttribute('aria-label'))).toEqual(['Find a Device Model'])
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

  it('is accessible and does not overflow on an Instance without a Device or a custom Palette', async () => {
    fakeDeviceModels({ ...UNUSED, palettes: TRMNL_PALETTES })
    await mountLoadedDeviceModels()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
