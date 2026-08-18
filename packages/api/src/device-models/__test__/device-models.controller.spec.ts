import type { MockDeviceModelsService } from './mockDeviceModelsService'
import { ServiceUnavailableException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceModelsController } from '../device-models.controller'
import { BW, createMockDeviceModelsService, OG_PLUS } from './mockDeviceModelsService'

describe('deviceModelsController', () => {
  let controller: DeviceModelsController
  let deviceModels: MockDeviceModelsService
  let syncService: { sync: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    deviceModels = createMockDeviceModelsService()
    syncService = { sync: vi.fn() }
    controller = new DeviceModelsController(deviceModels as any, syncService as any)
  })

  it('lists device models', async () => {
    deviceModels.findAll.mockResolvedValue([OG_PLUS])
    await expect(controller.getAll()).resolves.toEqual([OG_PLUS])
  })

  it('lists palettes', async () => {
    deviceModels.findAllPalettes.mockResolvedValue([BW])
    await expect(controller.getPalettes()).resolves.toEqual([BW])
  })

  it('returns the sync result', async () => {
    const result = { models: 1, palettes: 1, deprecatedModels: 0, deprecatedPalettes: 0, syncedAt: new Date() }
    syncService.sync.mockResolvedValue(result)
    await expect(controller.sync()).resolves.toBe(result)
  })

  it('maps a failed sync to 503', async () => {
    syncService.sync.mockRejectedValue(new Error('TRMNL models request failed: 502 Bad Gateway'))
    await expect(controller.sync()).rejects.toThrow(ServiceUnavailableException)
  })
})
