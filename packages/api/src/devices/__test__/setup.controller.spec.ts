import type { DeviceSetupService } from '../setup.service'
import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetupController } from '../setup.controller'

describe('setupController (unit)', () => {
  let controller: SetupController
  let service: { setupDevice: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = { setupDevice: vi.fn() }
    controller = new SetupController(service as unknown as DeviceSetupService)
  })

  it('should return setup response from service', async () => {
    const headers = { id: 'mac' }
    const response = {
      status: 200,
      image_url: 'url',
      message: 'Welcome',
      api_key: 'key',
      friendly_id: 'friendly',
    }
    service.setupDevice.mockResolvedValue(response)
    const result = await controller.setupDevice(headers as any)
    expect(service.setupDevice).toHaveBeenCalledWith(headers)
    expect(result).toBe(response)
  })

  it('should throw if required headers are missing', async () => {
    service.setupDevice.mockImplementation(() => {
      throw new BadRequestException('Missing headers')
    })
    await expect(controller.setupDevice({} as any)).rejects.toThrow(BadRequestException)
  })
})
