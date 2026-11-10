import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { userInfo } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'

// Microsoft re-pushes a Playwright image tag with newer Chrome patches, and a patch moves
// sub-pixel rendering enough to fail baselines. So the image is pinned by digest too, and a
// Playwright bump has to bring the digest of its new tag along with regenerated baselines.
const pinnedImage = {
  version: '1.65.0',
  digest: 'sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d',
}

const { version } = createRequire(import.meta.url)('playwright/package.json')
if (version !== pinnedImage.version) {
  console.error(
    `playwright ${version} is installed but scripts/screenshots.mjs pins the image for ${pinnedImage.version}. `
    + `Run \`docker buildx imagetools inspect mcr.microsoft.com/playwright:v${version}-noble\`, put its digest `
    + `and the version into pinnedImage, then regenerate the baselines with \`pnpm test:screenshots:update\`.`,
  )
  process.exit(1)
}

const image = `mcr.microsoft.com/playwright:v${pinnedImage.version}-noble@${pinnedImage.digest}`

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
