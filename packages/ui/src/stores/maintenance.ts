import type { CleanupResult, MaintenanceIssues, RetentionRunResult, RetentionStatus } from 'kuroshiro-shared'
import type { MaintenanceStats } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/apiRequest'

export const useMaintenanceStore = defineStore('maintenance', () => {
  const issues = ref<MaintenanceIssues | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const retentionStatus = ref<RetentionStatus | null>(null)

  async function scanSystem() {
    loading.value = true
    error.value = null
    try {
      const res = await apiFetch('/api/maintenance/scan')
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
      const res = await apiFetch('/api/maintenance/cleanup', {
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
      const res = await apiFetch('/api/maintenance/stats')
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

  async function loadRetentionStatus() {
    error.value = null
    try {
      const res = await apiFetch('/api/maintenance/retention')
      if (!res.ok)
        throw new Error(`Retention status fetch failed: ${res.statusText}`)
      retentionStatus.value = await res.json()
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load retention status'
      throw err
    }
  }

  async function runRetention(dryRun: boolean): Promise<RetentionRunResult> {
    error.value = null
    try {
      const res = await apiFetch('/api/maintenance/retention/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      if (!res.ok)
        throw new Error(`Retention run failed: ${res.statusText}`)
      const result: RetentionRunResult = await res.json()
      if (!dryRun)
        await loadRetentionStatus()
      return result
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to run retention'
      throw err
    }
  }

  return {
    issues,
    loading,
    error,
    retentionStatus,
    scanSystem,
    cleanupIssues,
    getStats,
    clearIssues,
    loadRetentionStatus,
    runRetention,
  }
})
