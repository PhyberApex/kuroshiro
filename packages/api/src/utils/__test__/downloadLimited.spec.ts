import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { downloadLimited, DownloadTooLargeError } from '../downloadLimited.js'

let server: Server | undefined

afterEach(async () => {
  if (!server)
    return
  await new Promise<void>(resolve => server!.close(() => resolve()))
  server = undefined
})

function listen(handler: http.RequestListener): Promise<string> {
  return new Promise((resolve) => {
    server = http.createServer(handler)
    server.listen(0, () => {
      const { port } = server!.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

describe('downloadLimited', () => {
  it('downloads a body at or under the limit', async () => {
    const url = await listen((_req, res) => res.end('hello'))

    const result = await downloadLimited(url, { limitBytes: 5, timeoutMs: 1000 })

    expect(result.status).toBe(200)
    expect(result.ok).toBe(true)
    expect(result.buffer.toString()).toBe('hello')
  })

  it('carries a non-2xx status without reading the body', async () => {
    const url = await listen((_req, res) => {
      res.statusCode = 404
      res.end('not found')
    })

    const result = await downloadLimited(url, { limitBytes: 5, timeoutMs: 1000 })

    expect(result.status).toBe(404)
    expect(result.ok).toBe(false)
  })

  it('refuses a body over the limit with an honest Content-Length, before reading it', async () => {
    const url = await listen((_req, res) => {
      res.setHeader('content-length', '1000')
      res.write('a'.repeat(10))
      // Never finishes writing the remaining declared bytes: if downloadLimited
      // read the stream instead of trusting Content-Length, this would hang.
    })

    await expect(downloadLimited(url, { limitBytes: 5, timeoutMs: 1000 })).rejects.toThrow(DownloadTooLargeError)
  })

  it('aborts a chunked body (no Content-Length) once bytes read pass the limit', async () => {
    const url = await listen((_req, res) => {
      res.flushHeaders()
      const chunk = setInterval(() => res.write('a'.repeat(10)), 5)
      res.on('close', () => clearInterval(chunk))
    })

    await expect(downloadLimited(url, { limitBytes: 5, timeoutMs: 1000 })).rejects.toThrow(DownloadTooLargeError)
  })

  it('aborts a slow body at the timeout', async () => {
    const url = await listen((_req, res) => {
      res.flushHeaders()
      res.write('a')
      // Never writes any more or ends the response.
    })

    await expect(downloadLimited(url, { limitBytes: 1000, timeoutMs: 20 })).rejects.toThrow()
  })
})
