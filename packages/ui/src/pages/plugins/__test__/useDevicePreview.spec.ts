import type { EffectScope } from 'vue'
import type { DevicePreviewSource } from '../useDevicePreview'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { useDevicePreview } from '../useDevicePreview'

const SOURCE: DevicePreviewSource = { html: '<div class="view view--full">Rain</div>', deviceModelName: 'og_png', paletteId: 'bw', width: 800, height: 480, dither: true }

let scope: EffectScope | undefined

afterEach(() => scope?.stop())

function preview(source: DevicePreviewSource | undefined) {
  scope = effectScope()
  return scope.run(() => useDevicePreview(() => source))!
}

const png = (signal: string) => new HttpResponse('png', { headers: { 'Content-Type': 'image/png', 'X-Render-Signal': signal } })

/** Answers the first draw only once `answer()` is called, with what `first` makes, and every later one at once with a drawing that asks to skip. */
function holdFirstDraw(first: () => Response) {
  let asked = 0
  let answer!: () => void
  const answered = new Promise<void>(resolve => (answer = resolve))
  api.use(http.post(apiUrl('device-preview'), async () => {
    asked += 1
    if (asked > 1)
      return png('skip')
    await answered
    return first()
  }))
  return { answer, asked: () => asked }
}

describe('the device preview\'s own drawing', () => {
  it('draws nothing while there is nothing to draw from', async () => {
    const asked: unknown[] = []
    api.use(http.post(apiUrl('device-preview'), ({ request }) => {
      asked.push(request.url)
      return png('none')
    }))
    const { state, draw } = preview(undefined)

    await draw()

    expect(state.value).toEqual({ status: 'idle' })
    expect(asked).toEqual([])
  })

  it('keeps the second drawing when the first one it replaced answers after it', async () => {
    const held = holdFirstDraw(() => png('hold'))
    const { state, draw } = preview(SOURCE)

    const first = draw()
    await expect.poll(held.asked).toBe(1)
    await draw()
    expect(state.value).toMatchObject({ status: 'drawn', signal: 'skip' })
    held.answer()
    await first

    expect(state.value).toMatchObject({ status: 'drawn', signal: 'skip' })
  })

  it('keeps the second drawing when the first one it replaced fails after it', async () => {
    const held = holdFirstDraw(() => apiErrorResponse({ statusCode: 500, code: 'internal' }))
    const { state, draw } = preview(SOURCE)

    const first = draw()
    await expect.poll(held.asked).toBe(1)
    await draw()
    held.answer()
    await first

    expect(state.value).toMatchObject({ status: 'drawn', signal: 'skip' })
  })

  it('is busy while another device preview is being drawn, and failed for any other refusal', async () => {
    let busy = true
    api.use(http.post(apiUrl('device-preview'), () => busy
      ? apiErrorResponse({ statusCode: 429, code: 'device-preview-busy', message: 'Another preview is being drawn.' })
      : apiErrorResponse({ statusCode: 422, code: 'palette-unknown' })))
    const { state, draw } = preview(SOURCE)

    await draw()
    expect(state.value).toEqual({ status: 'busy' })

    busy = false
    await draw()
    expect(state.value).toEqual({ status: 'failed' })
  })
})
