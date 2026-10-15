import { describe, expect, it } from 'vitest'
import { InstanceTimeZone } from './instance-time-zone.js'

describe('instanceTimeZone', () => {
  it('names the zone the process resolves', () => {
    expect(new InstanceTimeZone().name).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('answers the offset in seconds at an instant, east of UTC positive', () => {
    const berlin = Object.assign(new InstanceTimeZone(), { name: 'Europe/Berlin' })
    expect(berlin.utcOffsetSeconds(new Date('2030-01-05T09:00:00Z'))).toBe(3600)
    expect(berlin.utcOffsetSeconds(new Date('2030-07-05T09:00:00Z'))).toBe(7200)
  })
})
