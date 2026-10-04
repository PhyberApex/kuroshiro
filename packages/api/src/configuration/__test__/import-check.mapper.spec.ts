import type { ConfigurationManifest } from '../types.js'
import { describe, expect, it } from 'vitest'
import { toImportCheck } from '../services/import-check.mapper.js'

const MANIFEST: ConfigurationManifest = { kuroshiroVersion: '0.17.1', schemaVersion: 3, exportedAt: '2026-09-28T19:14:00.000Z', containsSecrets: true }
const NOTHING_DONE = { created: {}, updated: {}, devices: { added: [], overwritten: [] }, warnings: [] }

describe('toImportCheck', () => {
  it('answers the manifest, what the run added and overwrote, its Devices and its warnings', () => {
    const hallway = { id: 'hallway', name: 'Hallway' }
    const kitchen = { id: 'kitchen', name: 'Kitchen' }
    const warnings = [{ kind: 'device-apikey-redacted' as const, device: hallway }]

    expect(toImportCheck({ ...MANIFEST, containsSecrets: false, redacted: true }, {}, {
      created: { devices: 1, plugins: 2 },
      updated: { devices: 1 },
      devices: { added: [hallway], overwritten: [kitchen] },
      warnings,
    })).toEqual({
      archive: { kuroshiroVersion: '0.17.1', exportedAt: '2026-09-28T19:14:00.000Z', schemaVersion: 3, redacted: true },
      adds: { devices: 1, plugins: 2 },
      overwrites: { devices: 1 },
      devices: { added: [hallway], overwritten: [kitchen] },
      settings: { overridden: 0 },
      warnings,
    })
  })

  it('counts the Instance Settings the archive holds, a zero and a switched-off one included', () => {
    const settings = { lowBatteryPercent: 15, alertRetentionDays: 0, firmwareAutoUpdate: false }

    expect(toImportCheck(MANIFEST, settings, NOTHING_DONE).settings).toEqual({ overridden: 3 })
  })

  it('says an archive is not redacted unless its manifest says so, and gives null for what a manifest lacks', () => {
    const bare = { schemaVersion: 3 } as ConfigurationManifest

    expect(toImportCheck(bare, {}, NOTHING_DONE).archive).toEqual({ kuroshiroVersion: null, exportedAt: null, schemaVersion: 3, redacted: false })
  })
})
