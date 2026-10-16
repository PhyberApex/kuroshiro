import { beforeEach, describe, expect, it, vi } from 'vitest'

const { puppeteerLaunch } = vi.hoisted(() => ({ puppeteerLaunch: vi.fn() }))

vi.mock('puppeteer', () => ({ default: { launch: puppeteerLaunch } }))

const { withSharedPage } = await import('../shared-browser.js')
const { SharedBrowserService } = await import('../shared-browser.service.js')

describe('sharedBrowserService', () => {
  beforeEach(() => vi.resetAllMocks())

  it('closes the shared browser on module destroy', async () => {
    const browser = { connected: true, close: vi.fn(), newPage: vi.fn().mockResolvedValue({ close: vi.fn() }) }
    puppeteerLaunch.mockResolvedValue(browser)
    await withSharedPage(async () => {})

    await new SharedBrowserService().onModuleDestroy()

    expect(browser.close).toHaveBeenCalledOnce()
  })
})
