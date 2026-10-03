import type { ConfigService } from '@nestjs/config'
import type { InstanceSettings } from '../entities/instance-settings.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { InstanceSettingsService } from '../instance-settings.service.js'

const DEFAULT_ALERTS = {
  lowBatteryPercent: 20,
  lowBatteryPercentSource: 'default' as const,
  offlineMultiplier: 3,
  offlineMultiplierSource: 'default' as const,
  fetchFailureThreshold: 3,
  fetchFailureThresholdSource: 'default' as const,
}

const DEFAULT_RETENTION = {
  alertRetentionDays: 90,
  alertRetentionDaysSource: 'default' as const,
  deviceLogRetentionDays: 30,
  deviceLogRetentionDaysSource: 'default' as const,
}

function makeConfigService(overrides: { alerts?: object, retention?: object } = {}): ConfigService {
  const config: Record<string, object> = {
    alerts: { ...DEFAULT_ALERTS, ...overrides.alerts },
    retention: { ...DEFAULT_RETENTION, ...overrides.retention },
  }
  return { get: (key: string) => config[key] } as unknown as ConfigService
}

describe('instanceSettingsService', () => {
  let repo: ReturnType<typeof createMockRepository<InstanceSettings>>
  let configService: ConfigService
  let service: InstanceSettingsService

  beforeEach(() => {
    repo = createMockRepository<InstanceSettings>()
    repo.findOneBy.mockResolvedValue(null)
    configService = makeConfigService()
    service = new InstanceSettingsService(asRepository(repo), configService)
  })

  describe('resolveThresholds', () => {
    it('falls back to the env-derived value when no row exists', async () => {
      await expect(service.resolveThresholds()).resolves.toEqual({
        lowBatteryPercent: 20,
        offlineMultiplier: 3,
        fetchFailureThreshold: 3,
      })
    })

    it('prefers a saved override over the env-derived value', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: 15, offlineMultiplier: null, fetchFailureThreshold: null })

      await expect(service.resolveThresholds()).resolves.toEqual({
        lowBatteryPercent: 15,
        offlineMultiplier: 3,
        fetchFailureThreshold: 3,
      })
    })
  })

  describe('resolveRetentionAges', () => {
    function withEnvAges(): void {
      configService = makeConfigService({ retention: { alertRetentionDays: 120, alertRetentionDaysSource: 'env', deviceLogRetentionDays: 14, deviceLogRetentionDaysSource: 'env' } })
      service = new InstanceSettingsService(asRepository(repo), configService)
    }

    it('falls back to the built-in defaults when no row exists and no env var is set', async () => {
      await expect(service.resolveRetentionAges()).resolves.toEqual({ alertRetentionDays: 90, deviceLogRetentionDays: 30 })
    })

    it('falls back to the env-derived values when nothing is overridden', async () => {
      withEnvAges()
      repo.findOneBy.mockResolvedValue({ id: 1, alertRetentionDays: null, deviceLogRetentionDays: null })

      await expect(service.resolveRetentionAges()).resolves.toEqual({ alertRetentionDays: 120, deviceLogRetentionDays: 14 })
    })

    it('prefers a saved override over the env-derived value, for each age on its own', async () => {
      withEnvAges()
      repo.findOneBy.mockResolvedValue({ id: 1, alertRetentionDays: 7, deviceLogRetentionDays: null })
      await expect(service.resolveRetentionAges()).resolves.toEqual({ alertRetentionDays: 7, deviceLogRetentionDays: 14 })

      repo.findOneBy.mockResolvedValue({ id: 1, alertRetentionDays: null, deviceLogRetentionDays: 3 })
      await expect(service.resolveRetentionAges()).resolves.toEqual({ alertRetentionDays: 120, deviceLogRetentionDays: 3 })
    })

    it('keeps an override of 0, which disables pruning, instead of falling back', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, alertRetentionDays: 0, deviceLogRetentionDays: 0 })

      await expect(service.resolveRetentionAges()).resolves.toEqual({ alertRetentionDays: 0, deviceLogRetentionDays: 0 })
    })
  })

  describe('resolveFirmwareAutoUpdate', () => {
    it('resolves to false when no row exists', async () => {
      await expect(service.resolveFirmwareAutoUpdate()).resolves.toBe(false)
    })

    it('resolves to false when the row has no override', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, firmwareAutoUpdate: null })
      await expect(service.resolveFirmwareAutoUpdate()).resolves.toBe(false)
    })

    it('resolves to the saved override', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, firmwareAutoUpdate: true })
      await expect(service.resolveFirmwareAutoUpdate()).resolves.toBe(true)
    })
  })

  describe('get', () => {
    it('reports every Setting unoverridden as falling back to the built-in default when no row exists', async () => {
      await expect(service.get()).resolves.toEqual({
        lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
        offlineMultiplier: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
        fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
        alertRetentionDays: { override: null, value: 90, fallbackSource: 'default', fallbackValue: 90 },
        deviceLogRetentionDays: { override: null, value: 30, fallbackSource: 'default', fallbackValue: 30 },
        firmwareAutoUpdate: { override: null, value: false, fallbackSource: 'default', fallbackValue: false },
      })
    })

    it('reports the env value as the fallback when the env var is set', async () => {
      configService = makeConfigService({ alerts: { lowBatteryPercent: 15, lowBatteryPercentSource: 'env' } })
      service = new InstanceSettingsService(asRepository(repo), configService)

      const result = await service.get()
      expect(result.lowBatteryPercent).toEqual({ override: null, value: 15, fallbackSource: 'env', fallbackValue: 15 })
    })

    it('reports an override alongside the fallback it would otherwise use', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: 45, offlineMultiplier: null, fetchFailureThreshold: null })

      const result = await service.get()
      expect(result.lowBatteryPercent).toEqual({ override: 45, value: 45, fallbackSource: 'default', fallbackValue: 20 })
    })

    it('reports the fallback source of each Retention age, overridden or not', async () => {
      configService = makeConfigService({ retention: { alertRetentionDays: 120, alertRetentionDaysSource: 'env' } })
      service = new InstanceSettingsService(asRepository(repo), configService)
      repo.findOneBy.mockResolvedValue({ id: 1, alertRetentionDays: 0, deviceLogRetentionDays: null })

      const result = await service.get()
      expect(result.alertRetentionDays).toEqual({ override: 0, value: 0, fallbackSource: 'env', fallbackValue: 120 })
      expect(result.deviceLogRetentionDays).toEqual({ override: null, value: 30, fallbackSource: 'default', fallbackValue: 30 })
    })

    it('reports an overridden firmwareAutoUpdate with a default fallback source', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, firmwareAutoUpdate: true })

      const result = await service.get()
      expect(result.firmwareAutoUpdate).toEqual({ override: true, value: true, fallbackSource: 'default', fallbackValue: false })
    })
  })

  describe('update', () => {
    it('creates the row on the first save', async () => {
      await service.update({ lowBatteryPercent: 45 })

      expect(repo.create).toHaveBeenCalled()
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, lowBatteryPercent: 45 }))
    })

    it('leaves a Setting absent from the input untouched', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: 45, offlineMultiplier: 5, fetchFailureThreshold: null })

      await service.update({ offlineMultiplier: 6 })

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ lowBatteryPercent: 45, offlineMultiplier: 6, fetchFailureThreshold: null }))
    })

    it('clears an override back to its fallback when given null', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: 45, offlineMultiplier: null, fetchFailureThreshold: null })

      const result = await service.update({ lowBatteryPercent: null })

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ lowBatteryPercent: null }))
      expect(result.lowBatteryPercent).toEqual({ override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 })
    })

    it('does not touch the repository for a Setting never saved', async () => {
      await service.update({})
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    })

    it('saves a Retention age of 0 as an override', async () => {
      const result = await service.update({ alertRetentionDays: 0 })

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ alertRetentionDays: 0 }))
      expect(repo.save).not.toHaveBeenCalledWith(expect.objectContaining({ deviceLogRetentionDays: expect.anything() }))
      expect(result.deviceLogRetentionDays.override).toBeNull()
    })

    it('clears a Retention age override back to its fallback when given null', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, alertRetentionDays: 7, deviceLogRetentionDays: 3 })

      const result = await service.update({ deviceLogRetentionDays: null })

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ alertRetentionDays: 7, deviceLogRetentionDays: null }))
      expect(result.deviceLogRetentionDays).toEqual({ override: null, value: 30, fallbackSource: 'default', fallbackValue: 30 })
    })

    it('saves a firmwareAutoUpdate override', async () => {
      await service.update({ firmwareAutoUpdate: true })
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ firmwareAutoUpdate: true }))
    })

    it('clears a firmwareAutoUpdate override back to its default when given null', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: null, offlineMultiplier: null, fetchFailureThreshold: null, firmwareAutoUpdate: true })

      const result = await service.update({ firmwareAutoUpdate: null })

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ firmwareAutoUpdate: null }))
      expect(result.firmwareAutoUpdate).toEqual({ override: null, value: false, fallbackSource: 'default', fallbackValue: false })
    })
  })
})
