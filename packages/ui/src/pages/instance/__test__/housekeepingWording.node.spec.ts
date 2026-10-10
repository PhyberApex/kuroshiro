import type { StorageFinding } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { buildStorageCheck } from '@/testing/fixtures/maintenance'
import {
  cleanedSentence,
  cleanUpLabel,
  findingGroups,
  findingLine,
  lostLines,
  nothingOldEnough,
  notRemoved,
  openedSentence,
  prunedCounts,
  retentionIsOff,
  retentionLost,
  retentionSentence,
  screenImagesSentence,
  screensLine,
  staysLines,
} from '../housekeepingWording'

const check = buildStorageCheck()
const groups = findingGroups(check.findings)
const fileGroups = groups.filter(group => group.group !== 'missingImage')

function screen(name: string, deviceName: string, order: number): StorageFinding {
  return {
    id: `missingImage:${name}`,
    group: 'missingImage',
    screen: { id: name, name, kind: 'file', deviceId: deviceName, deviceName, order },
  }
}

describe('the stored-files check in words', () => {
  it('says what the Screen images take', () => {
    expect(screenImagesSentence(check.screenImages)).toBe('Screen images take 22.4 MB in 224 files.')
    expect(screenImagesSentence({ files: 1, bytes: 2048 })).toBe('Screen images take 2 KB in 1 file.')
    expect(screenImagesSentence({ files: 0, bytes: 0 })).toBe('No Screen image is stored yet.')
  })

  it('groups the findings in the spec\'s order, each with its count and size, leaving out a group that has none', () => {
    expect(groups.map(({ name, count, size }) => [name, count, size])).toEqual([
      ['Images no Screen uses', '2 files', '252 KB'],
      ['Folders of deleted Devices', '1 folder', '1.3 MB'],
      ['Temporary files older than a day', '1 file', '40 KB'],
      ['Old uploads', '2 files', '2.2 MB'],
      ['Screens whose image is missing', '1 Screen', undefined],
    ])
    expect(findingGroups(check.findings.slice(4)).map(group => group.group)).toEqual(['oldUpload', 'missingImage'])
    expect(findingGroups([])).toEqual([])
  })

  it('says what an opened group holds, one or several', () => {
    expect(groups.map(openedSentence)).toEqual([
      '2 image files left behind by Screens that were deleted or replaced.',
      'The image folder of a Device that is no longer registered.',
      '1 leftover of a render that did not finish.',
      '2 files an earlier version of Kuroshiro left in the uploads folder. Nothing reads them.',
      'The Screen “Holiday photo” on Kitchen and its Schedule. Its image is already gone, so Kitchen shows the error Fallback Screen at its turn today.',
    ])
    expect(openedSentence(findingGroups([screen('A', 'Kitchen', 1), screen('B', 'Hallway', 2)])[0]!))
      .toBe('2 Screens and their Schedules. Their images are already gone, so their Devices show the error Fallback Screen at their turn today.')
  })

  it('groups a stale Fallback Screen render as its own group, worded one or several', () => {
    const first: StorageFinding = { id: 'oldFallbackRender:fallback/v1/og_bwr-bw/error-abc123.png', group: 'oldFallbackRender', path: 'fallback/v1/og_bwr-bw/error-abc123.png', bytes: 51_200 }
    const second: StorageFinding = { id: 'oldFallbackRender:fallback/v2/og_bwr-bw/error-def456.png', group: 'oldFallbackRender', path: 'fallback/v2/og_bwr-bw/error-def456.png', bytes: 10_240 }
    const [fallbackGroup] = findingGroups([first])

    expect(fallbackGroup).toMatchObject({ group: 'oldFallbackRender', name: 'Stale Fallback Screen renders', count: '1 file', size: '50 KB' })
    expect(openedSentence(fallbackGroup!)).toBe('Fallback Screen drawn for an older look, or for a Device Model and Palette no Device uses.')
    expect(openedSentence(findingGroups([first, second])[0]!))
      .toBe('2 Fallback Screens drawn for an older look, or for a Device Model and Palette no Device uses.')
    expect(findingLine(first)).toEqual({ what: 'fallback/v1/og_bwr-bw/error-abc123.png', detail: '50 KB', path: true })
  })

  it('says under the rows what happens to a Screen whose image is missing', () => {
    expect(screensLine(groups, ['unusedImage'])).toBe('A Screen whose image is missing is left alone unless you tick it.')
    expect(screensLine(groups, ['missingImage'])).toBe('Cleaning up deletes 1 Screen.')
    expect(screensLine(findingGroups([screen('A', 'Kitchen', 1), screen('B', 'Hallway', 2)]), ['missingImage'])).toBe('Cleaning up deletes 2 Screens.')
    expect(screensLine(fileGroups, ['unusedImage'])).toBe('')
  })

  it('counts the groups on the button', () => {
    expect(cleanUpLabel(4)).toBe('Clean up 4 groups')
    expect(cleanUpLabel(1)).toBe('Clean up 1 group')
    expect(cleanUpLabel(0)).toBe('Clean up 0 groups')
  })

  it('names what a clean-up loses, group by group', () => {
    expect(lostLines(groups)).toEqual([
      'Images no Screen uses: 2 files, 252 KB.',
      'Folders of deleted Devices: 1 folder, 1.3 MB.',
      'Temporary files older than a day: 1 file, 40 KB.',
      'Old uploads: 2 files, 2.2 MB.',
      'The Screen “Holiday photo” on Kitchen and its Schedule.',
    ])
  })

  it('names what stays, and a Screen left alone as showing the error Fallback Screen at its turn', () => {
    expect(staysLines(groups, ['unusedImage'])).toEqual([
      'Every Screen that has its image, and every Device.',
      'The Screen “Holiday photo”, at whose turn Kitchen shows the error Fallback Screen.',
    ])
    expect(staysLines(groups, ['unusedImage', 'missingImage'])).toEqual(['Every Screen that has its image, and every Device.'])
    expect(staysLines(groups, []).join(' ')).not.toMatch(/skip/i)
  })

  it('says what a clean-up removed', () => {
    expect(cleanedSentence({ files: 12, folders: 1, screens: 0, bytes: 4_194_304 })).toBe('Removed 12 files and 1 folder, 4 MB.')
    expect(cleanedSentence({ files: 1, folders: 0, screens: 0, bytes: 2048 })).toBe('Removed 1 file, 2 KB.')
    expect(cleanedSentence({ files: 3, folders: 2, screens: 1, bytes: 1_048_576 })).toBe('Removed 3 files, 2 folders and 1 Screen, 1 MB.')
    expect(cleanedSentence({ files: 0, folders: 0, screens: 2, bytes: 0 })).toBe('Removed 2 Screens.')
    expect(cleanedSentence({ files: 0, folders: 0, screens: 0, bytes: 0 })).toBeUndefined()
  })

  it('lists what a group holds: a path with its size, a folder with its files, a Screen with its kind, Device and Order', () => {
    expect(check.findings.map(findingLine)).toEqual([
      { what: 'devices/7c9e6679-7425-40de-944b-e07fc1f90ae7/8e41.png', detail: '64 KB', path: true },
      { what: 'devices/7c9e6679-7425-40de-944b-e07fc1f90ae7/8e41.original', detail: '188 KB', path: true },
      { what: 'devices/0d44a1f0-3c5e-4b7a-8d21-6f0e9a4c9b17', detail: '1.3 MB · 14 files', path: true },
      { what: 'devices/7c9e6679-7425-40de-944b-e07fc1f90ae7/tmp-source', detail: '40 KB', path: true },
      { what: 'uploads/5b1f0a', detail: '1.4 MB', path: true },
      { what: 'uploads/aa93e2', detail: '819 KB', path: true },
      { what: 'Holiday photo, a File Screen on Kitchen', detail: 'Order 4', path: false },
    ])
    expect(findingLine(screen('', 'Hallway', 2))).toEqual({ what: 'Unnamed Screen, a File Screen on Hallway', detail: 'Order 2', path: false })
    const link = screen('Weather', 'Hallway', 1)
    if (link.group === 'missingImage')
      link.screen.kind = 'external'
    expect(findingLine(link).what).toBe('Weather, an External link Screen on Hallway')
  })

  it('says what could not be removed, each by what it is with the server\'s reason', () => {
    expect(notRemoved([
      { findingId: 'oldUpload:uploads/5b1f0a', reason: 'The server could not delete it (EACCES).' },
      { findingId: 'missingImage:3d2c1b0a-9f8e-4d7c-b6a5-0f1e2d3c4b5a', reason: 'No longer found.' },
      { findingId: 'unusedImage:gone', reason: 'No longer found.' },
    ], check.findings)).toEqual({
      title: '3 could not be removed.',
      reasons: [
        'uploads/5b1f0a: The server could not delete it (EACCES).',
        'The Screen “Holiday photo” on Kitchen: No longer found.',
        'No longer found.',
      ],
    })
    expect(notRemoved([], check.findings)).toBeUndefined()
  })
})

describe('retention in words', () => {
  it('says what Retention deletes every day, dropping the half whose age is 0', () => {
    expect(retentionSentence({ alertRetentionDays: 90, deviceLogRetentionDays: 14 }))
      .toBe('Every day at 04:00, server time, Retention deletes resolved Alerts older than 90 days and Device Log entries older than 14 days.')
    expect(retentionSentence({ alertRetentionDays: 0, deviceLogRetentionDays: 1 }))
      .toBe('Every day at 04:00, server time, Retention deletes Device Log entries older than 1 day. Resolved Alerts are kept for good.')
    expect(retentionSentence({ alertRetentionDays: 7, deviceLogRetentionDays: 0 }))
      .toBe('Every day at 04:00, server time, Retention deletes resolved Alerts older than 7 days. Device Log entries are kept until you clear a Device\'s Logs.')
    expect(retentionSentence({ alertRetentionDays: 0, deviceLogRetentionDays: 0 })).toBe('Retention is off: both ages are 0.')
  })

  it('counts what a run removed', () => {
    expect(prunedCounts({ alertsPruned: 3, deviceLogsPruned: 1284 })).toBe('3 resolved Alerts and 1,284 Device Log entries')
    expect(prunedCounts({ alertsPruned: 1, deviceLogsPruned: 1 })).toBe('1 resolved Alert and 1 Device Log entry')
    expect(prunedCounts({ alertsPruned: 0, deviceLogsPruned: 0 })).toBe('0 resolved Alerts and 0 Device Log entries')
  })

  it('is off while both ages are 0', () => {
    expect(retentionIsOff({ alertRetentionDays: 0, deviceLogRetentionDays: 0 })).toBe(true)
    expect(retentionIsOff({ alertRetentionDays: 0, deviceLogRetentionDays: 30 })).toBe(false)
  })

  it('finds nothing old enough only when a dry run counts nothing', () => {
    expect(nothingOldEnough({ alertsPruned: 0, deviceLogsPruned: 0 })).toBe(true)
    expect(nothingOldEnough({ alertsPruned: 0, deviceLogsPruned: 1 })).toBe(false)
  })

  it('says what a run would lose, a half that counts nothing as not old enough and a half that is off not at all', () => {
    const ages = { alertRetentionDays: 90, deviceLogRetentionDays: 30 }

    expect(retentionLost(ages, { alertsPruned: 3, deviceLogsPruned: 212 })).toBe('3 resolved Alerts older than 90 days and 212 Device Log entries older than 30 days.')
    expect(retentionLost(ages, { alertsPruned: 0, deviceLogsPruned: 212 })).toBe('212 Device Log entries older than 30 days. No resolved Alert is old enough.')
    expect(retentionLost(ages, { alertsPruned: 1, deviceLogsPruned: 0 })).toBe('1 resolved Alert older than 90 days. No Device Log entry is old enough.')
    expect(retentionLost({ alertRetentionDays: 0, deviceLogRetentionDays: 30 }, { alertsPruned: 0, deviceLogsPruned: 212 })).toBe('212 Device Log entries older than 30 days.')
  })
})
