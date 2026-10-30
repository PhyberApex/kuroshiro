import type { RouteLocationNormalized } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '..'

const router = createAppRouter(createMemoryHistory(), [
  { path: '/a', component: { render: () => null } },
  { path: '/b', component: { render: () => null } },
])

const locationOf = (path: string) => router.resolve(path) as RouteLocationNormalized

function scrollFor(to: string, from: string) {
  return router.options.scrollBehavior!(locationOf(to), locationOf(from), null)
}

function addSection(id: string) {
  const section = document.createElement('section')
  section.id = id
  document.body.append(section)
}

/** Past the 3 seconds the router waits for a fragment's element to render. */
async function waitOutTheFragment(scrolls: ReturnType<typeof scrollFor>[]) {
  await vi.advanceTimersByTimeAsync(3_100)
  return Promise.all(scrolls)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('the router\'s scroll behaviour', () => {
  it('scrolls to the element the fragment names', async () => {
    addSection('pairing')

    expect(await scrollFor('/b#pairing', '/a')).toEqual({ el: '#pairing', top: 0 })
  })

  it('decodes the fragment only once, so an escaped percent sign names its element', async () => {
    addSection('100%')

    expect(await scrollFor('/b#100%25', '/a')).toEqual({ el: '#100%', top: 0 })
  })

  it('opens a new path at the top when its fragment never names an element', async () => {
    expect(await waitOutTheFragment([scrollFor('/b#gone', '/a'), scrollFor('/a#gone', '/a')]))
      .toEqual([{ top: 0 }, false])
  })

  it('takes a malformed fragment for one that names nothing instead of rejecting', async () => {
    expect(await waitOutTheFragment([scrollFor('/b#%E0%A4%A', '/a'), scrollFor('/a#%E0%A4%A', '/a')]))
      .toEqual([{ top: 0 }, false])
  })
})
