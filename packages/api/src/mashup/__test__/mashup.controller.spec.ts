import type { ScreenReadsService } from '../../screens/screen-reads.service.js'
import type { MashupService } from '../mashup.service.js'
import { describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { MashupController } from '../mashup.controller.js'

describe('mashupController', () => {
  it('answers the read of the Mashup it updated', async () => {
    const service = { update: vi.fn().mockResolvedValue('screen-1') }
    const read = { id: 'screen-1' }
    const screenReads = { forScreen: vi.fn().mockResolvedValue(read) }
    const controller = new MashupController(asService<MashupService>(service), asService<ScreenReadsService>(screenReads))
    const input = { layout: '1Lx1R' as const, pluginIds: ['p1', 'p2'] }

    await expect(controller.update('screen-1', input)).resolves.toBe(read)

    expect(service.update).toHaveBeenCalledWith('screen-1', input)
    expect(screenReads.forScreen).toHaveBeenCalledWith('screen-1')
  })
})
