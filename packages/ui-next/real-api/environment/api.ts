import type { AddressInfo } from 'node:net'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import process from 'node:process'

const uiDir = resolve(import.meta.dirname, '../..')
const apiDir = resolve(uiDir, '../api')
// Laid out like the image: the API bundle in `dist/` beside the built UI in `public/`.
// It sits under the API's own `dist/`, which is already ignored and resolves the API's node_modules.
const stageDir = resolve(apiDir, 'dist/real-api')

function build() {
  // Vitest runs this with NODE_ENV=test, under which Vite would build the UI in development mode.
  const env = { ...process.env, NODE_ENV: 'production' }
  execFileSync('pnpm', ['run', 'build'], { cwd: apiDir, env, stdio: 'inherit' })
  execFileSync('pnpm', ['run', 'build'], { cwd: uiDir, env, stdio: 'inherit' })
  rmSync(stageDir, { recursive: true, force: true })
  mkdirSync(resolve(stageDir, 'dist'), { recursive: true })
  cpSync(resolve(apiDir, 'dist/main.js'), resolve(stageDir, 'dist/main.js'))
  cpSync(resolve(uiDir, 'dist'), resolve(stageDir, 'public'), { recursive: true })
}

async function freePort() {
  const server = createServer().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  server.close()
  await once(server, 'close')
  return port
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface RunningApi {
  baseUrl: string
  stop: () => Promise<void>
}

/** Builds the API and the UI, then runs them the way the image does: one process serving both. */
export async function startApi(databaseEnv: Record<string, string>): Promise<RunningApi> {
  build()
  const port = await freePort()
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
      KUROSHIRO_API_URL: baseUrl.replace(/\/$/, ''),
    },
  })
  api.stdout.on('data', chunk => output.push(String(chunk)))
  api.stderr.on('data', chunk => output.push(String(chunk)))

  const stop = async () => {
    if (api.exitCode !== null)
      return
    api.kill()
    await once(api, 'exit')
  }

  const answers = async (attemptsLeft = 120): Promise<void> => {
    if (api.exitCode !== null)
      throw new Error(`The API exited with code ${api.exitCode} before it answered:\n${output.join('')}`)
    const ok = await fetch(new URL('api/settings', baseUrl)).then(response => response.ok, () => false)
    if (ok)
      return
    if (attemptsLeft === 0)
      throw new Error(`The API did not answer within a minute:\n${output.join('')}`)
    await sleep(500)
    return answers(attemptsLeft - 1)
  }

  try {
    await answers()
  }
  catch (error) {
    await stop()
    throw error
  }
  return { baseUrl, stop }
}
