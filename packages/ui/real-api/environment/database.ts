import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { becomesReady } from './poll.ts'

export interface Database {
  /** The `KUROSHIRO_DB_*` variables the API connects with. */
  env: Record<string, string>
  stop: () => void
}

const CREDENTIALS = { user: 'kuroshiro', password: 'kuroshiro', database: 'kuroshiro' }

function docker(...args: string[]) {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim()
}

function acceptsConnections(container: string) {
  try {
    // Over TCP, because the socket already answers while the image's init scripts still run.
    docker('exec', container, 'pg_isready', '--host', '127.0.0.1', '--username', CREDENTIALS.user, '--dbname', CREDENTIALS.database)
    return true
  }
  catch {
    return false
  }
}

async function startThrowawayPostgres(): Promise<Database> {
  const container = docker(
    'run',
    '--detach',
    '--rm',
    '--env',
    `POSTGRES_USER=${CREDENTIALS.user}`,
    '--env',
    `POSTGRES_PASSWORD=${CREDENTIALS.password}`,
    '--env',
    `POSTGRES_DB=${CREDENTIALS.database}`,
    '--publish',
    '127.0.0.1::5432',
    'postgres:18-alpine',
  )
  const stop = () => {
    docker('rm', '--force', '--volumes', container)
  }
  try {
    if (!await becomesReady(() => acceptsConnections(container), 60))
      throw new Error('Postgres did not accept connections within 30 seconds.')
    const port = docker('port', container, '5432/tcp').split(':').at(-1)!
    return {
      env: {
        KUROSHIRO_DB_HOST: '127.0.0.1',
        KUROSHIRO_DB_PORT: port,
        KUROSHIRO_DB_USER: CREDENTIALS.user,
        KUROSHIRO_DB_PASSWORD: CREDENTIALS.password,
        KUROSHIRO_DB_DB: CREDENTIALS.database,
      },
      stop,
    }
  }
  catch (error) {
    stop()
    throw error
  }
}

/**
 * The Postgres the suite runs against: the one `KUROSHIRO_DB_HOST` points at (CI's service
 * container), or else an empty throwaway container that is removed afterwards.
 */
export async function startDatabase(): Promise<Database> {
  if (process.env.KUROSHIRO_DB_HOST)
    return { env: {}, stop: () => {} }
  return startThrowawayPostgres()
}
