import type { CreateMashupDto } from '../dto/create-mashup.dto'
import type { UpdateMashupDto } from '../dto/update-mashup.dto'
import type { MashupService } from '../mashup.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MashupController } from '../mashup.controller'

describe('mashupController', () => {
  let controller: MashupController
  let mockService: MashupService

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getConfiguration: vi.fn(),
      getLayouts: vi.fn(),
    } as any

    controller = new MashupController(mockService)
  })

  describe('create', () => {
    it('should create a mashup', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'device-1',
        filename: 'Dashboard',
        layout: '2x2',
        pluginIds: ['p1', 'p2', 'p3', 'p4'],
      }

      const screen = { id: 'screen-1', type: 'mashup', filename: 'Dashboard' }
      mockService.create = vi.fn().mockResolvedValue(screen)

      const result = await controller.create(dto)

      expect(mockService.create).toHaveBeenCalledWith(dto)
      expect(result).toBe(screen)
    })

    it('should throw BadRequestException on validation error', async () => {
      const dto: CreateMashupDto = {
        deviceId: 'device-1',
        filename: 'Dashboard',
        layout: '2x2',
        pluginIds: ['p1', 'p2'], // wrong count
      }

      mockService.create = vi.fn().mockRejectedValue(new BadRequestException('2x2 requires 4 plugins'))

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException)
    })
  })

  describe('update', () => {
    it('should update a mashup', async () => {
      const dto: UpdateMashupDto = {
        filename: 'Updated Dashboard',
        layout: '1Lx1R',
        pluginIds: ['p1', 'p2'],
      }

      const screen = { id: 'screen-1', filename: 'Updated Dashboard' }
      mockService.update = vi.fn().mockResolvedValue(screen)

      const result = await controller.update('screen-1', dto)

      expect(mockService.update).toHaveBeenCalledWith('screen-1', dto)
      expect(result).toBe(screen)
    })

    it('should throw NotFoundException if screen not found', async () => {
      mockService.update = vi.fn().mockRejectedValue(new NotFoundException('Mashup screen not found'))

      await expect(controller.update('nonexistent', {})).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('should delete a mashup', async () => {
      mockService.delete = vi.fn().mockResolvedValue(undefined)

      await controller.delete('screen-1')

      expect(mockService.delete).toHaveBeenCalledWith('screen-1')
    })

    it('should throw NotFoundException if screen not found', async () => {
      mockService.delete = vi.fn().mockRejectedValue(new NotFoundException('Mashup screen not found'))

      await expect(controller.delete('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getConfiguration', () => {
    it('should return mashup configuration', async () => {
      const config = {
        id: 'config-1',
        layout: '2x2',
        slots: [
          { id: 'slot-1', plugin: { id: 'p1', name: 'Weather' } },
        ],
      }

      mockService.getConfiguration = vi.fn().mockResolvedValue(config)

      const result = await controller.getConfiguration('screen-1')

      expect(mockService.getConfiguration).toHaveBeenCalledWith('screen-1')
      expect(result).toBe(config)
    })

    it('should throw NotFoundException if configuration not found', async () => {
      mockService.getConfiguration = vi.fn().mockRejectedValue(new NotFoundException('Mashup configuration not found'))

      await expect(controller.getConfiguration('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getLayouts', () => {
    it('should return layout configuration', () => {
      const layouts = {
        '1Lx1R': [{ position: 'left', size: 'view--half_vertical', order: 0 }],
        '2x2': [{ position: 'top-left', size: 'view--quadrant', order: 0 }],
      }

      mockService.getLayouts = vi.fn().mockReturnValue(layouts)

      const result = controller.getLayouts()

      expect(mockService.getLayouts).toHaveBeenCalled()
      expect(result).toBe(layouts)
    })
  })
})
