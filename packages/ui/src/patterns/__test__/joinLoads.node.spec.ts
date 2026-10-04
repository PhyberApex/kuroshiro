import type { Load } from '../useLoad'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { joinLoads } from '../joinLoads'

function loadOf<T>(state: Partial<Load<T>> = {}) {
  return reactive({ data: undefined, waiting: false, failure: undefined, missing: false, reload: vi.fn(async () => {}), ...state }) as Load<T> & { data: T | undefined }
}

describe('joinLoads', () => {
  it('has data once every load has, each under its own key', () => {
    const settings = loadOf<string>({ data: 'settings' })
    const facts = loadOf<number>()
    const joined = joinLoads({ settings, facts })

    expect(joined.data).toBeUndefined()

    facts.data = 7

    expect(joined.data).toEqual({ settings: 'settings', facts: 7 })
  })

  it('waits while any one waits', () => {
    expect(joinLoads({ a: loadOf(), b: loadOf({ waiting: true }) }).waiting).toBe(true)
    expect(joinLoads({ a: loadOf(), b: loadOf() }).waiting).toBe(false)
  })

  it('fails with the first failure, in the order the loads are named', () => {
    const first = { reason: 'The first.', unreachable: false }

    expect(joinLoads({ a: loadOf(), b: loadOf({ failure: first }), c: loadOf({ failure: { reason: 'The second.', unreachable: true } }) }).failure).toEqual(first)
    expect(joinLoads({ a: loadOf() }).failure).toBeUndefined()
  })

  it('is never missing, and reloads every load', async () => {
    const a = loadOf()
    const b = loadOf({ missing: true })
    const joined = joinLoads({ a, b })

    await joined.reload()

    expect(joined.missing).toBe(false)
    expect(a.reload).toHaveBeenCalledOnce()
    expect(b.reload).toHaveBeenCalledOnce()
  })
})
