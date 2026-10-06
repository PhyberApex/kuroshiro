import type { AddressInfo } from 'node:net'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import process from 'node:process'
import { becomesReady } from './poll.ts'

const uiDir = resolve(import.meta.dirname, '../..')
const apiDir = resolve(uiDir, '../api')
// Laid out like the image: the API bundle in `dist/` beside its `package.json` and the built UI in `public/`,
// with the API's static Fallback Screens under `public/screens/`.
// It sits under the API's own `dist/`, which is already ignored and resolves the API's node_modules.
const stageDir = resolve(apiDir, 'dist/real-api')

/** Builds the API and the UI and stages them the way the image lays them out. */
export function buildApi() {
  // Vitest runs this with NODE_ENV=test, under which Vite would build the UI in development mode.
  const env = { ...process.env, NODE_ENV: 'production' }
  execFileSync('pnpm', ['run', 'build'], { cwd: apiDir, env, stdio: 'inherit' })
  execFileSync('pnpm', ['run', 'build'], { cwd: uiDir, env, stdio: 'inherit' })
  rmSync(stageDir, { recursive: true, force: true })
  mkdirSync(resolve(stageDir, 'dist'), { recursive: true })
  cpSync(resolve(apiDir, 'dist/main.js'), resolve(stageDir, 'dist/main.js'))
  cpSync(resolve(apiDir, 'package.json'), resolve(stageDir, 'package.json'))
  cpSync(resolve(uiDir, 'dist'), resolve(stageDir, 'public'), { recursive: true })
  cpSync(resolve(apiDir, 'assets/screens'), resolve(stageDir, 'public/screens'), { recursive: true })
}

export async function freePort() {
  const server = createServer().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  server.close()
  await once(server, 'close')
  return port
}

export interface RunningApi {
  baseUrl: string
  stop: () => Promise<void>
}

/**
 * Runs the staged build the way the image does: one process serving both the API and the UI.
 * `publicUrl` is the address the Instance tells Devices and admins about, its own address unless given.
 */
export async function runApi(databaseEnv: Record<string, string>, port: number, publicUrl?: string): Promise<RunningApi> {
  const baseUrl = `http://127.0.0.1:${port}/`
  const output: string[] = []
  const api = spawn(process.execPath, [resolve(stageDir, 'dist/main.js')], {
    // The API reads its migrations from `dist/src/migrations` under the working directory.
    cwd: apiDir,
    env: {
      ...process.env,
      ...databaseEnv,
      NODE_ENV: 'production',
      KUROSHIRO_PORT: String(port),
      KUROSHIRO_API_URL: publicUrl ?? baseUrl.replace(/\/$/, ''),
    },
  })
  api.stdout.on('data', chunk => output.push(String(chunk)))
  api.stderr.on('data', chunk => output.push(String(chunk)))
  const exited = once(api, 'exit')
  const hasExited = () => api.exitCode !== null || api.signalCode !== null

  const stop = async () => {
    if (!hasExited())
      api.kill()
    await exited
  }

  const answers = () => fetch(new URL('api/settings', baseUrl)).then(response => response.ok, () => false)

  if (!await becomesReady(() => hasExited() || answers(), 120) || hasExited()) {
    await stop()
    throw new Error(`The API did not come up (exit: ${api.exitCode ?? api.signalCode ?? 'still running after a minute'}):\n${output.join('')}`)
  }
  return { baseUrl, stop }
}

/** Builds the API and the UI, then runs them on a free port. */
export async function startApi(databaseEnv: Record<string, string>): Promise<RunningApi> {
  buildApi()
  return runApi(databaseEnv, await freePort())
}
