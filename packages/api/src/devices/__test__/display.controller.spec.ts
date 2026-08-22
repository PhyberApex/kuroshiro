import type { DeviceDisplayService } from '../display.service'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService'
import { Display } from '../display'
import { DisplayController } from '../display.controller'

describe('displayController (unit)', () => {
  let controller: DisplayController
  let service: { getCurrentImage: ReturnType<typeof vi.fn>, getCurrentImageWithoutProgressing: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = { getCurrentImage: vi.fn(), getCurrentImageWithoutProgressing: vi.fn() }
    controller = new DisplayController(asService<DeviceDisplayService>(service))
  })

  it('display should return display from service', async () => {
    const headers = { 'id': 'mac', 'access-token': 'token' }
    const display = new Display({
      action: 'identify',
      filename: 'file.png',
      firmware_url: '',
      image_url: 'url',
      refresh_rate: 60,
      reset_firmware: false,
      special_function: 'identify',
      temperature_profile: 'default',
      update_firmware: false,
    })
    service.getCurrentImage.mockResolvedValue(display)
    const result = await controller.getCurrentImage(headers)
    expect(service.getCurrentImage).toHaveBeenCalledWith(headers)
    expect(result).toBe(display)
  })

  it('display should throw if required headers are missing', async () => {
    // Simulate service throwing due to missing headers
    service.getCurrentImage.mockImplementation(() => {
      throw new BadRequestException('Missing headers')
    })
    // @ts-expect-error deliberately missing the required id/access-token headers
    await expect(controller.getCurrentImage({})).rejects.toThrow(BadRequestException)
  })

  it('current_screen should return display from service', async () => {
    const headers = { 'id': 'mac', 'access-token': 'token' }
    const display = new Display({
      action: 'identify',
      filename: 'file.png',
      firmware_url: '',
      image_url: 'url',
      refresh_rate: 60,
      reset_firmware: false,
      special_function: 'identify',
      temperature_profile: 'default',
      update_firmware: false,
    })
    service.getCurrentImageWithoutProgressing.mockResolvedValue(display)
    const result = await controller.getCurrentImageWithoutProgressing(headers)
    expect(service.getCurrentImageWithoutProgressing).toHaveBeenCalledWith(headers)
    expect(result).toBe(display)
  })

  it('current_screen should throw if required headers are missing', async () => {
    // Simulate service throwing due to missing headers
    service.getCurrentImageWithoutProgressing.mockImplementation(() => {
      throw new BadRequestException('Missing headers')
    })
    // @ts-expect-error deliberately missing the required id/access-token headers
    await expect(controller.getCurrentImageWithoutProgressing({})).rejects.toThrow(BadRequestException)
  })
})
