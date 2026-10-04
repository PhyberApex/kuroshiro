import type { CleanupResult, RetentionRunResult, RetentionStatus, StorageCheck } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildRetentionStatus, buildStorageCheck } from '@/testing/fixtures/maintenance'

const HOUSEKEEPING = '/instance/housekeeping'

export interface FakedHousekeeping {
  /** What each check answers, in turn; the last one answers every check after it. */
  checks: (StorageCheck | Response)[]
  cleanupAnswer: CleanupResult | Response
  retention: RetentionStatus | Response
  dryRunAnswer: RetentionRunResult | Response
  runAnswer: RetentionRunResult | Response
  /** While set, a check is not answered until it resolves. */
  holdingChecks?: Promise<unknown>
  /** While set, a Retention Run is not answered until it resolves. */
  holdingRuns?: Promise<unknown>
  /** How many checks were asked for. */
  checked: number
  /** The finding ids of every clean-up, in order. */
  cleanups: string[][]
  /** The `dryRun` of every Retention Run, in order. */
  runs: boolean[]
}

interface Faked {
  checks?: (StorageCheck | Response)[]
  cleanup?: CleanupResult | Response
  retention?: RetentionStatus | Response
  dryRun?: RetentionRunResult | Response
  run?: RetentionRunResult | Response
}

const answer = (body: object | Response, status = 200) => body instanceof Response ? body.clone() : HttpResponse.json(body, { status })

/** Fakes the Housekeeping page's four routes: the check, the clean-up, the Retention status and a Retention Run. */
export function fakeHousekeeping({
  checks = [buildStorageCheck()],
  cleanup = { removed: { files: 0, folders: 0, screens: 0, bytes: 0 }, failed: [] },
  retention = buildRetentionStatus(),
  dryRun = { alertsPruned: 4, deviceLogsPruned: 212 },
  run = { alertsPruned: 4, deviceLogsPruned: 212 },
}: Faked = {}): FakedHousekeeping {
  const faked: FakedHousekeeping = { checks, cleanupAnswer: cleanup, retention, dryRunAnswer: dryRun, runAnswer: run, checked: 0, cleanups: [], runs: [] }

  fakeShellReads()
  api.use(
    http.get(apiUrl('maintenance/scan'), async () => {
      const turn = Math.min(faked.checked++, faked.checks.length - 1)
      await faked.holdingChecks
      return answer(faked.checks[turn]!)
    }),
    http.post(apiUrl('maintenance/cleanup'), async ({ request }) => {
      faked.cleanups.push(((await request.json()) as { findingIds: string[] }).findingIds)
      return answer(faked.cleanupAnswer, 201)
    }),
    http.get(apiUrl('maintenance/retention'), () => answer(faked.retention)),
    http.post(apiUrl('maintenance/retention/run'), async ({ request }) => {
      const { dryRun } = (await request.json()) as { dryRun: boolean }
      faked.runs.push(dryRun)
      await faked.holdingRuns
      return answer(dryRun ? faked.dryRunAnswer : faked.runAnswer, 201)
    }),
  )
  return faked
}

export async function mountHousekeeping(at = HOUSEKEEPING) {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { level: 2, name: 'Housekeeping' })).toBeVisible()
  return screen
}
