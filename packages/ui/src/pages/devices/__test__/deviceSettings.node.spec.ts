import { describe, expect, it } from 'vitest'
import {
  maskedKey,
  mirroringInput,
  rateSeconds,
  rateShown,
  screensCounted,
  secondsOfDay,
  sleepWindowInput,
} from '../deviceSettings'

describe('the refresh rate', () => {
  it.each([
    [900, { amount: 15, unit: 'minutes' }],
    [60, { amount: 1, unit: 'minutes' }],
    [3600, { amount: 1, unit: 'hours' }],
    [86400, { amount: 24, unit: 'hours' }],
    [5400, { amount: 90, unit: 'minutes' }],
    [90, { amount: 1.5, unit: 'minutes' }],
  ])('shows %i seconds as whole hours where it is, in minutes otherwise', (seconds, shown) => {
    expect(rateShown(seconds)).toEqual(shown)
  })

  it.each([
    [15, 'minutes', 900],
    [2, 'hours', 7200],
    [1, 'minutes', 60],
    [24, 'hours', 86400],
    [1.5, 'minutes', 90],
  ] as const)('sends %d %s as seconds', (amount, unit, seconds) => {
    expect(rateSeconds({ amount, unit })).toBe(seconds)
  })

  it.each([
    [0, 'minutes'],
    [0.5, 'minutes'],
    [1441, 'minutes'],
    [25, 'hours'],
    [0.0001, 'hours'],
    [null, 'minutes'],
  ] as const)('has no seconds for %s %s, which is outside 1 minute to 24 hours or no whole second', (amount, unit) => {
    expect(rateSeconds({ amount, unit })).toBeUndefined()
  })
})

describe('the hours of Sleep Mode', () => {
  it('are seconds of day on the wire', () => {
    expect(secondsOfDay('00:00')).toBe(0)
    expect(secondsOfDay('06:00')).toBe(21600)
    expect(secondsOfDay('23:59')).toBe(86340)
  })

  it('send only the end that was given', () => {
    expect(sleepWindowInput({ start: '22:30' })).toEqual({ sleepStartTime: 81000 })
    expect(sleepWindowInput({ end: '07:00' })).toEqual({ sleepEndTime: 25200 })
    expect(sleepWindowInput({ start: '23:00', end: '06:00' })).toEqual({ sleepStartTime: 82800, sleepEndTime: 21600 })
  })
})

describe('what Mirroring sends', () => {
  const off = { enabled: false, mac: null, apikeySet: false }
  const kept = { enabled: false, mac: 'A4:CF:12:9B:01:7E', apikeySet: true }
  const mirrored = { ...kept, enabled: true }

  it('is nothing while it is switched on without a valid MAC address and an API key', () => {
    expect(mirroringInput({ on: true, mac: '', key: '' }, off)).toBeUndefined()
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: '' }, off)).toBeUndefined()
    expect(mirroringInput({ on: true, mac: 'A4:CF:12', key: 'secret' }, off)).toBeUndefined()
  })

  it('is on with both, the MAC address upper-case, once both are valid', () => {
    expect(mirroringInput({ on: true, mac: ' a4:cf:12:9b:01:7e ', key: 'secret' }, off))
      .toEqual({ mirrorEnabled: true, mirrorMac: 'A4:CF:12:9B:01:7E', mirrorApikey: 'secret' })
  })

  it('is on alone when both values were kept', () => {
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: '' }, kept)).toEqual({ mirrorEnabled: true })
  })

  it('is off alone, which keeps both values', () => {
    expect(mirroringInput({ on: false, mac: 'A4:CF:12:9B:01:7E', key: '' }, mirrored)).toEqual({ mirrorEnabled: false })
    expect(mirroringInput({ on: false, mac: '', key: '' }, off)).toBeUndefined()
  })

  it('is only the value that changed while Mirroring is on', () => {
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:00:00:01', key: '' }, mirrored)).toEqual({ mirrorMac: 'A4:CF:12:00:00:01' })
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: 'another' }, mirrored)).toEqual({ mirrorApikey: 'another' })
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: '' }, mirrored)).toBeUndefined()
  })
})

describe('the words of the tucked sections', () => {
  it('masks an API key down to its last four characters', () => {
    expect(maskedKey('k7Qm2Zr9Xw4Tn8Vb')).toBe('••••••••••••n8Vb')
    expect(maskedKey('abc')).toBe('•••')
  })

  it('counts the Screens a Device loses', () => {
    expect(screensCounted(6)).toBe('6 Screens')
    expect(screensCounted(1)).toBe('1 Screen')
    expect(screensCounted(0)).toBe('0 Screens')
  })
})
