import type { EffectScope } from 'vue'
import type { Load, LoadOptions } from '../useLoad'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { ApiRefusal, ServerUnreachable } from '@/api/client'
import { buildApiError } from '@/testing/fixtures/errors'
import { useLoad } from '../useLoad'

const scopes: EffectScope[] = []

function load<T>(fetcher: () => Promise<T>, options?: LoadOptions) {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useLoad(fetcher, options)) as Load<T>
}

const answerAfter = <T>(ms: number, answer: T) => new Promise<T>(resolve => setTimeout(resolve, ms, answer))

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  Reflect.deleteProperty(document, 'visibilityState')
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('useLoad', () => {
  it('shows nothing while an answer takes 200 ms, then holds the data', async () => {
    const devices = load(() => answerAfter(200, ['Kitchen']))

    await vi.advanceTimersByTimeAsync(199)
    expect(devices.waiting).toBe(false)
    expect(devices.data).toBeUndefined()

    await vi.advanceTimersByTimeAsync(1)
    expect(devices.waiting).toBe(false)
    expect(devices.data).toEqual(['Kitchen'])
  })

  it('is waiting from 300 ms on for a slow answer, and no longer once it arrives', async () => {
    const devices = load(() => answerAfter(2000, ['Kitchen']))

    await vi.advanceTimersByTimeAsync(299)
    expect(devices.waiting).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(devices.waiting).toBe(true)

    await vi.advanceTimersByTimeAsync(1700)
    expect(devices.waiting).toBe(false)
    expect(devices.data).toEqual(['Kitchen'])
  })

  it('holds a refusal\'s reason and loads again when asked to', async () => {
    const fetcher = vi.fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new ApiRefusal(buildApiError({ statusCode: 500, code: 'internal' })))
      .mockResolvedValueOnce(['Kitchen'])
    const devices = load(fetcher)
    await vi.advanceTimersByTimeAsync(0)

    expect(devices.failure).toEqual({ reason: 'Something went wrong on the server.', unreachable: false })
    expect(devices.missing).toBe(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetcher).toHaveBeenCalledTimes(1)

    await devices.reload()

    expect(devices.failure).toBeUndefined()
    expect(devices.data).toEqual(['Kitchen'])
  })

  it('keeps the data of an earlier load under a failure', async () => {
    const fetcher = vi.fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['Kitchen'])
      .mockRejectedValueOnce(new ApiRefusal(buildApiError({ statusCode: 500, code: 'internal' })))
    const devices = load(fetcher)
    await vi.advanceTimersByTimeAsync(0)

    await devices.reload()

    expect(devices.failure?.reason).toBe('Something went wrong on the server.')
    expect(devices.data).toEqual(['Kitchen'])
  })

  it('says a record is missing when the server answers 404', async () => {
    const device = load(() => Promise.reject(new ApiRefusal(buildApiError({ statusCode: 404, code: 'device-not-found' }))))
    await vi.advanceTimersByTimeAsync(0)

    expect(device.missing).toBe(true)
  })

  it('retries by itself every 10 seconds while the server cannot be reached', async () => {
    const fetcher = vi.fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(new ServerUnreachable())
      .mockRejectedValueOnce(new ServerUnreachable())
      .mockResolvedValueOnce(['Kitchen'])
    const devices = load(fetcher)
    await vi.advanceTimersByTimeAsync(0)

    expect(devices.failure).toEqual({ reason: 'Kuroshiro\'s server is not answering.', unreachable: true })

    await vi.advanceTimersByTimeAsync(9_999)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(devices.failure?.unreachable).toBe(true)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(devices.failure).toBeUndefined()
    expect(devices.data).toEqual(['Kitchen'])
  })

  it('stops retrying once nothing uses it any more', async () => {
    const fetcher = vi.fn<() => Promise<string[]>>().mockRejectedValue(new ServerUnreachable())
    load(fetcher)
    await vi.advanceTimersByTimeAsync(0)

    scopes.splice(0).forEach(scope => scope.stop())
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('loads once and never again unless it is kept fresh', async () => {
    const fetcher = vi.fn(() => Promise.resolve(['Kitchen']))
    load(fetcher)

    await vi.advanceTimersByTimeAsync(90_000)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('loads anew, from nothing, when its key changes', async () => {
    const deviceId = ref('kitchen')
    const device = load(() => Promise.resolve(`the Device ${deviceId.value}`), { key: () => deviceId.value })
    await vi.advanceTimersByTimeAsync(0)
    expect(device.data).toBe('the Device kitchen')

    deviceId.value = 'hallway'
    await vi.advanceTimersByTimeAsync(0)

    expect(device.data).toBe('the Device hallway')
  })

  it('lets a late answer for an earlier key go', async () => {
    const deviceId = ref('kitchen')
    const delays: Record<string, number> = { kitchen: 500, hallway: 100 }
    const device = load(() => answerAfter(delays[deviceId.value]!, `the Device ${deviceId.value}`), { key: () => deviceId.value })

    await vi.advanceTimersByTimeAsync(50)
    deviceId.value = 'hallway'
    await vi.advanceTimersByTimeAsync(1000)

    expect(device.data).toBe('the Device hallway')
  })
})

describe('useLoad, kept fresh', () => {
  it('asks again every 30 seconds without a loading state', async () => {
    const fetcher = vi.fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['Kitchen'])
      .mockImplementationOnce(() => answerAfter(5000, ['Kitchen', 'Hallway']))
    const devices = load(fetcher, { fresh: true })
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(29_999)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetcher).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(4_000)
    expect(devices.waiting).toBe(false)
    expect(devices.data).toEqual(['Kitchen'])

    await vi.advanceTimersByTimeAsync(1_000)
    expect(devices.data).toEqual(['Kitchen', 'Hallway'])
  })

  it('asks again at once when the window regains the focus', async () => {
    const fetcher = vi.fn(() => Promise.resolve(['Kitchen']))
    load(fetcher, { fresh: true })
    await vi.advanceTimersByTimeAsync(0)

    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('pauses while the tab is hidden and asks again at once when it shows', async () => {
    const fetcher = vi.fn(() => Promise.resolve(['Kitchen']))
    load(fetcher, { fresh: true })
    await vi.advanceTimersByTimeAsync(0)

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetcher).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps the very same data for an identical answer, so nothing renders again', async () => {
    const devices = load(() => Promise.resolve([{ name: 'Kitchen' }]), { fresh: true })
    await vi.advanceTimersByTimeAsync(0)
    const first = devices.data

    await vi.advanceTimersByTimeAsync(30_000)

    expect(devices.data).toBe(first)
  })

  it('holds a fresh answer back while a typed-in control has the focus, and swaps it in when the focus leaves', async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValueOnce('Kitchen').mockResolvedValue('Pantry')
    const name = load(fetcher, { fresh: true })
    await vi.advanceTimersByTimeAsync(0)
    const input = document.body.appendChild(document.createElement('input'))
    input.focus()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetcher.mock.calls.length).toBeGreaterThan(1)
    expect(name.data).toBe('Kitchen')

    input.blur()
    await vi.advanceTimersByTimeAsync(0)
    expect(name.data).toBe('Pantry')
  })

  it('does not put a held answer over the failure of a later ask', async () => {
    let answer = () => Promise.resolve('Kitchen')
    const name = load(() => answer(), { fresh: true })
    await vi.advanceTimersByTimeAsync(0)
    const input = document.body.appendChild(document.createElement('input'))
    input.focus()
    answer = () => Promise.resolve('Pantry')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(name.data).toBe('Kitchen')
    answer = () => Promise.reject(new ApiRefusal(buildApiError({ statusCode: 500, code: 'internal' })))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(name.failure).toBeDefined()

    input.blur()
    await vi.advanceTimersByTimeAsync(0)

    expect(name.failure).toBeDefined()
  })

  it('does not ask for a record once its key is gone, as when the route leaves the page', async () => {
    const deviceId = ref<string | undefined>('kitchen')
    const fetcher = vi.fn(() => Promise.resolve(`the Device ${deviceId.value}`))
    const device = load(fetcher, { key: () => deviceId.value })
    await vi.advanceTimersByTimeAsync(0)

    deviceId.value = undefined
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(device.data).toBe('the Device kitchen')
  })

  it('swaps an answer the admin asked for even while a control has the focus', async () => {
    const fetcher = vi.fn<() => Promise<string>>().mockResolvedValueOnce('Kitchen').mockResolvedValue('Pantry')
    const name = load(fetcher, { fresh: true })
    await vi.advanceTimersByTimeAsync(0)
    document.body.appendChild(document.createElement('input')).focus()

    await name.reload()

    expect(name.data).toBe('Pantry')
  })
})
