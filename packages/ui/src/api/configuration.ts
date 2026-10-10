import type { ConfigurationImportSummary, ImportCheck } from 'kuroshiro-shared'
import { apiDownloadChecked, apiSend } from './client'

/** Downloads the Configuration Archive, or with `redacted` the Redacted Archive, as `kuroshiro-config-{time}.zip`. */
export function exportConfiguration({ redacted }: { redacted: boolean }) {
  return apiDownloadChecked('config/export', { redact: redacted || undefined })
}

function archiveForm(file: File) {
  const form = new FormData()
  form.set('file', file)
  return form
}

/** Reads an archive and answers what importing it would do. Nothing is changed. Refused as `importConfiguration` is. */
export function checkConfigurationImport(file: File) {
  return apiSend<ImportCheck>('POST', 'config/import/check', archiveForm(file))
}

/** Refused with `archive-not-zip`, `archive-not-configuration`, `archive-schema-version`, `archive-record-refused` or `upload-too-large`. */
export function importConfiguration(file: File) {
  return apiSend<ConfigurationImportSummary>('POST', 'config/import', archiveForm(file))
}
