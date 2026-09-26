import type { ConfigurationImportSummary } from 'kuroshiro-shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiRequest } from '../utils/apiRequest'
import { errorMessage } from '../utils/errorMessage'

export const useConfigurationStore = defineStore('configuration', () => {
  const importing = ref(false)
  const error = ref<string | null>(null)
  const importSummary = ref<ConfigurationImportSummary | null>(null)

  async function importArchive(file: File): Promise<boolean> {
    importing.value = true
    error.value = null
    importSummary.value = null
    try {
      const body = new FormData()
      body.append('file', file)
      importSummary.value = await apiRequest<ConfigurationImportSummary>('/api/config/import', { method: 'POST', body }, 'Failed to import configuration')
      return true
    }
    catch (err) {
      error.value = errorMessage(err, 'Failed to import configuration')
      return false
    }
    finally {
      importing.value = false
    }
  }

  function reset() {
    error.value = null
    importSummary.value = null
  }

  return { importing, error, importSummary, importArchive, reset }
})
