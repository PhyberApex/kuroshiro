import type { ConfigService } from '@nestjs/config'
import type { FindOperator } from 'typeorm'
import type { Alert } from '../entities/alert.entity.js'
import type { NotificationSenderService } from '../notification-sender.service.js'
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeAlert, makeDevice } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { AlertsService } from '../alerts.service.js'

function makeConfigService(overrides: Partial<{ appriseUrl?: string }> = {}): ConfigService {
  const alerts = { appriseKey: 'kuroshiro', ...overrides }
  return { get: (key: string) => (key === 'alerts' ? alerts : undefined) } as unknown as ConfigService
}

describe('alertsService', () => {
  let alertRepo: ReturnType<typeof createMockRepository<Alert>>
  let sender: { send: ReturnType<typeof vi.fn> }
  let configService: ConfigService
  let service: AlertsService

  beforeEach(() => {
    alertRepo = createMockRepository<Alert>()
    alertRepo.find.mockResolvedValue([])
    sender = { send: vi.fn() }
    configService = makeConfigService({ appriseUrl: 'http://apprise:8000' })
    service = new AlertsService(asRepository(alertRepo), sender as unknown as NotificationSenderService, configService)
  })

  describe('list', () => {
    it('returns active and resolved Alerts mapped to summaries', async () => {
      const device = makeDevice({ id: 'device-1', name: 'Living Room' })
      const active = makeAlert({ id: 'alert-active', kind: 'device-offline', device, resolvedAt: null, details: { lastSeen: 'x' } })
      const resolved = makeAlert({ id: 'alert-resolved', kind: 'device-low-battery', device, resolvedAt: new Date('2026-01-02T00:00:00.000Z') })
      // First call (active) resolves with `active`, second (resolved) resolves with `resolved`.
      alertRepo.find.mockResolvedValueOnce([active]).mockResolvedValueOnce([resolved])

      const result = await service.list()

      expect(result.active).toEqual([{
        id: 'alert-active',
        kind: 'device-offline',
        deviceId: 'device-1',
        deviceName: 'Living Room',
        openedAt: active.openedAt.toISOString(),
        resolvedAt: null,
        details: { lastSeen: 'x' },
      }])
      expect(result.resolved).toEqual([{
        id: 'alert-resolved',
        kind: 'device-low-battery',
        deviceId: 'device-1',
        deviceName: 'Living Room',
        openedAt: resolved.openedAt.toISOString(),
        resolvedAt: '2026-01-02T00:00:00.000Z',
        details: null,
      }])
    })

    it('drops Alerts whose Device relation is missing (cascade-deleted)', async () => {
      const orphan = makeAlert({ id: 'alert-orphan', device: undefined })
      alertRepo.find.mockResolvedValueOnce([orphan]).mockResolvedValueOnce([])

      const result = await service.list()

      expect(result.active).toEqual([])
    })

    it('caps the resolved query at 50 and defaults the window to 7 days', async () => {
      const now = new Date('2026-02-01T00:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(now)

      await service.list()

      const resolvedCall = alertRepo.find.mock.calls[1]?.[0]
      expect(resolvedCall).toMatchObject({ take: 50 })
      const cutoff = (resolvedCall?.where as { resolvedAt: FindOperator<Date> }).resolvedAt.value
      expect(cutoff.toISOString()).toBe('2026-01-25T00:00:00.000Z')

      vi.useRealTimers()
    })

    it('uses an explicit resolvedSince over the default window', async () => {
      await service.list('2026-01-15T00:00:00.000Z')

      const resolvedCall = alertRepo.find.mock.calls[1]?.[0]
      const cutoff = (resolvedCall?.where as { resolvedAt: FindOperator<Date> }).resolvedAt.value
      expect(cutoff.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    })
  })

  describe('sendTestNotification', () => {
    it('returns a success message when the sender reports true', async () => {
      sender.send.mockResolvedValue(true)

      const result = await service.sendTestNotification()

      expect(result.message).toMatch(/sent/i)
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'success', title: expect.stringContaining('Test'), body: expect.stringContaining('test') }))
    })

    it('does not write an Alert row when sending a test Notification', async () => {
      sender.send.mockResolvedValue(true)

      await service.sendTestNotification()

      expect(alertRepo.save).not.toHaveBeenCalled()
    })

    it('throws a 4xx when Apprise is not configured', async () => {
      sender.send.mockResolvedValue(false)
      configService = makeConfigService({ appriseUrl: undefined })
      service = new AlertsService(asRepository(alertRepo), sender as unknown as NotificationSenderService, configService)

      await expect(service.sendTestNotification()).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws a 5xx when Apprise is configured but delivery failed', async () => {
      sender.send.mockResolvedValue(false)

      await expect(service.sendTestNotification()).rejects.toBeInstanceOf(ServiceUnavailableException)
    })
  })
})
