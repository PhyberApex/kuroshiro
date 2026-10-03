import type { ScreenReadsService } from '../screen-reads.service.js'
import type { ScreensService } from '../screens.service.js'
import { describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { ScreensController } from '../screens.controller.js'

describe('screensController (unit)', () => {
  it('refresh answers the read of the Screen it refreshed', async () => {
    const service = { refresh: vi.fn().mockResolvedValue('1') }
    const read = { id: '1' }
    const controller = new ScreensController(asService<ScreensService>(service), asService<ScreenReadsService>({ forScreen: vi.fn().mockResolvedValue(read) }))

    await expect(controller.refresh('1')).resolves.toBe(read)

    expect(service.refresh).toHaveBeenCalledWith('1')
  })
})
