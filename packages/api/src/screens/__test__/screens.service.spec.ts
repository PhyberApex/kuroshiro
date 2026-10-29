import type { ConfigService } from '@nestjs/config'
import type { MockInstance } from 'vitest'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { Device } from '../../devices/devices.entity.js'
import type { MockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import type { Screen } from '../screens.entity.js'
import * as fs from 'node:fs'
import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationException } from '../../errors/api.exception.js'
import { makeDevice, makeScreen } from '../../test/fixtures.js'
import { makeMulterFile } from '../../test/fs.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository, createMockTransactionalRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { fetchPublic } from '../../utils/ssrfGuard.js'
import { ScreensService } from '../screens.service.js'

const { fileExistsMock } = vi.hoisted(() => ({ fileExistsMock: vi.fn() }))

vi.mock('../../utils/imageUtils.js', () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/fileExists.js', () => ({ fileExists: fileExistsMock }))

const SCREEN_ID = '11111111-1111-4111-8111-111111111111'

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

    it('logs a warning and counts it as not reconverted, instead of throwing, when an image Screen\'s file is gone from disk', async () => {
      screensRepo.find.mockResolvedValue([makeScreen({ id: 'gone', type: 'file', device })])
      fileExistsMock.mockResolvedValue(false)
      const warned = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      const { convertToPng } = await import('../../utils/imageUtils.js')

      await expect(service.reconvertImageScreens(device)).resolves.toBe(0)
      expect(warned).toHaveBeenCalledWith('No image to reconvert for screen gone')
      expect(convertToPng).not.toHaveBeenCalled()
      expect(screensRepo.update).not.toHaveBeenCalled()
      warned.mockRestore()
    })
  })

  it('refuses a kind other than file sent with a file, at path file', async () => {
    const refusal = await service.add({ deviceId: 'dev', kind: 'html', name: 'Markup', html: '<p></p>' }, makeMulterFile()).catch((err: unknown) => err)

    expect(refusal).toBeInstanceOf(ValidationException)
    expect((refusal as ValidationException).fields).toEqual([{ path: 'file', message: 'Only a File Screen takes a file.' }])
    expect(devicesRepo.findOneBy).not.toHaveBeenCalled()
  })

  it('refuses a private or loopback URL under demo_mode before anything is fetched', async () => {
    mockConfigService.get.mockImplementation((key: string) => key === 'demo_mode')
    const device = makeDevice({ id: 'dev' })
    screensRepo.findOne.mockResolvedValue(makeScreen({ id: SCREEN_ID, type: 'external', device, fetchManual: true, externalLink: 'http://127.0.0.1/image.png' }))
    const { downloadImage } = await import('../../utils/imageUtils.js')

    await expect(service.refresh(SCREEN_ID)).rejects.toThrow('Requests to private IP ranges are not allowed in demo mode')
    expect(downloadImage).not.toHaveBeenCalled()
    expect(screensRepo.update).not.toHaveBeenCalled()
  })

  it('fetches a public URL under demo_mode with the guarded fetch, so its redirects are checked too', async () => {
    mockConfigService.get.mockImplementation((key: string) => key === 'demo_mode')
    const device = makeDevice({ id: 'dev' })
    screensRepo.findOne.mockResolvedValue(makeScreen({ id: SCREEN_ID, type: 'external', device, fetchManual: true, externalLink: 'https://images.example/a.png' }))
    vi.spyOn(fs.promises, 'rename').mockResolvedValue(undefined)
    const { downloadImage } = await import('../../utils/imageUtils.js')

    await service.refresh(SCREEN_ID)

    expect(downloadImage).toHaveBeenCalledWith('https://images.example/a.png', expect.any(String), expect.anything(), fetchPublic)
  })

  it('refresh throws if not found', async () => {
    screensRepo.findOne.mockResolvedValue(null)
    await expect(service.refresh(SCREEN_ID)).rejects.toThrow()
  })
})
