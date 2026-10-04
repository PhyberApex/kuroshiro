import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { buildImportCheck } from '@/testing/fixtures/configuration'
import { expectPageScreenshots } from '@/testing/screenshots'
import { archiveFile, fakeArchive, mountArchive, REDACTED_WARNINGS } from './__test__/configurationArchiveHarness'

describe('configuration Archive', () => {
  it('with a Redacted Archive read, before the import is confirmed', async () => {
    fakeArchive({ check: buildImportCheck({ archive: { ...buildImportCheck().archive, redacted: true }, warnings: REDACTED_WARNINGS }) })
    const screen = await mountArchive()
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()
    await userEvent.upload(screen.getByLabelText('Choose file'), archiveFile())
    await expect.element(screen.getByRole('button', { name: 'Import Configuration Archive' })).toBeVisible()

    await expectPageScreenshots('configuration-archive')
  })
})
