import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildDeviceSummary = defineBuilder<DeviceSummary>(() => ({
  id: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11',
  name: 'Kitchen',
  friendlyId: '4F2A1C',
  firmwareVersion: '1.7.8',
  deviceModel: { name: 'og_plus', label: 'TRMNL OG (2-bit)', width: 800, height: 480, deprecated: false },
  lastSeenAt: '2026-10-03T07:31:00.000Z',
  nextPollAt: '2026-10-03T07:46:00.000Z',
  batteryPercent: 76,
  rssi: -61,
  isMirrored: false,
  isProxied: false,
  sleep: { enabled: false, start: null, end: null, whileAsleep: 'fallback', inWindow: false, endsAt: null },
  currentScreen: {
    kind: 'screen',
    screenId: 'c2f1d0a4-5b6e-4c7d-8e9f-0a1b2c3d4e5f',
    name: 'Calendar',
    imagePath: '/screens/devices/3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11/c2f1d0a4-5b6e-4c7d-8e9f-0a1b2c3d4e5f.png?v=1791012660000',
    renderedAt: '2026-10-03T07:31:00.000Z',
    servedAt: '2026-10-03T07:31:00.000Z',
    paused: false,
    holding: false,
  },
}))

export const buildDeviceDetail = defineBuilder<DeviceDetail>(() => ({
  ...buildDeviceSummary(),
  mac: 'A4:C1:38:5F:0B:9D',
  apikey: 'k7Qm2Zr9Xw4Tn8Vb',
  refreshRate: 900,
  reported: { batteryVoltage: '4.05', rssi: '-61', firmwareVersion: '1.7.8', model: 'og_plus', width: 800, height: 480 },
  palette: { id: '5c9e2f7a-3b1d-4e8f-a6c4-0d2b7e9f1a3c', name: 'Greyscale, 4 levels', kind: 'official' },
  mirror: { enabled: false, mac: null, apikeySet: false },
  targetFirmware: null,
  pending: { specialFunction: null, deviceReset: false, firmwarePush: false },
  sleepImagePath: null,
  sensors: [],
  screenCount: 1,
}))
