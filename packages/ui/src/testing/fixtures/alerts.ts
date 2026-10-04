import type { AlertsList, AlertSummary } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildAlert = defineBuilder<AlertSummary>(() => ({
  id: 'b7e2a9c4-1d3f-4e5a-8b6c-9d0e1f2a3b4c',
  kind: 'device-low-battery',
  deviceId: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11',
  deviceName: 'Kitchen',
  openedAt: '2026-10-03T06:05:00.000Z',
  resolvedAt: null,
  details: { percent: 18 },
}))

export const buildAlertsList = defineBuilder<AlertsList>(() => ({
  active: [],
  resolved: [],
}))
