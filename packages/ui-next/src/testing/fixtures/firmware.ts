import type { FirmwareList, FirmwareRead } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildFirmware = defineBuilder<FirmwareRead>(() => ({
  id: '9b2d4c6e-1f3a-4b5c-8d7e-6f5a4b3c2d1e',
  version: '1.7.9',
  kind: 'official-synced',
  label: null,
  compatibleModels: [],
  deprecated: false,
  syncedAt: '2026-10-03T04:00:00.000Z',
  uploadedAt: null,
  filePresent: true,
  targetOf: [],
  runningOn: [],
}))

export const buildFirmwareList = defineBuilder<FirmwareList>(() => ({
  lastSync: { ranAt: '2026-10-03T04:00:00.000Z', ok: true, error: null },
  firmware: [buildFirmware()],
}))
