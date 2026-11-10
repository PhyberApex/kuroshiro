import type { ConfigService } from '@nestjs/config'
import type { HTTPRequest } from 'puppeteer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'

const { puppeteerLaunch } = vi.hoisted(() => ({ puppeteerLaunch: vi.fn() }))

vi.mock('puppeteer', () => ({ default: { launch: puppeteerLaunch } }))

const { closeSharedBrowser, withSharedPage } = await import('../shared-browser.js')
const { SharedBrowserService } = await import('../shared-browser.service.js')

function configWith(values: Record<string, unknown>): ConfigService {
  return asService<ConfigService>({ get: (key: string) => values[key] })
}

function fakePage() {
  return { close: vi.fn().mockResolvedValue(undefined), setRequestInterception: vi.fn().mockResolvedValue(undefined), on: vi.fn() }
}

/** How the next render page settles a request to `url`: `continue` or `abort`. */
async function settledAs(url: string): Promise<'continue' | 'abort'> {
  await closeSharedBrowser()
  const page = fakePage()
  puppeteerLaunch.mockResolvedValue({ connected: true, close: vi.fn(), newPage: vi.fn().mockResolvedValue(page) })
  await withSharedPage(async () => {})
  const onRequest = page.on.mock.calls.find(([event]) => event === 'request')![1] as (request: HTTPRequest) => void
  return new Promise((resolve) => {
    onRequest(asService<HTTPRequest>({
      url: () => url,
      continue: async () => resolve('continue'),
      abort: async () => resolve('abort'),
    }))
  })
}

describe('sharedBrowserService', () => {
  beforeEach(async () => {
    await closeSharedBrowser()
    vi.resetAllMocks()
  })

  it('closes the shared browser on module destroy', async () => {
    const browser = { connected: true, close: vi.fn(), newPage: vi.fn().mockResolvedValue(fakePage()) }
    puppeteerLaunch.mockResolvedValue(browser)
    await withSharedPage(async () => {})

    await new SharedBrowserService(configWith({})).onModuleDestroy()

    expect(browser.close).toHaveBeenCalledOnce()
  })

  it('has render pages refuse a private address in demo mode', async () => {
    void new SharedBrowserService(configWith({ demo_mode: true, port: 3000, api_url: 'https://kuroshiro.example.com' }))

    expect(await settledAs('http://10.0.0.7/')).toBe('abort')
  })

  it('lets render pages reach a private address on a self-hosted Instance', async () => {
    void new SharedBrowserService(configWith({ demo_mode: false, port: 3000, api_url: 'https://kuroshiro.example.com' }))

    expect(await settledAs('http://10.0.0.7/')).toBe('continue')
  })

  it('has render pages refuse the API on the port it is configured to listen on', async () => {
    void new SharedBrowserService(configWith({ demo_mode: false, port: 8080, api_url: 'https://kuroshiro.example.com' }))

    expect(await settledAs('http://127.0.0.1:8080/api/devices')).toBe('abort')
    expect(await settledAs('https://kuroshiro.example.com/api/config/export')).toBe('abort')
  })
})
