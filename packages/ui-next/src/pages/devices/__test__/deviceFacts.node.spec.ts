import { describe, expect, it } from 'vitest'
import { buildAlert } from '@/testing/fixtures/alerts'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { deviceFacts } from '../deviceFacts'

const at = (hours: number, minutes: number) => new Date(2026, 9, 3, hours, minutes).toISOString()
const NOW = new Date(2026, 9, 3, 7, 35)

const kitchen = (overrides: Parameters<typeof buildDeviceDetail>[0] = {}) => buildDeviceDetail({ id: 'kitchen', lastSeenAt: at(7, 31), ...overrides })
const factsOf = (device = kitchen(), alerts = [] as ReturnType<typeof buildAlert>[]) => deviceFacts({ device, screens: [], alerts, now: NOW }).filter(fact => fact.value)
const rows = (...args: Parameters<typeof factsOf>) => factsOf(...args).map(fact => [fact.alert ?? fact.label, fact.value])

describe('the facts of a Device', () => {
  it('are last seen, battery, signal and Sleep Mode for an ordinary Device', () => {
    expect(rows()).toEqual([
      ['Last seen', '4 min ago'],
      ['Battery', '76 %'],
      ['Signal', '−61 dBm'],
      ['Sleep Mode', 'Off'],
    ])
  })

  it('leave out the battery of a Device that reports no voltage, and last seen and signal before the first poll', () => {
    expect(rows(kitchen({ lastSeenAt: null, batteryPercent: null, rssi: null }))).toEqual([['Sleep Mode', 'Off']])
  })

  it('carry the instant behind "Last seen", for its exact time', () => {
    expect(factsOf()[0]).toMatchObject({ at: at(7, 31), lead: '' })
  })

  it('turn the two rows a firing Alert stands behind into the Alert', () => {
    const device = kitchen({ lastSeenAt: at(4, 10), batteryPercent: 18 })
    const alerts = [buildAlert({ kind: 'device-offline' }), buildAlert({ kind: 'device-low-battery' })]

    expect(rows(device, alerts).slice(0, 2)).toEqual([
      ['Alert: offline', 'last seen 3 h ago'],
      ['Alert: battery low', '18 %'],
    ])
    expect(factsOf(device, alerts)[0]).toMatchObject({ lead: 'last seen ' })
  })

  it.each([
    [{ enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback' as const, inWindow: false, endsAt: null }, false, '23:00–06:00'],
    [{ enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback' as const, inWindow: true, endsAt: at(6, 0) }, false, 'in its window until 06:00'],
    [{ enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback' as const, inWindow: false, endsAt: null }, true, 'Off while Mirroring'],
  ])('word Sleep Mode %#', (sleep, isMirrored, wording) => {
    expect(rows(kitchen({ sleep, isMirrored }))).toContainEqual(['Sleep Mode', wording])
  })

  it('have one row per Sensor, with the value and unit as the Device sent them', () => {
    const device = kitchen({ sensors: [
      { kind: 'temperature', value: 21.4, unit: '°C' },
      { kind: 'humidity', value: 48, unit: '%' },
      { kind: 'pressure', value: 1013, unit: 'hPa' },
      { kind: 'carbon_dioxide', value: 612, unit: 'ppm' },
    ] })

    expect(rows(device).slice(4)).toEqual([
      ['Temperature', '21.4 °C'],
      ['Humidity', '48 %'],
      ['Pressure', '1013 hPa'],
      ['CO₂', '612 ppm'],
    ])
  })

  it('link to Settings when the Device reports another size than its Device Model\'s', () => {
    const device = kitchen({ reported: { ...kitchen().reported, width: 1872, height: 1404 } })

    expect(factsOf(device).at(-1)).toMatchObject({ label: 'Device Model', value: 'reports another size', to: '/devices/kitchen/settings' })
    expect(rows(kitchen({ reported: { ...kitchen().reported, width: null, height: null } })).map(([label]) => label)).not.toContain('Device Model')
  })

  it('say what waits for the next poll: a Special Function, a Device Reset and a Firmware push', () => {
    const device = kitchen({
      pending: { specialFunction: 'identify', deviceReset: true, firmwarePush: true },
      targetFirmware: { id: 'fw', version: '1.7.9', kind: 'official-synced', label: null, deprecated: false },
    })

    expect(factsOf(device).slice(4)).toEqual([
      { label: 'Special Function', value: 'identify at the next poll', pending: true },
      { label: 'Device Reset', value: 'at the next poll', pending: true },
      { label: 'Firmware', value: '1.7.9 at the next poll', pending: true },
    ])
  })

  it('keep the Firmware row of a pending push whose target is not known', () => {
    const device = kitchen({ pending: { specialFunction: null, deviceReset: false, firmwarePush: true } })

    expect(rows(device).at(-1)).toEqual(['Firmware', 'at the next poll'])
  })
})
