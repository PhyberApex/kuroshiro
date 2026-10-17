import type { DigestEntry } from '../notification-digest.js'
import type { NotificationContent } from '../rules/alert-rule.js'
import { describe, expect, it } from 'vitest'
import { buildDigest } from '../notification-digest.js'

function makeEntry(overrides: Partial<DigestEntry> = {}): DigestEntry {
  return {
    alertId: 'alert-1',
    kind: 'device-low-battery',
    phase: 'opened',
    notification: { title: 'ignored', body: 'default body', type: 'warning' },
    ...overrides,
  }
}

function makeNotification(overrides: Partial<NotificationContent> = {}): NotificationContent {
  return { title: 'ignored', body: 'default body', type: 'warning', ...overrides }
}

describe('buildDigest', () => {
  it('returns undefined for an empty set of entries', () => {
    expect(buildDigest([])).toBeUndefined()
  })

  it('names the opened and resolved counts in the title', () => {
    const digest = buildDigest([
      makeEntry({ phase: 'opened' }),
      makeEntry({ phase: 'opened' }),
      makeEntry({ phase: 'resolved' }),
    ])

    expect(digest?.title).toContain('2 opened')
    expect(digest?.title).toContain('1 resolved')
  })

  it('lists every open entry before every resolve entry', () => {
    const digest = buildDigest([
      makeEntry({ phase: 'resolved', notification: makeNotification({ body: 'device recovered' }) }),
      makeEntry({ phase: 'opened', notification: makeNotification({ body: 'device opened' }) }),
    ])

    expect(digest?.body.indexOf('device opened')).toBeLessThan(digest!.body.indexOf('device recovered'))
  })

  it('groups entries under their Alert Rule label, reusing the per-subject wording as the entry line', () => {
    const digest = buildDigest([
      makeEntry({ kind: 'device-low-battery', notification: makeNotification({ body: 'Device A is at 5%.' }) }),
      makeEntry({ kind: 'device-offline', notification: makeNotification({ body: 'Device B is offline.' }) }),
    ])

    expect(digest?.body).toContain('Low battery')
    expect(digest?.body).toContain('Device A is at 5%.')
    expect(digest?.body).toContain('Offline')
    expect(digest?.body).toContain('Device B is offline.')
  })

  it('lists Reminders under their own Still open section, between the opened and the resolved sections', () => {
    const digest = buildDigest([
      makeEntry({ phase: 'resolved', notification: makeNotification({ body: 'device recovered' }) }),
      makeEntry({ phase: 'reminded', kind: 'device-offline', notification: makeNotification({ body: 'Device B is offline.' }) }),
      makeEntry({ phase: 'opened', notification: makeNotification({ body: 'device opened' }) }),
    ])

    const body = digest!.body
    expect(body).toContain('Still open:\nOffline:\n- Device B is offline.')
    expect(body.indexOf('Opened:')).toBeLessThan(body.indexOf('Still open:'))
    expect(body.indexOf('Still open:')).toBeLessThan(body.indexOf('Resolved:'))
  })

  it('counts Reminders in the title only when there are some, so a digest without any reads as before', () => {
    expect(buildDigest([makeEntry({ phase: 'opened' })])?.title).toBe('Kuroshiro: 1 opened, 0 resolved')
    expect(buildDigest([
      makeEntry({ phase: 'reminded' }),
      makeEntry({ phase: 'reminded' }),
    ])?.title).toBe('Kuroshiro: 0 opened, 0 resolved, 2 still open')
  })

  it('carries a Reminder\'s severity into the digest type like an opened entry\'s', () => {
    expect(buildDigest([
      makeEntry({ phase: 'resolved', notification: makeNotification({ type: 'success' }) }),
      makeEntry({ phase: 'reminded', notification: makeNotification({ type: 'failure' }) }),
    ])?.type).toBe('failure')
  })

  it('takes the most severe type among all entries: failure over warning over success', () => {
    expect(buildDigest([makeEntry({ notification: makeNotification({ type: 'warning' }) })])?.type).toBe('warning')
    expect(buildDigest([
      makeEntry({ notification: makeNotification({ type: 'warning' }) }),
      makeEntry({ notification: makeNotification({ type: 'failure' }) }),
    ])?.type).toBe('failure')
    expect(buildDigest([
      makeEntry({ notification: makeNotification({ type: 'success' }) }),
      makeEntry({ notification: makeNotification({ type: 'warning' }) }),
    ])?.type).toBe('warning')
  })

  it('produces the same digest shape for a single changed Alert as for many — no special-cased single-Alert message', () => {
    const digest = buildDigest([makeEntry({ phase: 'opened' })])

    expect(digest?.title).toContain('1 opened')
    expect(digest?.body).toContain('Low battery')
  })
})
