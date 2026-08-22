import type { MockDeviceModelsService } from '../../device-models/__test__/mockDeviceModelsService'
import type { Device } from '../../devices/devices.entity'
import type { CreateScreenDto } from '../dto/create-screen.dto'
import type { Screen } from '../screens.entity'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../device-models/__test__/mockDeviceModelsService'
import { ScreensService } from '../screens.service'

const { fileExistsMock } = vi.hoisted(() => ({ fileExistsMock: vi.fn() }))

vi.mock('../../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/fileExists', () => ({ fileExists: fileExistsMock }))

function createMockRepo() {
  const repo: any = {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
  }
  repo.manager = {
    getRepository: vi.fn(() => repo),
    transaction: vi.fn(async (cb: (manager: any) => Promise<void>) => cb(repo.manager)),
  }
  return repo
}

describe('screensService', () => {
  let service: ScreensService
  let screensRepo: ReturnType<typeof createMockRepo>
  let devicesRepo: ReturnType<typeof createMockRepo>
  let unlinkMock: any
  let deviceModels: MockDeviceModelsService
  const mockConfigService = { get: vi.fn().mockReturnValue(false) }

  beforeEach(() => {
    screensRepo = createMockRepo()
    devicesRepo = createMockRepo()
    deviceModels = createMockDeviceModelsService()
    service = new ScreensService(
      screensRepo as any,
      devicesRepo as any,
      mockConfigService as any,
      deviceModels as any,
    )
    vi.resetAllMocks()
    primeMockDeviceModelsService(deviceModels)
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
    await expect(service.add(dto, { buffer: buffer.Buffer.from('data') } as Express.Multer.File)).rejects.toThrow()
  })

  it('add throws if neither file nor externalLink is provided', async () => {
    const dto: CreateScreenDto = { filename: 'file', deviceId: 'dev', fetchManual: false, html: '' }
    await expect(service.add(dto, undefined)).rejects.toThrow()
  })

  it('add creates a screen with file', async () => {
    const device = { id: 'dev', screens: [], width: 100, height: 100 } as unknown as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screen = { id: '1', filename: 'file', device, order: 1, isActive: false } as Screen
    screensRepo.create.mockReturnValue(screen)
    screensRepo.save.mockResolvedValue(screen)
    screensRepo.update.mockResolvedValue(undefined)
    const file = { buffer: buffer.Buffer.from('data') } as Express.Multer.File
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined)
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined)
    const result = await service.add({ filename: 'file', deviceId: 'dev', fetchManual: false, html: '' }, file)
    expect(result).toBe(screen)
    expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('public/screens/devices/dev/1.original'), file.buffer)
    expect(unlinkMock).not.toHaveBeenCalled()
    expect(screensRepo.save).toHaveBeenCalledWith(screen)
    expect(screensRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'file' }))
  })

  it('add creates a screen with html', async () => {
    const device = { id: 'dev', screens: [], width: 100, height: 100 } as unknown as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screen = { id: '1', html: '<div>hi</div>', device, order: 1, isActive: false } as Screen
    screensRepo.create.mockReturnValue(screen)
    screensRepo.save.mockResolvedValue(screen)
    screensRepo.update.mockResolvedValue(undefined)
    const result = await service.add({ filename: 'file', deviceId: 'dev', fetchManual: false, html: '<div>hi</div>' }, undefined)
    expect(result).toBe(screen)
    expect(screensRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'html' }))
  })

  it('add creates a screen with externalLink and fetchManual', async () => {
    const device = { id: 'dev', screens: [], width: 100, height: 100 } as unknown as Device
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
    expect(screensRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'external' }))
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
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('public/screens/devices/dev/1.png'))
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('public/screens/devices/dev/1.original'))
  })

  it('updateExternalScreen refetches into the retained original and converts it', async () => {
    const device = { id: 'dev', width: 100, height: 100 } as Device
    const screen = { id: '1', device, externalLink: 'url', fetchManual: true } as Screen
    screensRepo.findOne.mockResolvedValue(screen)
    await expect(service.updateExternalScreen('1')).resolves.toBeUndefined()
    const { downloadImage, convertToPng } = await import('../../utils/imageUtils.js')
    expect(downloadImage).toHaveBeenCalledWith('url', expect.stringContaining('public/screens/devices/dev/1.original'), expect.any(Object))
    expect(convertToPng).toHaveBeenCalledWith(expect.stringContaining('1.original'), expect.stringContaining('1.png'), expect.anything(), expect.any(Object))
  })

  describe('reconvertImageScreens', () => {
    const device = { id: 'dev' } as Device

    it('reconverts uploads and cached external images from their original, or from the PNG when none is retained', async () => {
      screensRepo.find.mockResolvedValue([
        { id: 'upload', type: 'file' },
        { id: 'legacy', type: 'file' },
        { id: 'cached', type: 'external', fetchManual: true },
        { id: 'live', type: 'external', fetchManual: false },
        { id: 'plugin', type: 'plugin' },
        { id: 'markup', type: 'html' },
      ])
      fileExistsMock.mockImplementation(async (p: string) => !p.endsWith('legacy.original'))
      const renameMock = vi.spyOn(fs.promises, 'rename').mockResolvedValue(undefined)
      const { convertToPng } = await import('../../utils/imageUtils.js')

      await expect(service.reconvertImageScreens(device)).resolves.toBe(3)

      const sources = vi.mocked(convertToPng).mock.calls.map(call => call[0].split('/').pop())
      expect(sources).toEqual(['upload.original', 'legacy.png', 'cached.original'])
      expect(renameMock).toHaveBeenCalledWith(expect.stringContaining('tmp-upload.png'), expect.stringContaining('/upload.png'))
      expect(screensRepo.update).toHaveBeenCalledWith({ id: 'upload' }, { generatedAt: expect.any(Date) })
      expect(screensRepo.update).not.toHaveBeenCalledWith({ id: 'live' }, expect.anything())
      expect(screensRepo.update).not.toHaveBeenCalledWith({ id: 'plugin' }, expect.anything())
      expect(screensRepo.update).not.toHaveBeenCalledWith({ id: 'markup' }, expect.anything())
    })

    it('keeps going when one screen fails to convert, cleaning up its temp file', async () => {
      screensRepo.find.mockResolvedValue([{ id: 'a', type: 'file' }, { id: 'b', type: 'file' }])
      fileExistsMock.mockResolvedValue(true)
      vi.spyOn(fs.promises, 'rename').mockResolvedValue(undefined)
      const { convertToPng } = await import('../../utils/imageUtils.js')
      vi.mocked(convertToPng).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined)

      await expect(service.reconvertImageScreens(device)).resolves.toBe(1)
      expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('tmp-a.png'))
    })
  })

  it('updateExternalScreen throws if not found', async () => {
    screensRepo.findOne.mockResolvedValue(null)
    await expect(service.updateExternalScreen('1')).rejects.toThrow()
  })

  it('reorder throws if device not found', async () => {
    devicesRepo.findOne.mockResolvedValue(null)
    await expect(service.reorder('dev', ['1', '2'])).rejects.toThrow(NotFoundException)
  })

  it('reorder reassigns order sequentially to match submitted array within a transaction', async () => {
    const device = { id: 'dev' } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = { id: 'a', order: 1, device } as Screen
    const screenB = { id: 'b', order: 2, device } as Screen
    screensRepo.find
      .mockResolvedValueOnce([screenA, screenB]) // fetch device screens
      .mockResolvedValueOnce([screenB, screenA]) // getByDevice after reorder
    screensRepo.save.mockResolvedValue(undefined)

    const result = await service.reorder('dev', ['b', 'a'])

    expect(screensRepo.manager.transaction).toHaveBeenCalled()
    expect(screenB.order).toBe(1)
    expect(screenA.order).toBe(2)
    expect(screensRepo.save).toHaveBeenCalledWith(screenB)
    expect(screensRepo.save).toHaveBeenCalledWith(screenA)
    expect(result).toEqual([screenB, screenA])
  })

  it('reorder rejects payload with duplicate ids', async () => {
    const device = { id: 'dev' } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = { id: 'a', order: 1, device } as Screen
    const screenB = { id: 'b', order: 2, device } as Screen
    screensRepo.find.mockResolvedValue([screenA, screenB])

    await expect(service.reorder('dev', ['a', 'a'])).rejects.toThrow(BadRequestException)
  })

  it('reorder rejects payload missing a screen id', async () => {
    const device = { id: 'dev' } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = { id: 'a', order: 1, device } as Screen
    const screenB = { id: 'b', order: 2, device } as Screen
    screensRepo.find.mockResolvedValue([screenA, screenB])

    await expect(service.reorder('dev', ['a'])).rejects.toThrow(BadRequestException)
  })

  it('reorder rejects payload with a foreign screen id', async () => {
    const device = { id: 'dev' } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = { id: 'a', order: 1, device } as Screen
    const screenB = { id: 'b', order: 2, device } as Screen
    screensRepo.find.mockResolvedValue([screenA, screenB])

    await expect(service.reorder('dev', ['a', 'foreign-id'])).rejects.toThrow(BadRequestException)
  })

  it('reorder rejects payload with an extra screen id', async () => {
    const device = { id: 'dev' } as Device
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = { id: 'a', order: 1, device } as Screen
    screensRepo.find.mockResolvedValue([screenA])

    await expect(service.reorder('dev', ['a', 'b'])).rejects.toThrow(BadRequestException)
  })
})
