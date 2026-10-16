import type { Browser, Page } from 'puppeteer'

/** Pages drawing at once; further renders wait their turn (ADR-0044). */
export const MAX_CONCURRENT_PAGES = 4

let browserPromise: Promise<Browser> | null = null
let openPages = 0
const waiting: Array<() => void> = []

async function launchBrowser(): Promise<Browser> {
  const { default: puppeteer } = await import('puppeteer')
  return puppeteer.launch({ args: ['--no-sandbox', '--disable-web-security'] })
}

/** The shared browser, launched on first use and relaunched once it has disconnected or crashed. */
async function sharedBrowser(): Promise<Browser> {
  const current = browserPromise
  if (current) {
    try {
      const browser = await current
      if (browser.connected !== false)
        return browser
    }
    catch {
      // a failed launch is retried below
    }
    // Another caller may have replaced the dead browser while we awaited.
    if (browserPromise !== current)
      return sharedBrowser()
  }
  const launching = launchBrowser()
  browserPromise = launching
  try {
    return await launching
  }
  catch (error) {
    if (browserPromise === launching)
      browserPromise = null
    throw error
  }
}

async function acquireSlot(): Promise<void> {
  if (openPages < MAX_CONCURRENT_PAGES) {
    openPages++
    return
  }
  // The releasing render hands its slot straight to us, so `openPages` stays at the cap.
  await new Promise<void>(resolve => waiting.push(resolve))
}

function releaseSlot(): void {
  const next = waiting.shift()
  if (next)
    next()
  else
    openPages--
}

/**
 * Runs `draw` on a fresh page of the shared browser's default context (one
 * cache for the pinned framework CSS/JS). The page is closed when `draw`
 * settles, however it does, and at most {@link MAX_CONCURRENT_PAGES} are open.
 */
export async function withSharedPage<T>(draw: (page: Page) => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    const browser = await sharedBrowser()
    const page = await browser.newPage()
    try {
      return await draw(page)
    }
    finally {
      await page.close().catch(() => {})
    }
  }
  finally {
    releaseSlot()
  }
}

/** Closes the shared browser, if one was launched; the next render launches a fresh one. */
export async function closeSharedBrowser(): Promise<void> {
  const closing = browserPromise
  browserPromise = null
  if (!closing)
    return
  try {
    await (await closing).close()
  }
  catch {
    // already gone
  }
}
