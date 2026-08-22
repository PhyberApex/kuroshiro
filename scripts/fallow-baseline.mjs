import { spawnSync } from 'node:child_process'
import process from 'node:process'

const FALLOW_ERROR_EXIT_CODE = 2

const analyses = ['dead-code', 'dupes', 'health']

for (const analysis of analyses) {
  const { status } = spawnSync('fallow', [analysis, '--save-baseline', `.fallow-baselines/${analysis}.baseline.json`, '--quiet'], { stdio: 'inherit', shell: true })
  if (status === FALLOW_ERROR_EXIT_CODE)
    process.exit(status)
}
