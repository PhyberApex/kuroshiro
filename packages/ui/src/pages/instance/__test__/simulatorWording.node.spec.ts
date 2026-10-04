import { describe, expect, it } from 'vitest'
import { buildDeviceDetail } from '@/testing/fixtures/devices'
import { buildScreen } from '@/testing/fixtures/screens'
import {
  answerRows,
  callConsequence,
  NEW_DEVICE_REPORT,
  pendingLost,
  pendingTaken,
  reportHeaders,
  reportOf,
  sensorsHeader,
  showsOf,
} from '../simulatorWording'

const words = (parts: { text: string }[]) => parts.map(part => part.text).join('')
const strongOf = (parts: { text: string, strong?: boolean }[]) => parts.filter(part => part.strong).map(part => part.text)

const FIRMWARE_1_8_0 = { id: 'fw-180', version: '1.8.0', kind: 'official-synced', label: null, deprecated: false } as const

const ANSWER = {
  action: 'none',
  filename: 'calendar.png',
  firmware_url: '',
  image_url: 'http://kuroshiro.local/screens/devices/kitchen/calendar.png',
  refresh_rate: 900,
  reset_firmware: false,
  special_function: 'none',
  temperature_profile: 'default',
  update_firmware: false,
}

describe('what a Device reports', () => {
  it('fills the six inputs from what the Device last reported, leaving out what it never reported', () => {
    const device = buildDeviceDetail({ reported: { batteryVoltage: '4.05', rssi: '-61', firmwareVersion: '1.7.8', model: 'og_plus', width: 800, height: null } })

    expect(reportOf(device)).toEqual({ batteryVoltage: '4.05', rssi: '-61', firmwareVersion: '1.7.8', model: 'og_plus', width: '800', height: '' })
  })

  it('sends each filled input as its header and leaves an empty one out', () => {
    expect(reportHeaders({ batteryVoltage: '4.05', rssi: ' -61 ', firmwareVersion: '1.7.8', model: 'og_plus', width: '800', height: '' })).toEqual({
      'Battery-Voltage': '4.05',
      'RSSI': '-61',
      'FW-Version': '1.7.8',
      'Model': 'og_plus',
      'Width': '800',
    })
  })

  it('gives a Device that is not registered a plausible report of its own', () => {
    expect(Object.values(NEW_DEVICE_REPORT).every(value => value !== '')).toBe(true)
  })

  it('sends the Sensors a Device has as the firmware does, and nothing for a Device without any', () => {
    expect(sensorsHeader([{ kind: 'temperature', value: 21.5, unit: 'C' }, { kind: 'humidity', value: 48, unit: '%' }]))
      .toBe('kind=temperature;value=21.5;unit=C,kind=humidity;value=48;unit=%')
    expect(sensorsHeader([])).toBeUndefined()
  })
})

describe('what is pending for a Device', () => {
  it('is nothing for a Device with nothing pending', () => {
    expect(pendingTaken(buildDeviceDetail())).toEqual([])
  })

  it('names a Firmware push by its version, a Device Reset and a Special Function by its name', () => {
    const device = buildDeviceDetail({
      targetFirmware: FIRMWARE_1_8_0,
      pending: { firmwarePush: true, deviceReset: true, specialFunction: 'identify' },
    })

    expect(pendingTaken(device)).toEqual(['the Firmware push of 1.8.0', 'the Device Reset', 'the Special Function identify'])
    expect(pendingLost(device)).toBe('The pending Firmware push of 1.8.0, Device Reset and Special Function identify. The simulator takes them and the Device never gets them.')
  })

  it('words the one thing that is lost', () => {
    const device = buildDeviceDetail({ pending: { firmwarePush: false, deviceReset: true, specialFunction: null } })

    expect(pendingLost(device)).toBe('The pending Device Reset. The simulator takes it and the Device never gets it.')
  })
})

describe('what a call does', () => {
  it('says a poll is a real one and what it takes, for a Device with nothing pending', () => {
    const consequence = callConsequence(buildDeviceDetail())

    expect(words(consequence)).toBe('A poll here is a real poll. It moves Kitchen\'s Rotation on by one Screen, counts as Kitchen having been seen, and takes any pending Special Function, Device Reset or Firmware push, which then never reaches the Device.')
    expect(strongOf(consequence)).toEqual(['A poll here is a real poll.'])
  })

  it('names in ink what is pending', () => {
    const consequence = callConsequence(buildDeviceDetail({ targetFirmware: FIRMWARE_1_8_0, pending: { firmwarePush: true, deviceReset: false, specialFunction: null } }))

    expect(words(consequence)).toBe('A poll here is a real poll. It moves Kitchen\'s Rotation on by one Screen, counts as Kitchen having been seen, and takes the Firmware push of 1.8.0, which then never reaches the Device.')
    expect(strongOf(consequence)).toEqual(['A poll here is a real poll.', 'the Firmware push of 1.8.0'])
  })

  it('names several pending things together', () => {
    const consequence = callConsequence(buildDeviceDetail({ pending: { firmwarePush: false, deviceReset: true, specialFunction: 'rewind' } }))

    expect(words(consequence)).toContain('and takes the Device Reset and the Special Function rewind, which then never reach the Device.')
  })

  it('does not promise a Rotation to a mirrored Device or one asleep', () => {
    const mirrored = buildDeviceDetail({ isMirrored: true, mirror: { enabled: true, mac: 'B0:B2:1C:00:00:01', apikeySet: true } })
    const asleep = buildDeviceDetail({ sleep: { enabled: true, start: '22:00', end: '06:00', whileAsleep: 'fallback', inWindow: true, endsAt: '2026-10-04T04:00:00.000Z' } })

    expect(words(callConsequence(mirrored))).toContain('It fetches Kitchen\'s image from TRMNL again, counts as Kitchen having been seen')
    expect(words(callConsequence(asleep))).toContain('It leaves Kitchen\'s Rotation where it is while Sleep Mode is in its window, counts as Kitchen having been seen')
  })

  it('says setup is a real one for a Device that is not registered', () => {
    const consequence = callConsequence(undefined)

    expect(words(consequence)).toBe('Setup here is a real setup. It registers a Device with this MAC address, and a poll gives it the welcome Fallback Screen.')
    expect(strongOf(consequence)).toEqual(['Setup here is a real setup.'])
  })
})

describe('what a poll showed', () => {
  const screens = [buildScreen({ id: 'weather', name: 'Weather' }), buildScreen({ id: 'calendar', name: 'Calendar' }), buildScreen({ id: 'photos', name: 'Photos' })]

  it('names the Screen and its place in the Order', () => {
    const device = buildDeviceDetail({
      currentScreen: { kind: 'screen', screenId: 'calendar', name: 'Calendar', imagePath: '/x.png', renderedAt: null, servedAt: '2026-10-03T07:35:00.000Z', paused: false, holding: false },
    })

    expect(showsOf(device, screens)).toBe('Calendar, Order 2 of 3')
  })

  it('names which Fallback Screen', () => {
    const fallback = (fallback: 'welcome' | 'noScreen' | 'error' | 'sleep') => buildDeviceDetail({
      currentScreen: { kind: 'fallback', fallback, reason: 'noScreens', screenId: null, imagePath: '/screens/fallback/x.png', servedAt: null },
    })

    expect(showsOf(fallback('noScreen'), [])).toBe('The no-screen Fallback Screen')
    expect(showsOf(fallback('welcome'), [])).toBe('The welcome Fallback Screen')
    expect(showsOf(fallback('error'), [])).toBe('The error Fallback Screen')
    expect(showsOf(fallback('sleep'), [])).toBe('The sleep Fallback Screen')
  })

  it('says a mirrored image comes from TRMNL', () => {
    const device = buildDeviceDetail({ currentScreen: { kind: 'mirror', proxied: false, mirrorMac: 'B0:B2:1C:00:00:01', imagePath: '/x.png', fetchedAt: '2026-10-03T07:31:00.000Z' } })

    expect(showsOf(device, [])).toBe('The image of the TRMNL Device B0:B2:1C:00:00:01')
  })

  it('lists what the answer told the Device, the Device Reset only when it carries one', () => {
    expect(answerRows(ANSWER, null)).toEqual([
      { label: 'Polls again in', value: '15 min' },
      { label: 'Firmware', value: 'no update' },
      { label: 'Special Function', value: 'none pending' },
    ])
    expect(answerRows({ ...ANSWER, refresh_rate: 30, update_firmware: true, firmware_url: 'http://kuroshiro.local/firmware/fw-180.bin', special_function: 'identify', reset_firmware: true }, '1.8.0')).toEqual([
      { label: 'Polls again in', value: '30 s' },
      { label: 'Firmware', value: 'told to update to 1.8.0' },
      { label: 'Special Function', value: 'identify' },
      { label: 'Device Reset', value: 'told to reset' },
    ])
  })

  it('words a Firmware update whose version the page does not know by its address', () => {
    expect(answerRows({ ...ANSWER, update_firmware: true, firmware_url: 'https://trmnl.app/fw.bin' }, null)[1])
      .toEqual({ label: 'Firmware', value: 'told to update, from https://trmnl.app/fw.bin' })
  })
})
