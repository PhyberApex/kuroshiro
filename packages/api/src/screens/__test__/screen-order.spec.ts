import type { Screen } from '../screens.entity.js'
import { describe, expect, it } from 'vitest'
import { asRepository, createMockTransactionalRepository } from '../../test/mockRepository.js'
import { joinEndOfOrder } from '../screen-order.js'

const DEVICE_ID = '00000000-0000-4000-8000-000000000001'

describe('joinEndOfOrder', () => {
  it('locks the Device row before reading the maximum Order, inside the transaction it opens', async () => {
    const screensRepo = createMockTransactionalRepository<Screen>()
    const calls: string[] = []
    screensRepo.manager.query.mockImplementation(async () => {
      calls.push('lock')
    })
    screensRepo.maximum.mockImplementation(async () => {
      calls.push('read-max')
      return 2
    })
    screensRepo.save.mockImplementation(async (screen: Screen) => {
      calls.push('save')
      return screen
    })

    const screen = await joinEndOfOrder(asRepository(screensRepo).manager, DEVICE_ID, { type: 'html', html: 'hi' })

    expect(calls).toEqual(['lock', 'read-max', 'save'])
    expect(screensRepo.manager.query).toHaveBeenCalledWith('SELECT 1 FROM "device" WHERE "id" = $1 FOR UPDATE', [DEVICE_ID])
    expect(screen).toMatchObject({ order: 3, isActive: false, type: 'html', html: 'hi' })
  })

  it('runs inside the transaction already open when the manager given is itself transactional', async () => {
    const screensRepo = createMockTransactionalRepository<Screen>()
    screensRepo.maximum.mockResolvedValue(0)

    await joinEndOfOrder(asRepository(screensRepo).manager, DEVICE_ID, { type: 'html', html: 'hi' })

    expect(screensRepo.manager.transaction).toHaveBeenCalledTimes(1)
  })
})
