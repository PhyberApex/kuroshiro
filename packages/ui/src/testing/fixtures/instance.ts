import type { InstanceFacts, InstanceSettingsResponse } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildInstanceSettings = defineBuilder<InstanceSettingsResponse>(() => ({
  lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
  offlineMultiplier: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
  fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
  alertRetentionDays: { override: null, value: 90, fallbackSource: 'default', fallbackValue: 90 },
  deviceLogRetentionDays: { override: null, value: 30, fallbackSource: 'default', fallbackValue: 30 },
  firmwareAutoUpdate: { override: null, value: false, fallbackSource: 'default', fallbackValue: false },
}))

export const buildInstanceFacts = defineBuilder<InstanceFacts>(() => ({
  version: '0.17.1',
  serverUrl: 'http://kuroshiro.lan:3000',
  serverUrlIsLoopback: false,
  timezone: 'Europe/Berlin',
  demoMode: false,
  notifications: { configured: false, appriseUrl: null },
  limits: {
    imageUploadBytes: 10 * 1024 * 1024,
    firmwareUploadBytes: 8 * 1024 * 1024,
    archiveUploadBytes: 50 * 1024 * 1024,
    pluginImportBytes: 10 * 1024 * 1024,
    webhookBodyBytes: 1024 * 1024,
  },
}))
