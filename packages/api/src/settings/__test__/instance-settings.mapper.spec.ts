import type { InstanceSettingsFallbacks } from '../instance-settings.mapper.js'
import { describe, expect, it } from 'vitest'
import { toInstanceSettingsResponse } from '../instance-settings.mapper.js'

const fallbacks: InstanceSettingsFallbacks = {
  lowBatteryPercent: { value: 20, source: 'default' },
  offlineMultiplier: { value: 4, source: 'env' },
  fetchFailureThreshold: { value: 3, source: 'default' },
}

describe('toInstanceSettingsResponse', () => {
  it('answers every Setting from its fallback when no row was saved yet', () => {
    expect(toInstanceSettingsResponse(null, fallbacks)).toEqual({
      lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
      offlineMultiplier: { override: null, value: 4, fallbackSource: 'env', fallbackValue: 4 },
      fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
      firmwareAutoUpdate: { override: null, value: false, fallbackSource: 'default', fallbackValue: false },
    })
  })

  it('puts a saved override ahead of the fallback and still states the fallback', () => {
    const row = { id: 1, lowBatteryPercent: 15, offlineMultiplier: null, fetchFailureThreshold: null, firmwareAutoUpdate: true }

    const response = toInstanceSettingsResponse(row, fallbacks)

    expect(response.lowBatteryPercent).toEqual({ override: 15, value: 15, fallbackSource: 'default', fallbackValue: 20 })
    expect(response.offlineMultiplier).toEqual({ override: null, value: 4, fallbackSource: 'env', fallbackValue: 4 })
    expect(response.firmwareAutoUpdate).toEqual({ override: true, value: true, fallbackSource: 'default', fallbackValue: false })
  })

  it('keeps an override of false distinct from no override', () => {
    const row = { id: 1, firmwareAutoUpdate: false }

    expect(toInstanceSettingsResponse(row, fallbacks).firmwareAutoUpdate.override).toBe(false)
  })

  it('serializes with the keys in the order the endpoint has always answered', () => {
    expect(JSON.stringify(toInstanceSettingsResponse(null, fallbacks))).toBe(
      '{"lowBatteryPercent":{"override":null,"value":20,"fallbackSource":"default","fallbackValue":20},'
      + '"offlineMultiplier":{"override":null,"value":4,"fallbackSource":"env","fallbackValue":4},'
      + '"fetchFailureThreshold":{"override":null,"value":3,"fallbackSource":"default","fallbackValue":3},'
      + '"firmwareAutoUpdate":{"override":null,"value":false,"fallbackSource":"default","fallbackValue":false}}',
    )
  })
})
