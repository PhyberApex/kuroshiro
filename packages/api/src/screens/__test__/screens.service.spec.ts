import type { Device } from '../../devices/devices.entity'
import type { CreateScreenDto } from '../dto/create-screen.dto'
import type { Screen } from '../screens.entity'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ScreensService } from '../screens.service'

vi.mock('../../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToMonochromeBmp: vi.fn().mockResolvedValue(undefined),
}))

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

describe('screensService', () => {
  let service: ScreensService
  let screensRepo: ReturnType<typeof createMockRepo>
  let devicesRepo: ReturnType<typeof createMockRepo>
  let unlinkMock: any

  beforeEach(() => {
    screensRepo = createMockRepo()
    devicesRepo = createMockRepo()
    service = new ScreensService(
      screensRepo as any,
      devicesRepo as any,
    )
    vi.resetAllMocks()
    unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
  })

  it('getAll returns all screens', async () => {
    const screens = [{ id: '1' } as Screen]
    screensRepo.find.mockResolvedValue(screens)
    const result = await service.getAll()
    expect(result).toBe(screens)
  })

  it('add throws if both file and externalLink are provided', async () => {
    const dto: CreateScreenDto = { filename: 'file', deviceId: 'dev', externalLink: 'url', fetchManual: false, html: '' }
    await expect(service.add(dto, { buffer: buffer.Buffer.from('data') })).rejects.toThrow()
  })

  it('add throws if neither file nor externalLink is provided', async () => {
    const dto: CreateScreenDto = { filename: 'file', deviceId: 'dev', fetchManual: false, html: '' }
    await expect(service.add(dto, undefined)).rejects.toThrow()
  })

  it('add creates a screen with file', async () => {
    const device = { id: 'dev', screens: [], width: 100, height: 100 } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screen = { id: '1', filename: 'file', device, order: 1, isActive: false } as Screen
    screensRepo.create.mockReturnValue(screen)
    screensRepo.save.mockResolvedValue(screen)
    screensRepo.update.mockResolvedValue(undefined)
    const file = { buffer: buffer.Buffer.from('data') }
    const result = await service.add({ filename: 'file', deviceId: 'dev', fetchManual: false, html: '' }, file)
    expect(result).toBe(screen)
    expect(screensRepo.save).toHaveBeenCalledWith(screen)
  })

  it('add creates a screen with externalLink and fetchManual', async () => {
    const device = { id: 'dev', screens: [], width: 100, height: 100 } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screen = { id: '1', filename: 'file', device, order: 1, isActive: false } as Screen
    screensRepo.create.mockReturnValue(screen)
    screensRepo.save.mockResolvedValue(screen)
    screensRepo.update.mockResolvedValue(undefined)
    const dto: CreateScreenDto = {
      filename: 'file',
      deviceId: 'dev',
      externalLink: 'url',
      fetchManual: true,
      html: '',
    }
    const result = await service.add(dto, undefined)
    expect(result).toBe(screen)
    expect(screensRepo.save).toHaveBeenCalledWith(screen)
  })

  it('getByDevice returns screens for a device', async () => {
    const screens = [{ id: '1' } as Screen]
    screensRepo.find.mockResolvedValue(screens)
    const result = await service.getByDevice('dev')
    expect(result).toBe(screens)
  })

  it('delete removes a screen and reindexes', async () => {
    const device = { id: 'dev' } as Device
    const screen = { id: '1', device } as Screen
    screensRepo.findOne.mockResolvedValue({ ...screen, device })
    screensRepo.delete.mockResolvedValue(undefined)
    screensRepo.find.mockResolvedValue([{ id: '2', order: 2, device } as Screen])
    screensRepo.save.mockResolvedValue(undefined)
    await expect(service.delete('1')).resolves.toBeUndefined()
    expect(screensRepo.delete).toHaveBeenCalledWith('1')
    expect(screensRepo.save).toHaveBeenCalled()
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('public/screens/devices/dev/1.bmp'))
  })

  it('updateExternalScreen refetches and converts image', async () => {
    const device = { id: 'dev', width: 100, height: 100 } as Device
    const screen = { id: '1', device, externalLink: 'url', fetchManual: true } as Screen
    screensRepo.findOne.mockResolvedValue(screen)
    await expect(service.updateExternalScreen('1')).resolves.toBeUndefined()
  })

  it('updateExternalScreen throws if not found', async () => {
    screensRepo.findOne.mockResolvedValue(null)
    await expect(service.updateExternalScreen('1')).rejects.toThrow()
  })
})
