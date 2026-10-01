import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import type { InstanceSettingsService } from '../instance-settings.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { UpdateInstanceSettingsDto } from '../dto/update-instance-settings.dto.js'
import { SettingsController } from '../settings.controller.js'

describe('settingsController', () => {
  let controller: SettingsController
  let service: { get: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = {
      get: vi.fn(),
      update: vi.fn(),
    }
    controller = new SettingsController(asService<InstanceSettingsService>(service))
  })

  describe('get', () => {
    it('calls service.get and returns the result', async () => {
      const response: InstanceSettingsResponse = {
        lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
        offlineMultiplier: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
        fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
        firmwareAutoUpdate: { override: null, value: false, fallbackSource: 'default', fallbackValue: false },
      }
      vi.mocked(service.get).mockResolvedValue(response)

      const result = await controller.get()

      expect(service.get).toHaveBeenCalled()
      expect(result).toBe(response)
    })
  })

  describe('update', () => {
    it('calls service.update with the dto and returns the result', async () => {
      const dto = new UpdateInstanceSettingsDto()
      dto.lowBatteryPercent = 15
      const response = {} as InstanceSettingsResponse
      vi.mocked(service.update).mockResolvedValue(response)

      const result = await controller.update(dto)

      expect(service.update).toHaveBeenCalledWith(dto)
      expect(result).toBe(response)
    })
  })
})
