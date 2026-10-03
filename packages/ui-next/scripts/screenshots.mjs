import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { userInfo } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'

// The image is pinned by the Playwright version in the workspace catalog, so the browser
// that writes a baseline is the one the installed Playwright expects, locally and in CI.
const { version } = createRequire(import.meta.url)('playwright/package.json')
const image = `mcr.microsoft.com/playwright:v${version}-noble`

const packageDir = resolve(import.meta.dirname, '..')
const repoRoot = resolve(packageDir, '../..')
const { uid, gid } = userInfo()

const { status } = spawnSync('docker', [
  'run',
  '--rm',
  '--ipc=host',
  '--user',
  `${uid}:${gid}`,
  '--env',
  'HOME=/tmp',
  '--env',
  `KUROSHIRO_SCREENSHOT_IMAGE=${image}`,
  // Mounted at its own path, because node_modules holds absolute paths into the workspace.
  '--volume',
  `${repoRoot}:${repoRoot}`,
  '--workdir',
  packageDir,
  image,
  'node',
  'node_modules/vitest/vitest.mjs',
  'run',
  '--config',
  'vitest.screenshots.config.ts',
  ...process.argv.slice(2),
], { stdio: 'inherit' })

process.exit(status ?? 1)
