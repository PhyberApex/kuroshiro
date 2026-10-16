import type { Page } from 'puppeteer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { puppeteerLaunch } = vi.hoisted(() => ({ puppeteerLaunch: vi.fn() }))

vi.mock('puppeteer', () => ({ default: { launch: puppeteerLaunch } }))

const { closeSharedBrowser, withSharedPage, MAX_CONCURRENT_PAGES } = await import('../shared-browser.js')

function fakeBrowser() {
  const pages: Array<{ close: ReturnType<typeof vi.fn> }> = []
  const browser = {
    connected: true,
    close: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn(async () => {
      const page = { close: vi.fn().mockResolvedValue(undefined) }
      pages.push(page)
      return page
    }),
  }
  return { browser, pages }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('shared browser', () => {
  beforeEach(async () => {
    await closeSharedBrowser()
    vi.resetAllMocks()
  })

  it('never has more than 4 pages open; a 5th waits for one to finish', async () => {
    const { browser } = fakeBrowser()
    puppeteerLaunch.mockResolvedValue(browser)
    const gates: Array<() => void> = []
    const draw = () => new Promise<void>(resolve => gates.push(resolve))

    const runs = Array.from({ length: MAX_CONCURRENT_PAGES + 1 }, () => withSharedPage(draw))
    await flush()
    expect(browser.newPage).toHaveBeenCalledTimes(MAX_CONCURRENT_PAGES)

    gates[0]()
    await flush()
    expect(browser.newPage).toHaveBeenCalledTimes(MAX_CONCURRENT_PAGES + 1)

    gates.slice(1).forEach(open => open())
    await Promise.all(runs)
    expect(puppeteerLaunch).toHaveBeenCalledOnce()
  })

  it('closes the page and frees its slot when the draw throws', async () => {
    const { browser, pages } = fakeBrowser()
    puppeteerLaunch.mockResolvedValue(browser)

    for (let i = 0; i < MAX_CONCURRENT_PAGES + 1; i++)
      await expect(withSharedPage(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')

    expect(pages).toHaveLength(MAX_CONCURRENT_PAGES + 1)
    pages.forEach(page => expect(page.close).toHaveBeenCalledOnce())
    await expect(withSharedPage(async (page: Page) => page)).resolves.toBeDefined()
  })

  it('relaunches after the browser has disconnected', async () => {
    const first = fakeBrowser()
    const second = fakeBrowser()
    puppeteerLaunch.mockResolvedValueOnce(first.browser).mockResolvedValueOnce(second.browser)

    await withSharedPage(async () => {})
    first.browser.connected = false
    await withSharedPage(async () => {})

    expect(puppeteerLaunch).toHaveBeenCalledTimes(2)
    expect(second.browser.newPage).toHaveBeenCalledOnce()
  })

  it('retries the launch after a failed one', async () => {
    const { browser } = fakeBrowser()
    puppeteerLaunch.mockRejectedValueOnce(new Error('no chromium')).mockResolvedValueOnce(browser)

    await expect(withSharedPage(async () => {})).rejects.toThrow('no chromium')
    await expect(withSharedPage(async () => 'ok')).resolves.toBe('ok')
  })

  it('closes the browser on close', async () => {
    const { browser } = fakeBrowser()
    puppeteerLaunch.mockResolvedValue(browser)
    await withSharedPage(async () => {})

    await closeSharedBrowser()

    expect(browser.close).toHaveBeenCalledOnce()
  })
})
