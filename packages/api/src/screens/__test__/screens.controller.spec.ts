import type { ConfigService } from '@nestjs/config'
import type { CreateScreenDto } from '../dto/create-screen.dto'
import type { Screen } from '../screens.entity'
import type { ScreensService } from '../screens.service'
import buffer from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreensController } from '../screens.controller'

function createMockService() {
  return {
    getAll: vi.fn(),
    add: vi.fn(),
    getByDevice: vi.fn(),
    delete: vi.fn(),
    updateExternalScreen: vi.fn(),
  }
}

describe('screensController (unit)', () => {
  let controller: ScreensController
  let service: ReturnType<typeof createMockService>
  let configService: { get: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    service = createMockService()
    configService = { get: vi.fn() }
    controller = new ScreensController(service as unknown as ScreensService, configService as unknown as ConfigService)
  })

  it('getAll returns all screens', async () => {
    const screens = [{ id: '1' } as Screen]
    service.getAll.mockResolvedValue(screens)
    const result = await controller.getAll()
    expect(result).toBe(screens)
  })

  it('add creates a screen', async () => {
    const dto: CreateScreenDto = { filename: 'file', deviceId: 'dev', fetchManual: false }
    const file = { buffer: buffer.Buffer.from('data') }
    const screen = { id: '1', filename: 'file' } as Screen
    service.add.mockResolvedValue(screen)
    configService.get.mockReturnValue(false)
    const result = await controller.add(dto, file)
    expect(service.add).toHaveBeenCalledWith(dto, file)
    expect(result).toBe(screen)
  })

  it('getByDevice returns screens for a device', async () => {
    const screens = [{ id: '1' } as Screen]
    service.getByDevice.mockResolvedValue(screens)
    const result = await controller.getByDevice('dev')
    expect(service.getByDevice).toHaveBeenCalledWith('dev')
    expect(result).toBe(screens)
  })

  it('delete calls service delete', async () => {
    service.delete.mockResolvedValue(undefined)
    await expect(controller.delete('1')).resolves.toBeUndefined()
    expect(service.delete).toHaveBeenCalledWith('1')
  })

  it('updateExternalScreen calls service', async () => {
    service.updateExternalScreen.mockResolvedValue(undefined)
    await expect(controller.updateExternalScreen('1')).resolves.toBeUndefined()
    expect(service.updateExternalScreen).toHaveBeenCalledWith('1')
  })
})
