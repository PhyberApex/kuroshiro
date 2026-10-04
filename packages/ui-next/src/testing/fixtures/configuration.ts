import type { ConfigurationImportSummary, ImportCheck } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

/** A Configuration Archive of another Instance read on one that has Kitchen: it adds Hallway and overwrites Kitchen. */
export const buildImportCheck = defineBuilder<ImportCheck>(() => ({
  archive: { kuroshiroVersion: '0.17.1', exportedAt: '2026-09-28T19:14:00.000Z', schemaVersion: 3, redacted: false },
  adds: { devices: 1, plugins: 4, screens: 9, schedules: 3, mashupConfigurations: 1, palettes: 1, firmware: 1 },
  overwrites: { devices: 1, plugins: 6, screens: 5 },
  devices: {
    added: [{ id: 'd1f0a8c2-5b7e-4f3a-9c1d-2e4f6a8b0c1d', name: 'Hallway' }],
    overwritten: [{ id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', name: 'Kitchen' }],
  },
  settings: { overridden: 2 },
  warnings: [],
}))

export const buildImportSummary = defineBuilder<ConfigurationImportSummary>(() => ({
  created: { devices: 1, plugins: 4, screens: 9, schedules: 3, mashupConfigurations: 1, palettes: 1, firmware: 1 },
  updated: { devices: 1, plugins: 6, screens: 5 },
  warnings: [],
}))
