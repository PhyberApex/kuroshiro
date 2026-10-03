import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildInstanceSettings = defineBuilder<InstanceSettingsResponse>(() => ({
  lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
  offlineMultiplier: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
  fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
  firmwareAutoUpdate: { override: null, value: false, fallbackSource: 'default', fallbackValue: false },
}))
