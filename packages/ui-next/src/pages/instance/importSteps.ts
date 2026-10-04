import type { ConfigurationImportSummary, ImportCheck } from 'kuroshiro-shared'
import type { ArchiveNotice } from './configurationArchiveWording'
import { ref } from 'vue'
import { checkConfigurationImport, importConfiguration } from '@/api/configuration'
import { useAlerts, useDevices, useInstanceFacts } from '@/reads/sharedReads'
import { refusalNotice } from './configurationArchiveWording'

/** Where a Configuration Import stands. Nothing is changed before `imported`. */
type ImportStep
  = | { at: 'choose' }
    | { at: 'reading', file: File }
    | { at: 'read', file: File, check: ImportCheck, importing: boolean }
    | { at: 'imported', summary: ConfigurationImportSummary }
    | { at: 'refused', notice: ArchiveNotice }

/**
 * The four steps of a Configuration Import: `read(file)` asks what importing the archive would do,
 * `confirm()` imports the archive that was read, `startOver()` goes back to choosing a file.
 * `version` is this Kuroshiro's, which a refusal names.
 */
export function useImportSteps(version: () => string) {
  const step = ref<ImportStep>({ at: 'choose' })
  const shellReads = [useDevices(), useAlerts(), useInstanceFacts()]

  async function read(file: File) {
    step.value = { at: 'reading', file }
    try {
      step.value = { at: 'read', file, check: await checkConfigurationImport(file), importing: false }
    }
    catch (error) {
      step.value = { at: 'refused', notice: refusalNotice(error, version()) }
    }
  }

  async function confirm() {
    const current = step.value
    if (current.at !== 'read' || current.importing)
      return
    step.value = { ...current, importing: true }
    try {
      step.value = { at: 'imported', summary: await importConfiguration(current.file) }
    }
    catch (error) {
      step.value = { at: 'refused', notice: refusalNotice(error, version(), 'imported') }
      return
    }
    // An import changes almost everything the shell shows: the bar's Devices, the Alerts, the Instance facts.
    await Promise.all(shellReads.map(load => load.reload()))
  }

  function startOver() {
    step.value = { at: 'choose' }
  }

  return { step, read, confirm, startOver }
}
