import { readFileSync } from 'node:fs'
import { resolveAppPath } from '../utils/pathHelper.js'

/** Reads the running API package's own version, the same way the UI reads its own `package.json` for the app-bar version string. */
export function getApiVersion(): string {
  const packageJsonPath = resolveAppPath('package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }
  return packageJson.version
}
