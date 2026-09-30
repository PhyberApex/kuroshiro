import type { ConfigService } from '@nestjs/config'
import type { InstanceSettings } from '../entities/instance-settings.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { InstanceSettingsService } from '../instance-settings.service.js'

function makeConfigService(): ConfigService {
  const alerts = {
    lowBatteryPercent: 20,
    lowBatteryPercentSource: 'default' as const,
    offlineMultiplier: 3,
    offlineMultiplierSource: 'default' as const,
    fetchFailureThreshold: 3,
    fetchFailureThresholdSource: 'default' as const,
  }
  return { get: (key: string) => (key === 'alerts' ? alerts : undefined) } as unknown as ConfigService
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

  describe('get', () => {
    it('reports every Setting unoverridden as falling back to the built-in default when no row exists', async () => {
      await expect(service.get()).resolves.toEqual({
        lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
        offlineMultiplier: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
        fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
      })
    })

    it('reports the env value as the fallback when the env var is set', async () => {
      configService = { get: () => ({ lowBatteryPercent: 15, lowBatteryPercentSource: 'env', offlineMultiplier: 3, offlineMultiplierSource: 'default', fetchFailureThreshold: 3, fetchFailureThresholdSource: 'default' }) } as unknown as ConfigService
      service = new InstanceSettingsService(asRepository(repo), configService)

      const result = await service.get()
      expect(result.lowBatteryPercent).toEqual({ override: null, value: 15, fallbackSource: 'env', fallbackValue: 15 })
    })

    it('reports an override alongside the fallback it would otherwise use', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, lowBatteryPercent: 45, offlineMultiplier: null, fetchFailureThreshold: null })

      const result = await service.get()
      expect(result.lowBatteryPercent).toEqual({ override: 45, value: 45, fallbackSource: 'default', fallbackValue: 20 })
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
  })
})
