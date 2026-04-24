import type { CleanupResult, MaintenanceIssues, MaintenanceStats } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMaintenanceStore = defineStore('maintenance', () => {
  const issues = ref<MaintenanceIssues | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function scanSystem() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/maintenance/scan')
      if (!res.ok)
        throw new Error(`Scan failed: ${res.statusText}`)
      issues.value = await res.json()
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to scan system'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  async function cleanupIssues(
    orphanedFiles: string[] = [],
    orphanedDirs: string[] = [],
    brokenScreens: string[] = [],
    tempFiles: string[] = [],
    oldUploads: string[] = [],
    dryRun: boolean = false,
  ): Promise<CleanupResult> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/maintenance/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orphanedFiles,
          orphanedDirs,
          brokenScreens,
          tempFiles,
          oldUploads,
          dryRun,
        }),
      })
      if (!res.ok)
        throw new Error(`Cleanup failed: ${res.statusText}`)
      return await res.json()
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to cleanup'
      throw err
    }
    finally {
      loading.value = false
    }
  }

  async function getStats(): Promise<MaintenanceStats> {
    try {
      const res = await fetch('/api/maintenance/stats')
      if (!res.ok)
        throw new Error(`Stats fetch failed: ${res.statusText}`)
      return await res.json()
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get stats'
      throw err
    }
  }

  function clearIssues() {
    issues.value = null
    error.value = null
  }

  return {
    issues,
    loading,
    error,
    scanSystem,
    cleanupIssues,
    getStats,
    clearIssues,
  }
})
