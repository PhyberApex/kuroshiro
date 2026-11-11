import type { Browser, Page } from 'puppeteer'
import type { RenderRequestPolicy } from './render-request-guard.js'
import process from 'node:process'
import { Logger } from '@nestjs/common'
import { guardRenderRequests } from './render-request-guard.js'

/** Pages drawing at once; further renders wait their turn (ADR-0044). */
export const MAX_CONCURRENT_PAGES = 4

let browserPromise: Promise<Browser> | null = null
let openPages = 0
const waiting: Array<() => void> = []

/** Until the Instance sets its own (`SharedBrowserService`), loopback is refused and nothing else internal. */
let requestPolicy: RenderRequestPolicy = { demoMode: false, apiPort: 3000, apiUrl: 'http://localhost:3000' }

/** What every render page from now on may request. */
export function setRenderRequestPolicy(policy: RenderRequestPolicy): void {
  requestPolicy = policy
}

const logger = new Logger('SharedBrowser')

/** Set once a sandboxed launch has failed; every relaunch after it skips straight to `--no-sandbox`. */
let sandboxUnavailable = false

/**
 * The renderers, which run the third-party markup, stay sandboxed; only the GPU process is let
 * out. Under Alpine's musl Chromium the GPU process's seccomp filter kills it on a syscall it
 * makes (pwritev2), and Chromium gives up on every page once that has happened a few times.
 */
const SANDBOXED_ARGS = ['--disable-gpu-sandbox']
const UNSANDBOXED_ARGS = ['--no-sandbox']

async function launchBrowser(): Promise<Browser> {
  const { default: puppeteer } = await import('puppeteer')
  const launch = (args: string[]) => puppeteer.launch({ args, ignoreDefaultArgs: ['--disable-popup-blocking'] })
  // Chromium refuses to sandbox itself as root, so there is nothing to try there.
  if (sandboxUnavailable || process.getuid?.() === 0)
    return launch(UNSANDBOXED_ARGS)
  try {
    return await launch(SANDBOXED_ARGS)
  }
  catch (error) {
    // A container whose seccomp profile denies the user namespaces the sandbox needs lands here.
    const reason = error instanceof Error ? error.message : String(error)
    logger.warn(`Chromium could not start sandboxed, so it renders without its sandbox: ${reason}`)
    sandboxUnavailable = true
    return launch(UNSANDBOXED_ARGS)
  }
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
 * cache for the pinned framework CSS/JS), its requests guarded by the render
 * request policy before `draw` loads anything. The page is closed when `draw`
 * settles, however it does, and at most {@link MAX_CONCURRENT_PAGES} are open.
 */
export async function withSharedPage<T>(draw: (page: Page) => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    const browser = await sharedBrowser()
    const page = await browser.newPage()
    try {
      await guardRenderRequests(page, requestPolicy)
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

/** Closes the shared browser, if one was launched; the next render launches a fresh one, trying the sandbox again. */
export async function closeSharedBrowser(): Promise<void> {
  const closing = browserPromise
  browserPromise = null
  sandboxUnavailable = false
  if (!closing)
    return
  try {
    await (await closing).close()
  }
  catch {
    // already gone
  }
}
