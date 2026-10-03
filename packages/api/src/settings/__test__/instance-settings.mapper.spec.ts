import type { InstanceSettingsFallbacks } from '../instance-settings.mapper.js'
import { describe, expect, it } from 'vitest'
import { toInstanceSettingsResponse } from '../instance-settings.mapper.js'

const fallbacks: InstanceSettingsFallbacks = {
  lowBatteryPercent: { value: 20, source: 'default' },
  offlineMultiplier: { value: 4, source: 'env' },
  fetchFailureThreshold: { value: 3, source: 'default' },
  alertRetentionDays: { value: 90, source: 'default' },
  deviceLogRetentionDays: { value: 14, source: 'env' },
  firmwareAutoUpdate: { value: false, source: 'default' },
}

describe('toInstanceSettingsResponse', () => {
  it('answers every Setting from its fallback when no row was saved yet', () => {
    expect(toInstanceSettingsResponse(null, fallbacks)).toEqual({
      lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
      offlineMultiplier: { override: null, value: 4, fallbackSource: 'env', fallbackValue: 4 },
      fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
      alertRetentionDays: { override: null, value: 90, fallbackSource: 'default', fallbackValue: 90 },
      deviceLogRetentionDays: { override: null, value: 14, fallbackSource: 'env', fallbackValue: 14 },
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

  it('keeps a Retention age override of 0 instead of falling back', () => {
    const row = { id: 1, alertRetentionDays: 0, deviceLogRetentionDays: null }

    const response = toInstanceSettingsResponse(row, fallbacks)

    expect(response.alertRetentionDays).toEqual({ override: 0, value: 0, fallbackSource: 'default', fallbackValue: 90 })
    expect(response.deviceLogRetentionDays).toEqual({ override: null, value: 14, fallbackSource: 'env', fallbackValue: 14 })
  })

  it('keeps an override of false distinct from no override', () => {
    const row = { id: 1, firmwareAutoUpdate: false }

    expect(toInstanceSettingsResponse(row, fallbacks).firmwareAutoUpdate.override).toBe(false)
  })

  it('serializes the thresholds first, then the Retention ages, then the boolean Settings, each as override, value, fallbackSource, fallbackValue', () => {
    expect(JSON.stringify(toInstanceSettingsResponse(null, fallbacks))).toBe(
      '{"lowBatteryPercent":{"override":null,"value":20,"fallbackSource":"default","fallbackValue":20},'
      + '"offlineMultiplier":{"override":null,"value":4,"fallbackSource":"env","fallbackValue":4},'
      + '"fetchFailureThreshold":{"override":null,"value":3,"fallbackSource":"default","fallbackValue":3},'
      + '"alertRetentionDays":{"override":null,"value":90,"fallbackSource":"default","fallbackValue":90},'
      + '"deviceLogRetentionDays":{"override":null,"value":14,"fallbackSource":"env","fallbackValue":14},'
      + '"firmwareAutoUpdate":{"override":null,"value":false,"fallbackSource":"default","fallbackValue":false}}',
    )
  })
})
