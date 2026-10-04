import type { ImportCheck, ImportCounts, ImportWarning, Ref } from 'kuroshiro-shared'
import type { ConfigurationManifest, InstanceSettingsManifestEntry } from '../types.js'
import { BOOLEAN_SETTING_KEYS, SETTING_KEYS } from 'kuroshiro-shared'

/** What an import that was run and rolled back did, as far as `ImportCheck` tells it. */
export interface CheckedImport {
  created: ImportCounts
  updated: ImportCounts
  devices: { added: Ref[], overwritten: Ref[] }
  warnings: ImportWarning[]
}

export function toImportCheck(manifest: ConfigurationManifest, settings: InstanceSettingsManifestEntry, checked: CheckedImport): ImportCheck {
  return {
    archive: {
      kuroshiroVersion: typeof manifest.kuroshiroVersion === 'string' ? manifest.kuroshiroVersion : null,
      exportedAt: typeof manifest.exportedAt === 'string' ? manifest.exportedAt : null,
      schemaVersion: manifest.schemaVersion,
      redacted: manifest.redacted === true,
    },
    adds: checked.created,
    overwrites: checked.updated,
    devices: checked.devices,
    settings: { overridden: [...SETTING_KEYS, ...BOOLEAN_SETTING_KEYS].filter(key => settings[key] != null).length },
    warnings: checked.warnings,
  }
}
