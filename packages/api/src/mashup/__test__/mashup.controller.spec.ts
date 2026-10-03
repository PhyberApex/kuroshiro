import type { ScreenReadsService } from '../../screens/screen-reads.service.js'
import type { UpdateMashupDto } from '../dto/update-mashup.dto.js'
import type { MashupService } from '../mashup.service.js'
import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { MashupController } from '../mashup.controller.js'

describe('mashupController', () => {
  let controller: MashupController
  let mockService: { update: ReturnType<typeof vi.fn>, getConfiguration: ReturnType<typeof vi.fn>, getLayouts: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockService = {
      update: vi.fn(),
      getConfiguration: vi.fn(),
      getLayouts: vi.fn(),
    }

    controller = new MashupController(asService<MashupService>(mockService), asService<ScreenReadsService>({}))
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
