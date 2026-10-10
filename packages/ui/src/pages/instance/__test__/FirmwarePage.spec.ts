import type { Screen } from '@/pages/devices/__test__/deviceSettingsHarness'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { held, noteOf, rowOf, stateOf, words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { exactTime } from '@/patterns/time'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { buildFirmware } from '@/testing/fixtures/firmware'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { AUTO_UPDATE_ON, DEVICES, EARLIER, fakeFirmware, mountFirmware, mountLoadedFirmware, NOW, OFFICIAL, rowsOf } from './firmwareHarness'

const at = (iso: string) => exactTime(new Date(iso))

const shownOf = (screen: Screen, label: string) => words(rowOf(screen, label)?.querySelector('.control-cell'))

const MISSING_FILE = 'Its file is missing, so it cannot be pushed. Delete it and upload it again.'

describe('the Firmware page', () => {
  describe('available Firmware', () => {
    it('has a row per Firmware that is not deprecated, newest first, with what it is, where it is headed and its date', async () => {
      fakeFirmware()
      const screen = await mountFirmware()
      const section = screen.getByRole('region', { name: 'Available Firmware' })

      await expect.element(section).toBeVisible()
      expect(rowsOf(section.element())).toEqual([
        ['1.8.0-rc2', 'Custom · Release candidate, battery fix · Fits TRMNL OG Goes out to Study at the next poll', 'Uploaded 22 h ago Delete'],
        ['1.7.9', 'Official · Fits TRMNL OG (1-bit) and TRMNL OG Goes out to Hallway at the next poll · Running on Kitchen and Study', `Synced ${at('2026-09-30T04:00:00.000Z')}`],
        ['2.0.3', `Custom · TRMNL X build · Fits TRMNL X ${MISSING_FILE}`, `Uploaded ${at('2026-09-12T18:40:00.000Z')} Delete`],
      ])
    })

    it('leads from a Device it names to that Device\'s Firmware settings', async () => {
      fakeFirmware({ firmware: [OFFICIAL] })
      const screen = await mountFirmware()

      await expect.element(screen.getByRole('main').getByRole('link', { name: 'Hallway' })).toHaveAttribute('href', '/devices/hallway/settings#firmware')
      await expect.element(screen.getByRole('main').getByRole('link', { name: 'Kitchen' })).toHaveAttribute('href', '/devices/kitchen/settings#firmware')
    })

    it('says when TRMNL was last checked, and how the library is kept', async () => {
      fakeFirmware()
      const screen = await mountFirmware()

      await expect.element(screen.getByText('Checked TRMNL 3 h ago')).toBeVisible()
      await expect.element(screen.getByText('Every Firmware a Device can be pushed to. Which one a Device gets is chosen in that Device\'s Settings.')).toBeVisible()
      await expect.element(screen.getByText('Kuroshiro asks TRMNL for the newest official Firmware when it starts and every day at 04:00, server time. TRMNL\'s update feed only carries Firmware for the TRMNL OG (1-bit) and TRMNL OG (2-bit); any other Device Model, TRMNL OG (B/W/R/Y) included, needs an upload.')).toBeVisible()
    })

    it('says nothing about a check where TRMNL was never asked', async () => {
      fakeFirmware({ lastSync: null })
      const screen = await mountFirmware()

      await expect.element(screen.getByRole('region', { name: 'Available Firmware' })).toBeVisible()
      expect(screen.getByText('Checked TRMNL', { exact: false }).elements()).toEqual([])
    })

    it('says that the last check of TRMNL failed, not that it was checked, and shows nothing red', async () => {
      fakeFirmware({ lastSync: { ranAt: '2026-10-03T04:00:00.000Z', ok: false, error: 'TRMNL did not answer' } })
      const screen = await mountFirmware()

      await expect.element(screen.getByText('Last check of TRMNL failed 3 h ago')).toBeVisible()
      expect(screen.getByText('Checked TRMNL', { exact: false }).elements()).toEqual([])
      expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
      await expectAccessible()
    })

    it('tucks the deprecated ones away as earlier official Firmware, without actions', async () => {
      fakeFirmware()
      const screen = await mountFirmware()
      const earlier = screen.getByRole('button', { name: 'Earlier official Firmware (2)' })
      await expect.element(earlier).toHaveAttribute('aria-expanded', 'false')

      await earlier.click()

      await expect.element(screen.getByText('Replaced by 1.7.9 and no longer offered as a target. A Device that already targets one keeps it.')).toBeVisible()
      const tucked = screen.getByRole('main').element().querySelector('#earlier')
      expect(rowsOf(tucked)).toEqual([
        ['1.6.9', 'Official · Fits TRMNL OG (1-bit) and TRMNL OG', `Synced ${at('2026-09-02T04:00:00.000Z')}`],
        ['1.6.8', 'Official · Fits TRMNL OG (1-bit) and TRMNL OG', `Synced ${at('2026-08-11T04:00:00.000Z')}`],
      ])
      expect(tucked?.querySelectorAll('button:not(.trigger)')).toHaveLength(0)
    })

    it('has no tucked section where no Firmware is deprecated', async () => {
      fakeFirmware({ firmware: [OFFICIAL] })
      const screen = await mountFirmware()

      await expect.element(screen.getByRole('region', { name: 'Available Firmware' })).toBeVisible()
      expect(screen.getByRole('button', { name: /Earlier official Firmware/ }).elements()).toEqual([])
    })

    it('shows a deprecated Firmware nowhere but in the tucked section', async () => {
      fakeFirmware({ firmware: [OFFICIAL, ...EARLIER] })
      const screen = await mountFirmware()
      const section = screen.getByRole('region', { name: 'Available Firmware' })

      await expect.element(section).toBeVisible()
      expect(rowsOf(section.element()).map(([version]) => version)).toEqual(['1.7.9'])
      expect(words(section.element())).not.toContain('1.6.9')
    })
  })

  describe('firmware Auto-Update', () => {
    const autoUpdate = (screen: Screen) => screen.getByRole('switch', { name: 'Firmware Auto-Update' })

    it('is off with what updates a Device then, above the library', async () => {
      fakeFirmware()
      const screen = await mountFirmware()

      await expect.element(autoUpdate(screen)).not.toBeChecked()
      expect(shownOf(screen, 'Firmware Auto-Update')).toBe('Off')
      expect(noteOf(screen, 'Firmware Auto-Update')).toBe('A Device only updates when you press “Update now” in its Settings. While on, each new official Firmware is pushed to every Device it fits.')
      const library = screen.getByRole('region', { name: 'Available Firmware' }).element()
      expect(rowOf(screen, 'Firmware Auto-Update')!.compareDocumentPosition(library) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('saves as it is switched on, and names the newest official Firmware no Device is caught up to', async () => {
      const faked = fakeFirmware()
      const screen = await mountFirmware()

      await autoUpdate(screen).click()

      await expect.poll(() => faked.settingsWrites).toEqual([{ firmwareAutoUpdate: true }])
      await expect.poll(() => stateOf(screen, 'Firmware Auto-Update')).toBe('Saved')
      await expect.element(autoUpdate(screen)).toBeChecked()
      expect(shownOf(screen, 'Firmware Auto-Update')).toBe('On')
      expect(noteOf(screen, 'Firmware Auto-Update')).toBe('Each new official Firmware becomes the target of every Device it fits, except a mirrored Device and one with a push already pending. It starts with the next official Firmware; Devices are not caught up to 1.7.9 now.')
    })

    it('saves as it is switched off again', async () => {
      const faked = fakeFirmware({ settings: AUTO_UPDATE_ON })
      const screen = await mountFirmware()
      await expect.element(autoUpdate(screen)).toBeChecked()

      await autoUpdate(screen).click()

      await expect.poll(() => faked.settingsWrites).toEqual([{ firmwareAutoUpdate: false }])
      await expect.element(autoUpdate(screen)).not.toBeChecked()
      expect(shownOf(screen, 'Firmware Auto-Update')).toBe('Off')
    })

    it('says why a change was not saved and saves it on "Try again"', async () => {
      const faked = fakeFirmware()
      const screen = await mountFirmware()
      api.use(http.patch(apiUrl('settings'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))

      await autoUpdate(screen).click()
      await expect.poll(() => stateOf(screen, 'Firmware Auto-Update')).toBe('Not saved. Something went wrong on the server.')

      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.poll(() => faked.settingsWrites).toEqual([{ firmwareAutoUpdate: true }])
      await expect.poll(() => stateOf(screen, 'Firmware Auto-Update')).toBe('Saved')
    })
  })

  describe('sync from TRMNL', () => {
    const syncButton = (screen: Screen) => screen.getByRole('button', { name: 'Sync from TRMNL' })
    const syncLine = (screen: Screen) => words(screen.getByRole('main').element().querySelector('.sync-line'))
    const NEW = { ranAt: NOW, inserted: true, version: '1.8.0', assigned: [] }

    it('disables the button and says what it asks TRMNL while it runs', async () => {
      const faked = fakeFirmware()
      const answer = held()
      faked.holding = answer.promise
      const screen = await mountLoadedFirmware()
      const region = screen.getByRole('main').element().querySelector('.sync-line')
      expect(region).toBeEmptyDOMElement()

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Asking TRMNL for the newest official Firmware')
      await expect.element(syncButton(screen)).toBeDisabled()
      expect(region?.querySelector('.loading-mark')).not.toBeNull()
      expect(screen.getByRole('main').element().querySelector('.sync-line')).toBe(region)

      answer.release()

      await expect.element(syncButton(screen)).toBeEnabled()
      expect(faked.syncs).toBe(1)
    })

    it('says that nothing is new, and that TRMNL was checked just now', async () => {
      fakeFirmware()
      const screen = await mountLoadedFirmware()

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Nothing new. 1.7.9 is still TRMNL\'s newest official Firmware.')
      await expect.element(screen.getByText('Checked TRMNL just now')).toBeVisible()
    })

    it('shows a new Firmware and says no Device is given it while Firmware Auto-Update is off', async () => {
      const faked = fakeFirmware({ firmware: [OFFICIAL] })
      faked.syncAnswer = NEW
      const screen = await mountLoadedFirmware()
      await expect.element(screen.getByRole('region', { name: 'Available Firmware' })).toBeVisible()
      faked.library = { ...faked.library, firmware: [buildFirmware({ id: 'new', version: '1.8.0', syncedAt: NOW }), { ...OFFICIAL, deprecated: true }] }

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Synced 1.8.0. No Device is given it until you choose it as that Device\'s target.')
      expect(rowsOf(screen.getByRole('region', { name: 'Available Firmware' }).element()).map(([version]) => version)).toEqual(['1.8.0'])
      await expect.element(screen.getByRole('button', { name: 'Earlier official Firmware (1)' })).toBeVisible()
    })

    it('names the Devices Firmware Auto-Update gave a new Firmware to', async () => {
      const faked = fakeFirmware({ settings: AUTO_UPDATE_ON })
      faked.syncAnswer = { ...NEW, assigned: [DEVICES.kitchen, DEVICES.study] }
      const screen = await mountLoadedFirmware()

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Synced 1.8.0. Firmware Auto-Update made it the target of Kitchen and Study; it goes out at their next poll.')
    })

    it('says that no Device is free to take a new Firmware while Firmware Auto-Update is on', async () => {
      const faked = fakeFirmware({ settings: AUTO_UPDATE_ON })
      faked.syncAnswer = NEW
      const screen = await mountLoadedFirmware()

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Synced 1.8.0. No Device it fits is free to take it.')
    })

    it('words the outcome by the switch as it stands, not as it was loaded', async () => {
      const faked = fakeFirmware()
      faked.syncAnswer = NEW
      const screen = await mountLoadedFirmware()
      await screen.getByRole('switch', { name: 'Firmware Auto-Update' }).click()
      await expect.poll(() => faked.settingsWrites).toHaveLength(1)

      await syncButton(screen).click()

      await expect.poll(() => syncLine(screen)).toBe('Synced 1.8.0. No Device it fits is free to take it.')
    })

    it('keeps the outcome as it was worded when the switch is flipped afterwards', async () => {
      const faked = fakeFirmware()
      faked.syncAnswer = NEW
      const screen = await mountLoadedFirmware()

      await syncButton(screen).click()
      await expect.poll(() => syncLine(screen)).toBe('Synced 1.8.0. No Device is given it until you choose it as that Device\'s target.')
      await screen.getByRole('switch', { name: 'Firmware Auto-Update' }).click()
      await expect.poll(() => faked.settingsWrites).toHaveLength(1)

      expect(syncLine(screen)).toBe('Synced 1.8.0. No Device is given it until you choose it as that Device\'s target.')
    })

    it('cannot be asked for before the page has loaded', async () => {
      fakeFirmware()
      api.use(http.get(apiUrl('firmware'), () => new Promise<never>(() => {})))
      const screen = await mountFirmware()

      await expect.element(syncButton(screen)).toBeDisabled()
    })

    it('says with the server\'s reason that it could not sync, and syncs on "Try again"', async () => {
      const faked = fakeFirmware()
      faked.syncAnswer = apiErrorResponse({ statusCode: 502, code: 'upstream-unreachable', details: { reason: 'usetrmnl.com did not answer within 15 seconds.' } })
      const screen = await mountLoadedFirmware()
      faked.library = { ...faked.library, lastSync: { ranAt: NOW, ok: false, error: 'usetrmnl.com did not answer within 15 seconds.' } }

      await syncButton(screen).click()

      const notice = screen.getByRole('alert')
      await expect.element(notice).toHaveTextContent('Could not sync from TRMNL. usetrmnl.com did not answer within 15 seconds.')
      await expect.element(screen.getByText('Last check of TRMNL failed just now')).toBeVisible()
      expect(syncLine(screen)).toBe('')
      await expect.element(syncButton(screen)).toBeEnabled()

      faked.syncAnswer = { ranAt: NOW, inserted: false, version: '1.7.9', assigned: [] }
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.poll(() => syncLine(screen)).toBe('Nothing new. 1.7.9 is still TRMNL\'s newest official Firmware.')
      expect(screen.getByRole('alert').elements()).toEqual([])
      expect(faked.syncs).toBe(2)
    })
  })

  describe('delete a custom Firmware', () => {
    const lostAndStays = (dialog: Element) => [...dialog.querySelectorAll('dl > div')].map(line => [...line.children].map(words).join(' '))

    it('offers no "Delete" on an official Firmware', async () => {
      fakeFirmware()
      const screen = await mountLoadedFirmware()

      await expect.element(screen.getByRole('region', { name: 'Available Firmware' })).toBeVisible()
      expect(screen.getByRole('button', { name: /^Delete Firmware/ }).elements().map(button => button.getAttribute('aria-label'))).toEqual(['Delete Firmware 1.8.0-rc2', 'Delete Firmware 2.0.3'])
    })

    it('asks first, naming the Device whose pending push is cancelled, and deletes on "Delete Firmware"', async () => {
      const faked = fakeFirmware()
      const screen = await mountLoadedFirmware()

      await screen.getByRole('button', { name: 'Delete Firmware 1.8.0-rc2' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Delete Firmware 1.8.0-rc2?' })
      await expect.element(dialog).toBeVisible()
      await expect.element(dialog.getByText('Study has it as its target Firmware, with a push pending. Deleting cancels that push.')).toBeVisible()
      expect(lostAndStays(dialog.element())).toEqual([
        'Lost Firmware 1.8.0-rc2 (Release candidate, battery fix) and its file. The pending push to Study.',
        'Stays Study goes on running the Firmware it has, with no target.',
      ])
      expect(faked.deleted).toEqual([])

      await dialog.getByRole('button', { name: 'Delete Firmware' }).click()

      await expect.poll(() => faked.deleted).toEqual(['candidate'])
      await expect.poll(() => rowsOf(screen.getByRole('main').element().querySelector('#available')).map(([version]) => version)).toEqual(['1.7.9', '2.0.3'])
    })

    it('says that every Device stays as it is where none has the Firmware as its target, and deletes one whose file is missing', async () => {
      const faked = fakeFirmware()
      const screen = await mountLoadedFirmware()

      await screen.getByRole('button', { name: 'Delete Firmware 2.0.3' }).click()

      const dialog = screen.getByRole('alertdialog', { name: 'Delete Firmware 2.0.3?' })
      await expect.element(dialog).toBeVisible()
      expect(lostAndStays(dialog.element())).toEqual([
        'Lost Firmware 2.0.3 (TRMNL X build).',
        'Stays Every Device goes on running the Firmware it has. No Device has this one as its target.',
      ])

      await dialog.getByRole('button', { name: 'Delete Firmware' }).click()

      await expect.poll(() => faked.deleted).toEqual(['x-build'])
    })

    it('keeps the Firmware and the confirmation open with the reason when the server refuses', async () => {
      fakeFirmware()
      api.use(http.delete(apiUrl('firmware/:id'), () => apiErrorResponse({ statusCode: 409, code: 'firmware-not-custom' })))
      const screen = await mountLoadedFirmware()

      await screen.getByRole('button', { name: 'Delete Firmware 2.0.3' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Delete Firmware' }).click()

      await expect.element(screen.getByRole('alertdialog').getByText('Only a custom Firmware can be deleted.')).toBeVisible()
    })

    it('leaves the Firmware alone on "Cancel"', async () => {
      const faked = fakeFirmware()
      const screen = await mountLoadedFirmware()

      await screen.getByRole('button', { name: 'Delete Firmware 2.0.3' }).click()
      await screen.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

      await expect.element(screen.getByRole('button', { name: 'Delete Firmware 2.0.3' })).toBeVisible()
      expect(faked.deleted).toEqual([])
    })
  })

  describe('empty, loading, failed', () => {
    it('says there is no Firmware yet under Firmware Auto-Update, with both ways to get one', async () => {
      const faked = fakeFirmware({ firmware: [], lastSync: null })
      const screen = await mountFirmware()

      await expect.element(screen.getByRole('heading', { level: 3, name: 'No Firmware yet' })).toBeVisible()
      await expect.element(screen.getByText('Kuroshiro fetches the official Firmware from TRMNL when it starts and every day at 04:00. This Instance has not reached TRMNL yet.')).toBeVisible()
      await expect.element(screen.getByRole('switch', { name: 'Firmware Auto-Update' })).toBeVisible()
      expect(screen.getByRole('region', { name: 'Available Firmware' }).elements()).toEqual([])
      const empty = screen.getByRole('main').element().querySelector('.empty-state')!
      expect([...empty.querySelectorAll('a, button')].map(words)).toEqual(['Sync from TRMNL', 'Upload Firmware'])
      expect(empty.querySelector('a')?.getAttribute('href')).toBe('/instance/firmware/upload')

      await screen.getByRole('button', { name: 'Sync from TRMNL' }).last().click()

      await expect.poll(() => faked.syncs).toBe(1)
    })

    it('says that it is loading the Firmware, over three rows of bars', async () => {
      fakeFirmware()
      api.use(http.get(apiUrl('firmware'), () => new Promise<never>(() => {})))
      const screen = await mountFirmware()

      await expect.element(screen.getByText('Loading the Firmware')).toBeVisible()
      expect(screen.getByRole('main').element().querySelectorAll('[aria-hidden="true"] .skeleton-row')).toHaveLength(3)
    })

    it('says that the Firmware could not be loaded, and loads it on "Try again"', async () => {
      fakeFirmware()
      api.use(http.get(apiUrl('firmware'), () => apiErrorResponse({ statusCode: 500, code: 'internal' }), { once: true }))
      const screen = await mountFirmware()

      await expect.element(screen.getByText('Could not load the Firmware.')).toBeVisible()

      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(screen.getByRole('region', { name: 'Available Firmware' })).toBeVisible()
      expect(screen.getByText('Could not load the Firmware.').elements()).toEqual([])
    })
  })

  it('is accessible and does not overflow', async () => {
    fakeFirmware()
    const screen = await mountFirmware()
    await expect.element(screen.getByRole('region', { name: 'Available Firmware' })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
