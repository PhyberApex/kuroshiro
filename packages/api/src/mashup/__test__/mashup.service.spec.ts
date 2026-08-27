import type { Device } from '../../devices/devices.entity'
import type { Plugin } from '../../plugins/entities/plugin.entity'
import type { Screen } from '../../screens/screens.entity'
import type { CreateMashupDto } from '../dto/create-mashup.dto'
import type { UpdateMashupDto } from '../dto/update-mashup.dto'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity'
import type { MashupSlot } from '../entities/mashup-slot.entity'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeDevice, makeMashupConfiguration, makeMashupSlot, makePlugin, makeScreen } from '../../test/fixtures'
import { asRepository, createMockRepository, whereId } from '../../test/mockRepository'
import { MashupService } from '../mashup.service'

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

  describe('create', () => {
    it('should create a mashup with valid data', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'device-1',
        filename: 'My Dashboard',
        layout: '2x2',
        pluginIds: ['plugin-1', 'plugin-2', 'plugin-3', 'plugin-4'],
      }

      const device = makeDevice({ id: 'device-1' })
      const plugins = [
        makePlugin({ id: 'plugin-1' }),
        makePlugin({ id: 'plugin-2' }),
        makePlugin({ id: 'plugin-3' }),
        makePlugin({ id: 'plugin-4' }),
      ]

      deviceRepo.findOne.mockResolvedValue(device)
      pluginRepo.findOne.mockImplementation(async options =>
        plugins.find(p => p.id === whereId(options)) ?? null)

      const screen = makeScreen({ id: 'screen-1', type: 'mashup', filename: dto.filename, device, order: 1, isActive: false })
      screenRepo.create.mockReturnValue(screen)
      screenRepo.save.mockResolvedValue(screen)
      screenRepo.update.mockResolvedValue({ raw: [], generatedMaps: [] })

      const config = makeMashupConfiguration({ id: 'config-1', screen, layout: dto.layout, slots: [] })
      mashupConfigRepo.create.mockReturnValue(config)
      mashupConfigRepo.save.mockResolvedValue(config)

      const slot = makeMashupSlot({ id: 'slot-1' })
      mashupSlotRepo.create.mockReturnValue(slot)
      mashupSlotRepo.save.mockResolvedValue(slot)

      const result = await service.create(dto)

      expect(result).toBe(screen)
      expect(deviceRepo.findOne).toHaveBeenCalledWith({ where: { id: 'device-1' }, relations: { screens: true } })
      expect(pluginRepo.findOne).toHaveBeenCalledTimes(4)
      expect(screenRepo.create).toHaveBeenCalled()
      expect(mashupConfigRepo.create).toHaveBeenCalled()
      expect(mashupSlotRepo.create).toHaveBeenCalledTimes(4)
    })

    it('should throw NotFoundException if device not found', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'nonexistent',
        filename: 'Test',
        layout: '2x2',
        pluginIds: ['p1', 'p2', 'p3', 'p4'],
      }

      deviceRepo.findOne.mockResolvedValue(null)

      await expect(service.create(dto)).rejects.toThrow(NotFoundException)
      await expect(service.create(dto)).rejects.toThrow('Device not found')
    })

    it('should throw BadRequestException if plugin count does not match layout', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'device-1',
        filename: 'Test',
        layout: '2x2',
        pluginIds: ['p1', 'p2'], // only 2 plugins, but 2x2 needs 4
      }

      const device = makeDevice({ id: 'device-1' })
      deviceRepo.findOne.mockResolvedValue(device)

      await expect(service.create(dto)).rejects.toThrow(BadRequestException)
      await expect(service.create(dto)).rejects.toThrow('2x2 requires 4 plugins')
    })

    it('should throw NotFoundException if any plugin not found', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'device-1',
        filename: 'Test',
        layout: '2x2',
        pluginIds: ['p1', 'p2', 'p3', 'nonexistent'],
      }

      const device = makeDevice({ id: 'device-1' })
      deviceRepo.findOne.mockResolvedValue(device)

      pluginRepo.findOne.mockImplementation(async (options) => {
        const id = whereId(options)
        if (id === 'nonexistent')
          return null
        return makePlugin({ id })
      })

      await expect(service.create(dto)).rejects.toThrow(NotFoundException)
      await expect(service.create(dto)).rejects.toThrow('Plugin nonexistent not found')
    })

    it('should throw BadRequestException if duplicate plugins', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'device-1',
        filename: 'Test',
        layout: '2x2',
        pluginIds: ['p1', 'p2', 'p3', 'p1'], // duplicate p1
      }

      const device = makeDevice({ id: 'device-1' })
      deviceRepo.findOne.mockResolvedValue(device)

      await expect(service.create(dto)).rejects.toThrow(BadRequestException)
      await expect(service.create(dto)).rejects.toThrow('Cannot use the same plugin multiple times')
    })
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

    it('should throw BadRequestException with the unified message if plugin count does not match layout', async () => {
      const dto: UpdateMashupDto = {
        layout: '2x2',
        pluginIds: ['p1', 'p2'], // only 2 plugins, but 2x2 needs 4
      }

      const screen = makeScreen({ id: 'screen-1', type: 'mashup' })
      screenRepo.findOne.mockResolvedValue(screen)

      const config = makeMashupConfiguration({ id: 'config-1', screen, layout: '1Lx1R', slots: [] })
      mashupConfigRepo.findOne.mockResolvedValue(config)

      await expect(service.update('screen-1', dto)).rejects.toThrow(BadRequestException)
      await expect(service.update('screen-1', dto)).rejects.toThrow('2x2 requires 4 plugins, but 2 were provided')
    })
  })

  describe('delete', () => {
    it('should delete a mashup and its configuration', async () => {
      const screen = makeScreen({ id: 'screen-1', type: 'mashup' })
      screenRepo.findOne.mockResolvedValue(screen)

      const config = makeMashupConfiguration({ id: 'config-1', screen })
      mashupConfigRepo.findOne.mockResolvedValue(config)

      mashupConfigRepo.remove.mockResolvedValue(config)
      screenRepo.remove.mockResolvedValue(screen)

      await expect(service.delete('screen-1')).resolves.toBeUndefined()
      expect(mashupConfigRepo.remove).toHaveBeenCalledWith(config)
      expect(screenRepo.remove).toHaveBeenCalledWith(screen)
    })

    it('should throw NotFoundException if screen not found', async () => {
      screenRepo.findOne.mockResolvedValue(null)

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException)
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
