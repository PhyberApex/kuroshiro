export interface ConfigurationImportSummary {
  created: Record<string, number>
  updated: Record<string, number>
  warnings: string[]
}

// Configuration Export writes this in every redactable field of a Redacted Archive;
// Configuration Import recognises it in any redactable field regardless of the
// manifest's `redacted` flag (ADR-0028).
export const CONFIGURATION_REDACTION_SENTINEL = '__KUROSHIRO_REDACTED__'
