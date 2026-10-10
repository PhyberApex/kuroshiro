import type { StorageFinding } from 'kuroshiro-shared'
import type { Locator } from 'vitest/browser'
import type { Screen } from '@/pages/devices/__test__/deviceSettingsHarness'
import { describe, expect, it } from 'vitest'
import { held, words } from '@/pages/devices/__test__/deviceSettingsHarness'
import { expectAccessible } from '@/testing/a11y'
import { apiErrorResponse } from '@/testing/api/server'
import { buildRetentionStatus, buildStorageCheck } from '@/testing/fixtures/maintenance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { freezeTime } from '@/testing/time'
import { fakeHousekeeping, mountHousekeeping } from './housekeepingHarness'

const NOW = '2026-10-03T07:35:00.000Z'

const FILE_GROUPS = ['Images no Screen uses', 'Folders of deleted Devices', 'Temporary files older than a day', 'Old uploads']
const SCREENS = 'Screens whose image is missing'

const CHECK = buildStorageCheck()
const NOTHING_FOUND = buildStorageCheck({ screenImages: { files: 212, bytes: 19_293_798 }, findings: [] })
const ONLY_THE_SCREEN = buildStorageCheck({ findings: CHECK.findings.filter(finding => finding.group === 'missingImage') })
const FALLBACK_FINDING: StorageFinding = { id: 'oldFallbackRender:fallback/v1/og_bwr-bw/error-abc.png', group: 'oldFallbackRender', path: 'fallback/v1/og_bwr-bw/error-abc.png', bytes: 51_200 }
const WITH_STALE_FALLBACK_RENDER = buildStorageCheck({ findings: [...CHECK.findings, FALLBACK_FINDING] })

const storedFiles = (screen: Screen) => screen.getByRole('region', { name: 'Stored files' })
const retention = (screen: Screen) => screen.getByRole('region', { name: 'Retention' })
const tick = (screen: Screen, group: string) => storedFiles(screen).getByRole('checkbox', { name: group, exact: true })
const group = (screen: Screen, name: string) => storedFiles(screen).getByRole('button', { name, exact: true })
const cleanUp = (screen: Screen) => storedFiles(screen).getByRole('button', { name: /^Clean up \d+ groups?$/ })
const runRetention = (screen: Screen) => retention(screen).getByRole('button', { name: 'Run Retention now' })
const dialog = (screen: Screen) => screen.getByRole('alertdialog')

/** What a section's status line says, a bold start included. */
const statusOf = (section: Locator) => words(section.element().querySelector('.result-line'))
const noticeOf = (section: Locator) => words(section.element().querySelector('.notice [role="alert"]'))
const lastRunOf = (screen: Screen) => words(retention(screen).element().querySelector('.last-run'))

/** Each row's name, count and size. */
function rowsOf(screen: Screen) {
  return [...storedFiles(screen).element().querySelectorAll('li.finding-row')]
    .map(row => [row.querySelector('.trigger'), ...row.querySelectorAll('.facts > span')].map(words).filter(Boolean).join(' '))
}

/** The confirmation's "Lost" and "Stays", each as the words of its value. */
function outcomeOf(screen: Screen) {
  const rows = [...dialog(screen).element().querySelectorAll('dl > div')]
  return Object.fromEntries(rows.map(row => [words(row.querySelector('dt')), words(row.querySelector('dd'))]))
}

async function openHousekeeping(faked: Parameters<typeof fakeHousekeeping>[0] = {}) {
  freezeTime(NOW)
  const fake = fakeHousekeeping(faked)
  const screen = await mountHousekeeping()
  return { fake, screen }
}

async function waitForTheFindings(screen: Screen) {
  await expect.element(tick(screen, FILE_GROUPS[0]!)).toBeVisible()
}

describe('housekeeping', () => {
  it('is a page of the Instance frame with its lede', async () => {
    const { screen } = await openHousekeeping()

    await expect.element(screen.getByRole('navigation', { name: 'Instance' }).getByRole('link', { name: 'Housekeeping' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByText('What Kuroshiro keeps that nothing needs any more, and what removes it.')).toBeVisible()
  })

  describe('stored files', () => {
    it('checks them on opening and lists the findings by group in the spec\'s order, with the Screen image totals', async () => {
      const { fake, screen } = await openHousekeeping()
      await waitForTheFindings(screen)

      expect(fake.checked).toBe(1)
      await expect.element(storedFiles(screen).getByText('Screen images take 22.4 MB in 224 files. Checked just now.')).toBeVisible()
      expect(rowsOf(screen)).toEqual([
        'Images no Screen uses 2 files 252 KB',
        'Folders of deleted Devices 1 folder 1.3 MB',
        'Temporary files older than a day 1 file 40 KB',
        'Old uploads 2 files 2.2 MB',
        'Screens whose image is missing 1 Screen',
      ])
    })

    it('opens a group in place to what it holds: paths below the storage folder with their sizes, or the Screens', async () => {
      const { screen } = await openHousekeeping()
      await waitForTheFindings(screen)

      await group(screen, 'Images no Screen uses').click()
      const images = storedFiles(screen).getByRole('region', { name: 'Images no Screen uses' })
      await expect.element(images.getByText('2 image files left behind by Screens that were deleted or replaced.')).toBeVisible()
      expect([...images.element().querySelectorAll('li')].map(words)).toEqual([
        'devices/7c9e6679-7425-40de-944b-e07fc1f90ae7/8e41.png 64 KB',
        'devices/7c9e6679-7425-40de-944b-e07fc1f90ae7/8e41.original 188 KB',
      ])

      await group(screen, 'Folders of deleted Devices').click()
      const folders = storedFiles(screen).getByRole('region', { name: 'Folders of deleted Devices' })
      await expect.element(folders.getByText('devices/0d44a1f0-3c5e-4b7a-8d21-6f0e9a4c9b17')).toBeVisible()
      await expect.element(folders.getByText('1.3 MB · 14 files')).toBeVisible()

      await group(screen, SCREENS).click()
      const screens = storedFiles(screen).getByRole('region', { name: SCREENS })
      await expect.element(screens.getByText('The Screen “Holiday photo” on Kitchen and its Schedule. Its image is already gone, so Kitchen shows the error Fallback Screen at its turn today.')).toBeVisible()
      expect([...screens.element().querySelectorAll('li')].map(words)).toEqual(['Holiday photo, a File Screen on Kitchen Order 4'])
    })

    it('lists a stale Fallback Screen render as its own group, worded and ticked like the other file groups', async () => {
      const { screen } = await openHousekeeping({ checks: [WITH_STALE_FALLBACK_RENDER] })
      await waitForTheFindings(screen)
      const name = 'Stale Fallback Screen renders'

      await expect.element(tick(screen, name)).toBeChecked()
      expect(rowsOf(screen)).toContain(`${name} 1 file 50 KB`)

      await group(screen, name).click()
      const opened = storedFiles(screen).getByRole('region', { name })
      await expect.element(opened.getByText('Fallback Screen drawn for an older look, or for a Device Model and Palette no Device uses.')).toBeVisible()
      expect([...opened.element().querySelectorAll('li')].map(words)).toEqual(['fallback/v1/og_bwr-bw/error-abc.png 50 KB'])
    })

    it('says it is checking while the check runs, and checks again on "Check again"', async () => {
      const { fake, screen } = await openHousekeeping({ checks: [CHECK, NOTHING_FOUND] })
      await waitForTheFindings(screen)
      const hold = held()
      fake.holdingChecks = hold.promise

      await storedFiles(screen).getByRole('button', { name: 'Check again' }).click()

      await expect.element(storedFiles(screen).getByText('Checking stored files')).toBeVisible()
      expect(tick(screen, FILE_GROUPS[0]!).elements()).toEqual([])
      hold.release()
      await expect.element(storedFiles(screen).getByText('Nothing to clean up. Screen images take 18.4 MB in 212 files.')).toBeVisible()
      expect(fake.checked).toBe(2)
    })

    it('says there is nothing to clean up when the check finds nothing, with no button to clean up', async () => {
      const { screen } = await openHousekeeping({ checks: [NOTHING_FOUND] })

      await expect.element(storedFiles(screen).getByText('Nothing to clean up. Screen images take 18.4 MB in 212 files.')).toBeVisible()
      expect(storedFiles(screen).getByRole('checkbox').elements()).toEqual([])
      expect(storedFiles(screen).getByRole('button', { name: /^Clean up/ }).elements()).toEqual([])
    })

    it('says it could not check, with "Try again", while Retention stays usable', async () => {
      const { fake, screen } = await openHousekeeping({ checks: [apiErrorResponse({ statusCode: 500, code: 'internal', message: 'Internal server error' }), CHECK] })

      await expect.element(storedFiles(screen).getByText('Could not check the stored files.')).toBeVisible()
      await expect.element(runRetention(screen)).toBeEnabled()
      await expect.element(retention(screen).getByText('Every day at 04:00, server time, Retention deletes resolved Alerts older than 90 days and Device Log entries older than 30 days.')).toBeVisible()

      await storedFiles(screen).getByRole('button', { name: 'Try again' }).click()
      await waitForTheFindings(screen)
      expect(fake.checked).toBe(2)
    })
  })

  describe('clean up', () => {
    it('ticks the four groups of files and leaves the Screens unticked, and says so under the rows', async () => {
      const { screen } = await openHousekeeping()
      await waitForTheFindings(screen)

      for (const name of FILE_GROUPS)
        await expect.element(tick(screen, name)).toBeChecked()
      await expect.element(tick(screen, SCREENS)).not.toBeChecked()
      await expect.element(storedFiles(screen).getByText('A Screen whose image is missing is left alone unless you tick it.')).toBeVisible()
      await expect.element(cleanUp(screen)).toHaveAccessibleName('Clean up 4 groups')
    })

    it('counts the ticked groups on the button and is disabled with none ticked', async () => {
      const { fake, screen } = await openHousekeeping()
      await waitForTheFindings(screen)

      await tick(screen, SCREENS).click()
      await expect.element(cleanUp(screen)).toHaveAccessibleName('Clean up 5 groups')
      for (const name of [...FILE_GROUPS, SCREENS])
        await tick(screen, name).click()

      await expect.element(cleanUp(screen)).toHaveAccessibleName('Clean up 0 groups')
      await expect.element(cleanUp(screen)).toBeDisabled()
      await cleanUp(screen).click({ force: true })
      expect(dialog(screen).elements()).toEqual([])
      expect(fake.cleanups).toEqual([])
    })

    it('confirms what is lost and what stays, the Screen staying and showing the error Fallback Screen while it is unticked', async () => {
      const { screen } = await openHousekeeping()
      await waitForTheFindings(screen)

      await cleanUp(screen).click()

      await expect.element(dialog(screen).getByRole('heading', { name: 'Clean up 4 groups?' })).toBeVisible()
      expect(outcomeOf(screen)).toEqual({
        Lost: 'Images no Screen uses: 2 files, 252 KB. Folders of deleted Devices: 1 folder, 1.3 MB. Temporary files older than a day: 1 file, 40 KB. Old uploads: 2 files, 2.2 MB.',
        Stays: 'Every Screen that has its image, and every Device. The Screen “Holiday photo”, at whose turn Kitchen shows the error Fallback Screen.',
      })
      expect(words(dialog(screen).element())).not.toContain('skipping')
    })

    it('puts the Screen among what is lost once its group is ticked, and says so under the rows', async () => {
      const { screen } = await openHousekeeping()
      await waitForTheFindings(screen)

      await tick(screen, SCREENS).click()
      await expect.element(storedFiles(screen).getByText('Cleaning up deletes 1 Screen.')).toBeVisible()
      await cleanUp(screen).click()

      await expect.element(dialog(screen).getByRole('heading', { name: 'Clean up 5 groups?' })).toBeVisible()
      expect(outcomeOf(screen).Lost).toContain('The Screen “Holiday photo” on Kitchen and its Schedule.')
      expect(outcomeOf(screen).Stays).toBe('Every Screen that has its image, and every Device.')
    })

    it('removes nothing until it is confirmed', async () => {
      const { fake, screen } = await openHousekeeping()
      await waitForTheFindings(screen)

      await cleanUp(screen).click()
      await dialog(screen).getByRole('button', { name: 'Cancel' }).click()

      await expect.poll(() => dialog(screen).elements()).toEqual([])
      expect(fake.cleanups).toEqual([])
      await expect.element(tick(screen, FILE_GROUPS[0]!)).toBeChecked()
    })

    it('removes the ticked groups by their finding ids, says what went and checks again', async () => {
      const { fake, screen } = await openHousekeeping({
        checks: [CHECK, ONLY_THE_SCREEN],
        cleanup: { removed: { files: 5, folders: 1, screens: 0, bytes: 3_969_024 }, failed: [] },
      })
      await waitForTheFindings(screen)

      await cleanUp(screen).click()
      await dialog(screen).getByRole('button', { name: 'Clean up' }).click()

      await expect.poll(() => statusOf(storedFiles(screen))).toBe('Cleaned up. Removed 5 files and 1 folder, 3.8 MB.')
      expect(fake.cleanups).toEqual([CHECK.findings.filter(finding => finding.group !== 'missingImage').map(finding => finding.id)])
      expect(fake.checked).toBe(2)
      await expect.element(storedFiles(screen).getByRole('button', { name: 'Check again' })).toHaveFocus()
      await expect.element(tick(screen, SCREENS)).not.toBeChecked()
      expect(tick(screen, FILE_GROUPS[0]!).elements()).toEqual([])
    })

    it('says nothing is left to clean up once a clean-up took everything', async () => {
      const { screen } = await openHousekeeping({
        checks: [CHECK, NOTHING_FOUND],
        cleanup: { removed: { files: 5, folders: 1, screens: 1, bytes: 3_969_024 }, failed: [] },
      })
      await waitForTheFindings(screen)
      await tick(screen, SCREENS).click()

      await cleanUp(screen).click()
      await dialog(screen).getByRole('button', { name: 'Clean up' }).click()

      await expect.poll(() => statusOf(storedFiles(screen))).toBe('Cleaned up. Removed 5 files, 1 folder and 1 Screen, 3.8 MB. Nothing to clean up. Screen images take 18.4 MB in 212 files.')
    })

    it('keeps listing what the server could not remove, under a notice with its reasons', async () => {
      const [unused] = CHECK.findings
      const leftOver = buildStorageCheck({ findings: [unused!] })
      const { screen } = await openHousekeeping({
        checks: [CHECK, leftOver],
        cleanup: { removed: { files: 4, folders: 1, screens: 0, bytes: 3_903_488 }, failed: [{ findingId: unused!.id, reason: 'The server could not delete it (EACCES).' }] },
      })
      await waitForTheFindings(screen)

      await cleanUp(screen).click()
      await dialog(screen).getByRole('button', { name: 'Clean up' }).click()

      await expect.poll(() => noticeOf(storedFiles(screen))).toBe('1 could not be removed. devices/7c9e6679-7425-40de-944b-e07fc1f90ae7/8e41.png: The server could not delete it (EACCES).')
      await expect.element(tick(screen, 'Images no Screen uses')).toBeVisible()
      expect(rowsOf(screen)).toEqual(['Images no Screen uses 1 file 64 KB'])
      expect(statusOf(storedFiles(screen))).toBe('Cleaned up. Removed 4 files and 1 folder, 3.7 MB.')
    })
  })

  describe('retention', () => {
    it('says what Retention deletes, when it last ran, and links to where the ages are changed', async () => {
      const { screen } = await openHousekeeping()

      await expect.element(retention(screen).getByText('Every day at 04:00, server time, Retention deletes resolved Alerts older than 90 days and Device Log entries older than 30 days.')).toBeVisible()
      await expect.poll(() => lastRunOf(screen)).toBe('Last Retention Run 5 h ago: removed 3 resolved Alerts and 1,284 Device Log entries.')
      await expect.element(retention(screen).getByRole('link', { name: 'Change the ages' })).toHaveAttribute('href', '/instance/settings#retention')
    })

    it('says when it has not run since Kuroshiro was started, and words an age of 0', async () => {
      const { screen } = await openHousekeeping({ retention: buildRetentionStatus({ ages: { alertRetentionDays: 0, deviceLogRetentionDays: 30 }, lastRun: null }) })

      await expect.element(retention(screen).getByText('Every day at 04:00, server time, Retention deletes Device Log entries older than 30 days. Resolved Alerts are kept for good.')).toBeVisible()
      await expect.element(retention(screen).getByText('Retention has not run since Kuroshiro was started.')).toBeVisible()
    })

    it('is off while both ages are 0, and cannot be run', async () => {
      const { fake, screen } = await openHousekeeping({ retention: buildRetentionStatus({ ages: { alertRetentionDays: 0, deviceLogRetentionDays: 0 } }) })

      await expect.element(retention(screen).getByText('Retention is off: both ages are 0.')).toBeVisible()
      await expect.element(runRetention(screen)).toBeDisabled()
      await runRetention(screen).click({ force: true })
      expect(fake.runs).toEqual([])
    })

    it('counts what is old enough first, then confirms and runs', async () => {
      const { fake, screen } = await openHousekeeping({ dryRun: { alertsPruned: 0, deviceLogsPruned: 212 }, run: { alertsPruned: 0, deviceLogsPruned: 214 } })
      const hold = held()
      fake.holdingRuns = hold.promise

      await runRetention(screen).click()
      await expect.element(retention(screen).getByText('Counting what is old enough')).toBeVisible()
      hold.release()

      await expect.element(dialog(screen).getByRole('heading', { name: 'Run Retention now?' })).toBeVisible()
      expect(outcomeOf(screen)).toEqual({
        Lost: '212 Device Log entries older than 30 days. No resolved Alert is old enough.',
        Stays: 'Firing Alerts, and everything newer than the ages.',
      })
      expect(fake.runs).toEqual([true])
      fake.retention = buildRetentionStatus({ lastRun: { ranAt: NOW, alertsPruned: 0, deviceLogsPruned: 214 } })

      await dialog(screen).getByRole('button', { name: 'Run Retention' }).click()

      await expect.poll(() => statusOf(retention(screen))).toBe('Retention Run finished. Removed 0 resolved Alerts and 214 Device Log entries.')
      expect(fake.runs).toEqual([true, false])
      await expect.poll(() => lastRunOf(screen)).toBe('Last Retention Run just now: removed 0 resolved Alerts and 214 Device Log entries.')
    })

    it('asks nothing when nothing is old enough to remove', async () => {
      const { fake, screen } = await openHousekeeping({ dryRun: { alertsPruned: 0, deviceLogsPruned: 0 } })

      await runRetention(screen).click()

      await expect.element(retention(screen).getByText('Nothing is old enough to remove.')).toBeVisible()
      expect(dialog(screen).elements()).toEqual([])
      expect(fake.runs).toEqual([true])
    })

    it('runs nothing when the confirmation is cancelled', async () => {
      const { fake, screen } = await openHousekeeping()

      await runRetention(screen).click()
      await dialog(screen).getByRole('button', { name: 'Cancel' }).click()

      await expect.poll(() => dialog(screen).elements()).toEqual([])
      expect(fake.runs).toEqual([true])
    })

    it('says why it could not count what is old enough', async () => {
      const { screen } = await openHousekeeping({ dryRun: apiErrorResponse({ statusCode: 500, code: 'internal', message: 'Internal server error' }) })

      await runRetention(screen).click()

      await expect.poll(() => noticeOf(retention(screen))).toBe('Could not run Retention. Something went wrong on the server.')
      expect(dialog(screen).elements()).toEqual([])
    })
  })

  it('says it could not load Housekeeping when the Retention status does not load', async () => {
    const { screen } = await openHousekeeping({ retention: apiErrorResponse({ statusCode: 500, code: 'internal', message: 'Internal server error' }) })

    await expect.element(screen.getByText('Could not load Housekeeping.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  it('is accessible and does not overflow, with a group open', async () => {
    const { screen } = await openHousekeeping()
    await waitForTheFindings(screen)
    await group(screen, 'Images no Screen uses').click()
    await expect.element(storedFiles(screen).getByRole('region', { name: 'Images no Screen uses' })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
