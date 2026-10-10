import type { Device } from '../devices.entity.js'
import { describe, expect, it } from 'vitest'
import { makeDevice, makeDeviceModel, makeFirmware, makePalette, makeScreen } from '../../test/fixtures.js'
import { toDeviceDetail, toDeviceSummary } from '../device.mapper.js'

const POLLED_AT = new Date('2026-03-01T10:00:00.000Z')
const NOW = new Date('2026-03-01T10:01:00.000Z')
const RENDERED_AT = new Date('2026-03-01T09:30:00.000Z')

const weather = makeScreen({ id: 'screen-weather', filename: 'Weather', generatedAt: RENDERED_AT })

function polledDevice(overrides: Partial<Device> = {}): Device {
  return makeDevice({
    lastSeen: POLLED_AT,
    lastServedAt: POLLED_AT,
    lastServedKind: 'screen',
    lastServedScreenId: weather.id,
    lastServedFallback: null,
    lastServedReason: null,
    lastServedRefreshRate: 300,
    lastServedImagePath: '/screens/devices/device-1/screen-weather.png',
    ...overrides,
  })
}

function servedFallback(overrides: Partial<Device>): Device {
  return polledDevice({ lastServedKind: 'fallback', lastServedScreenId: null, ...overrides })
}

function currentScreenOf(device: Device, servedScreen: typeof weather | null = null) {
  return toDeviceSummary(device, { now: NOW, servedScreen }).currentScreen
}

/** Local wall-clock time, so the Sleep Mode window math holds whatever the host's timezone. */
function localTime(hh: number, mm: number, day = 1): Date {
  return new Date(2026, 2, day, hh, mm, 0)
}

describe('toDeviceSummary', () => {
  describe('a Device that never polled', () => {
    const neverPolled = makeDevice({ lastSeen: null })

    it('has no last seen time, no next poll and the welcome Fallback Screen as its Current Screen', () => {
      const summary = toDeviceSummary(neverPolled, { now: NOW, servedScreen: null })

      expect(summary.lastSeenAt).toBeNull()
      expect(summary.nextPollAt).toBeNull()
      expect(summary.currentScreen).toEqual({
        kind: 'fallback',
        fallback: 'welcome',
        reason: 'neverPolled',
        screenId: null,
        imagePath: '/screens/welcome.png?v=2',
        servedAt: null,
      })
    })
  })

  describe('the Current Screen, from the last-served record', () => {
    it('is the Screen the last poll served, with its name, image and the poll\'s time', () => {
      expect(currentScreenOf(polledDevice(), weather)).toEqual({
        kind: 'screen',
        screenId: 'screen-weather',
        name: 'Weather',
        imagePath: `/screens/devices/device-1/screen-weather.png?v=${RENDERED_AT.getTime()}`,
        renderedAt: '2026-03-01T09:30:00.000Z',
        servedAt: '2026-03-01T10:00:00.000Z',
        paused: false,
        holding: false,
      })
    })

    it('is the no-screen Fallback Screen for a Device without Screens', () => {
      const device = servedFallback({ lastServedFallback: 'noScreen', lastServedReason: 'noScreens', lastServedImagePath: '/screens/fallback/v3/og_plus-bw/noScreen.png' })

      expect(currentScreenOf(device)).toEqual({
        kind: 'fallback',
        fallback: 'noScreen',
        reason: 'noScreens',
        screenId: null,
        imagePath: `/screens/fallback/v3/og_plus-bw/noScreen.png?v=${POLLED_AT.getTime()}`,
        servedAt: '2026-03-01T10:00:00.000Z',
      })
    })

    it('is the no-screen Fallback Screen with its own reason when Rotation passes over every Screen', () => {
      const device = servedFallback({ lastServedFallback: 'noScreen', lastServedReason: 'noneEligible' })

      expect(currentScreenOf(device)).toMatchObject({ kind: 'fallback', fallback: 'noScreen', reason: 'noneEligible', screenId: null })
    })

    it('is the error Fallback Screen naming the Screen that could not be rendered', () => {
      const device = servedFallback({ lastServedFallback: 'error', lastServedReason: 'renderFailed', lastServedScreenId: weather.id, lastServedImagePath: '/screens/error.png' })

      expect(currentScreenOf(device, weather)).toEqual({
        kind: 'fallback',
        fallback: 'error',
        reason: 'renderFailed',
        screenId: 'screen-weather',
        imagePath: `/screens/error.png?v=${POLLED_AT.getTime()}`,
        servedAt: '2026-03-01T10:00:00.000Z',
      })
    })

    it('is the error Fallback Screen with the mirror reason after a failed mirror fetch', () => {
      const device = servedFallback({ mirrorEnabled: true, mirrorMac: '11:22:33:44:55:66', lastServedFallback: 'error', lastServedReason: 'mirrorFailed' })

      expect(currentScreenOf(device)).toMatchObject({ kind: 'fallback', fallback: 'error', reason: 'mirrorFailed', screenId: null })
    })

    it('is the sleep Fallback Screen while Sleep Mode shows it', () => {
      const device = servedFallback({ lastServedFallback: 'sleep', lastServedReason: 'asleep' })

      expect(currentScreenOf(device)).toMatchObject({ kind: 'fallback', fallback: 'sleep', reason: 'asleep' })
    })

    it('is the Screen, paused, while Sleep Mode keeps its image on the Device', () => {
      const device = polledDevice({ lastServedReason: 'asleep' })

      expect(currentScreenOf(device, weather)).toMatchObject({ kind: 'screen', screenId: 'screen-weather', paused: true })
    })

    it('is the mirrored image on a mirrored Device', () => {
      const device = polledDevice({
        mirrorEnabled: true,
        mirrorMac: '11:22:33:44:55:66',
        lastServedKind: 'mirror',
        lastServedScreenId: null,
        lastServedImagePath: '/screens/devices/device-1/mirror.png',
      })

      expect(currentScreenOf(device)).toEqual({
        kind: 'mirror',
        proxied: false,
        mirrorMac: '11:22:33:44:55:66',
        imagePath: `/screens/devices/device-1/mirror.png?v=${POLLED_AT.getTime()}`,
        fetchedAt: '2026-03-01T10:00:00.000Z',
      })
    })

    it('is the mirrored image, proxied, on a Proxied Device', () => {
      const device = polledDevice({ mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:FF', lastServedKind: 'mirror', lastServedScreenId: null })

      expect(currentScreenOf(device)).toMatchObject({ kind: 'mirror', proxied: true, mirrorMac: 'AA:BB:CC:DD:EE:FF' })
    })

    it('reads as the deleted-Screen kind, with no image path, when the served Screen was deleted since', () => {
      expect(currentScreenOf(polledDevice(), null)).toEqual({
        kind: 'deletedScreen',
        imagePath: null,
        servedAt: '2026-03-01T10:00:00.000Z',
      })
    })

    it('reads as the deleted-Screen kind even when the Device has other Screens left', () => {
      const device = polledDevice({ lastServedScreenId: 'screen-gone' })

      expect(currentScreenOf(device, null)).toMatchObject({ kind: 'deletedScreen', imagePath: null })
    })

    it('reads as waiting for the first poll when a Device polled before anything was recorded', () => {
      const device = makeDevice({ lastSeen: POLLED_AT })

      expect(currentScreenOf(device)).toMatchObject({ kind: 'fallback', fallback: 'welcome', reason: 'neverPolled' })
    })
  })

  describe('the next poll', () => {
    it('is the last poll plus the refresh rate that poll was given, not the configured one', () => {
      const device = polledDevice({ refreshRate: 900, lastServedRefreshRate: 300 })

      expect(toDeviceSummary(device, { now: NOW, servedScreen: weather }).nextPollAt).toBe('2026-03-01T10:05:00.000Z')
    })

    it('is when the window ends for a sleeping Device, which was given the seconds until then', () => {
      const device = servedFallback({ lastServedFallback: 'sleep', lastServedReason: 'asleep', lastServedRefreshRate: 7200 })

      expect(toDeviceSummary(device, { now: NOW, servedScreen: null }).nextPollAt).toBe('2026-03-01T12:00:00.000Z')
    })

    it('follows the refresh rate TRMNL gave a Proxied Device', () => {
      const device = polledDevice({ mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:FF', lastServedKind: 'mirror', lastServedRefreshRate: 1800 })

      expect(toDeviceSummary(device, { now: NOW, servedScreen: null }).nextPollAt).toBe('2026-03-01T10:30:00.000Z')
    })
  })

  describe('mirrored and Proxied', () => {
    it('is neither when Mirroring is off, even with a mirror MAC stored', () => {
      const summary = toDeviceSummary(makeDevice({ mirrorEnabled: false, mirrorMac: 'AA:BB:CC:DD:EE:FF' }), { now: NOW, servedScreen: null })

      expect(summary).toMatchObject({ isMirrored: false, isProxied: false })
    })

    it('is mirrored but not Proxied when it mirrors another Device', () => {
      const summary = toDeviceSummary(makeDevice({ mirrorEnabled: true, mirrorMac: '11:22:33:44:55:66' }), { now: NOW, servedScreen: null })

      expect(summary).toMatchObject({ isMirrored: true, isProxied: false })
    })

    it('is Proxied when it mirrors its own MAC', () => {
      const summary = toDeviceSummary(makeDevice({ mirrorEnabled: true, mirrorMac: 'AA:BB:CC:DD:EE:FF' }), { now: NOW, servedScreen: null })

      expect(summary).toMatchObject({ isMirrored: true, isProxied: true })
    })
  })

  describe('sleep Mode', () => {
    const nightSleeper = { sleepModeEnabled: true, sleepStartTime: 22 * 3600, sleepEndTime: 6 * 3600 + 30 * 60, sleepScreenEnabled: true }

    it('states the window as clock times and what the Device shows while asleep', () => {
      const { sleep } = toDeviceSummary(makeDevice(nightSleeper), { now: localTime(12, 0), servedScreen: null })

      expect(sleep).toEqual({ enabled: true, start: '22:00', end: '06:30', whileAsleep: 'fallback', inWindow: false, endsAt: null })
    })

    it('is in its window until the end time, the next day when the window crosses midnight', () => {
      const { sleep } = toDeviceSummary(makeDevice(nightSleeper), { now: localTime(23, 0), servedScreen: null })

      expect(sleep.inWindow).toBe(true)
      expect(sleep.endsAt).toBe(localTime(6, 30, 2).toISOString())
    })

    it('ends the same day once midnight has passed', () => {
      const { sleep } = toDeviceSummary(makeDevice(nightSleeper), { now: localTime(1, 0), servedScreen: null })

      expect(sleep.endsAt).toBe(localTime(6, 30).toISOString())
    })

    it('is never in its window on a mirrored Device', () => {
      const { sleep } = toDeviceSummary(makeDevice({ ...nightSleeper, mirrorEnabled: true }), { now: localTime(23, 0), servedScreen: null })

      expect(sleep).toMatchObject({ enabled: true, inWindow: false, endsAt: null })
    })

    it('keeps the image while asleep when the sleep Fallback Screen is off, and has no window when unset', () => {
      const { sleep } = toDeviceSummary(makeDevice(), { now: NOW, servedScreen: null })

      expect(sleep).toEqual({ enabled: false, start: null, end: null, whileAsleep: 'keep', inWindow: false, endsAt: null })
    })
  })

  it('reads battery as a percent and RSSI as a number, and null when the Device reported neither', () => {
    const reporting = toDeviceSummary(makeDevice({ batteryVoltage: '3.6', rssi: '-62', fwVersion: '1.7.1' }), { now: NOW, servedScreen: null })
    const silent = toDeviceSummary(makeDevice(), { now: NOW, servedScreen: null })

    expect(reporting).toMatchObject({ batteryPercent: 50, rssi: -62, firmwareVersion: '1.7.1' })
    expect(silent).toMatchObject({ batteryPercent: null, rssi: null, firmwareVersion: null, deviceModel: null })
  })

  it('carries no secret and no offline field, with every key present', () => {
    const device = polledDevice({ mirrorEnabled: true, mirrorMac: '11:22:33:44:55:66', mirrorApikey: 'mirror-secret', deviceModel: makeDeviceModel() })

    const summary = toDeviceSummary(device, { now: NOW, servedScreen: weather })

    expect(Object.keys(summary)).toEqual(['id', 'name', 'friendlyId', 'firmwareVersion', 'deviceModel', 'lastSeenAt', 'nextPollAt', 'batteryPercent', 'rssi', 'isMirrored', 'isProxied', 'sleep', 'currentScreen'])
    expect(summary.deviceModel).toEqual({ name: 'og_plus', label: 'TRMNL OG (2-bit)', width: 800, height: 480, deprecated: false })
    expect(JSON.stringify(summary)).not.toContain('test-api-key')
    expect(JSON.stringify(summary)).not.toContain('mirror-secret')
  })
})

describe('toDeviceDetail', () => {
  const facts = { now: NOW, servedScreen: null, sensors: [], screenCount: 0 }

  it('reveals the Device\'s API key and says only whether a mirror API key is stored', () => {
    const device = makeDevice({ mirrorEnabled: true, mirrorMac: '11:22:33:44:55:66', mirrorApikey: 'mirror-secret' })

    const detail = toDeviceDetail(device, facts)

    expect(detail.apikey).toBe('test-api-key')
    expect(detail.mirror).toEqual({ enabled: true, mac: '11:22:33:44:55:66', apikeySet: true })
    expect(JSON.stringify(detail)).not.toContain('mirror-secret')
  })

  it('states what is pending from the stored Special Function, Device Reset and Firmware push', () => {
    const waiting = toDeviceDetail(makeDevice({ specialFunction: 'rewind', resetDevice: true, updateFirmware: true }), facts)
    const idle = toDeviceDetail(makeDevice({ specialFunction: 'none' }), facts)

    expect(waiting.pending).toEqual({ specialFunction: 'rewind', deviceReset: true, firmwarePush: true })
    expect(idle.pending).toEqual({ specialFunction: null, deviceReset: false, firmwarePush: false })
  })

  it('folds in the Sensor readings and counts the Screens', () => {
    const detail = toDeviceDetail(makeDevice(), { ...facts, sensors: [{ kind: 'temperature', value: 21.5, unit: '°C' }], screenCount: 3 })

    expect(detail.sensors).toEqual([{ kind: 'temperature', value: 21.5, unit: '°C' }])
    expect(detail.screenCount).toBe(3)
  })

  it('references the Palette and the target Firmware, and reports what the Device said about itself', () => {
    const device = makeDevice({
      palette: makePalette(),
      targetFirmware: makeFirmware({ label: 'Nightly' }),
      batteryVoltage: '3.99',
      rssi: '-62',
      fwVersion: '1.7.1',
      reportedModel: 'og',
      width: 800,
      height: 480,
    })

    const detail = toDeviceDetail(device, facts)

    expect(detail.palette).toEqual({ id: 'palette-1', name: 'Test Palette', kind: 'official' })
    expect(detail.targetFirmware).toEqual({ id: 'firmware-1', version: '1.0.0', kind: 'official-synced', label: 'Nightly', deprecated: false })
    expect(detail.reported).toEqual({ batteryVoltage: '3.99', rssi: '-62', firmwareVersion: '1.7.1', model: 'og', width: 800, height: 480 })
  })

  it('has every key present, with null for what a bare Device does not have', () => {
    const detail = toDeviceDetail(makeDevice({ lastSeen: null }), facts)

    expect(JSON.parse(JSON.stringify(detail))).toEqual({
      id: 'device-1',
      name: 'Test Device',
      friendlyId: 'ABC123',
      firmwareVersion: null,
      deviceModel: null,
      lastSeenAt: null,
      nextPollAt: null,
      batteryPercent: null,
      rssi: null,
      isMirrored: false,
      isProxied: false,
      sleep: { enabled: false, start: null, end: null, whileAsleep: 'keep', inWindow: false, endsAt: null },
      currentScreen: { kind: 'fallback', fallback: 'welcome', reason: 'neverPolled', screenId: null, imagePath: '/screens/welcome.png?v=2', servedAt: null },
      mac: 'AA:BB:CC:DD:EE:FF',
      apikey: 'test-api-key',
      refreshRate: 300,
      reported: { batteryVoltage: null, rssi: null, firmwareVersion: null, model: null, width: null, height: null },
      palette: null,
      mirror: { enabled: false, mac: null, apikeySet: false },
      targetFirmware: null,
      pending: { specialFunction: 'identify', deviceReset: false, firmwarePush: false },
      sleepImagePath: null,
      sensors: [],
      screenCount: 0,
    })
  })
})
