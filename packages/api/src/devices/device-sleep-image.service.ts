import type { ApiErrorCode } from 'kuroshiro-shared'
import type { StagedImagePaths } from '../utils/stagedImageUpload.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { fileExists } from '../utils/fileExists.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { convertToPng } from '../utils/imageUtils.js'
import { resolveAppPath } from '../utils/pathHelper.js'
import { deleteFileIfExists, stageUpload } from '../utils/stagedImageUpload.js'
import { Device } from './devices.entity.js'

const SLEEP_IMAGE_FILENAME = 'sleep-image.png'
const SLEEP_IMAGE_ORIGINAL_FILENAME = 'sleep-image.original'

export function sleepImagePath(deviceId: string): string {
  return resolveAppPath('public', 'screens', 'devices', deviceId, SLEEP_IMAGE_FILENAME)
}

export function sleepImageOriginalPath(deviceId: string): string {
  return resolveAppPath('public', 'screens', 'devices', deviceId, SLEEP_IMAGE_ORIGINAL_FILENAME)
}

/** Root-relative, so the UI can prefix its own base path and a `/display` poll can prefix the Instance's address. */
export function sleepImageRootRelativePath(deviceId: string): string {
  return `/screens/devices/${deviceId}/${SLEEP_IMAGE_FILENAME}`
}

export function sleepImageUrl(apiUrl: string, deviceId: string): string {
  return `${apiUrl}${sleepImageRootRelativePath(deviceId)}`
}

/**
 * Stores, reconverts and removes a Device's own sleep image, reusing the
 * File Screen upload's staging ("a failed conversion leaves the previous
 * image in place") and conversion helpers rather than copying them.
 */
@Injectable()
export class DeviceSleepImageService {
  private readonly logger = new Logger(DeviceSleepImageService.name)

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private readonly configService: ConfigService,
    private readonly deviceModels: DeviceModelsService,
  ) {}

  /** Stores and converts `file` as the Device's sleep image; replacing an existing one is just another upload. */
  async upload(deviceId: string, file?: Express.Multer.File): Promise<void> {
    const device = await this.findDevice(deviceId)
    this.assertUploadAllowed(file)
    await stageUpload(sleepImageOriginalPath(device.id), sleepImagePath(device.id), this.logger)
      .store(staged => this.convertUpload(device, file!, staged))
    await this.deviceRepository.update({ id: device.id }, { sleepImageGeneratedAt: new Date() })
  }

  /** Deletes both the converted image and its retained original, and clears the Device's own record of having one. */
  async remove(deviceId: string): Promise<void> {
    const device = await this.findDevice(deviceId)
    await deleteFileIfExists(sleepImagePath(device.id), this.logger)
    await deleteFileIfExists(sleepImageOriginalPath(device.id), this.logger)
    await this.deviceRepository.update({ id: device.id }, { sleepImageGeneratedAt: null })
  }

  /**
   * Regenerates the Device's own sleep image from its retained original for
   * the Device's current render target, wherever File Screens are
   * reconverted too. A Device without a sleep image, or whose original has
   * gone missing, is left alone; a failed conversion leaves the previous
   * image in place.
   */
  async reconvert(device: Device): Promise<void> {
    if (!device.sleepImageGeneratedAt)
      return
    const originalPath = sleepImageOriginalPath(device.id)
    if (!await fileExists(originalPath)) {
      this.logger.warn(`No sleep image to reconvert for device ${device.id}`)
      return
    }
    const outputPath = sleepImagePath(device.id)
    const tempPath = path.join(path.dirname(outputPath), `tmp-sleep-image-${device.id}.png`)
    try {
      const target = await this.deviceModels.renderTargetFor(device)
      await convertToPng(originalPath, tempPath, target, this.logger)
      await fs.promises.rename(tempPath, outputPath)
      await this.deviceRepository.update({ id: device.id }, { sleepImageGeneratedAt: new Date() })
    }
    catch (err) {
      this.logger.error(`Failed to reconvert the sleep image of device ${device.id}: ${getErrorMessage(err)}`)
      await fs.promises.unlink(tempPath).catch(() => {})
    }
  }

  private async convertUpload(device: Device, file: Express.Multer.File, staged: StagedImagePaths): Promise<void> {
    const target = await this.deviceModels.renderTargetFor(device)
    await fs.promises.mkdir(path.dirname(staged.originalPath), { recursive: true })
    await fs.promises.writeFile(staged.originalPath, file.buffer)
    try {
      await convertToPng(staged.originalPath, staged.imagePath, target, this.logger)
    }
    catch (err) {
      throw this.refuseImage(err, HttpStatus.BAD_REQUEST, 'image-unreadable', 'The file is not an image Kuroshiro can read.')
    }
  }

  private assertUploadAllowed(file?: Express.Multer.File): void {
    if (this.configService.get<boolean>('demo_mode'))
      throw new ApiException(HttpStatus.FORBIDDEN, 'demo-mode', 'A file cannot be uploaded in demo mode.')
    if (!file)
      throw new ValidationException([{ path: 'file', message: 'A sleep image needs a file.' }])
  }

  /** Builds the refusal of an image; the cause goes to the log, not to the client. */
  private refuseImage(cause: unknown, status: HttpStatus, code: ApiErrorCode, message: string): ApiException {
    this.logger.error(`Refusing a sleep image (${code}): ${getErrorMessage(cause)}`)
    return new ApiException(status, code, message)
  }

  private async findDevice(id: string): Promise<Device> {
    const device = isUUID(id) ? await this.deviceRepository.findOneBy({ id }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id })
    return device
  }
}
