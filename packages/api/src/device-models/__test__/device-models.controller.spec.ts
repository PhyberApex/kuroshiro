import type { CustomPalettesService } from '../custom-palettes.service.js'
import type { DeviceModelReadsService } from '../device-model-reads.service.js'
import type { DeviceModelSyncService } from '../device-model-sync.service.js'
import type { CreateCustomPaletteDto } from '../dto/create-custom-palette.dto.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiException } from '../../errors/api.exception.js'
import { CUSTOM_RED_3BWR } from '../../test/mockDeviceModelsService.js'
import { asService } from '../../test/mockService.js'
import { DeviceModelsController } from '../device-models.controller.js'

describe('deviceModelsController', () => {
  let controller: DeviceModelsController
  let reads: { listModels: ReturnType<typeof vi.fn>, listPalettes: ReturnType<typeof vi.fn> }
  let syncService: { sync: ReturnType<typeof vi.fn> }
  let customPalettesService: { create: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    reads = { listModels: vi.fn(), listPalettes: vi.fn() }
    syncService = { sync: vi.fn() }
    customPalettesService = { create: vi.fn(), delete: vi.fn() }
    controller = new DeviceModelsController(
      asService<DeviceModelReadsService>(reads),
      asService<DeviceModelSyncService>(syncService),
      asService<CustomPalettesService>(customPalettesService),
    )
  })

  it('lists device models from the reads service', async () => {
    const list = { lastSync: null, models: [] }
    reads.listModels.mockResolvedValue(list)
    await expect(controller.getAll()).resolves.toBe(list)
  })

  it('lists palettes from the reads service', async () => {
    reads.listPalettes.mockResolvedValue([])
    await expect(controller.getPalettes()).resolves.toEqual([])
  })

  it('returns the sync result', async () => {
    const result = { models: 1, palettes: 1, deprecatedModels: 0, deprecatedPalettes: 0, ranAt: new Date().toISOString() }
    syncService.sync.mockResolvedValue(result)
    await expect(controller.sync()).resolves.toBe(result)
  })

  it('maps a failed sync to 502 upstream-unreachable with the reason', async () => {
    syncService.sync.mockRejectedValue(new Error('TRMNL models request failed: 502 Bad Gateway'))
    const refusal = await controller.sync().catch((error: unknown) => error)
    expect(refusal).toBeInstanceOf(ApiException)
    expect(refusal).toMatchObject({ code: 'upstream-unreachable', details: { reason: 'TRMNL models request failed: 502 Bad Gateway' } })
    expect((refusal as ApiException).getStatus()).toBe(502)
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
