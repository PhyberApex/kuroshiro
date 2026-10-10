import { Buffer } from 'node:buffer'
import { parseHeaderInt } from './parseHeaderInt.js'

export class DownloadTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`The download is larger than ${limitBytes} bytes.`)
  }
}

export interface DownloadLimitedOptions {
  limitBytes: number
  timeoutMs: number
}

export interface LimitedDownload {
  status: number
  ok: boolean
  statusText: string
  buffer: Buffer
}

/**
 * Fetches `url` under a byte ceiling and a timeout that covers the whole
 * request, including reading the body. A lying or missing `Content-Length`
 * cannot get past the limit: the body is read as a stream and the read is
 * aborted the moment the bytes seen so far pass `limitBytes`.
 */
export async function downloadLimited(url: string, { limitBytes, timeoutMs }: DownloadLimitedOptions): Promise<LimitedDownload> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })

  if (!response.ok) {
    await response.body?.cancel()
    return { status: response.status, ok: false, statusText: response.statusText, buffer: Buffer.alloc(0) }
  }

  const contentLength = parseHeaderInt(response.headers.get('content-length'))
  if (contentLength !== undefined && contentLength > limitBytes) {
    await response.body?.cancel()
    throw new DownloadTooLargeError(limitBytes)
  }

  const buffer = await readLimited(response.body, limitBytes)
  return { status: response.status, ok: true, statusText: response.statusText, buffer }
}

async function readLimited(body: ReadableStream<Uint8Array> | null, limitBytes: number): Promise<Buffer> {
  if (!body)
    return Buffer.alloc(0)

  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done)
        break
      total += value.byteLength
      if (total > limitBytes) {
        await reader.cancel()
        throw new DownloadTooLargeError(limitBytes)
      }
      chunks.push(Buffer.from(value))
    }
  }
  finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks)
}
