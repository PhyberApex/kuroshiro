import type { Device } from '../../devices/devices.entity.js'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../entities/mashup-slot.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { MashupService } from '../mashup.service.js'

describe('mashupService', () => {
  let service: MashupService
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let mashupConfigRepo: ReturnType<typeof createMockRepository<MashupConfiguration>>
  let mashupSlotRepo: ReturnType<typeof createMockRepository<MashupSlot>>
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>

  beforeEach(() => {
    screenRepo = createMockRepository<Screen>()
    deviceRepo = createMockRepository<Device>()
    mashupConfigRepo = createMockRepository<MashupConfiguration>()
    mashupSlotRepo = createMockRepository<MashupSlot>()
    pluginRepo = createMockRepository<Plugin>()

    service = new MashupService(
      asRepository(screenRepo),
      asRepository(deviceRepo),
      asRepository(mashupConfigRepo),
      asRepository(mashupSlotRepo),
      asRepository(pluginRepo),
    )
  })

  describe('update', () => {
    it('answers 404 screen-not-found for a Mashup that does not exist', async () => {
      mashupConfigRepo.findOne.mockResolvedValue(null)

      await expect(service.update('00000000-0000-4000-8000-000000000000', { pluginIds: [] })).rejects.toMatchObject({ code: 'screen-not-found' })
    })

    it('answers 404 screen-not-found for an id that is no UUID without asking the database', async () => {
      await expect(service.update('nonexistent', { pluginIds: [] })).rejects.toMatchObject({ code: 'screen-not-found' })

      expect(mashupConfigRepo.findOne).not.toHaveBeenCalled()
    })
  })
})
