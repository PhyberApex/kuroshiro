import type { FetchedResponse, FetchRequest, ServerMessage, TransformJob, WorkerMessage } from './plugin-transform.worker.js'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { Injectable, Logger } from '@nestjs/common'
import { readBodyLimited } from '../../utils/downloadLimited.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { RESPONSE_LIMIT_BYTES } from './plugin-data-fetcher.service.js'

const DEFAULT_TIMEOUT_MS = 5000

/**
 * The worker beside this module: the `.ts` source under test, the `.js` that `nest start` compiles beside it, and the
 * one tsup bundles beside `main.js` under the same name.
 */
const WORKER_URL = new URL(`./plugin-transform.worker${extname(fileURLToPath(import.meta.url))}`, import.meta.url)

export interface TransformOptions {
  /** How long the code may take, synchronously and awaiting, before the transform fails and its thread is stopped. */
  timeoutMs?: number
  /** The `fetch` the code may call, guarded by the caller; without one the code has no way to the network. */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
}

@Injectable()
export class PluginTransformService {
  private readonly logger = new Logger(PluginTransformService.name)

  /**
   * Runs a transform in a sandbox on its input, the fetched data laid over the template context, and answers what the
   * transform returns, awaited when it is a promise, as JSON reads it. The sandbox runs on a thread of its own that is
   * terminated when the time runs out, so the bound covers code after an `await` too (ADR-0072). It has Node's web
   * globals (ADR-0055) but no `require` and no file system, and only the `fetch` it is handed (ADR-0052).
   */
  async transform(transformJs: string, input: unknown, { timeoutMs = DEFAULT_TIMEOUT_MS, fetch }: TransformOptions = {}): Promise<unknown> {
    try {
      const json = await this.runOnWorker({ transformJs, input, withFetch: fetch !== undefined }, timeoutMs, fetch)
      this.logger.debug(`Transform executed successfully`)
      return json === undefined ? undefined : JSON.parse(json)
    }
    catch (error) {
      this.logger.error(`Transform execution failed: ${getErrorMessage(error)}`)
      throw error
    }
  }

  private runOnWorker(job: TransformJob, timeoutMs: number, fetch: TransformOptions['fetch']): Promise<string | undefined> {
    const worker = new Worker(WORKER_URL, { workerData: job })
    const fetches = new Map<number, AbortController>()
    let timer: NodeJS.Timeout | undefined

    return new Promise<string | undefined>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`The transform did not finish within ${timeoutMs} ms.`)), timeoutMs)
      worker.on('message', (message: WorkerMessage) => {
        switch (message.type) {
          case 'log':
            this.logger.debug(`[Transform] ${message.text}`)
            break
          case 'fetch':
            if (fetch)
              void fetchFor(worker, message, fetch, fetches)
            break
          case 'abort':
            fetches.get(message.id)?.abort()
            break
          case 'done':
            resolve(message.json)
            break
          case 'failed':
            reject(Object.assign(new Error(message.message), { name: message.name }))
            break
        }
      })
      worker.on('error', reject)
      // A thread that ends without answering had nothing left to wait for: the transform awaits what never settles.
      worker.on('exit', code => reject(new Error(code === 0 ? 'The transform awaited something that never settles.' : `The transform stopped with exit code ${code}.`)))
    }).finally(() => {
      clearTimeout(timer)
      worker.removeAllListeners('message')
      for (const controller of fetches.values())
        controller.abort()
      void worker.terminate()
    })
  }
}

/** Makes a request the transform asked for with the guarded `fetch` and answers the worker with the whole response, its body read up to the limit a Data Source's is. */
async function fetchFor(worker: Worker, { id, request }: { id: number, request: FetchRequest }, fetch: NonNullable<TransformOptions['fetch']>, fetches: Map<number, AbortController>): Promise<void> {
  const controller = new AbortController()
  fetches.set(id, controller)
  let reply: ServerMessage
  let transfer: ArrayBuffer[] = []
  try {
    const response = await fetch(request.url, { ...request.init, signal: controller.signal })
    const read = await readBodyLimited(response, RESPONSE_LIMIT_BYTES)
    const body = read.buffer.slice(read.byteOffset, read.byteOffset + read.byteLength) as ArrayBuffer
    const fetched: FetchedResponse = { status: response.status, statusText: response.statusText, headers: [...response.headers], body, url: response.url }
    reply = { type: 'fetched', id, response: fetched }
    transfer = [body]
  }
  catch (error) {
    reply = { type: 'fetch-failed', id, name: error instanceof Error ? error.name : 'Error', message: getErrorMessage(error) }
  }
  finally {
    fetches.delete(id)
  }
  if (!controller.signal.aborted)
    worker.postMessage(reply, transfer)
}
