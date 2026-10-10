import type { ApiError, ApiErrorCode, ApiErrorField } from 'kuroshiro-shared'
import { wordRefusal } from './refusalWording'

/**
 * The server answered and said no. `message` is the sentence the admin reads, worded from
 * `code`, so it can be shown as it is: by a notice, a save state or a confirmation.
 */
export class ApiRefusal extends Error {
  readonly statusCode: number
  readonly code: ApiErrorCode
  /** A validation refusal's problems, each with its dotted path into the request. */
  readonly fields: ApiErrorField[]
  readonly details: Record<string, unknown>

  constructor(refusal: ApiError) {
    super(wordRefusal(refusal))
    this.name = 'ApiRefusal'
    this.statusCode = refusal.statusCode
    this.code = refusal.code
    this.fields = refusal.fields ?? []
    this.details = refusal.details ?? {}
  }
}

/** No answer from Kuroshiro's server: the network failed, or something in between answered in its place. */
export class ServerUnreachable extends Error {
  constructor() {
    super('Kuroshiro\'s server is not answering.')
    this.name = 'ServerUnreachable'
  }
}

/** Whether the server refused, and with `code` when one is named. */
export function isRefusal(error: unknown, code?: ApiErrorCode): error is ApiRefusal {
  return error instanceof ApiRefusal && (code === undefined || error.code === code)
}

export function isUnreachable(error: unknown): error is ServerUnreachable {
  return error instanceof ServerUnreachable
}

/** The messages of a validation refusal by the path of their field; empty for any other failure. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  return isRefusal(error)
    ? Object.fromEntries(error.fields.map(field => [field.path, field.message]))
    : {}
}

/** Every address is built from the document base, which carries the prefix the UI is served under. */
function underBase(path: string) {
  return new URL(path.replace(/^\/+/, ''), document.baseURI)
}

/** The usable address of an image path as a read model gives it: root-relative, with its version. */
export function imageUrl(imagePath: string) {
  return underBase(imagePath).href
}

type Query = Record<string, string | number | boolean | undefined>

function apiAddress(path: string, query: Query = {}) {
  const address = underBase(`api/${path}`)
  Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .forEach(([key, value]) => address.searchParams.set(key, String(value)))
  return address
}

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'code' in body && 'statusCode' in body
}

async function answerOf<T>(response: Response): Promise<T> {
  if (response.status === 204)
    return undefined as T
  const body: unknown = await response.json().catch(() => undefined)
  if (response.ok && body !== undefined)
    return body as T
  throw isApiError(body) ? new ApiRefusal(body) : new ServerUnreachable()
}

function sent(address: URL, init: RequestInit): Promise<Response> {
  return fetch(address, init).catch(() => {
    throw new ServerUnreachable()
  })
}

async function request<T>(address: URL, init: RequestInit): Promise<T> {
  return answerOf<T>(await sent(address, init))
}

/** Reads `GET /api/{path}`. Rejects with an `ApiRefusal` or a `ServerUnreachable`. */
export function apiGet<T>(path: string, query?: Query): Promise<T> {
  return request<T>(apiAddress(path, query), { headers: { Accept: 'application/json' } })
}

type WriteMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/**
 * Writes to `/api/{path}`. `body` is one of the shared `…Input` types, sent as JSON, or a
 * `FormData` for an upload. Answers the read model the server gives back, or nothing for a 204.
 */
export function apiSend<T = void>(method: WriteMethod, path: string, body?: object): Promise<T> {
  const headers = { Accept: 'application/json' }
  if (body === undefined || body instanceof FormData)
    return request<T>(apiAddress(path), { method, headers, body })
  return request<T>(apiAddress(path), {
    method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Uploads to `/api/{path}` where the server answers an image and stores nothing: a preview. A refusal still comes in the error envelope. */
export async function apiSendForImage(method: WriteMethod, path: string, body: FormData): Promise<Blob> {
  const response = await sent(apiAddress(path), { method, body })
  return response.ok ? response.blob() : answerOf<Blob>(response)
}

/** As {@link apiSendForImage}, with a JSON body instead of a `FormData` upload, and the response's own headers alongside the image. */
export async function apiSendForImageWithHeaders(method: WriteMethod, path: string, body: object): Promise<{ blob: Blob, headers: Headers }> {
  const response = await sent(apiAddress(path), {
    method,
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response.ok ? { blob: await response.blob(), headers: response.headers } : answerOf(response)
}

/** The name a `Content-Disposition: attachment` header gives the download, from its `filename*` or, absent that, its `filename`. */
function downloadName(headers: Headers): string {
  const disposition = headers.get('Content-Disposition') ?? ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
  if (utf8)
    return decodeURIComponent(utf8)
  return /filename="([^"]*)"/.exec(disposition)?.[1] ?? ''
}

function save(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

/**
 * Fetches what `GET /api/{path}` answers as a file, then has the browser save it from an
 * object URL under the name the server gives it. Rejects with an `ApiRefusal` or a
 * `ServerUnreachable`, without saving anything.
 */
export async function apiDownloadChecked(path: string, query?: Query): Promise<void> {
  const response = await sent(apiAddress(path, query), {})
  if (!response.ok)
    return answerOf(response)
  save(await response.blob(), downloadName(response.headers))
}
