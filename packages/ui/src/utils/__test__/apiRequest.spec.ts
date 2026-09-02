import { afterEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { apiFetch, apiRequest } from '../apiRequest'

describe('apiFetch', () => {
  afterEach(() => {
    document.head.querySelector('base')?.remove()
  })

  it('resolves the request against the runtime base path', async () => {
    const base = document.createElement('base')
    base.href = '/api/hassio_ingress/some-token/'
    document.head.appendChild(base)

    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({}))

    await apiFetch('/api/devices')

    expect(mockFetch).toHaveBeenCalledWith('/api/hassio_ingress/some-token/api/devices', undefined)
  })
})

describe('apiRequest', () => {
  it('returns the parsed JSON body on success', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({ id: 'plugin-1' }))

    await expect(apiRequest('/api/plugins', undefined, 'Failed to create plugin')).resolves.toEqual({ id: 'plugin-1' })
    expect(mockFetch).toHaveBeenCalledWith('/api/plugins', undefined)
  })

  it('passes the request init through to fetch', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

    await apiRequest('/api/plugins', { method: 'POST', body: '{}' }, 'Failed to create plugin')

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins', { method: 'POST', body: '{}' })
  })

  it('throws the server message from the error body', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Data source name "trmnl" is reserved' }, false))

    await expect(apiRequest('/api/plugins', undefined, 'Failed to create plugin'))
      .rejects
      .toThrow('Data source name "trmnl" is reserved')
  })

  it('falls back to the given message when the error body has no message', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({}, false))

    await expect(apiRequest('/api/plugins', undefined, 'Failed to create plugin'))
      .rejects
      .toThrow('Failed to create plugin')
  })

  it('falls back to the given message when the error body carries an empty message', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({ message: '' }, false))

    await expect(apiRequest('/api/plugins', undefined, 'Failed to create plugin'))
      .rejects
      .toThrow('Failed to create plugin')
  })

  it('falls back to the given message when the error body is not JSON', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(new Response('not json', { status: 500, statusText: 'Server Error' }))

    await expect(apiRequest('/api/plugins', undefined, 'Failed to create plugin'))
      .rejects
      .toThrow('Failed to create plugin')
  })

  it('computes the fallback message from the response when given a function', async () => {
    const mockFetch = stubFetch()
    mockFetch.mockResolvedValue(jsonResponse({}, { ok: false, statusText: 'Service Unavailable' }))

    await expect(apiRequest('/api/device-models/sync', { method: 'POST' }, res => `Sync failed: ${res.statusText}`))
      .rejects
      .toThrow('Sync failed: Service Unavailable')
  })
})
