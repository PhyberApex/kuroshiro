import type { ConfigService } from '@nestjs/config'
import type { FindManyOptions } from 'typeorm'
import type { Device } from '../../devices/devices.entity.js'
import type { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import type { InstanceSettingsService } from '../../settings/instance-settings.service.js'
import type { Alert } from '../entities/alert.entity.js'
import type { NotificationSenderService } from '../notification-sender.service.js'
import { Logger } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeAlert, makeDevice, makePluginDataSource } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { AlertSweepService } from '../alert-sweep.service.js'

const { cronMock } = vi.hoisted(() => ({ cronMock: { schedule: vi.fn() } }))

vi.mock('node-cron', () => ({ default: cronMock }))

function whereKind(options?: FindManyOptions<Alert>): string | undefined {
  return (options?.where as { kind?: string } | undefined)?.kind
}

function makeSettingsService(overrides: Partial<{ lowBatteryPercent: number, offlineMultiplier: number, fetchFailureThreshold: number }> = {}, alertReminderHours = 0): InstanceSettingsService {
  const thresholds = { lowBatteryPercent: 20, offlineMultiplier: 3, fetchFailureThreshold: 3, ...overrides }
  return asService<InstanceSettingsService>({
    resolveThresholds: vi.fn().mockResolvedValue(thresholds),
    resolveAlertReminderHours: vi.fn().mockResolvedValue(alertReminderHours),
  })
}

const HOUR_MS = 60 * 60 * 1000
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS)

function makeConfigService(sweepCron = '*/5 * * * *'): ConfigService {
  return asService<ConfigService>({ get: (key: string) => (key === 'alerts' ? { sweepCron } : undefined) })
}

describe('alertSweepService', () => {
  let alertRepo: ReturnType<typeof createMockRepository<Alert>>
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let dataSourceRepo: ReturnType<typeof createMockRepository<PluginDataSource>>
  let sender: { send: ReturnType<typeof vi.fn>, isConfigured: ReturnType<typeof vi.fn> }
  let service: AlertSweepService

  beforeEach(() => {
    vi.clearAllMocks()
    alertRepo = createMockRepository<Alert>()
    deviceRepo = createMockRepository<Device>()
    dataSourceRepo = createMockRepository<PluginDataSource>()
    alertRepo.find.mockResolvedValue([])
    dataSourceRepo.find.mockResolvedValue([])
    sender = { send: vi.fn().mockResolvedValue(false), isConfigured: vi.fn().mockReturnValue(true) }
    service = new AlertSweepService(asRepository(alertRepo), asRepository(deviceRepo), asRepository(dataSourceRepo), sender as unknown as NotificationSenderService, makeSettingsService(), makeConfigService())
  })

  describe('onApplicationBootstrap', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('runs a sweep immediately and schedules one on the configured schedule', async () => {
      deviceRepo.find.mockResolvedValue([])
      await service.onApplicationBootstrap()
      await vi.waitFor(() => expect(deviceRepo.find).toHaveBeenCalledTimes(1))
      expect(cronMock.schedule).toHaveBeenCalledTimes(1)
      expect(cronMock.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function))
    })

    it('schedules the sweep on whatever cron schedule the config resolves to', async () => {
      deviceRepo.find.mockResolvedValue([])
      service = new AlertSweepService(asRepository(alertRepo), asRepository(deviceRepo), asRepository(dataSourceRepo), sender as unknown as NotificationSenderService, makeSettingsService(), makeConfigService('*/5 * * * * *'))
      await service.onApplicationBootstrap()
      expect(cronMock.schedule).toHaveBeenCalledWith('*/5 * * * * *', expect.any(Function))
    })

    it('logs a boot-time sweep failure as a warning instead of rejecting', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      deviceRepo.find.mockRejectedValue(new Error('db down'))

      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined()

      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledWith('Initial alert sweep skipped: db down'))
    })

    it('logs a failure of the scheduled sweep as a warning instead of throwing', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      deviceRepo.find.mockRejectedValue(new Error('db down'))
      await service.onApplicationBootstrap()
      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledTimes(1))
      const scheduled: () => void = cronMock.schedule.mock.calls[0][1]

      expect(() => scheduled()).not.toThrow()

      await vi.waitFor(() => expect(warnSpy).toHaveBeenCalledWith('Scheduled alert sweep failed: db down'))
    })
  })

  describe('sweep', () => {
    it('opens a new low-battery alert and attempts its notification as part of the digest', async () => {
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
      expect(sender.send).toHaveBeenCalledTimes(1)
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Low battery') }))
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
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Resolved:') }))
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolutionNotifiedAt: expect.any(Date) }))
    })

    it('marks a resolution notified immediately, without calling the sender, when no sender is configured', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '4.2', lastSeen: new Date() }) // 100%, well clear
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))
      sender.isConfigured.mockReturnValue(false)

      await service.sweep()

      expect(sender.send).not.toHaveBeenCalled()
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolvedAt: expect.any(Date), resolutionNotifiedAt: expect.any(Date) }))
    })

    it('still attempts delivery and leaves the resolution pending when a sender is configured but delivery fails', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '4.2', lastSeen: new Date() })
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))
      sender.isConfigured.mockReturnValue(true)
      sender.send.mockResolvedValue(false)

      await service.sweep()

      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Resolved:') }))
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolvedAt: expect.any(Date) }))
      expect(alertRepo.update).not.toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolutionNotifiedAt: expect.anything() }))
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

      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Resolved:') }))
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolutionNotifiedAt: expect.any(Date) }))
    })

    it('drops a pending resolution whose Rule is unknown or whose subject is gone', async () => {
      const unknownKind = makeAlert({ id: 'alert-unknown', kind: 'retired-rule' as Alert['kind'], resolvedAt: new Date() })
      const orphaned = makeAlert({ id: 'alert-orphan', kind: 'device-low-battery', device: null, resolvedAt: new Date() })
      deviceRepo.find.mockResolvedValue([])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === undefined ? [unknownKind, orphaned] : []))

      await service.sweep()

      expect(alertRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ resolvedAt: expect.anything() }) }))
      expect(sender.send).not.toHaveBeenCalled()
      expect(alertRepo.update).not.toHaveBeenCalled()
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

    it('opens a data-source-fetch-failing alert once a Data Source\'s streak reaches the threshold', async () => {
      const source = makePluginDataSource({ id: 'ds-1', name: 'weather', fetchFailureStreak: 3 })
      deviceRepo.find.mockResolvedValue([])
      dataSourceRepo.find.mockResolvedValue([source])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'data-source-fetch-failing' ? [] : []))
      alertRepo.save.mockImplementation(async input => ({ ...input, id: 'new-alert-id' }))
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(alertRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'data-source-fetch-failing',
        dataSource: source,
        details: { streak: 3, lastError: null },
      }))
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Fetch failing') }))
    })

    it('does not open a data-source-fetch-failing alert one short of the threshold', async () => {
      const source = makePluginDataSource({ id: 'ds-1', name: 'weather', fetchFailureStreak: 2 })
      deviceRepo.find.mockResolvedValue([])
      dataSourceRepo.find.mockResolvedValue([source])

      await service.sweep()

      expect(alertRepo.save).not.toHaveBeenCalled()
    })

    it('resolves an active data-source-fetch-failing alert once the streak clears and attempts the resolution notification', async () => {
      const source = makePluginDataSource({ id: 'ds-1', name: 'weather', fetchFailureStreak: 0 })
      const existing = makeAlert({ id: 'alert-1', kind: 'data-source-fetch-failing', device: undefined, dataSource: source, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([])
      dataSourceRepo.find.mockResolvedValue([source])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'data-source-fetch-failing' ? [existing] : []))
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ resolvedAt: expect.any(Date) }))
      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Fetch failing') }))
    })

    it('never opens a data-source-fetch-failing alert for a literal-mode source', async () => {
      const source = makePluginDataSource({ id: 'ds-1', name: 'title', mode: 'literal', fetchFailureStreak: 0 })
      deviceRepo.find.mockResolvedValue([])
      dataSourceRepo.find.mockResolvedValue([source])

      await service.sweep()

      expect(alertRepo.save).not.toHaveBeenCalled()
    })

    it('sends nothing when nothing opened, resolved, or was left unannounced', async () => {
      deviceRepo.find.mockResolvedValue([])
      dataSourceRepo.find.mockResolvedValue([])
      alertRepo.find.mockResolvedValue([])

      await service.sweep()

      expect(sender.send).not.toHaveBeenCalled()
    })

    it('combines opens and resolves from two different Rules into a single digest send', async () => {
      const device = makeDevice({ id: 'device-1', batteryVoltage: '3.0', lastSeen: new Date() }) // opens: 0%
      const source = makePluginDataSource({ id: 'ds-1', name: 'weather', fetchFailureStreak: 0 }) // resolves
      const existingFetchAlert = makeAlert({ id: 'alert-fetch-1', kind: 'data-source-fetch-failing', device: undefined, dataSource: source, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device])
      dataSourceRepo.find.mockResolvedValue([source])
      alertRepo.find.mockImplementation(async (options) => {
        const kind = whereKind(options)
        if (kind === 'device-low-battery')
          return []
        if (kind === 'data-source-fetch-failing')
          return [existingFetchAlert]
        return []
      })
      alertRepo.save.mockImplementation(async input => ({ ...input, id: 'new-alert-id' }))
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(sender.send).toHaveBeenCalledTimes(1)
      const digest = sender.send.mock.calls[0][0]
      expect(digest.title).toContain('1 opened')
      expect(digest.title).toContain('1 resolved')
      expect(digest.body.indexOf('Low battery')).toBeLessThan(digest.body.indexOf('Fetch failing'))
      expect(alertRepo.update).toHaveBeenCalledWith('new-alert-id', expect.objectContaining({ notifiedAt: expect.any(Date) }))
      expect(alertRepo.update).toHaveBeenCalledWith('alert-fetch-1', expect.objectContaining({ resolutionNotifiedAt: expect.any(Date) }))
    })

    it('carries an Alert left unannounced by a prior failed send into the next digest alongside new changes, in one send call', async () => {
      const device1 = makeDevice({ id: 'device-1', batteryVoltage: '3.0', lastSeen: new Date() }) // still active, unannounced from before
      const device2 = makeDevice({ id: 'device-2', batteryVoltage: '4.2', lastSeen: new Date() }) // resolves this sweep
      const unannounced = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device: device1, notifiedAt: null })
      const resolving = makeAlert({ id: 'alert-2', kind: 'device-low-battery', device: device2, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device1, device2])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [unannounced, resolving] : []))
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(sender.send).toHaveBeenCalledTimes(1)
      const digest = sender.send.mock.calls[0][0]
      expect(digest.title).toContain('1 opened')
      expect(digest.title).toContain('1 resolved')
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', expect.objectContaining({ notifiedAt: expect.any(Date) }))
      expect(alertRepo.update).toHaveBeenCalledWith('alert-2', expect.objectContaining({ resolutionNotifiedAt: expect.any(Date) }))
    })

    it('stamps nothing when the combined digest send fails, even with multiple entries pending', async () => {
      const device1 = makeDevice({ id: 'device-1', batteryVoltage: '3.0', lastSeen: new Date() })
      const device2 = makeDevice({ id: 'device-2', batteryVoltage: '4.2', lastSeen: new Date() })
      const unannounced = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device: device1, notifiedAt: null })
      const resolving = makeAlert({ id: 'alert-2', kind: 'device-low-battery', device: device2, notifiedAt: new Date() })
      deviceRepo.find.mockResolvedValue([device1, device2])
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [unannounced, resolving] : []))
      sender.send.mockResolvedValue(false)

      await service.sweep()

      expect(sender.send).toHaveBeenCalledTimes(1)
      expect(alertRepo.update).not.toHaveBeenCalledWith('alert-1', expect.objectContaining({ notifiedAt: expect.anything() }))
      expect(alertRepo.update).not.toHaveBeenCalledWith('alert-2', expect.objectContaining({ resolutionNotifiedAt: expect.anything() }))
    })
  })

  describe('reminders', () => {
    function withReminderHours(hours: number): void {
      service = new AlertSweepService(asRepository(alertRepo), asRepository(deviceRepo), asRepository(dataSourceRepo), sender as unknown as NotificationSenderService, makeSettingsService({}, hours), makeConfigService())
    }

    function withActiveLowBatteryAlert(alert: Partial<Alert>): void {
      const device = makeDevice({ id: 'device-1', name: 'Kitchen', batteryVoltage: '3.0', lastSeen: new Date() }) // 0%, still active
      deviceRepo.find.mockResolvedValue([device])
      const existing = makeAlert({ id: 'alert-1', kind: 'device-low-battery', device, ...alert })
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-low-battery' ? [existing] : []))
    }

    it('reminds an Alert still active whose opening Notification is older than the Reminder Interval, and stamps remindedAt alone', async () => {
      withReminderHours(24)
      withActiveLowBatteryAlert({ notifiedAt: hoursAgo(25) })
      sender.send.mockResolvedValue(true)

      await service.sweep()

      expect(sender.send).toHaveBeenCalledTimes(1)
      const [digest] = sender.send.mock.calls[0]
      expect(digest.title).toBe('Kuroshiro: 0 opened, 0 resolved, 1 still open')
      expect(digest.body).toContain('Still open:\nLow battery:\n- Kitchen')
      expect(alertRepo.update).toHaveBeenCalledWith('alert-1', { remindedAt: expect.any(Date) })
      expect(alertRepo.update).not.toHaveBeenCalledWith('alert-1', expect.objectContaining({ notifiedAt: expect.anything() }))
    })

    it('does not remind an Alert announced more recently than the Reminder Interval', async () => {
      withReminderHours(24)
      withActiveLowBatteryAlert({ notifiedAt: hoursAgo(23) })

      await service.sweep()

      expect(sender.send).not.toHaveBeenCalled()
    })

    it('counts the interval from the previous Reminder when it is later than the opening Notification', async () => {
      withReminderHours(24)
      withActiveLowBatteryAlert({ notifiedAt: hoursAgo(30), remindedAt: hoursAgo(1) })

      await service.sweep()

      expect(sender.send).not.toHaveBeenCalled()
    })

    it('reminds again once the previous Reminder is itself older than the interval', async () => {
      withReminderHours(24)
      withActiveLowBatteryAlert({ notifiedAt: hoursAgo(50), remindedAt: hoursAgo(25) })

      await service.sweep()

      expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('Still open:') }))
    })

    it('reminds nothing while the Reminder Interval is 0, however old the announcement', async () => {
      withReminderHours(0)
      withActiveLowBatteryAlert({ notifiedAt: hoursAgo(24 * 365) })

      await service.sweep()

      expect(sender.send).not.toHaveBeenCalled()
    })

    it('carries an Alert whose opening Notification never landed as an opened entry, not a Reminder', async () => {
      withReminderHours(1)
      withActiveLowBatteryAlert({ notifiedAt: null })

      await service.sweep()

      const [digest] = sender.send.mock.calls[0]
      expect(digest.title).toBe('Kuroshiro: 1 opened, 0 resolved')
    })

    it('does not remind a subject its Rule skips this Sweep', async () => {
      withReminderHours(1)
      const device = makeDevice({ id: 'device-1', lastSeen: null, batteryVoltage: undefined })
      deviceRepo.find.mockResolvedValue([device])
      const existing = makeAlert({ id: 'alert-1', kind: 'device-offline', device, notifiedAt: hoursAgo(48) })
      alertRepo.find.mockImplementation(async options => (whereKind(options) === 'device-offline' ? [existing] : []))

      await service.sweep()

      expect(sender.send).not.toHaveBeenCalled()
    })

    it('stamps no remindedAt when the digest send fails, so the Reminder rides again next Sweep', async () => {
      withReminderHours(24)
      withActiveLowBatteryAlert({ notifiedAt: hoursAgo(25) })
      sender.send.mockResolvedValue(false)

      await service.sweep()

      expect(sender.send).toHaveBeenCalledTimes(1)
      expect(alertRepo.update).not.toHaveBeenCalledWith('alert-1', expect.objectContaining({ remindedAt: expect.anything() }))
    })
  })
})
