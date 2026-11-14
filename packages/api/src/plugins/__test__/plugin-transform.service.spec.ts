import buffer from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { endlessBody } from '../../test/fetch.js'
import { PluginTransformService } from '../services/plugin-transform.service.js'

describe('pluginTransformService', () => {
  let service: PluginTransformService

  beforeEach(() => {
    service = new PluginTransformService()
  })

  describe('the serverless contract of TRMNL', () => {
    const input = { items: [1, 2], trmnl: { user: { locale: 'de' } } }

    it('awaits an async run function exported as module.exports = { run }', async () => {
      const transformJs = `
        async function run(input) {
          await Promise.resolve()
          return { first: input.items[0], locale: input.trmnl.user.locale }
        }
        module.exports = { run }
      `

      expect(await service.transform(transformJs, input)).toEqual({ first: 1, locale: 'de' })
    })

    it('calls a run function that is only declared, as TRMNL\'s editor has it', async () => {
      expect(await service.transform('function run(input) { return { n: input.items.length } }', input)).toEqual({ n: 2 })
    })

    it('calls exports.run', async () => {
      expect(await service.transform('exports.run = input => ({ n: input.items.length })', input)).toEqual({ n: 2 })
    })

    it('prefers run over a transform function beside it', async () => {
      expect(await service.transform('function transform() { return "old" }\nfunction run() { return "new" }', input)).toBe('new')
    })

    it('fails a run function that resolves too late', async () => {
      await expect(service.transform('async function run() { await new Promise(resolve => setTimeout(resolve, 5000)) }', input, { timeoutMs: 500 })).rejects.toThrow('The transform did not finish within 500 ms.')
    })

    it('fails a run function that awaits what never settles, without waiting out its time', async () => {
      const started = Date.now()
      await expect(service.transform('async function run() { await new Promise(() => {}) }', input, { timeoutMs: 10_000 })).rejects.toThrow('The transform awaited something that never settles.')
      expect(Date.now() - started).toBeLessThan(5000)
    })

    it('fails a run function that busies itself after an await, and the server stays free meanwhile', async () => {
      const transformJs = 'async function run() { await new Promise(resolve => setTimeout(resolve, 1)); for (;;) {} }'
      let ticks = 0
      const ticker = setInterval(() => ticks++, 10)
      const started = Date.now()
      try {
        await expect(service.transform(transformJs, input, { timeoutMs: 1000 })).rejects.toThrow('The transform did not finish within 1000 ms.')
      }
      finally {
        clearInterval(ticker)
      }

      expect(Date.now() - started).toBeLessThan(3000)
      expect(ticks).toBeGreaterThan(10)
    })

    it('gives the code the fetch it is handed, and no other way to the network', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ quotes: [{ quote: 'Festina lente' }] })))
      const transformJs = 'async function run() { const res = await fetch("https://dummyjson.com/quotes?limit=1", { headers: { Accept: "application/json" } }); const data = await res.json(); return { quote: data.quotes[0].quote } }'

      expect(await service.transform(transformJs, input, { fetch })).toEqual({ quote: 'Festina lente' })
      expect(fetch).toHaveBeenCalledWith('https://dummyjson.com/quotes?limit=1', expect.objectContaining({ headers: { accept: 'application/json' } }))
      await expect(service.transform(transformJs, input)).rejects.toThrow('fetch is not defined')
    })

    it('sends the body the code posts and hands back the status, headers and body the fetch answered', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response('{"id":7}', { status: 201, headers: { 'X-Total': '1' } }))
      const transformJs = `
        async function run() {
          const res = await fetch('https://api.example.com/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'a' }) })
          return { status: res.status, total: res.headers.get('x-total'), body: await res.json() }
        }
      `

      expect(await service.transform(transformJs, input, { fetch })).toEqual({ status: 201, total: '1', body: { id: 7 } })
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
      expect([url, init.method, new Headers(init.headers).get('content-type'), new TextDecoder().decode(init.body as ArrayBuffer)]).toEqual(['https://api.example.com/items', 'POST', 'application/json', '{"name":"a"}'])
    })

    it('fails the run with the error the fetch failed with', async () => {
      const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

      await expect(service.transform('async function run() { await fetch("https://api.example.com") }', input, { fetch })).rejects.toThrow('fetch failed')
    })

    it('stops reading a fetched body once it passes 5 MB and fails the code\'s fetch, saying so', async () => {
      const { body, cancelled } = endlessBody()
      const fetch = vi.fn().mockResolvedValue(new Response(body))
      const transformJs = 'async function run() { try { await fetch("https://huge.example") } catch (error) { return error.message } }'

      expect(await service.transform(transformJs, input, { fetch })).toBe('The response is larger than 5242880 bytes.')
      expect(cancelled()).toBe(true)
    })

    it('aborts a fetch still under way when the transform runs out of time', async () => {
      let signal: AbortSignal | undefined
      const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined
        return new Promise<Response>(() => {})
      })

      await expect(service.transform('async function run() { await fetch("https://slow.example") }', input, { fetch, timeoutMs: 2000 })).rejects.toThrow('The transform did not finish within 2000 ms.')
      expect(fetch).toHaveBeenCalledOnce()
      expect(signal?.aborted).toBe(true)
    })

    it('has the web globals Node has, so a transform bounds its fetch with a timer and an AbortController', async () => {
      const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }))
      const transformJs = `
        async function run(input) {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 5)
          try {
            await fetch(new URL('/quotes', 'https://dummyjson.com').href, { signal: controller.signal })
            return { aborted: false }
          }
          catch {
            return { aborted: true, query: new URLSearchParams({ q: input.items.length }).toString(), bytes: new TextEncoder().encode('ab').length, b64: btoa('ab'), copy: structuredClone(input.items) }
          }
          finally {
            clearTimeout(timer)
          }
        }
      `

      expect(await service.transform(transformJs, input, { fetch })).toEqual({ aborted: true, query: 'q=2', bytes: 2, b64: 'YWI=', copy: [1, 2] })
    })

    it('keeps require, process and the file system out of reach', async () => {
      expect(await service.transform('function run() { return [typeof require, typeof process] }', input)).toEqual(['undefined', 'undefined'])
    })

    it('propagates the rejection of an async run function', async () => {
      await expect(service.transform('async function run() { throw new Error("no quotes today") }', input)).rejects.toThrow('no quotes today')
    })
  })

  it('transforms data using module.exports function', async () => {
    const transformJs = `
      module.exports = function(data) {
        return { transformed: true, original: data };
      };
    `
    const rawData = { value: 42 }
    const result = await service.transform(transformJs, rawData) as Record<string, unknown>

    expect(result.transformed).toBe(true)
    expect(result.original).toEqual({ value: 42 })
  })

  it('transforms data using transform function', async () => {
    const transformJs = `
      function transform(data) {
        return { doubled: data.value * 2 };
      }
    `
    const rawData = { value: 10 }
    const result = await service.transform(transformJs, rawData) as Record<string, unknown>

    expect(result.doubled).toBe(20)
  })

  it('returns data unchanged if no transform function found', async () => {
    const transformJs = `
      const x = 5;
    `
    const rawData = { value: 42 }
    const result = await service.transform(transformJs, rawData)

    expect(result).toEqual({ value: 42 })
  })

  it('handles complex transformations', async () => {
    const transformJs = `
      module.exports = function(data) {
        return {
          items: data.items.map(item => ({
            ...item,
            processed: true
          }))
        };
      };
    `
    const rawData = { items: [{ id: 1 }, { id: 2 }] }
    const result = await service.transform(transformJs, rawData) as { items: { processed: boolean }[] }

    expect(result.items).toHaveLength(2)
    expect(result.items[0].processed).toBe(true)
    expect(result.items[1].processed).toBe(true)
  })

  it('propagates the error on transformation failure', async () => {
    const transformJs = `
      module.exports = function(data) {
        throw new Error('Transform failed');
      };
    `
    const rawData = { value: 42 }

    await expect(service.transform(transformJs, rawData)).rejects.toThrow('Transform failed')
  })

  it('propagates the error on timeout for long-running transforms', async () => {
    const transformJs = `
      module.exports = function(data) {
        while(true) {} // Infinite loop
        return data;
      };
    `
    const rawData = { value: 42 }

    await expect(service.transform(transformJs, rawData)).rejects.toThrow()
  }, 10000)

  it('provides console.log in sandbox', async () => {
    const transformJs = `
      module.exports = function(data) {
        console.log('Processing data', data.value);
        return { logged: true };
      };
    `
    const rawData = { value: 42 }
    const result = await service.transform(transformJs, rawData) as Record<string, unknown>

    expect(result.logged).toBe(true)
  })

  it('propagates the error when an unsafe API is blocked', async () => {
    const transformJs = `
      module.exports = function(data) {
        const fs = require('fs'); // Should fail
        return { hacked: true };
      };
    `
    const rawData = { value: 42 }

    await expect(service.transform(transformJs, rawData)).rejects.toThrow()
  })

  describe('the globals the sandbox builds for itself (ADR-0077)', () => {
    const input = { items: [1, 2] }

    it('resolves a reference against a base and keeps the parts of the result', async () => {
      const transformJs = `
        function run() {
          const url = new URL('../v2/quotes?page=2#top', 'https://api.example.com/v1/deep/here')
          return { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash, host: url.host }
        }
      `

      expect(await service.transform(transformJs, input)).toEqual({
        href: 'https://api.example.com/v1/v2/quotes?page=2#top',
        origin: 'https://api.example.com',
        pathname: '/v1/v2/quotes',
        search: '?page=2',
        hash: '#top',
        host: 'api.example.com',
      })
    })

    it('drops a default port, keeps one that is not, and reads credentials', async () => {
      const transformJs = `
        function run() {
          return [new URL('https://a.test:443/x').href, new URL('https://a.test:8443/x').port, new URL('https://u:p@a.test/').username]
        }
      `

      expect(await service.transform(transformJs, input)).toEqual(['https://a.test/x', '8443', 'u'])
    })

    it('writes a change through searchParams back into search and href', async () => {
      const transformJs = `
        function run() {
          const url = new URL('https://a.test/x?one=1')
          url.searchParams.set('two', '2')
          url.searchParams.append('two', '3')
          url.searchParams.delete('one')
          return { search: url.search, href: url.href, all: url.searchParams.getAll('two') }
        }
      `

      expect(await service.transform(transformJs, input)).toEqual({ search: '?two=2&two=3', href: 'https://a.test/x?two=2&two=3', all: ['2', '3'] })
    })

    it('encodes a query the way a form does, space as a plus', async () => {
      const transformJs = 'function run() { return new URLSearchParams({ q: "a b&c", n: 2 }).toString() }'

      expect(await service.transform(transformJs, input)).toBe('q=a+b%26c&n=2')
    })

    it('round-trips a multi-byte string through TextEncoder and TextDecoder', async () => {
      const transformJs = `
        function run() {
          const bytes = new TextEncoder().encode('héllo 🌸')
          return { length: bytes.length, back: new TextDecoder().decode(bytes) }
        }
      `

      expect(await service.transform(transformJs, input)).toEqual({ length: 11, back: 'héllo 🌸' })
    })

    it('round-trips bytes through btoa and atob', async () => {
      const transformJs = 'function run() { return [btoa("any carnal pleasure."), atob(btoa("any carnal pleasure."))] }'

      expect(await service.transform(transformJs, input)).toEqual(['YW55IGNhcm5hbCBwbGVhc3VyZS4=', 'any carnal pleasure.'])
    })

    it('reads a header whatever its case, and joins the ones that repeat', async () => {
      const transformJs = `
        function run() {
          const headers = new Headers({ 'Content-Type': 'application/json' })
          headers.append('X-Try', 'one')
          headers.append('x-try', 'two')
          return { type: headers.get('CONTENT-TYPE'), tries: headers.get('X-Try'), has: headers.has('x-TRY') }
        }
      `

      expect(await service.transform(transformJs, input)).toEqual({ type: 'application/json', tries: 'one, two', has: true })
    })

    it('builds a Request with its body and content type, and refuses a body on a GET', async () => {
      const transformJs = `
        async function run() {
          const request = new Request('https://a.test/x', { method: 'POST', body: JSON.stringify({ a: 1 }) })
          let refused = null
          try { new Request('https://a.test/x', { body: 'nope' }) }
          catch (error) { refused = error.message }
          return { method: request.method, type: request.headers.get('content-type'), body: await request.json(), refused }
        }
      `

      expect(await service.transform(transformJs, input)).toEqual({
        method: 'POST',
        type: 'text/plain;charset=UTF-8',
        body: { a: 1 },
        refused: 'A GET or HEAD request cannot have a body',
      })
    })

    it('answers a fetch with a Response the sandbox built, carrying its status, headers and url', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ quotes: ['one'] }), {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json', 'x-page': '2' },
      }))
      const transformJs = `
        async function run() {
          const response = await fetch('https://dummyjson.com/quotes')
          return { ok: response.ok, status: response.status, page: response.headers.get('x-page'), body: await response.json() }
        }
      `

      expect(await service.transform(transformJs, input, { fetch })).toEqual({ ok: true, status: 201, page: '2', body: { quotes: ['one'] } })
    })

    it('sends the headers and the body a Request carries through the lent fetch', async () => {
      const fetch = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }))
      const transformJs = `
        async function run() {
          await fetch(new Request('https://a.test/x', { method: 'PUT', headers: { 'X-Key': 'k' }, body: 'hello' }))
          return {}
        }
      `

      await service.transform(transformJs, input, { fetch })

      const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://a.test/x')
      expect(init.method).toBe('PUT')
      expect(new Headers(init.headers).get('x-key')).toBe('k')
      expect(buffer.Buffer.from(init.body as ArrayBuffer).toString('utf8')).toBe('hello')
    })

    it('clones a Map, a Date and a cycle through structuredClone', async () => {
      const transformJs = `
        function run() {
          const source = { when: new Date(0), map: new Map([['a', 1]]) }
          source.self = source
          const copy = structuredClone(source)
          return { when: copy.when.toISOString(), a: copy.map.get('a'), cyclic: copy.self === copy, apart: copy.map !== source.map }
        }
      `

      expect(await service.transform(transformJs, input)).toEqual({ when: '1970-01-01T00:00:00.000Z', a: 1, cyclic: true, apart: true })
    })

    it('bridges the clock and the entropy without lending the host objects', async () => {
      const transformJs = `
        function run() {
          const bytes = new Uint8Array(8)
          crypto.getRandomValues(bytes)
          return {
            uuid: /^[0-9a-f-]{36}$/.test(crypto.randomUUID()),
            filled: bytes.some((byte) => byte !== 0),
            subtle: typeof crypto.subtle,
            now: typeof performance.now(),
          }
        }
      `

      expect(await service.transform(transformJs, input)).toEqual({ uuid: true, filled: true, subtle: 'undefined', now: 'number' })
    })

    it('bounds a fetch with AbortSignal.timeout, which the sandbox builds on the bridged timer', async () => {
      const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }))
      const transformJs = `
        async function run() {
          try {
            await fetch('https://a.test/slow', { signal: AbortSignal.timeout(5) })
            return { name: 'none' }
          }
          catch (error) {
            return { name: error.name }
          }
        }
      `

      expect(await service.transform(transformJs, input, { fetch })).toEqual({ name: 'TimeoutError' })
    })
  })
})
