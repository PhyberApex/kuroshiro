import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { isRefusal } from '../client'
import { devicePreview } from '../devicePreview'

const INPUT = { html: '<div class="view view--full">Hi</div>', deviceModelName: 'og_plus', paletteId: 'bw' }

describe('devicePreview', () => {
  it('posts the body HTML and target as JSON, and answers the PNG with the Render Signal the response header names', async () => {
    const sent: unknown[] = []
    api.use(http.post(apiUrl('device-preview'), async ({ request }) => {
      sent.push(request.headers.get('content-type'), await request.json())
      return new HttpResponse('png-bytes', { headers: { 'Content-Type': 'image/png', 'X-Render-Signal': 'skip' } })
    }))

    const answer = await devicePreview(INPUT)

    expect(sent).toEqual(['application/json', INPUT])
    expect(await answer.blob.text()).toBe('png-bytes')
    expect(answer.signal).toBe('skip')
  })

  it('reports no signal when the response carries none', async () => {
    api.use(http.post(apiUrl('device-preview'), () => new HttpResponse('png', { headers: { 'Content-Type': 'image/png' } })))

    expect((await devicePreview(INPUT)).signal).toBe('none')
  })

  it('is refused with device-preview-busy while another render is running', async () => {
    api.use(http.post(apiUrl('device-preview'), () => apiErrorResponse({ statusCode: 429, code: 'device-preview-busy' })))

    const failure = await devicePreview(INPUT).catch((error: unknown) => error)

    expect(isRefusal(failure, 'device-preview-busy')).toBe(true)
  })
})
