import type { RouteLocationNormalized } from 'vue-router'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '..'

const router = createAppRouter(createMemoryHistory(), [
  { path: '/a', component: { render: () => null } },
  { path: '/b', component: { render: () => null } },
])

const at = (path: string) => router.resolve(path) as RouteLocationNormalized

function scrollFor(to: string, from: string) {
  return router.options.scrollBehavior!(at(to), at(from), null)
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('the router\'s scroll behaviour', () => {
  it('scrolls to the element the fragment names', async () => {
    const section = document.createElement('section')
    section.id = 'pairing'
    document.body.append(section)

    expect(await scrollFor('/b#pairing', '/a')).toEqual({ el: '#pairing', top: 0 })
  })

  it('takes a malformed fragment for one that names nothing instead of rejecting', async () => {
    await expect(scrollFor('/b#%E0%A4%A', '/a')).resolves.toEqual({ top: 0 })
    await expect(scrollFor('/a#%E0%A4%A', '/a')).resolves.toBe(false)
  })

  it('opens a new path at the top when its fragment never names an element', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame'] })
    onTestFinished(() => {
      vi.useRealTimers()
    })

    const toNewPath = scrollFor('/b#gone', '/a')
    const onSamePath = scrollFor('/a#gone', '/a')
    await vi.advanceTimersByTimeAsync(3_100)

    expect(await toNewPath).toEqual({ top: 0 })
    expect(await onSamePath).toBe(false)
  })
})
