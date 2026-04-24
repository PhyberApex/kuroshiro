import type { Device } from '../../devices/devices.entity'
import type { Plugin } from '../../plugins/entities/plugin.entity'
import type { Screen } from '../../screens/screens.entity'
import type { CreateMashupDto } from '../dto/create-mashup.dto'
import type { UpdateMashupDto } from '../dto/update-mashup.dto'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity'
import type { MashupSlot } from '../entities/mashup-slot.entity'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MashupService } from '../mashup.service'

function createMockRepo() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
  }
}

describe('mashupService', () => {
  let service: MashupService
  let screenRepo: ReturnType<typeof createMockRepo>
  let deviceRepo: ReturnType<typeof createMockRepo>
  let mashupConfigRepo: ReturnType<typeof createMockRepo>
  let mashupSlotRepo: ReturnType<typeof createMockRepo>
  let pluginRepo: ReturnType<typeof createMockRepo>

  beforeEach(() => {
    screenRepo = createMockRepo()
    deviceRepo = createMockRepo()
    mashupConfigRepo = createMockRepo()
    mashupSlotRepo = createMockRepo()
    pluginRepo = createMockRepo()

    service = new MashupService(
      screenRepo as any,
      deviceRepo as any,
      mashupConfigRepo as any,
      mashupSlotRepo as any,
      pluginRepo as any,
    )

    vi.resetAllMocks()
  })

  describe('create', () => {
    it('should create a mashup with valid data', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'device-1',
        filename: 'My Dashboard',
        layout: '2x2',
        pluginIds: ['plugin-1', 'plugin-2', 'plugin-3', 'plugin-4'],
      }

      const device = { id: 'device-1' } as Device
      const plugins = [
        { id: 'plugin-1' } as Plugin,
        { id: 'plugin-2' } as Plugin,
        { id: 'plugin-3' } as Plugin,
        { id: 'plugin-4' } as Plugin,
      ]

      deviceRepo.findOne.mockResolvedValue(device)
      pluginRepo.findOne.mockImplementation(({ where }) => {
        return Promise.resolve(plugins.find(p => p.id === where.id))
      })

      const screen = { id: 'screen-1', type: 'mashup', filename: dto.filename, device, order: 1, isActive: false } as Screen
      screenRepo.create.mockReturnValue(screen)
      screenRepo.save.mockResolvedValue(screen)
      screenRepo.update.mockResolvedValue(undefined)

      const config = { id: 'config-1', screen, layout: dto.layout, slots: [] } as MashupConfiguration
      mashupConfigRepo.create.mockReturnValue(config)
      mashupConfigRepo.save.mockResolvedValue(config)

      const slot = { id: 'slot-1' } as MashupSlot
      mashupSlotRepo.create.mockReturnValue(slot)
      mashupSlotRepo.save.mockResolvedValue(slot)

      const result = await service.create(dto)

      expect(result).toBe(screen)
      expect(deviceRepo.findOne).toHaveBeenCalledWith({ where: { id: 'device-1' }, relations: ['screens'] })
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

      const device = { id: 'device-1' } as Device
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

      const device = { id: 'device-1' } as Device
      deviceRepo.findOne.mockResolvedValue(device)

      pluginRepo.findOne.mockImplementation(({ where }) => {
        if (where.id === 'nonexistent')
          return Promise.resolve(null)
        return Promise.resolve({ id: where.id } as Plugin)
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

      const device = { id: 'device-1' } as Device
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

      const screen = { id: 'screen-1', type: 'mashup', filename: 'Old Name' } as Screen
      screenRepo.findOne.mockResolvedValue(screen)
      screenRepo.save.mockResolvedValue({ ...screen, filename: dto.filename })

      const oldSlots = [{ id: 'old-slot-1' }, { id: 'old-slot-2' }] as MashupSlot[]
      const config = { id: 'config-1', screen, layout: '2x2', slots: oldSlots } as MashupConfiguration
      mashupConfigRepo.findOne.mockResolvedValue(config)
      mashupConfigRepo.save.mockResolvedValue({ ...config, layout: dto.layout })

      mashupSlotRepo.remove.mockResolvedValue(undefined)

      pluginRepo.findOne.mockImplementation(({ where }) => {
        return Promise.resolve({ id: where.id } as Plugin)
      })

      const slot = { id: 'slot-1' } as MashupSlot
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
  })

  describe('delete', () => {
    it('should delete a mashup and its configuration', async () => {
      const screen = { id: 'screen-1', type: 'mashup' } as Screen
      screenRepo.findOne.mockResolvedValue(screen)

      const config = { id: 'config-1', screen } as MashupConfiguration
      mashupConfigRepo.findOne.mockResolvedValue(config)

      mashupConfigRepo.remove.mockResolvedValue(undefined)
      screenRepo.remove.mockResolvedValue(undefined)

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
      const config = {
        id: 'config-1',
        layout: '2x2',
        slots: [
          { id: 'slot-1', plugin: { id: 'p1', name: 'Plugin 1' } },
          { id: 'slot-2', plugin: { id: 'p2', name: 'Plugin 2' } },
        ],
      } as MashupConfiguration

      mashupConfigRepo.findOne.mockResolvedValue(config)

      const result = await service.getConfiguration('screen-1')

      expect(result).toBe(config)
      expect(mashupConfigRepo.findOne).toHaveBeenCalledWith({
        where: { screen: { id: 'screen-1' } },
        relations: ['slots', 'slots.plugin'],
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
