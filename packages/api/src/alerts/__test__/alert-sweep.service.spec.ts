import type { ConfigService } from '@nestjs/config'
import type { FindManyOptions } from 'typeorm'
import type { Device } from '../../devices/devices.entity.js'
import type { Alert } from '../entities/alert.entity.js'
import type { NotificationSenderService } from '../notification-sender.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeAlert, makeDevice } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { AlertSweepService } from '../alert-sweep.service.js'

const { cronMock } = vi.hoisted(() => ({ cronMock: { schedule: vi.fn() } }))

vi.mock('node-cron', () => ({ default: cronMock }))

function whereKind(options?: FindManyOptions<Alert>): string | undefined {
  return (options?.where as { kind?: string } | undefined)?.kind
}

function makeConfigService(overrides: Partial<{ appriseUrl?: string, appriseKey: string, lowBatteryPercent: number, offlineMultiplier: number }> = {}): ConfigService {
  const alerts = { appriseKey: 'kuroshiro', lowBatteryPercent: 20, offlineMultiplier: 3, ...overrides }
  return { get: (key: string) => (key === 'alerts' ? alerts : undefined) } as unknown as ConfigService
}

describe('alertSweepService', () => {
  let alertRepo: ReturnType<typeof createMockRepository<Alert>>
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let sender: { send: ReturnType<typeof vi.fn> }
  let service: AlertSweepService

  beforeEach(() => {
    vi.clearAllMocks()
    alertRepo = createMockRepository<Alert>()
    deviceRepo = createMockRepository<Device>()
    alertRepo.find.mockResolvedValue([])
    sender = { send: vi.fn().mockResolvedValue(false) }
    service = new AlertSweepService(asRepository(alertRepo), asRepository(deviceRepo), sender as unknown as NotificationSenderService, makeConfigService())
  })

  describe('onApplicationBootstrap', () => {
    it('runs a sweep immediately and schedules one every 5 minutes', async () => {
      deviceRepo.find.mockResolvedValue([])
      await service.onApplicationBootstrap()
      expect(cronMock.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function))
    })
  })

  describe('sweep', () => {
    it('opens a new low-battery alert and attempts its notification', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '3.0', lastSeen: new Date() }) // 0%
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockResolvedValue([])
      alertRepo.save.mockImplementation(async input => ({ ...input, id: 'new-alert-id' }))
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(alertRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'device-low-battery',
        device,
        details: { percent: 0 },
      }))
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('battery low') }))
      expect(alertRepo.update).toHaveBeenCalledWith('new-alert-id', expect.objectContaining({ notifiedAt: expect.any(Date) }))
    })

    it('does not open a second alert while one is already active for the same rule and device', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '3.0', lastSeen: new Date() })
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))

      await service.sweep()

      expect(alertRepo.save).not.toHaveBeenCalled()
    })

    it('retries the opening notification on the next sweep when it previously failed', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '3.0', lastSeen: new Date() })
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, notifiedAt: null })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(sender.send).toHaveBeenCalled()
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ notifiedAt: expect.any(Date) }))
    })

    it('does not re-send a notification that already succeeded', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '3.0', lastSeen: new Date() })
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))

      await service.sweep()

      expect(sender.send).not.toHaveBeenCalled()
    })

    it('resolves an active alert once its condition clears and attempts the resolution notification', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '4.2', lastSeen: new Date() }) // 100%, well clear
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolvedAt: expect.any(Date) }))
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('recovered') }))
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolutionNotifiedAt: expect.any(Date) }))
    })

    it('never opens or resolves for a device with no reported battery voltage', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: undefined, lastSeen: new Date() })
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))

      await service.sweep()

      expect(alertRepo.save).not.toHaveBeenCalled()
      expect(alertRepo.update).not.toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolvedAt: expect.anything() }))
    })

    it('retries a pending resolution notification for an already-resolved alert on a later sweep', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '4.2', lastSeen: new Date() })
      const resolved = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, resolvedAt: new Date(), resolutionNotifiedAt: null })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async (options) => {
        if (whereKind(options) === undefined && (options?.where as { resolvedAt?: unknown } | undefined)?.resolvedAt !== undefined)
          return [resolved] // the "pending resolution notification" query
        return [] // no active alerts for either rule
      })
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('recovered') }))
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolutionNotifiedAt: expect.any(Date) }))
    })

    it('does not duplicate an overlapping sweep', async () => {
      deviceRepo.find.mockResolvedValue([])
      let resolveFind: (alerts: Alert[]) => void = () => {}
      const pending = new Promise<Alert[]>((resolve) => {
        resolveFind = resolve
      })
      alertRepo.find.mockReturnValue(pending)

      const first = service.sweep()
      const second = service.sweep()
      expect(first).toBe(second)

      resolveFind([])
      await Promise.all([first, second])
    })
  })
})
