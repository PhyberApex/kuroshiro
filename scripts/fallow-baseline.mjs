import { spawnSync } from 'node:child_process'
import process from 'node:process'

const FALLOW_ERROR_EXIT_CODE = 2

const analyses = ['dead-code', 'dupes', 'health']

// The health baseline carries per-function identities; fallow refuses a count-mode save over it.
const modeFlags = analysis => analysis === 'health' ? ['--baseline-mode', 'identity'] : []

for (const analysis of analyses) {
  const { status } = spawnSync('fallow', [analysis, '--save-baseline', `.fallow-baselines/${analysis}.baseline.json`, ...modeFlags(analysis), '--quiet'], { stdio: 'inherit', shell: true })
  if (status === FALLOW_ERROR_EXIT_CODE)
    process.exit(status)
}
