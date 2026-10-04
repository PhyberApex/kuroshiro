import type { Screen } from '@/pages/devices/__test__/deviceSettingsHarness'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { held, words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { catchDownloads } from '@/pages/plugins/__test__/pluginPageHarness'
import { exactTime } from '@/patterns/time'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildImportCheck, buildImportSummary } from '@/testing/fixtures/configuration'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { archiveFile, fakeArchive, mountArchive, REDACTED_WARNING_LINES, REDACTED_WARNINGS } from './configurationArchiveHarness'

const SECRETS_WARNING = 'Holds every Device API key, mirror API key, Webhook Token, Data Source header and password Field Value as written. Keep it like a password.'
const MADE_FOR_FRESH = 'Made for a fresh Instance, like this one. Kuroshiro reads the archive first and changes nothing until you confirm.'
const DROP_HERE = 'Drop a Configuration Archive here: the .zip a Configuration Export made.'

const section = (screen: Screen, name: string) => screen.getByRole('region', { name })
const exporting = (screen: Screen) => section(screen, 'Configuration Export')
const importing = (screen: Screen) => section(screen, 'Configuration Import')
const fileInput = (screen: Screen) => screen.getByLabelText('Choose file')
const confirm = (screen: Screen) => screen.getByRole('button', { name: 'Import Configuration Archive' })

/** What a value says, its lines joined by a space: `textContent` joins blocks without one. */
function linesOf(value: Element) {
  const blocks = [...value.querySelectorAll(':scope > :not(ul), li')]
  return blocks.length === 0 ? words(value) : blocks.map(words).join(' ')
}

/** The summary as rows of label and value, the lines of a value joined by a space. */
function summaryOf(screen: Screen) {
  const rows = [...importing(screen).element().querySelectorAll('dl > div')]
  return Object.fromEntries(rows.map(row => [words(row.querySelector('dt')), linesOf(row.querySelector('dd')!)]))
}

const problemsOf = (screen: Screen) => [...importing(screen).element().querySelectorAll('dd li')].map(words)

async function choose(screen: Screen, file = archiveFile()) {
  await userEvent.upload(fileInput(screen), file)
}

async function read(screen: Screen, file = archiveFile()) {
  await choose(screen, file)
  await expect.element(confirm(screen)).toBeVisible()
}

describe('configuration Archive', () => {
  it('is a page of the Instance frame that says what an archive holds', async () => {
    fakeArchive()
    const screen = await mountArchive()

    await expect.element(screen.getByRole('navigation', { name: 'Instance' }).getByRole('link', { name: 'Configuration Archive' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByText('One .zip holding what you built on this Instance: Devices, Screens with their Schedules, Mashups, Plugins with their Field Values, custom Palettes and the Instance Settings you set.')).toBeVisible()
  })

  describe('configuration Export', () => {
    it('warns of the secrets before the button is pressed, and downloads the archive at once', async () => {
      fakeArchive()
      const downloads = catchDownloads()
      const screen = await mountArchive()
      const row = exporting(screen).getByRole('group', { name: 'With its secrets' })

      await expect.element(row.getByText('The archive to restore from. Devices keep their API keys, so they go on polling a restored Instance without being set up again.')).toBeVisible()
      await expect.element(row.getByText(SECRETS_WARNING)).toBeVisible()
      expect(downloads).toEqual([])

      await row.getByRole('button', { name: 'Export', exact: true }).click()

      expect(downloads).toEqual([apiUrl('config/export')])
      await expect.element(row.getByRole('button', { name: 'Download started' })).toBeVisible()
      await expect.element(exporting(screen).getByRole('button', { name: 'Export redacted' })).toBeVisible()
      await expect.element(row.getByRole('button', { name: 'Export', exact: true })).toBeVisible()
    })

    it('downloads a Redacted Archive from its own button, and says what neither archive holds', async () => {
      fakeArchive()
      const downloads = catchDownloads()
      const screen = await mountArchive()
      const row = exporting(screen).getByRole('group', { name: 'Redacted Archive' })

      await expect.element(row.getByText('The same with every secret replaced by a placeholder. Safe to share or to keep in a repository. Restored onto a fresh Instance, each Device and Webhook sender has to be set up again.')).toBeVisible()
      await row.getByRole('button', { name: 'Export redacted' }).click()

      expect(downloads).toEqual([`${apiUrl('config/export')}?redact=true`])
      await expect.element(row.getByRole('button', { name: 'Download started' })).toBeVisible()
      await expect.element(exporting(screen).getByText('Not in either: rendered images, Webhook Payloads, Sensor readings, Device Logs, Alerts, the files of custom Firmware and anything synced from TRMNL. A File Screen\'s image is included.')).toBeVisible()
    })
  })

  describe('configuration Import', () => {
    it('says on an Instance with Devices how many it has, over the drop zone', async () => {
      fakeArchive()
      const screen = await mountArchive()

      await expect.element(importing(screen).getByText('Made for a fresh Instance. This one already has 1 Device, so read what an import would change before you confirm it. Kuroshiro reads the archive first and changes nothing until you confirm.')).toBeVisible()
      await expect.element(importing(screen).getByText(DROP_HERE)).toBeVisible()
    })

    it('says on a fresh Instance that an import is made for it', async () => {
      fakeArchive({ devices: [] })
      const screen = await mountArchive()

      await expect.element(importing(screen).getByText(MADE_FOR_FRESH)).toBeVisible()
    })

    it('reads a chosen archive without importing it, and says what importing it would do', async () => {
      const faked = fakeArchive({ check: buildImportCheck({ archive: { ...buildImportCheck().archive, redacted: true }, warnings: REDACTED_WARNINGS }) })
      const reading = held()
      faked.holding = reading.promise
      const screen = await mountArchive()

      await choose(screen)

      await expect.element(importing(screen).getByText('Reading kuroshiro-config-2026-09-28.zip')).toBeVisible()
      expect(importing(screen).getByRole('button', { name: 'Import Configuration Archive' }).elements()).toEqual([])

      reading.release()

      await expect.element(confirm(screen)).toBeVisible()
      expect(summaryOf(screen)).toEqual({
        Archive: `kuroshiro-config-2026-09-28.zip A Redacted Archive from Kuroshiro 0.17.1, exported ${exactTime(new Date('2026-09-28T19:14:00.000Z'))}.`,
        Adds: '1 Device (Hallway), 4 Plugins, 9 Screens with their Schedules, 1 Mashup, 1 custom Palette, 1 custom Firmware',
        Overwrites: '1 Device (Kitchen), 6 Plugins and 5 Screens that are already here under the same id. What you changed on them since the export is lost.',
        Replaces: 'The Instance Settings, with the 2 the archive holds. The others go back to their fallback.',
        Leaves: 'Everything here that is not in the archive. An import deletes nothing.',
        Mind: REDACTED_WARNING_LINES.join(' '),
      })
      expect(problemsOf(screen)).toEqual(REDACTED_WARNING_LINES)
      await expect.element(importing(screen).getByText('Nothing has changed yet.')).toBeVisible()
      expect(faked.sent).toEqual([{ asked: 'check', file: 'kuroshiro-config-2026-09-28.zip' }])
    })

    it('goes back to choosing a file on "Cancel", with nothing imported', async () => {
      const faked = fakeArchive()
      const screen = await mountArchive()
      await read(screen)

      await importing(screen).getByRole('button', { name: 'Cancel' }).click()

      await expect.element(importing(screen).getByText(DROP_HERE)).toBeVisible()
      await expect.element(fileInput(screen)).toHaveFocus()
      expect(importing(screen).element().querySelector('dl')).toBeNull()
      expect(faked.sent.map(sent => sent.asked)).toEqual(['check'])
    })

    it('imports once it is confirmed, says what it did and what to do now, and gives the bar the imported Devices', async () => {
      const faked = fakeArchive({
        check: buildImportCheck({ warnings: REDACTED_WARNINGS }),
        summary: buildImportSummary({ warnings: REDACTED_WARNINGS }),
      })
      const screen = await mountArchive()
      await read(screen)
      expect(screen.getByRole('banner').getByRole('link', { name: 'Hallway' }).elements()).toEqual([])

      await confirm(screen).click()

      await expect.element(importing(screen).getByText('Imported. Added 17 records and overwrote 12. The Instance Settings were replaced.')).toBeVisible()
      expect(faked.sent).toEqual([
        { asked: 'check', file: 'kuroshiro-config-2026-09-28.zip' },
        { asked: 'import', file: 'kuroshiro-config-2026-09-28.zip' },
      ])
      expect(Object.keys(summaryOf(screen))).toEqual(['To do now'])
      expect(problemsOf(screen)).toEqual(REDACTED_WARNING_LINES)
      await expect.element(importing(screen).getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices')
      await expect.element(importing(screen).getByRole('link', { name: 'Plugins' })).toHaveAttribute('href', '/plugins')
      await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Hallway' })).toBeVisible()
      expect(importing(screen).getByText('Made for a fresh Instance', { exact: false }).elements()).toEqual([])

      await importing(screen).getByRole('button', { name: 'Import another' }).click()

      await expect.element(importing(screen).getByText('Made for a fresh Instance. This one already has 2 Devices, so read what an import would change before you confirm it.', { exact: false })).toBeVisible()
      await expect.element(importing(screen).getByText(DROP_HERE)).toBeVisible()
      await expect.element(fileInput(screen)).toHaveFocus()
    })

    it('has nothing "To do now" after an import without warnings', async () => {
      fakeArchive()
      const screen = await mountArchive()
      await read(screen)

      await confirm(screen).click()

      await expect.element(importing(screen).getByText('Imported.', { exact: false })).toBeVisible()
      expect(importing(screen).element().querySelector('dl')).toBeNull()
    })

    it('leaves "Overwrites", "Leaves" and "Mind" out on a fresh Instance the archive overwrites nothing on', async () => {
      fakeArchive({ devices: [], check: buildImportCheck({ overwrites: {}, devices: { added: [{ id: 'hallway', name: 'Hallway' }], overwritten: [] } }) })
      const screen = await mountArchive()

      await read(screen)

      expect(Object.keys(summaryOf(screen))).toEqual(['Archive', 'Adds', 'Replaces'])
    })

    it('says "Nothing" for an archive that adds nothing, and keeps "Leaves" where there is something to leave', async () => {
      fakeArchive({ check: buildImportCheck({ adds: {}, overwrites: {}, devices: { added: [], overwritten: [] }, settings: { overridden: 0 } }) })
      const screen = await mountArchive()

      await read(screen)

      expect(summaryOf(screen)).toMatchObject({ Adds: 'Nothing', Replaces: 'The Instance Settings. The archive holds none, so every one goes back to its fallback.' })
      expect(Object.keys(summaryOf(screen))).toEqual(['Archive', 'Adds', 'Replaces', 'Leaves'])
    })

    describe('refused', () => {
      async function refusedWith(answer: Response) {
        const faked = fakeArchive({ check: answer })
        const screen = await mountArchive()
        await choose(screen)
        await expect.element(importing(screen).getByRole('alert')).toBeVisible()
        expect(importing(screen).element().querySelector('dl')).toBeNull()
        expect(confirm(screen).elements()).toEqual([])
        return { faked, screen, said: words(importing(screen).getByRole('alert').element()) }
      }

      it('names both versions for an archive of another archive version', async () => {
        const { said } = await refusedWith(apiErrorResponse({ statusCode: 400, code: 'archive-schema-version', details: { archive: 1, expected: 3 } }))

        expect(said).toBe('This archive cannot be imported. It was made with archive version 1, and this Kuroshiro reads version 3. Export it again from an Instance running Kuroshiro 0.18.0.')
      })

      it('says what is not a Configuration Archive, and lets another file be chosen', async () => {
        const { faked, screen, said } = await refusedWith(apiErrorResponse({ statusCode: 400, code: 'archive-not-configuration' }))

        expect(said).toBe('This is not a Configuration Archive. It has to be the .zip a Configuration Export made.')

        await importing(screen).getByRole('button', { name: 'Choose another file' }).click()

        await expect.element(importing(screen).getByText(DROP_HERE)).toBeVisible()
        await expect.element(fileInput(screen)).toHaveFocus()
        faked.checkAnswer = buildImportCheck()
        await read(screen)
        expect(faked.sent.map(sent => sent.asked)).toEqual(['check', 'check'])
      })

      it('gives the server\'s reason for a record the database refuses', async () => {
        const { said } = await refusedWith(apiErrorResponse({ statusCode: 422, code: 'archive-record-refused', details: { entity: 'Screen', id: 'photo', reason: 'It names a Device that is not in the archive' } }))

        expect(said).toBe('This archive cannot be imported. Screen photo: It names a Device that is not in the archive. Nothing was changed.')
      })

      it('says so when the archive could not be read at all', async () => {
        const { said } = await refusedWith(HttpResponse.error())

        expect(said).toBe('This archive could not be read. Kuroshiro\'s server is not answering.')
      })
    })

    it('shows the notice in place of the summary when the import itself is refused', async () => {
      const faked = fakeArchive()
      const screen = await mountArchive()
      await read(screen)
      faked.importAnswer = apiErrorResponse({ statusCode: 500, code: 'internal' })

      await confirm(screen).click()

      await expect.element(importing(screen).getByRole('alert')).toHaveTextContent('This archive could not be imported. Something went wrong on the server.')
      expect(importing(screen).element().querySelector('dl')).toBeNull()
      await expect.element(importing(screen).getByRole('button', { name: 'Choose another file' })).toBeVisible()
    })

    it('does not send a file that is no .zip or is over the Instance\'s limit', async () => {
      const faked = fakeArchive({ archiveUploadBytes: 1024 * 1024 })
      const screen = await mountArchive()

      await choose(screen, archiveFile('notes.txt'))
      await expect.element(importing(screen).getByText('A Configuration Archive is a .zip.')).toBeVisible()

      await choose(screen, archiveFile('huge.zip', 2 * 1024 * 1024))
      await expect.element(importing(screen).getByText('This file is 2 MB. A Configuration Archive can be up to 1 MB.')).toBeVisible()
      expect(faked.sent).toEqual([])
    })

    it('says so in place of the drop zone when the Instance cannot be loaded', async () => {
      fakeArchive()
      api.use(http.get(apiUrl('devices'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
      const screen = await mountApp({ at: '/instance/archive' })

      await expect.element(importing(screen).getByRole('alert')).toHaveTextContent('Could not load the Instance. Something went wrong on the server.')
      expect(fileInput(screen).elements()).toEqual([])
      await expect.element(exporting(screen).getByRole('button', { name: 'Export redacted' })).toBeVisible()
    })

    it('does not import twice when the button is pressed again while the import runs', async () => {
      const faked = fakeArchive()
      const screen = await mountArchive()
      await read(screen)
      const running = held()
      faked.holding = running.promise

      await confirm(screen).click()
      await expect.element(confirm(screen)).toHaveAttribute('aria-busy', 'true')
      await confirm(screen).click({ force: true })
      running.release()

      await expect.element(importing(screen).getByText('Imported.', { exact: false })).toBeVisible()
      expect(faked.sent.map(sent => sent.asked)).toEqual(['check', 'import'])
    })
  })

  it('is accessible and does not overflow, with an archive read', async () => {
    fakeArchive({ check: buildImportCheck({ warnings: REDACTED_WARNINGS }) })
    const screen = await mountArchive()
    await read(screen)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
