import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
