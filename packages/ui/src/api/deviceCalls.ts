import type { DisplayAnswer, SetupAnswer } from 'kuroshiro-shared'
import { ServerUnreachable } from './client'

/** The headers a Device sends, by the name the firmware gives them. */
export type DeviceHeaders = Record<string, string>

/**
 * How a Device-facing call came back: the answer, or the server's refusal as its status and reason.
 * These routes keep Nest's own `{ statusCode, message, error }` body, not the admin API's envelope. An answer that is
 * not JSON came from something in the server's place, as the admin client takes it.
 */
export type DeviceCall<T> = { answered: T } | { refused: string }

interface NestRefusal {
  statusCode?: number
  error?: string
  message?: string | string[]
}

function reasonOf(response: Response, body: NestRefusal | undefined) {
  const status = [response.status, body?.error ?? response.statusText].filter(Boolean).join(' ')
  const messages = [body?.message ?? []].flat().filter(Boolean)
  return messages.length > 0 ? `${status}: ${messages.join('; ')}.` : `${status}.`
}

async function deviceCall<T>(path: string, headers: DeviceHeaders): Promise<DeviceCall<T>> {
  const response = await fetch(new URL(`api/${path}`, document.baseURI), { headers: { Accept: 'application/json', ...headers } })
    .catch(() => {
      throw new ServerUnreachable()
    })
  const body: unknown = await response.json().catch(() => undefined)
  if (response.ok && body !== undefined)
    return { answered: body as T }
  if (response.ok)
    throw new ServerUnreachable()
  return { refused: reasonOf(response, body as NestRefusal | undefined) }
}

/** Announces a Device by its MAC address as the firmware does on first start. A MAC address nobody registered creates a Device. */
export function callSetup(headers: DeviceHeaders & { ID: string }) {
  return deviceCall<SetupAnswer>('setup', headers)
}

/** Polls for the next Screen as the firmware does on every wake. */
export function pollDisplay(headers: DeviceHeaders & { 'ID': string, 'Access-Token': string }) {
  return deviceCall<DisplayAnswer>('display', headers)
}
