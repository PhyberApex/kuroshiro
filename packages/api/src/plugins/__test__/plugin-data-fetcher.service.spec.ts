import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InstanceTimeZone } from '../../instance/instance-time-zone.js'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { asService } from '../../test/mockService.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'

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

  it('renders Liquid in the url, the header values and the body against the template context', async () => {
    const liquid = new PluginRendererService(new InstanceTimeZone())
    mockRenderer.render.mockImplementation((template: string, data: object) => liquid.render(template, data))
    mockFetch.mockResolvedValue(jsonResponse({}))

    await service.fetchData(
      'POST',
      'https://api.example.com/{{ city }}',
      { 'Authorization': 'Bearer {{ trmnl.plugin_settings.custom_fields_values.api_key }}', 'X-Plain': 'as-is' },
      { query: { place: '{{ city }}', limit: 3 }, tags: ['{{ city }}', 'fixed'] },
      { city: 'Berlin', trmnl: { plugin_settings: { custom_fields_values: { api_key: 's3cret' } } } },
    )

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/Berlin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer s3cret', 'X-Plain': 'as-is' },
      body: JSON.stringify({ query: { place: 'Berlin', limit: 3 }, tags: ['Berlin', 'fixed'] }),
    })
  })

  it('answers the text of a response that is not JSON, as an Atom feed or HTML page', async () => {
    mockFetch.mockResolvedValue(new Response('<feed><entry/></feed>', { status: 200, headers: { 'content-type': 'application/atom+xml' } }))

    expect(await service.fetchData('GET', 'https://example.com/feed')).toBe('<feed><entry/></feed>')
  })

  describe('several polling URLs (ADR-0058)', () => {
    it('requests each non-blank line the URL renders to and answers them as IDX_0, IDX_1, … in line order', async () => {
      mockRenderer.render.mockResolvedValue('https://a.example/one\n\n   https://b.example/two  \r\nhttps://c.example/three\n')
      mockFetch.mockImplementation(async (url: string | URL | Request) => jsonResponse({ from: String(url) }))

      const result = await service.fetchData('GET', '{% for feed in feeds %}{{ feed }}\n{% endfor %}', { Accept: 'application/json' }, undefined, { feeds: [] })

      expect(result).toEqual({ IDX_0: { from: 'https://a.example/one' }, IDX_1: { from: 'https://b.example/two' }, IDX_2: { from: 'https://c.example/three' } })
      expect(mockFetch.mock.calls.map(([url, init]) => [url, init?.headers])).toEqual([
        ['https://a.example/one', { Accept: 'application/json' }],
        ['https://b.example/two', { Accept: 'application/json' }],
        ['https://c.example/three', { Accept: 'application/json' }],
      ])
    })

    it('gives a line that fails its own error marker, so the other lines still read', async () => {
      mockRenderer.render.mockResolvedValue('https://a.example/one\nhttps://b.example/two')
      mockFetch.mockResolvedValueOnce(new Response('x', { status: 404 })).mockResolvedValueOnce(jsonResponse({ ok: true }))

      expect(await service.fetchData('GET', '{{ urls }}', {}, undefined, {})).toEqual({ IDX_0: { error: true, message: 'HTTP error! status: 404' }, IDX_1: { ok: true } })
    })

    it('refuses an internal host on any line in demo mode, with the marker on that line', async () => {
      mockConfigService.get.mockReturnValue(true)
      mockRenderer.render.mockResolvedValue('https://a.example/one\nhttp://localhost:3000/private')
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

      const result = await service.fetchData('GET', '{{ urls }}', {}, undefined, {}) as Record<string, unknown>

      expect(result.IDX_0).toEqual({ ok: true })
      expect(result.IDX_1).toMatchObject({ error: true })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('reads a single line, spaces around it dropped, as the one request it always was', async () => {
      mockRenderer.render.mockResolvedValue('  https://a.example/one \n')
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }))

      expect(await service.fetchData('GET', '{{ url }}', {}, undefined, {})).toEqual({ ok: true })
      expect(mockFetch).toHaveBeenCalledWith('https://a.example/one', expect.anything())
    })
  })

  it('answers an empty body as null', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 200 }))

    expect(await service.fetchData('GET', 'https://example.com/empty')).toBeNull()
  })

  describe('fetchForTransform', () => {
    it('passes the request through to fetch and answers the Response as is', async () => {
      const response = new Response('{"ok":true}', { status: 200 })
      mockFetch.mockResolvedValue(response)

      expect(await service.fetchForTransform('https://api.example.com/items', { method: 'POST', body: '{}' })).toBe(response)
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/items', { method: 'POST', body: '{}' })
    })

    it('refuses an internal host in demo mode, as a Data Source URL is refused', async () => {
      mockConfigService.get.mockReturnValue(true)

      await expect(service.fetchForTransform('http://127.0.0.1:9/secrets')).rejects.toThrow('not allowed in demo mode')
      expect(mockFetch).not.toHaveBeenCalled()
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
