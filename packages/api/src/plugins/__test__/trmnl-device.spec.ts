import { describe, expect, it } from 'vitest'
import { makeDevice, makeDeviceModel } from '../../test/fixtures.js'
import { V2 } from '../../test/mockDeviceModelsService.js'
import { trmnlDeviceOf } from '../trmnl-device.js'

describe('trmnlDeviceOf', () => {
  it('tells a template the Device and the size, depth and name of the Device Model it is rendered at, as trmnlp spells them', () => {
    const device = makeDevice({ friendlyId: 'KITCHEN', batteryVoltage: '3.6', fwVersion: '1.6.9', refreshRate: 900, sleepModeEnabled: true, sleepStartTime: 79200, sleepEndTime: 28800 })

    expect(trmnlDeviceOf(device, V2)).toEqual({
      friendly_id: 'KITCHEN',
      percent_charged: 50,
      width: 1872,
      height: 1404,
      model: 'v2',
      bit_depth: 4,
      orientation: 'landscape',
      firmware_version: '1.6.9',
      refresh_interval_seconds: 900,
      sleep_mode_enabled: true,
      sleep_start_time: 1320,
      sleep_end_time: 480,
    })
  })

  it('reads a Device Model taller than it is wide as portrait', () => {
    expect(trmnlDeviceOf(makeDevice(), makeDeviceModel({ name: 'portrait', width: 480, height: 800 }))).toMatchObject({ width: 480, height: 800, orientation: 'portrait' })
  })

  it('leaves out what the Device has not reported or set', () => {
    const told = trmnlDeviceOf(makeDevice({ batteryVoltage: undefined, fwVersion: undefined, sleepStartTime: null, sleepEndTime: null }), makeDeviceModel())

    expect(told).not.toHaveProperty('percent_charged')
    expect(told).not.toHaveProperty('firmware_version')
    expect(told).not.toHaveProperty('sleep_start_time')
    expect(told).not.toHaveProperty('sleep_end_time')
    expect(told).not.toHaveProperty('wifi_strength')
  })
})
