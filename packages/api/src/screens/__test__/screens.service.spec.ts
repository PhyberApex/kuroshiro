import type { ConfigService } from '@nestjs/config'
import type { MockInstance } from 'vitest'
import type { DeviceModelsService } from '../../device-models/device-models.service'
import type { Device } from '../../devices/devices.entity'
import type { MockDeviceModelsService } from '../../test/mockDeviceModelsService'
import type { CreateScreenDto } from '../dto/create-screen.dto'
import type { Screen } from '../screens.entity'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice, makeScreen } from '../../test/fixtures'
import { makeMulterFile } from '../../test/fs'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService'
import { asRepository, createMockRepository, createMockTransactionalRepository } from '../../test/mockRepository'
import { asService } from '../../test/mockService'
import { ScreensService } from '../screens.service'

const { fileExistsMock } = vi.hoisted(() => ({ fileExistsMock: vi.fn() }))

vi.mock('../../utils/imageUtils', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/fileExists', () => ({ fileExists: fileExistsMock }))

describe('screensService', () => {
  let service: ScreensService
  let screensRepo: ReturnType<typeof createMockTransactionalRepository<Screen>>
  let devicesRepo: ReturnType<typeof createMockRepository<Device>>
  let unlinkMock: MockInstance<typeof fs.promises.unlink>
  let deviceModels: MockDeviceModelsService
  const mockConfigService = { get: vi.fn().mockReturnValue(false) }

  beforeEach(() => {
    screensRepo = createMockTransactionalRepository<Screen>()
    devicesRepo = createMockRepository<Device>()
    deviceModels = createMockDeviceModelsService()
    service = new ScreensService(
      asRepository(screensRepo),
      asRepository(devicesRepo),
      asService<ConfigService>(mockConfigService),
      asService<DeviceModelsService>(deviceModels),
    )
    vi.resetAllMocks()
    primeMockDeviceModelsService(deviceModels)
    unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
  })

  it('getAll returns all screens', async () => {
    const screens = [makeScreen({ id: '1' })]
    screensRepo.find.mockResolvedValue(screens)
    const result = await service.getAll()
    expect(result).toBe(screens)
  })

  it('add throws if both file and externalLink are provided', async () => {
    const dto: CreateScreenDto = { filename: 'file', deviceId: 'dev', externalLink: 'url', fetchManual: false, html: '' }
    await expect(service.add(dto, makeMulterFile({ buffer: buffer.Buffer.from('data') }))).rejects.toThrow()
  })

  it('add throws if neither file nor externalLink is provided', async () => {
    const dto: CreateScreenDto = { filename: 'file', deviceId: 'dev', fetchManual: false, html: '' }
    await expect(service.add(dto, undefined)).rejects.toThrow()
  })

  it('add creates a screen with file', async () => {
    const device = makeDevice({ id: 'dev', width: 100, height: 100 })
    devicesRepo.findOne.mockResolvedValue(device)
    const screen = makeScreen({ id: '1', filename: 'file', device, order: 1, isActive: false })
    screensRepo.create.mockReturnValue(screen)
    screensRepo.save.mockResolvedValue(screen)
    const file = makeMulterFile({ buffer: buffer.Buffer.from('data') })
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
    const device = makeDevice({ id: 'dev', width: 100, height: 100 })
    devicesRepo.findOne.mockResolvedValue(device)
    const screen = makeScreen({ id: '1', html: '<div>hi</div>', device, order: 1, isActive: false })
    screensRepo.create.mockReturnValue(screen)
    screensRepo.save.mockResolvedValue(screen)
    const result = await service.add({ filename: 'file', deviceId: 'dev', fetchManual: false, html: '<div>hi</div>' }, undefined)
    expect(result).toBe(screen)
    expect(screensRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'html' }))
  })

  it('add creates a screen with externalLink and fetchManual', async () => {
    const device = makeDevice({ id: 'dev', width: 100, height: 100 })
    devicesRepo.findOne.mockResolvedValue(device)
    const screen = makeScreen({ id: '1', filename: 'file', device, order: 1, isActive: false })
    screensRepo.create.mockReturnValue(screen)
    screensRepo.save.mockResolvedValue(screen)
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
    const screens = [makeScreen({ id: '1' })]
    screensRepo.find.mockResolvedValue(screens)
    const result = await service.getByDevice('dev')
    expect(result).toBe(screens)
  })

  it('delete removes a screen and reindexes', async () => {
    const device = makeDevice({ id: 'dev' })
    const screen = makeScreen({ id: '1', device })
    screensRepo.findOne.mockResolvedValue(screen)
    screensRepo.find.mockResolvedValue([makeScreen({ id: '2', order: 2, device })])
    await expect(service.delete('1')).resolves.toBeUndefined()
    expect(screensRepo.delete).toHaveBeenCalledWith('1')
    expect(screensRepo.save).toHaveBeenCalled()
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('public/screens/devices/dev/1.png'))
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringContaining('public/screens/devices/dev/1.original'))
  })

  it('updateExternalScreen refetches into the retained original and converts it', async () => {
    const device = makeDevice({ id: 'dev', width: 100, height: 100 })
    const screen = makeScreen({ id: '1', device, externalLink: 'url', fetchManual: true })
    screensRepo.findOne.mockResolvedValue(screen)
    await expect(service.updateExternalScreen('1')).resolves.toBeUndefined()
    const { downloadImage, convertToPng } = await import('../../utils/imageUtils.js')
    expect(downloadImage).toHaveBeenCalledWith('url', expect.stringContaining('public/screens/devices/dev/1.original'), expect.any(Object))
    expect(convertToPng).toHaveBeenCalledWith(expect.stringContaining('1.original'), expect.stringContaining('1.png'), expect.anything(), expect.any(Object))
  })

  describe('reconvertImageScreens', () => {
    const device = makeDevice({ id: 'dev' })

    it('reconverts uploads and cached external images from their original, or from the PNG when none is retained', async () => {
      screensRepo.find.mockResolvedValue([
        makeScreen({ id: 'upload', type: 'file', device }),
        makeScreen({ id: 'legacy', type: 'file', device }),
        makeScreen({ id: 'cached', type: 'external', device, fetchManual: true }),
        makeScreen({ id: 'live', type: 'external', device, fetchManual: false }),
        makeScreen({ id: 'plugin', type: 'plugin', device }),
        makeScreen({ id: 'markup', type: 'html', device }),
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
      screensRepo.find.mockResolvedValue([makeScreen({ id: 'a', type: 'file', device }), makeScreen({ id: 'b', type: 'file', device })])
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
    const device = makeDevice({ id: 'dev' })
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = makeScreen({ id: 'a', order: 1, device })
    const screenB = makeScreen({ id: 'b', order: 2, device })
    screensRepo.find
      .mockResolvedValueOnce([screenA, screenB]) // fetch device screens
      .mockResolvedValueOnce([screenB, screenA]) // getByDevice after reorder

    const result = await service.reorder('dev', ['b', 'a'])

    expect(screensRepo.manager.transaction).toHaveBeenCalled()
    expect(screenB.order).toBe(1)
    expect(screenA.order).toBe(2)
    expect(screensRepo.save).toHaveBeenCalledWith(screenB)
    expect(screensRepo.save).toHaveBeenCalledWith(screenA)
    expect(result).toEqual([screenB, screenA])
  })

  it('reorder rejects payload with duplicate ids', async () => {
    const device = makeDevice({ id: 'dev' })
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = makeScreen({ id: 'a', order: 1, device })
    const screenB = makeScreen({ id: 'b', order: 2, device })
    screensRepo.find.mockResolvedValue([screenA, screenB])

    await expect(service.reorder('dev', ['a', 'a'])).rejects.toThrow(BadRequestException)
  })

  it('reorder rejects payload missing a screen id', async () => {
    const device = makeDevice({ id: 'dev' })
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = makeScreen({ id: 'a', order: 1, device })
    const screenB = makeScreen({ id: 'b', order: 2, device })
    screensRepo.find.mockResolvedValue([screenA, screenB])

    await expect(service.reorder('dev', ['a'])).rejects.toThrow(BadRequestException)
  })

  it('reorder rejects payload with a foreign screen id', async () => {
    const device = makeDevice({ id: 'dev' })
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = makeScreen({ id: 'a', order: 1, device })
    const screenB = makeScreen({ id: 'b', order: 2, device })
    screensRepo.find.mockResolvedValue([screenA, screenB])

    await expect(service.reorder('dev', ['a', 'foreign-id'])).rejects.toThrow(BadRequestException)
  })

  it('reorder rejects payload with an extra screen id', async () => {
    const device = makeDevice({ id: 'dev' })
    devicesRepo.findOne.mockResolvedValue(device)
    const screenA = makeScreen({ id: 'a', order: 1, device })
    screensRepo.find.mockResolvedValue([screenA])

    await expect(service.reorder('dev', ['a', 'b'])).rejects.toThrow(BadRequestException)
  })
})
