import type { DeviceModelReadsService } from '../device-model-reads.service.js'
import type { DeviceModelSyncService } from '../device-model-sync.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiException } from '../../errors/api.exception.js'
import { asService } from '../../test/mockService.js'
import { DeviceModelsController } from '../device-models.controller.js'

describe('deviceModelsController', () => {
  let controller: DeviceModelsController
  let reads: { listModels: ReturnType<typeof vi.fn>, listPalettes: ReturnType<typeof vi.fn> }
  let syncService: { sync: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    reads = { listModels: vi.fn(), listPalettes: vi.fn() }
    syncService = { sync: vi.fn() }
    controller = new DeviceModelsController(
      asService<DeviceModelReadsService>(reads),
      asService<DeviceModelSyncService>(syncService),
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
})
