import type { ScheduleRead, ScreenRead } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildSchedule = defineBuilder<ScheduleRead>(() => ({
  id: '7d3a5c1e-2b4f-4a6d-9e8c-1f0b2a3c4d5e',
  enabled: true,
  weekdays: [1, 2, 3, 4, 5],
  startTime: '06:00',
  endTime: '09:00',
  startDate: null,
  endDate: null,
}))

export const buildScreen = defineBuilder<ScreenRead>(() => ({
  id: 'c2f1d0a4-5b6e-4c7d-8e9f-0a1b2c3d4e5f',
  deviceId: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11',
  kind: 'plugin',
  name: 'Calendar',
  order: 1,
  state: null,
  stateCause: null,
  renderSignal: null,
  imagePath: 'screens/devices/3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11/c2f1d0a4-5b6e-4c7d-8e9f-0a1b2c3d4e5f.png',
  renderedAt: '2026-10-03T07:31:00.000Z',
  schedule: null,
  plugin: { id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', name: 'Calendar', kind: 'Poll', requiredFieldEmpty: false, fetchAlertFiring: false },
  mashup: null,
  external: null,
  file: null,
  html: null,
}))
