import type { PreviewData, PreviewDataInput } from 'kuroshiro-shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { buildPreviewData } from '@/testing/fixtures/plugins'
import { usePreviewData } from '../usePreviewData'

const FORECAST = { name: 'forecast', mode: 'literal' as const, literalValue: { today: 'Rain' } }

/** A server whose answers the test lets through one by one. */
function heldServer() {
  const asked: PreviewDataInput[] = []
  const answers: Array<{ resolve: (data: PreviewData) => void, reject: (error: Error) => void }> = []
  const fetch = (input: PreviewDataInput) => {
    asked.push(JSON.parse(JSON.stringify(input)))
    return new Promise<PreviewData>((resolve, reject) => answers.push({ resolve, reject }))
  }
  const settle = async (act: () => void) => {
    act()
    await nextTick()
    await nextTick()
  }
  return {
    asked,
    fetch,
    answer: (index: number, data = buildPreviewData()) => settle(() => answers[index]!.resolve(data)),
    fail: (index: number, reason = 'Kuroshiro\'s server is not answering.') => settle(() => answers[index]!.reject(new Error(reason))),
  }
}

function mounted(start: PreviewDataInput | null = { deviceId: 'kitchen', name: 'Weather', dataSources: [FORECAST], fieldValues: { location: 'Lindenplatz' } }) {
  const input = ref<PreviewDataInput | undefined>(start ?? undefined)
  const server = heldServer()
  const scope = effectScope()
  const preview = scope.run(() => usePreviewData(() => input.value, server.fetch))!
  return { input, server, preview, stop: () => scope.stop() }
}

describe('the data a Plugin\'s preview draws against', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is fetched when it is first asked for, with the form as it stands, and held', async () => {
    const { server, preview } = mounted()

    expect(server.asked).toEqual([{ deviceId: 'kitchen', name: 'Weather', dataSources: [FORECAST], fieldValues: { location: 'Lindenplatz' } }])
    expect([preview.held.value, preview.fetching.value, preview.failure.value]).toEqual([undefined, true, undefined])

    const data = buildPreviewData()
    await server.answer(0, data)

    expect([preview.held.value, preview.fetching.value, preview.failure.value]).toEqual([data, false, undefined])
  })

  it('waits until it is known which Device the preview is for', async () => {
    const { input, server } = mounted(null)
    expect(server.asked).toEqual([])

    input.value = { deviceId: null }
    await nextTick()

    expect(server.asked).toEqual([{ deviceId: null }])
  })

  it('fetches once, 800 ms after the last of a burst of changes to a Data Source or a Field Value', async () => {
    const { input, server } = mounted()
    await server.answer(0)

    input.value = { ...input.value!, fieldValues: { location: 'M' } }
    await nextTick()
    await vi.advanceTimersByTimeAsync(700)
    input.value = { ...input.value!, fieldValues: { location: 'Marktplatz' } }
    await nextTick()
    await vi.advanceTimersByTimeAsync(700)
    input.value = { ...input.value!, dataSources: [{ ...FORECAST, literalValue: { today: 'Sun' } }] }
    await nextTick()
    await vi.advanceTimersByTimeAsync(799)
    expect(server.asked).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)

    expect(server.asked).toHaveLength(2)
    expect(server.asked[1]).toMatchObject({ fieldValues: { location: 'Marktplatz' }, dataSources: [{ literalValue: { today: 'Sun' } }] })
  })

  it('does not fetch for a change of the name alone, and sends the name with the next fetch', async () => {
    const { input, server, preview } = mounted()
    await server.answer(0)

    input.value = { ...input.value!, name: 'Forecast' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(5000)
    expect(server.asked).toHaveLength(1)

    void preview.fetchAgain()

    expect(server.asked[1]).toMatchObject({ name: 'Forecast' })
  })

  it('fetches at once for another Device, and for no Device, dropping the fetch a change was waiting for', async () => {
    const { input, server } = mounted()
    await server.answer(0)

    input.value = { ...input.value!, fieldValues: { location: 'Marktplatz' } }
    await nextTick()
    input.value = { ...input.value!, deviceId: 'hallway' }
    await nextTick()
    expect(server.asked.map(asked => asked.deviceId)).toEqual(['kitchen', 'hallway'])

    await vi.advanceTimersByTimeAsync(5000)
    input.value = { ...input.value!, deviceId: null }
    await nextTick()

    expect(server.asked.map(asked => asked.deviceId)).toEqual(['kitchen', 'hallway', null])
  })

  it('keeps the data it holds while it fetches again, and takes the new answer', async () => {
    const { server, preview } = mounted()
    const first = buildPreviewData({ fetchedAt: '2026-10-03T07:31:00.000Z' })
    await server.answer(0, first)

    void preview.fetchAgain()
    expect([preview.held.value, preview.fetching.value]).toEqual([first, true])

    const second = buildPreviewData({ fetchedAt: '2026-10-03T07:35:00.000Z' })
    await server.answer(1, second)

    expect([preview.held.value, preview.fetching.value]).toEqual([second, false])
  })

  it('says why a fetch failed, keeps the earlier data, and forgets the failure once a fetch works', async () => {
    const { server, preview } = mounted()
    const first = buildPreviewData()
    await server.answer(0, first)

    void preview.fetchAgain()
    await server.fail(1)

    expect([preview.held.value, preview.fetching.value, preview.failure.value]).toEqual([first, false, 'Kuroshiro\'s server is not answering.'])

    void preview.fetchAgain()
    expect(preview.failure.value).toBe('Kuroshiro\'s server is not answering.')
    await server.answer(2)

    expect(preview.failure.value).toBeUndefined()
  })

  it('drops an answer that a later fetch has overtaken', async () => {
    const { server, preview } = mounted()
    void preview.fetchAgain()
    const later = buildPreviewData({ fetchedAt: '2026-10-03T07:36:00.000Z' })

    await server.answer(1, later)
    await server.answer(0, buildPreviewData({ fetchedAt: '2026-10-03T07:30:00.000Z' }))

    expect([preview.held.value, preview.fetching.value]).toEqual([later, false])
  })

  it('fetches nothing more once its page is left', async () => {
    const { input, server, stop } = mounted()
    await server.answer(0)
    input.value = { ...input.value!, fieldValues: { location: 'Marktplatz' } }
    await nextTick()

    stop()
    await vi.advanceTimersByTimeAsync(5000)

    expect(server.asked).toHaveLength(1)
  })
})
