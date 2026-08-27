import type { MockDeviceModelsService } from '../../test/mockDeviceModelsService'
import type { CustomPalettesService } from '../custom-palettes.service'
import type { DeviceModelSyncService } from '../device-model-sync.service'
import type { DeviceModelsService } from '../device-models.service'
import type { CreateCustomPaletteDto } from '../dto/create-custom-palette.dto'
import { ServiceUnavailableException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BW, createMockDeviceModelsService, CUSTOM_RED_3BWR, OG_PLUS } from '../../test/mockDeviceModelsService'
import { asService } from '../../test/mockService'
import { DeviceModelsController } from '../device-models.controller'

describe('deviceModelsController', () => {
  let controller: DeviceModelsController
  let deviceModels: MockDeviceModelsService
  let syncService: { sync: ReturnType<typeof vi.fn> }
  let customPalettesService: { create: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    deviceModels = createMockDeviceModelsService()
    syncService = { sync: vi.fn() }
    customPalettesService = { create: vi.fn(), delete: vi.fn() }
    controller = new DeviceModelsController(
      asService<DeviceModelsService>(deviceModels),
      asService<DeviceModelSyncService>(syncService),
      asService<CustomPalettesService>(customPalettesService),
    )
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
    const result = { models: 1, palettes: 1, deprecatedModels: 0, deprecatedPalettes: 0, syncedAt: new Date().toISOString() }
    syncService.sync.mockResolvedValue(result)
    await expect(controller.sync()).resolves.toBe(result)
  })

  it('maps a failed sync to 503', async () => {
    syncService.sync.mockRejectedValue(new Error('TRMNL models request failed: 502 Bad Gateway'))
    await expect(controller.sync()).rejects.toThrow(ServiceUnavailableException)
  })

  it('delegates palette creation to CustomPalettesService', async () => {
    const dto: CreateCustomPaletteDto = { name: 'My Red', frameworkClass: 'screen--color-3bwr', colors: ['#ff0000'] }
    customPalettesService.create.mockResolvedValue(CUSTOM_RED_3BWR)
    await expect(controller.createPalette(dto)).resolves.toBe(CUSTOM_RED_3BWR)
    expect(customPalettesService.create).toHaveBeenCalledWith(dto)
  })

  it('delegates palette deletion to CustomPalettesService', async () => {
    customPalettesService.delete.mockResolvedValue(undefined)
    await controller.deletePalette(CUSTOM_RED_3BWR.id)
    expect(customPalettesService.delete).toHaveBeenCalledWith(CUSTOM_RED_3BWR.id)
  })
})
