import type { CleanupInput, CleanupResult, RetentionRunResult, RetentionStatus, StorageCheck } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

/** Runs the stored-files check. It changes nothing. */
export function checkStoredFiles() {
  return apiGet<StorageCheck>('maintenance/scan')
}

/** Removes the findings named by id, for good. One the server no longer finds, or cannot remove, comes back in `failed`. */
export function cleanUpStoredFiles(input: CleanupInput) {
  return apiSend<CleanupResult>('POST', 'maintenance/cleanup', input)
}

export function getRetentionStatus() {
  return apiGet<RetentionStatus>('maintenance/retention')
}

/** A Retention Run. With `dryRun` it only counts what a run would remove. */
export function runRetention({ dryRun }: { dryRun: boolean }) {
  return apiSend<RetentionRunResult>('POST', 'maintenance/retention/run', { dryRun })
}
