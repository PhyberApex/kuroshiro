import type { ConfigService } from '@nestjs/config'
import type { PluginRendererService } from '../services/plugin-renderer.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { asService } from '../../test/mockService.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'

const mockFetch = stubFetch()

describe('pluginDataFetcherService', () => {
  let service: PluginDataFetcherService
  const mockRenderer = { render: vi.fn() }
  const mockConfigService = { get: vi.fn().mockReturnValue(false) }

  beforeEach(() => {
    service = new PluginDataFetcherService(asService<PluginRendererService>(mockRenderer), asService<ConfigService>(mockConfigService))
    vi.clearAllMocks()
    mockConfigService.get.mockReturnValue(false)
  })

  it('fetches data from a GET endpoint', async () => {
    const mockData = { temperature: 25, condition: 'sunny' }
    mockFetch.mockResolvedValue(jsonResponse(mockData))

    const result = await service.fetchData('GET', 'https://api.weather.com/data')

    expect(mockFetch).toHaveBeenCalledWith('https://api.weather.com/data', {
      method: 'GET',
      headers: {},
    })
    expect(result).toEqual(mockData)
  })

  it('fetches data from a POST endpoint with body', async () => {
    const mockData = { success: true }
    const body = { location: 'Tokyo', units: 'metric' }
    mockFetch.mockResolvedValue(jsonResponse(mockData))

    const result = await service.fetchData('POST', 'https://api.example.com/webhook', {}, body)

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(result).toEqual(mockData)
  })

  it('includes custom headers in request', async () => {
    const mockData = { data: 'test' }
    const headers = { 'Authorization': 'Bearer token123', 'X-Custom': 'value' }
    mockFetch.mockResolvedValue(jsonResponse(mockData))

    await service.fetchData('GET', 'https://api.example.com', headers)

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com', {
      method: 'GET',
      headers,
    })
  })

  it('throws error when fetch fails', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, { ok: false, status: 404 }))

    await expect(
      service.fetchData('GET', 'https://api.example.com/notfound'),
    ).rejects.toThrow('HTTP error! status: 404')
  })

  it('throws error when network fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

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
    mockFetch.mockResolvedValue(jsonResponse(complexData))

    const result = await service.fetchData('GET', 'https://api.example.com')
    expect(result).toEqual(complexData)
  })
})
