import type { ScreenReadsService } from '../screen-reads.service.js'
import type { ScreensService } from '../screens.service.js'
import { describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { ScreensController } from '../screens.controller.js'

describe('screensController (unit)', () => {
  it('updateExternalScreen calls service', async () => {
    const service = { updateExternalScreen: vi.fn().mockResolvedValue(undefined) }
    const controller = new ScreensController(asService<ScreensService>(service), asService<ScreenReadsService>({}))

    await expect(controller.updateExternalScreen('1')).resolves.toBeUndefined()

    expect(service.updateExternalScreen).toHaveBeenCalledWith('1')
  })
})
