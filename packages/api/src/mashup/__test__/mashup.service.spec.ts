import type { Device } from '../../devices/devices.entity.js'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../entities/mashup-slot.entity.js'
import type { ScreenRenderService } from '../services/screen-render.service.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMashupConfiguration, makePlugin } from '../../test/fixtures.js'
import { asRepository, createMockRepository, createMockTransactionalRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { MashupService } from '../mashup.service.js'

const SCREEN_ID = '00000000-0000-4000-8000-000000000000'

describe('mashupService', () => {
  let service: MashupService
  let screenRepo: ReturnType<typeof createMockTransactionalRepository<Screen>>
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let mashupConfigRepo: ReturnType<typeof createMockRepository<MashupConfiguration>>
  let mashupSlotRepo: ReturnType<typeof createMockRepository<MashupSlot>>
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let screenRender: { renderAfterSave: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    screenRepo = createMockTransactionalRepository<Screen>()
    deviceRepo = createMockRepository<Device>()
    mashupConfigRepo = createMockRepository<MashupConfiguration>()
    mashupSlotRepo = createMockRepository<MashupSlot>()
    pluginRepo = createMockRepository<Plugin>()
    screenRender = { renderAfterSave: vi.fn().mockResolvedValue(undefined) }

    service = new MashupService(
      asRepository(screenRepo),
      asRepository(deviceRepo),
      asRepository(mashupConfigRepo),
      asRepository(mashupSlotRepo),
      asRepository(pluginRepo),
      asService<ScreenRenderService>(screenRender),
    )
  })

  describe('update', () => {
    it('answers 404 screen-not-found for a Mashup that does not exist', async () => {
      mashupConfigRepo.findOne.mockResolvedValue(null)

      await expect(service.update(SCREEN_ID, { pluginIds: [] })).rejects.toMatchObject({ code: 'screen-not-found' })
    })

    it('answers 404 screen-not-found for an id that is no UUID without asking the database', async () => {
      await expect(service.update('nonexistent', { pluginIds: [] })).rejects.toMatchObject({ code: 'screen-not-found' })

      expect(mashupConfigRepo.findOne).not.toHaveBeenCalled()
    })

    it('starts a background render once the slots are saved, without waiting for it', async () => {
      mashupConfigRepo.findOne.mockResolvedValue(makeMashupConfiguration({ id: 'config-1', layout: '1Lx1R', slots: [] }))
      pluginRepo.findOne.mockResolvedValue(makePlugin({ id: 'plugin-1' }))
      let renderSettled = false
      screenRender.renderAfterSave.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => {
          renderSettled = true
          resolve(undefined)
        }, 10)
      }))

      await service.update(SCREEN_ID, { pluginIds: ['plugin-1', 'plugin-2'] })

      expect(screenRender.renderAfterSave).toHaveBeenCalledWith(SCREEN_ID)
      expect(renderSettled).toBe(false)
    })
  })
})
