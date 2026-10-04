import type { InstanceFacts } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { apiGet, apiSend, apiSendForImage, fieldErrorsOf, imageUrl, isRefusal, isUnreachable } from '../client'

const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error)

describe('the API client', () => {
  it('reads an admin API path under the document base and answers the body', async () => {
    api.use(http.get(apiUrl('instance'), () => HttpResponse.json({ version: '0.17.1' })))

    expect(await apiGet<InstanceFacts>('instance')).toEqual({ version: '0.17.1' })
  })

  it('sends the query it is given and leaves out what is undefined', async () => {
    api.use(http.get(apiUrl('alerts'), ({ request }) => HttpResponse.json({ search: new URL(request.url).search })))

    expect(await apiGet('alerts', { deviceId: '42', pluginId: undefined })).toEqual({ search: '?deviceId=42' })
  })

  it('sends a write as JSON and answers nothing for a 204', async () => {
    const sent: unknown[] = []
    api.use(
      http.patch(apiUrl('devices/42'), async ({ request }) => {
        sent.push(request.headers.get('content-type'), await request.json())
        return HttpResponse.json({ name: 'Kitchen' })
      }),
      http.delete(apiUrl('devices/42'), () => new HttpResponse(null, { status: 204 })),
    )

    expect(await apiSend('PATCH', 'devices/42', { name: 'Kitchen' })).toEqual({ name: 'Kitchen' })
    expect(sent).toEqual(['application/json', { name: 'Kitchen' }])
    expect(await apiSend('DELETE', 'devices/42')).toBeUndefined()
  })

  it('sends a form as it is, so the browser sets the multipart boundary', async () => {
    api.use(http.post(apiUrl('firmware'), async ({ request }) => HttpResponse.json({ version: (await request.formData()).get('version') })))
    const form = new FormData()
    form.set('version', '1.7.8')

    expect(await apiSend('POST', 'firmware', form)).toEqual({ version: '1.7.8' })
  })

  it('words a refusal from its code, not from the server\'s sentence', async () => {
    api.use(http.get(apiUrl('devices/42'), () => apiErrorResponse({ statusCode: 404, code: 'device-not-found', message: 'Device 42 was not found.' })))

    const failure = await failureOf(apiGet('devices/42'))

    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe('That Device does not exist.')
    expect(isRefusal(failure)).toBe(true)
    expect(isRefusal(failure, 'device-not-found')).toBe(true)
    expect(isRefusal(failure, 'plugin-not-found')).toBe(false)
    expect(isUnreachable(failure)).toBe(false)
  })

  it('answers the image a preview gives back, and a refusal of one as any other', async () => {
    api.use(http.post(apiUrl('screens/7/image-preview'), () => new HttpResponse('png', { headers: { 'Content-Type': 'image/png' } }), { once: true }))
    const image = await apiSendForImage('POST', 'screens/7/image-preview', new FormData())
    expect(image.type).toBe('image/png')
    expect(await image.text()).toBe('png')

    api.use(http.post(apiUrl('screens/7/image-preview'), () => apiErrorResponse({ statusCode: 400, code: 'image-unreadable' })))
    const failure = await failureOf(apiSendForImage('POST', 'screens/7/image-preview', new FormData()))
    expect(isRefusal(failure, 'image-unreadable')).toBe(true)
    expect((failure as Error).message).toBe('This file is not an image Kuroshiro can read. Use PNG, JPEG, BMP, GIF, TIFF or WebP.')
  })

  it('adds the server\'s reason to an image that could not be fetched, which only the server knows', async () => {
    api.use(http.post(apiUrl('screens/7/refresh'), () => apiErrorResponse({ statusCode: 422, code: 'image-fetch-failed', message: 'The address did not answer with an image Kuroshiro can read.' })))

    const failure = await failureOf(apiSend('POST', 'screens/7/refresh'))

    expect((failure as Error).message).toBe('Kuroshiro could not fetch an image from this address. The address did not answer with an image Kuroshiro can read.')
  })

  it('names the limit of an upload that is too large', async () => {
    api.use(http.post(apiUrl('firmware'), () => apiErrorResponse({ statusCode: 413, code: 'upload-too-large', details: { limitBytes: 8 * 1024 * 1024 } })))

    const failure = await failureOf(apiSend('POST', 'firmware', new FormData()))

    expect((failure as Error).message).toBe('That file is larger than the 8 MB this Instance accepts.')
  })

  it('hands a validation refusal\'s fields over by their path', async () => {
    api.use(http.patch(apiUrl('settings'), () => apiErrorResponse({
      statusCode: 400,
      code: 'validation',
      fields: [{ path: 'lowBatteryPercent', message: 'lowBatteryPercent must not be greater than 100' }],
    })))

    const failure = await failureOf(apiSend('PATCH', 'settings', { lowBatteryPercent: 400 }))

    expect(fieldErrorsOf(failure)).toEqual({ lowBatteryPercent: 'lowBatteryPercent must not be greater than 100' })
    expect(fieldErrorsOf(new Error('anything else'))).toEqual({})
  })

  it('tells a server that cannot be reached from one that refused', async () => {
    api.use(http.get(apiUrl('devices'), () => HttpResponse.error()))

    const failure = await failureOf(apiGet('devices'))

    expect(isUnreachable(failure)).toBe(true)
    expect(isRefusal(failure)).toBe(false)
    expect((failure as Error).message).toBe('Kuroshiro\'s server is not answering.')
  })

  it('takes an answer that is not the API\'s envelope, such as a proxy\'s error page, for a server that is not answering', async () => {
    api.use(http.get(apiUrl('devices'), () => new HttpResponse('<h1>502 Bad Gateway</h1>', { status: 502, headers: { 'content-type': 'text/html' } })))

    expect(isUnreachable(await failureOf(apiGet('devices')))).toBe(true)
  })

  it('takes a page answered in the API\'s place with a 200 for a server that is not answering too', async () => {
    api.use(http.get(apiUrl('devices'), () => new HttpResponse('<h1>Sign in</h1>', { headers: { 'content-type': 'text/html' } })))

    expect(isUnreachable(await failureOf(apiGet('devices')))).toBe(true)
  })

  it('turns the root-relative image path of a read into an address under the document base', () => {
    expect(imageUrl('/screens/devices/42/7.png?v=1759476660000')).toBe(new URL('screens/devices/42/7.png?v=1759476660000', document.baseURI).href)
  })
})
