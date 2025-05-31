import type { DeviceDisplayService } from '../display.service'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Display } from '../display'
import { DisplayController } from '../display.controller'

describe('displayController (unit)', () => {
  let controller: DisplayController
  let service: { getCurrentImage: ReturnType<typeof vi.fn>, getCurrentImageWithoutProgressing: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = { getCurrentImage: vi.fn(), getCurrentImageWithoutProgressing: vi.fn() }
    controller = new DisplayController(service as unknown as DeviceDisplayService)
  })

  it('display should return display from service', async () => {
    const headers = { 'id': 'mac', 'access-token': 'token' }
    const display = new Display({
      filename: 'file.bmp',
      firmware_url: '',
      image_url: 'url',
      refresh_rate: 60,
      reset_firmware: false,
      special_function: 'identify',
      update_firmware: false,
    })
    service.getCurrentImage.mockResolvedValue(display)
    const result = await controller.getCurrentImage(headers as any)
    expect(service.getCurrentImage).toHaveBeenCalledWith(headers)
    expect(result).toBe(display)
  })

  it('display should throw if required headers are missing', async () => {
    // Simulate service throwing due to missing headers
    service.getCurrentImage.mockImplementation(() => {
      throw new BadRequestException('Missing headers')
    })
    await expect(controller.getCurrentImage({} as any)).rejects.toThrow(BadRequestException)
  })

  it('current_screen should return display from service', async () => {
    const headers = { 'id': 'mac', 'access-token': 'token' }
    const display = new Display({
      filename: 'file.bmp',
      firmware_url: '',
      image_url: 'url',
      refresh_rate: 60,
      reset_firmware: false,
      special_function: 'identify',
      update_firmware: false,
    })
    service.getCurrentImageWithoutProgressing.mockResolvedValue(display)
    const result = await controller.getCurrentImageWithoutProgressing(headers as any)
    expect(service.getCurrentImageWithoutProgressing).toHaveBeenCalledWith(headers)
    expect(result).toBe(display)
  })

  it('current_screen should throw if required headers are missing', async () => {
    // Simulate service throwing due to missing headers
    service.getCurrentImageWithoutProgressing.mockImplementation(() => {
      throw new BadRequestException('Missing headers')
    })
    await expect(controller.getCurrentImageWithoutProgressing({} as any)).rejects.toThrow(BadRequestException)
  })
})
