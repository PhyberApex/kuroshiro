import type { SyncRun as SyncRunRead } from 'kuroshiro-shared'
import type { SyncRun } from './entities/sync-run.entity.js'
import { toIsoString } from '../utils/readModel.js'

export function toSyncRun(run: SyncRun): SyncRunRead {
  return { ranAt: toIsoString(run.ranAt), ok: run.ok, error: run.error }
}
