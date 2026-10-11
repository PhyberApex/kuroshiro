import type { ConfigService } from '@nestjs/config'
import type { DeviceModelsService } from '../../device-models/device-models.service.js'
import type { Device } from '../devices.entity.js'
import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDevice } from '../../test/fixtures.js'
import { createMockDeviceModelsService, primeMockDeviceModelsService } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { asService } from '../../test/mockService.js'
import { DeviceSleepImageService, sleepImageOriginalPath, sleepImagePath, sleepImageUrl } from '../device-sleep-image.service.js'

const { fileExistsMock } = vi.hoisted(() => ({ fileExistsMock: vi.fn() }))

vi.mock('../../utils/imageUtils.js', () => ({
  convertToPng: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/fileExists.js', () => ({ fileExists: fileExistsMock }))

const DEVICE_ID = '11111111-1111-4111-8111-111111111111'

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return { buffer: Buffer.from('image-bytes'), originalname: 'photo.jpg', size: 11, ...overrides } as Express.Multer.File
}

describe('deviceSleepImageService', () => {
  let service: DeviceSleepImageService
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let deviceModels: ReturnType<typeof createMockDeviceModelsService>
  const configService = { get: vi.fn().mockReturnValue(false) }

  beforeEach(() => {
    vi.resetAllMocks()
    deviceRepo = createMockRepository<Device>()
    deviceModels = createMockDeviceModelsService()
    primeMockDeviceModelsService(deviceModels)
    configService.get.mockReturnValue(false)
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined)
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined)
    vi.spyOn(fs.promises, 'rename').mockResolvedValue(undefined)
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined)
    service = new DeviceSleepImageService(asRepository(deviceRepo), asService<ConfigService>(configService), asService<DeviceModelsService>(deviceModels))
  })

  describe('path helpers', () => {
    it('builds root-relative URLs and on-disk paths under the device\'s own folder', () => {
      expect(sleepImagePath(DEVICE_ID)).toContain(`devices/${DEVICE_ID}/sleep-image.png`)
      expect(sleepImageOriginalPath(DEVICE_ID)).toContain(`devices/${DEVICE_ID}/sleep-image.original`)
      expect(sleepImageUrl('http://api', DEVICE_ID)).toBe(`http://api/screens/devices/${DEVICE_ID}/sleep-image.png`)
    })
  })

  describe('upload', () => {
    it('refuses when the device does not exist', async () => {
      deviceRepo.findOneBy.mockResolvedValue(null)
      await expect(service.upload(DEVICE_ID, makeFile())).rejects.toMatchObject({ code: 'device-not-found' })
    })

    it('refuses with demo-mode in demo mode, without touching the repository', async () => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ id: DEVICE_ID }))
      configService.get.mockReturnValue(true)
      await expect(service.upload(DEVICE_ID, makeFile())).rejects.toMatchObject({ code: 'demo-mode' })
      expect(deviceRepo.update).not.toHaveBeenCalled()
    })

    it('refuses without a file', async () => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ id: DEVICE_ID }))
      await expect(service.upload(DEVICE_ID, undefined)).rejects.toMatchObject({ code: 'validation' })
    })

    it('converts the upload for the device\'s render target and records when it changed', async () => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ id: DEVICE_ID }))
      const { convertToPng } = await import('../../utils/imageUtils.js')

      await service.upload(DEVICE_ID, makeFile())

      expect(vi.mocked(convertToPng)).toHaveBeenCalledWith(
        expect.stringContaining('.staging.original'),
        expect.stringContaining('.staging.png'),
        { model: expect.anything(), palette: expect.anything() },
        expect.anything(),
      )
      expect(fs.promises.rename).toHaveBeenCalledWith(expect.stringContaining('.staging.original'), sleepImageOriginalPath(DEVICE_ID))
      expect(fs.promises.rename).toHaveBeenCalledWith(expect.stringContaining('.staging.png'), sleepImagePath(DEVICE_ID))
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: DEVICE_ID }, { sleepImageGeneratedAt: expect.any(Date) })
    })

    it('leaves the previous image in place when the conversion fails', async () => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ id: DEVICE_ID }))
      const { convertToPng } = await import('../../utils/imageUtils.js')
      vi.mocked(convertToPng).mockRejectedValueOnce(new Error('unreadable'))

      await expect(service.upload(DEVICE_ID, makeFile())).rejects.toMatchObject({ code: 'image-unreadable' })

      expect(fs.promises.rename).not.toHaveBeenCalled()
      expect(deviceRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('refuses when the device does not exist', async () => {
      deviceRepo.findOneBy.mockResolvedValue(null)
      await expect(service.remove(DEVICE_ID)).rejects.toMatchObject({ code: 'device-not-found' })
    })

    it('deletes both files and clears the record', async () => {
      deviceRepo.findOneBy.mockResolvedValue(makeDevice({ id: DEVICE_ID, sleepImageGeneratedAt: new Date() }))

      await service.remove(DEVICE_ID)

      expect(fs.promises.unlink).toHaveBeenCalledWith(sleepImagePath(DEVICE_ID))
      expect(fs.promises.unlink).toHaveBeenCalledWith(sleepImageOriginalPath(DEVICE_ID))
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: DEVICE_ID }, { sleepImageGeneratedAt: null })
    })
  })

  describe('reconvert', () => {
    it('does nothing for a device with no sleep image', async () => {
      await service.reconvert(makeDevice({ id: DEVICE_ID, sleepImageGeneratedAt: null }))

      expect(deviceModels.renderTargetFor).not.toHaveBeenCalled()
      expect(deviceRepo.update).not.toHaveBeenCalled()
    })

    it('does nothing when the retained original has gone missing', async () => {
      fileExistsMock.mockResolvedValue(false)

      await service.reconvert(makeDevice({ id: DEVICE_ID, sleepImageGeneratedAt: new Date() }))

      expect(deviceModels.renderTargetFor).not.toHaveBeenCalled()
      expect(deviceRepo.update).not.toHaveBeenCalled()
    })

    it('reconverts from the retained original for the current render target', async () => {
      fileExistsMock.mockResolvedValue(true)
      const { convertToPng } = await import('../../utils/imageUtils.js')

      await service.reconvert(makeDevice({ id: DEVICE_ID, sleepImageGeneratedAt: new Date('2026-01-01T00:00:00Z') }))

      expect(vi.mocked(convertToPng)).toHaveBeenCalledWith(sleepImageOriginalPath(DEVICE_ID), expect.stringContaining('tmp-sleep-image'), expect.anything(), expect.anything())
      expect(fs.promises.rename).toHaveBeenCalledWith(expect.stringContaining('tmp-sleep-image'), sleepImagePath(DEVICE_ID))
      expect(deviceRepo.update).toHaveBeenCalledWith({ id: DEVICE_ID }, { sleepImageGeneratedAt: expect.any(Date) })
    })

    it('keeps the previous image and cleans up the temp file when the conversion fails', async () => {
      fileExistsMock.mockResolvedValue(true)
      const { convertToPng } = await import('../../utils/imageUtils.js')
      vi.mocked(convertToPng).mockRejectedValueOnce(new Error('boom'))

      await service.reconvert(makeDevice({ id: DEVICE_ID, sleepImageGeneratedAt: new Date() }))

      expect(fs.promises.rename).not.toHaveBeenCalled()
      expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringContaining('tmp-sleep-image'))
      expect(deviceRepo.update).not.toHaveBeenCalled()
    })
  })
})
