/**
 * The thread a transform runs on (ADR-0072). `PluginTransformService` starts one per run and terminates it when the run
 * outlasts its time, so a transform busy after an `await` stops with it instead of blocking the server. The thread
 * borrows the server's `fetch` over messages and answers the transform's result as JSON.
 *
 * Node runs this file as it is under test, stripping its types, so it imports nothing but Node, vm2 and the sandbox's
 * own globals beside it, which import nothing themselves, and only types from elsewhere.
 */
import type { MessagePort } from 'node:worker_threads'
import buffer from 'node:buffer'
import { parentPort, workerData } from 'node:worker_threads'
import { VM } from 'vm2'
import { SANDBOX_GLOBALS } from './transform-globals.ts'

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
 * What the sandbox cannot build for itself: the clock, the entropy, the timers and the way to the network. Each is
 * bridged in as a plain function rather than as a host object (ADR-0077), so the sandbox holds no reference to one.
 * The timers are this thread's, so they end with it.
 */
function bridgedGlobals(): Record<string, unknown> {
  return {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    performance: { now: () => performance.now() },
    crypto: {
      randomUUID: () => crypto.randomUUID(),
      // Filled through the sandbox's own view: a typed array from the sandbox fails the host's internal slot check.
      getRandomValues: (array: { length: number, BYTES_PER_ELEMENT?: number, [index: number]: number }) => {
        const width = array.BYTES_PER_ELEMENT ?? 1
        const bytes = crypto.getRandomValues(new Uint8Array(array.length * width))
        for (let index = 0; index < array.length; index++) {
          let value = 0
          for (let byte = 0; byte < width; byte++)
            value = value * 256 + bytes[index * width + byte]
          array[index] = value
        }
        return array
      },
    },
  }
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

/** A request the sandbox hands out, its body base64 because an `ArrayBuffer` cannot cross the sandbox boundary. */
interface SandboxRequest {
  url: string
  init: { method: string, headers: Record<string, string>, redirect: RequestRedirect, body?: string }
}

/** What the sandbox reads back, its body base64 and its headers an object the sandbox's `Headers` takes. */
type SandboxAnswer
  = | { status: number, statusText: string, headers: Record<string, string>, body: string, url: string }
    | { failed: true, name: string, message: string }

/**
 * The server's `fetch`, reached over the port. Every call crosses sandbox to host and never the other way: the
 * sandbox starts a request, registers its own abort against the id it gets back, and waits on the answer.
 */
function fetchBridge(port: MessagePort): Record<string, unknown> {
  let nextId = 0
  const pending = new Map<number, { resolve: (answer: SandboxAnswer) => void }>()

  port.on('message', (message: ServerMessage) => {
    const waiting = pending.get(message.id)
    if (!waiting)
      return
    pending.delete(message.id)
    waiting.resolve(message.type === 'fetched'
      ? {
          status: message.response.status,
          statusText: message.response.statusText,
          headers: Object.fromEntries(message.response.headers),
          body: buffer.Buffer.from(message.response.body).toString('base64'),
          url: message.response.url,
        }
      : { failed: true, name: message.name, message: message.message })
  })

  return {
    __fetchStart: ({ url, init }: SandboxRequest) => {
      const id = nextId++
      const body = init.body === undefined ? undefined : Uint8Array.from(buffer.Buffer.from(init.body, 'base64')).buffer
      const request: FetchRequest = { url, init: { method: init.method, headers: { ...init.headers }, redirect: init.redirect, ...(body && { body }) } }
      port.postMessage({ type: 'fetch', id, request } satisfies WorkerMessage)
      return id
    },
    __fetchAbort: (id: number) => {
      const waiting = pending.get(id)
      if (!waiting)
        return
      pending.delete(id)
      port.postMessage({ type: 'abort', id } satisfies WorkerMessage)
      // Settled so nothing waits on a request that will never answer; the sandbox rejects with its own reason first.
      waiting.resolve({ failed: true, name: 'AbortError', message: 'This operation was aborted' })
    },
    __fetchWait: (id: number) => new Promise<SandboxAnswer>((resolve) => {
      pending.set(id, { resolve })
    }),
  }
}

async function runJob(port: MessagePort, { transformJs, input, withFetch }: TransformJob): Promise<string | undefined> {
  const moduleObj = { exports: {} }
  const vm = new VM({
    sandbox: {
      ...bridgedGlobals(),
      input,
      data: input,
      module: moduleObj,
      exports: moduleObj.exports,
      __log: (text: unknown) => port.postMessage({ type: 'log', text: typeof text === 'string' ? text : '' } satisfies WorkerMessage),
      ...(withFetch && fetchBridge(port)),
    },
  })
  vm.run(SANDBOX_CONSOLE)
  vm.run(SANDBOX_GLOBALS)
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
