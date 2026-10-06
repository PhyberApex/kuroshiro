/** The record a warning is about, as the archive or this Instance names it. */
export interface Ref {
  id: string
  name: string
}

/**
 * What a Configuration Import did that the admin has to know about, by kind and with the
 * record it is about. The page words each one; the server never sends a sentence.
 */
export type ImportWarning
  = | { kind: 'device-apikey-redacted', device: Ref }
    | { kind: 'device-apikeys-kept' }
    | { kind: 'mirror-apikey-redacted', device: Ref }
    | { kind: 'webhook-token-redacted', plugin: Ref }
    | { kind: 'header-redacted', plugin: Ref, dataSource: string, header: string }
    | { kind: 'field-value-redacted', plugin: Ref, keyname: string, label: string }
    | { kind: 'field-value-without-field', plugin: Ref, keyname: string }
    | { kind: 'previous-version-values-dropped', plugin: Ref }
    | { kind: 'firmware-file-missing', firmware: { id: string, version: string } }
    | { kind: 'device-model-unknown', device: Ref, deviceModel: string }
    | { kind: 'palette-unknown', device: Ref, paletteId: string }
    | { kind: 'firmware-unknown', device: Ref, firmwareId: string }

/** How many records of each kind, by the importer's own keys: `devices`, `plugins`, `screens`, `schedules`, `mashupConfigurations`, `palettes`, `firmware` and the rows under a Plugin. */
export type ImportCounts = Record<string, number>

export interface ConfigurationImportSummary {
  created: ImportCounts
  updated: ImportCounts
  warnings: ImportWarning[]
}

/** What importing an archive would do, read without importing it. */
export interface ImportCheck {
  archive: {
    kuroshiroVersion: string | null
    exportedAt: string | null
    schemaVersion: number
    redacted: boolean
  }
  adds: ImportCounts
  overwrites: ImportCounts
  devices: { added: Ref[], overwritten: Ref[] }
  /** How many Instance Settings the archive holds; an import puts every other one back to its fallback. */
  settings: { overridden: number }
  warnings: ImportWarning[]
}

// Configuration Export writes this in every redactable field of a Redacted Archive;
// Configuration Import recognises it in any redactable field regardless of the
// manifest's `redacted` flag (ADR-0028).
export const CONFIGURATION_REDACTION_SENTINEL = '__KUROSHIRO_REDACTED__'
