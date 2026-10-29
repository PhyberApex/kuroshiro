/**
 * The thread a transform runs on (ADR-0072). `PluginTransformService` starts one per run and terminates it when the run
 * outlasts its time, so a transform busy after an `await` stops with it instead of blocking the server. The thread
 * borrows the server's `fetch` over messages and answers the transform's result as JSON.
 *
 * Node runs this file as it is under test, stripping its types, so it imports nothing but Node and vm2, and only types
 * from elsewhere.
 */
import type { MessagePort } from 'node:worker_threads'
import { parentPort, workerData } from 'node:worker_threads'
import { VM } from 'vm2'

export interface TransformJob {
  transformJs: string
  input: unknown
  /** Whether the server lends the transform a `fetch`; without one the code has no way to the network. */
  withFetch: boolean
}

/** A request the transform makes, as plain data the thread can send. */
export interface FetchRequest {
  url: string
  init: { method: string, headers: Record<string, string>, body?: ArrayBuffer, redirect: RequestRedirect }
}

/** A response the server's `fetch` answered, as plain data the thread can send. */
export interface FetchedResponse {
  status: number
  statusText: string
  headers: [string, string][]
  body: ArrayBuffer
  url: string
}

export type WorkerMessage
  = | { type: 'log', text: string }
    | { type: 'fetch', id: number, request: FetchRequest }
    | { type: 'abort', id: number }
    | { type: 'done', json: string | undefined }
    | { type: 'failed', name: string, message: string }

export type ServerMessage
  = | { type: 'fetched', id: number, response: FetchedResponse }
    | { type: 'fetch-failed', id: number, name: string, message: string }

/**
 * The web-standard globals Node 20 has, which TRMNL's serverless runtime leaves in reach (ADR-0055). Node's own
 * `require`, `process` and file system stay out. They are this thread's, so its timers end with it.
 */
const WEB_GLOBALS = {
  AbortController,
  AbortSignal,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  atob,
  btoa,
  structuredClone,
  performance,
  crypto,
  Headers,
  Request,
  Response,
}

/**
 * The sandbox's `console`, which turns its arguments to text inside the sandbox, so a transform's `toString` runs
 * there and never on this thread's side.
 */
const SANDBOX_CONSOLE = `
  globalThis.console = { log: (...args) => __log(args.join(' ')) }
`

/**
 * The function a transform exports, found as TRMNL's serverless runtime finds it (ADR-0051): `run`, declared or
 * exported as `module.exports = { run }` / `exports.run`, then `module.exports` itself, then a declared `transform`.
 * Without one the input passes through unchanged. What it returns, awaited, leaves the sandbox as JSON.
 */
const PICK_TRANSFORM = `
  (async () => {
    const exported = module.exports
    const candidates = [
      typeof run === 'function' ? run : undefined,
      exported && typeof exported.run === 'function' ? exported.run : undefined,
      typeof exported === 'function' ? exported : undefined,
      typeof transform === 'function' ? transform : undefined,
    ]
    const picked = candidates.find(candidate => candidate !== undefined)
    return JSON.stringify(picked ? await picked(input) : input)
  })()
`

/** The server's `fetch`, reached over the port: the request goes out as plain data and the response comes back whole. */
function fetchOverPort(port: MessagePort): (url: string, init?: RequestInit) => Promise<Response> {
  let nextId = 0
  const pending = new Map<number, { resolve: (response: Response) => void, reject: (error: unknown) => void }>()

  port.on('message', (message: ServerMessage) => {
    const waiting = pending.get(message.id)
    if (!waiting)
      return
    pending.delete(message.id)
    if (message.type === 'fetched')
      waiting.resolve(responseOf(message.response))
    else
      waiting.reject(Object.assign(new Error(message.message), { name: message.name }))
  })

  return async (url, init) => {
    const signal = init?.signal
    signal?.throwIfAborted()
    const request = await requestOf(String(url), init)
    const id = nextId++
    return new Promise<Response>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      port.postMessage({ type: 'fetch', id, request } satisfies WorkerMessage)
      signal?.addEventListener('abort', () => {
        if (!pending.delete(id))
          return
        port.postMessage({ type: 'abort', id } satisfies WorkerMessage)
        reject(signal.reason)
      }, { once: true })
    })
  }
}

/** A request as the server's `fetch` takes it, read through `Request` so every kind of body arrives as bytes with its content type. */
async function requestOf(url: string, init?: RequestInit): Promise<FetchRequest> {
  const request = new Request(url, init)
  const body = request.body ? await request.arrayBuffer() : undefined
  return { url: request.url, init: { method: request.method, headers: Object.fromEntries(request.headers), redirect: request.redirect, ...(body && { body }) } }
}

const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304])

function responseOf({ status, statusText, headers, body, url }: FetchedResponse): Response {
  const response = new Response(NULL_BODY_STATUSES.has(status) ? null : body, { status, statusText, headers })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

async function runJob(port: MessagePort, { transformJs, input, withFetch }: TransformJob): Promise<string | undefined> {
  const moduleObj = { exports: {} }
  const vm = new VM({
    sandbox: {
      ...WEB_GLOBALS,
      input,
      data: input,
      module: moduleObj,
      exports: moduleObj.exports,
      __log: (text: unknown) => port.postMessage({ type: 'log', text: typeof text === 'string' ? text : '' } satisfies WorkerMessage),
      ...(withFetch && { fetch: fetchOverPort(port) }),
    },
  })
  vm.run(SANDBOX_CONSOLE)
  return await vm.run(`${transformJs}\n;${PICK_TRANSFORM}`) as string | undefined
}

if (parentPort) {
  const port = parentPort
  runJob(port, workerData as TransformJob).then(
    json => port.postMessage({ type: 'done', json } satisfies WorkerMessage),
    (error: unknown) => {
      const failure = error instanceof Error ? error : new Error(String(error))
      port.postMessage({ type: 'failed', name: String(failure.name), message: String(failure.message) } satisfies WorkerMessage)
    },
  )
}
