import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'

globalThis.fetch = vi.fn()

describe('pluginDataFetcherService', () => {
  let service: PluginDataFetcherService

  beforeEach(() => {
    service = new PluginDataFetcherService()
    vi.clearAllMocks()
  })

  it('fetches data from a GET endpoint', async () => {
    const mockData = { temperature: 25, condition: 'sunny' }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })

    const result = await service.fetchData('GET', 'https://api.weather.com/data')

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.weather.com/data', {
      method: 'GET',
      headers: {},
    })
    expect(result).toEqual(mockData)
  })

  it('fetches data from a POST endpoint with body', async () => {
    const mockData = { success: true }
    const body = { location: 'Tokyo', units: 'metric' }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })

    const result = await service.fetchData('POST', 'https://api.example.com/webhook', {}, body)

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(result).toEqual(mockData)
  })

  it('includes custom headers in request', async () => {
    const mockData = { data: 'test' }
    const headers = { 'Authorization': 'Bearer token123', 'X-Custom': 'value' }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })

    await service.fetchData('GET', 'https://api.example.com', headers)

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com', {
      method: 'GET',
      headers,
    })
  })

  it('throws error when fetch fails', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(
      service.fetchData('GET', 'https://api.example.com/notfound'),
    ).rejects.toThrow('HTTP error! status: 404')
  })

  it('throws error when network fails', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('Network error'))

    await expect(
      service.fetchData('GET', 'https://api.example.com'),
    ).rejects.toThrow('Network error')
  })

  it('parses JSON response correctly', async () => {
    const complexData = {
      nested: { value: 123 },
      array: [1, 2, 3],
      string: 'test',
    }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => complexData,
    })

    const result = await service.fetchData('GET', 'https://api.example.com')
    expect(result).toEqual(complexData)
  })
})
