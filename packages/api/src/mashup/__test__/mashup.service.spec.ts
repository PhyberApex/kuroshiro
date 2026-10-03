import type { Device } from '../../devices/devices.entity.js'
import type { Plugin } from '../../plugins/entities/plugin.entity.js'
import type { Screen } from '../../screens/screens.entity.js'
import type { UpdateMashupDto } from '../dto/update-mashup.dto.js'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../entities/mashup-slot.entity.js'
import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeMashupConfiguration, makeMashupSlot, makePlugin, makeScreen } from '../../test/fixtures.js'
import { asRepository, createMockRepository, whereId } from '../../test/mockRepository.js'
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
    it('should update a mashup successfully', async () => {
      const dto: UpdateMashupDto = {
        filename: 'Updated Dashboard',
        layout: '1Lx1R',
        pluginIds: ['p1', 'p2'],
      }

      const screen = makeScreen({ id: 'screen-1', type: 'mashup', filename: 'Old Name' })
      screenRepo.findOne.mockResolvedValue(screen)
      screenRepo.save.mockResolvedValue({ ...screen, filename: dto.filename ?? screen.filename })

      const oldSlots = [makeMashupSlot({ id: 'old-slot-1' }), makeMashupSlot({ id: 'old-slot-2' })]
      const config = makeMashupConfiguration({ id: 'config-1', screen, layout: '2x2', slots: oldSlots })
      mashupConfigRepo.findOne.mockResolvedValue(config)
      mashupConfigRepo.save.mockResolvedValue({ ...config, layout: dto.layout ?? config.layout })

      mashupSlotRepo.remove.mockResolvedValue([])

      pluginRepo.findOne.mockImplementation(async options => makePlugin({ id: whereId(options) }))

      const slot = makeMashupSlot({ id: 'slot-1' })
      mashupSlotRepo.create.mockReturnValue(slot)
      mashupSlotRepo.save.mockResolvedValue(slot)

      const result = await service.update('screen-1', dto)

      expect(result.filename).toBe('Updated Dashboard')
      expect(mashupSlotRepo.remove).toHaveBeenCalled()
      expect(mashupSlotRepo.create).toHaveBeenCalledTimes(2)
    })

    it('should throw NotFoundException if screen not found', async () => {
      screenRepo.findOne.mockResolvedValue(null)

      await expect(service.update('nonexistent', {})).rejects.toThrow(NotFoundException)
    })

    it('refuses a plugin count that does not match the layout, naming pluginIds', async () => {
      const dto: UpdateMashupDto = {
        layout: '2x2',
        pluginIds: ['p1', 'p2'], // only 2 plugins, but 2x2 needs 4
      }

      const screen = makeScreen({ id: 'screen-1', type: 'mashup' })
      screenRepo.findOne.mockResolvedValue(screen)

      const config = makeMashupConfiguration({ id: 'config-1', screen, layout: '1Lx1R', slots: [] })
      mashupConfigRepo.findOne.mockResolvedValue(config)

      await expect(service.update('screen-1', dto)).rejects.toMatchObject({
        fields: [{ path: 'pluginIds', message: '2x2 requires 4 plugins, but 2 were provided' }],
      })
    })
  })

  describe('getConfiguration', () => {
    it('should return mashup configuration with slots and plugins', async () => {
      const config = makeMashupConfiguration({
        id: 'config-1',
        layout: '2x2',
        slots: [
          makeMashupSlot({ id: 'slot-1', plugin: makePlugin({ id: 'p1', name: 'Plugin 1' }) }),
          makeMashupSlot({ id: 'slot-2', plugin: makePlugin({ id: 'p2', name: 'Plugin 2' }) }),
        ],
      })

      mashupConfigRepo.findOne.mockResolvedValue(config)

      const result = await service.getConfiguration('screen-1')

      expect(result).toBe(config)
      expect(mashupConfigRepo.findOne).toHaveBeenCalledWith({
        where: { screen: { id: 'screen-1' } },
        relations: { slots: { plugin: true } },
      })
    })

    it('should throw NotFoundException if configuration not found', async () => {
      mashupConfigRepo.findOne.mockResolvedValue(null)

      await expect(service.getConfiguration('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getLayouts', () => {
    it('should return layout configuration', () => {
      const layouts = service.getLayouts()

      expect(layouts).toHaveProperty('1Lx1R')
      expect(layouts).toHaveProperty('2x2')
      expect(layouts['2x2']).toHaveLength(4)
      expect(layouts['1Lx1R']).toHaveLength(2)
    })
  })
})
