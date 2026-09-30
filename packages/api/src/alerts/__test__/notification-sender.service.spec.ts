import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubFetch } from '../../test/fetch.js'
import { NotificationSenderService } from '../notification-sender.service.js'

const mockFetch = stubFetch()

function makeConfigService(overrides: Partial<{ appriseUrl?: string, appriseKey: string }> = {}): ConfigService {
  const alerts = { appriseKey: 'kuroshiro', ...overrides }
  return { get: (key: string) => (key === 'alerts' ? alerts : undefined) } as unknown as ConfigService
}

describe('notificationSenderService', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('isConfigured', () => {
    it('is false when no Apprise URL is configured', () => {
      const service = new NotificationSenderService(makeConfigService())
      expect(service.isConfigured()).toBe(false)
    })

    it('is true when an Apprise URL is configured', () => {
      const service = new NotificationSenderService(makeConfigService({ appriseUrl: 'http://apprise:8000' }))
      expect(service.isConfigured()).toBe(true)
    })
  })

  it('is a no-op and makes no HTTP call when no Apprise URL is configured', async () => {
    const service = new NotificationSenderService(makeConfigService())
    const sent = await service.send({ title: 't', body: 'b', type: 'warning' })
    expect(sent).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('posts title/body/type to /notify/{key} when a URL is configured', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }))
    const service = new NotificationSenderService(makeConfigService({ appriseUrl: 'http://apprise:8000', appriseKey: 'my-key' }))

    const sent = await service.send({ title: 'Kuroshiro: low battery', body: 'body text', type: 'warning' })

    expect(sent).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('http://apprise:8000/notify/my-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Kuroshiro: low battery', body: 'body text', type: 'warning' }),
      signal: expect.any(AbortSignal),
    })
  })

  it('returns false and logs a warning on a non-2xx response', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500, statusText: 'Internal Server Error' }))
    const service = new NotificationSenderService(makeConfigService({ appriseUrl: 'http://apprise:8000' }))

    const sent = await service.send({ title: 't', body: 'b', type: 'warning' })

    expect(sent).toBe(false)
  })

  it('returns false when the request throws (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const service = new NotificationSenderService(makeConfigService({ appriseUrl: 'http://apprise:8000' }))

    const sent = await service.send({ title: 't', body: 'b', type: 'warning' })

    expect(sent).toBe(false)
  })

  it('returns false instead of hanging forever when the sidecar never responds', async () => {
    mockFetch.mockImplementation(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    const service = new NotificationSenderService(makeConfigService({ appriseUrl: 'http://apprise:8000' }))

    const sent = await service.send({ title: 't', body: 'b', type: 'warning' })

    expect(sent).toBe(false)
    expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })
})
