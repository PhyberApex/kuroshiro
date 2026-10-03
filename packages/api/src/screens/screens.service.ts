import type { DeepPartial } from 'typeorm'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, HttpStatus, Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { Device } from '../devices/devices.entity.js'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import { fileExists } from '../utils/fileExists.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { convertToPng, downloadImage, readImageSize } from '../utils/imageUtils.js'
import { resolveAppPath } from '../utils/pathHelper.js'
import { assertPublicUrl } from '../utils/ssrfGuard.js'
import { CreateScreenDto } from './dto/create-screen.dto.js'
import { closeGapInOrder, joinEndOfOrder, writeOrder } from './screen-order.js'
import { Screen } from './screens.entity.js'

@Injectable()
export class ScreensService {
  private readonly logger = new Logger(ScreensService.name)
  constructor(
    @InjectRepository(Screen)
    private screensRepository: Repository<Screen>,
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
    private readonly configService: ConfigService,
    private readonly deviceModels: DeviceModelsService,
  ) {}

  /** Adds an External link, File or HTML Screen at the end of the Device's Order and answers its id. */
  async add(input: CreateScreenDto, file?: Express.Multer.File): Promise<string> {
    this.logger.log(`Adding ${input.kind} screen to device ${input.deviceId}`)
    this.assertFileMatchesKind(input, file)
    const device = await this.devicesRepository.findOneBy({ id: input.deviceId })
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: input.deviceId })

    const id = randomUUID()
    const content = await this.prepareContent(input, device, id, file)
    try {
      await joinEndOfOrder(this.screensRepository.manager, device.id, { id, type: input.kind, filename: input.name, ...content })
    }
    catch (err) {
      await this.deleteImages(device.id, id)
      throw err
    }
    this.logger.log(`Screen created with id: ${id} for device: ${device.id}`)
    return id
  }

  private assertFileMatchesKind(input: CreateScreenDto, file?: Express.Multer.File): void {
    if (input.kind !== 'file') {
      if (file)
        throw new ValidationException([{ path: 'file', message: 'Only a File Screen takes a file.' }])
      return
    }
    if (this.configService.get<boolean>('demo_mode'))
      throw new ApiException(HttpStatus.FORBIDDEN, 'demo-mode', 'A file cannot be uploaded in demo mode.')
    if (!file)
      throw new ValidationException([{ path: 'file', message: 'A File Screen needs a file.' }])
  }

  /** The kind's own columns, with its image stored under the given Screen id when the kind keeps one. */
  private async prepareContent(input: CreateScreenDto, device: Device, screenId: string, file?: Express.Multer.File): Promise<DeepPartial<Screen>> {
    switch (input.kind) {
      case 'html':
        return { html: input.html }
      case 'external':
        if (input.fetchManual)
          await this.fetchKeptImage(device, screenId, input.url!)
        return { externalLink: input.url, fetchManual: input.fetchManual }
      case 'file':
        return this.storeUpload(device, screenId, file!)
    }
  }

  private async fetchKeptImage(device: Device, screenId: string, url: string): Promise<void> {
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(url)
    const inputPath = this.originalImagePath(device.id, screenId)
    try {
      await downloadImage(url, inputPath, this.logger)
      await convertToPng(inputPath, this.screenImagePath(device.id, screenId), await this.deviceModels.renderTargetFor(device), this.logger)
    }
    catch (err) {
      const reason = getErrorMessage(err)
      this.logger.error(`Failed to fetch the image of a new screen: ${reason}`)
      await this.deleteImages(device.id, screenId)
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'image-fetch-failed', `The image could not be fetched: ${reason}`, { url })
    }
  }

  private async storeUpload(device: Device, screenId: string, file: Express.Multer.File): Promise<DeepPartial<Screen>> {
    const inputPath = this.originalImagePath(device.id, screenId)
    try {
      await fs.promises.mkdir(path.dirname(inputPath), { recursive: true })
      await fs.promises.writeFile(inputPath, file.buffer)
      const { width, height } = await readImageSize(inputPath, this.logger)
      await convertToPng(inputPath, this.screenImagePath(device.id, screenId), await this.deviceModels.renderTargetFor(device), this.logger)
      return { fileOriginalName: file.originalname, fileWidth: width, fileHeight: height, fileBytes: file.size }
    }
    catch (err) {
      const reason = getErrorMessage(err)
      this.logger.error(`Failed to read the upload of a new screen: ${reason}`)
      await this.deleteImages(device.id, screenId)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'image-unreadable', `The file is not an image Kuroshiro can read: ${reason}`)
    }
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting screen ${id}`)
    const screen = await this.findScreenWithDevice(id)
    const deviceId = screen.device.id
    await this.deleteImages(deviceId, id)
    await this.screensRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Screen).delete(id)
      if (screen.devicePluginId)
        await manager.getRepository(DevicePlugin).delete(screen.devicePluginId)
      await closeGapInOrder(manager, deviceId)
    })
    this.logger.log(`Screen deleted: ${id}`)
  }

  /** Puts a Device's Screens in the given Order, which has to name each of them once. */
  async reorder(deviceId: string, screenIds: string[]): Promise<void> {
    this.logger.log(`Reordering screens for device ${deviceId}`)
    const device = isUUID(deviceId) ? await this.devicesRepository.findOneBy({ id: deviceId }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })

    const screens = await this.screensRepository.find({ where: { device: { id: deviceId } } })
    const screensById = new Map(screens.map(screen => [screen.id, screen]))
    const ordered = screenIds.flatMap(screenId => screensById.get(screenId) ?? [])
    if (new Set(screenIds).size !== screenIds.length || screens.length !== screenIds.length || ordered.length !== screens.length)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'order-not-a-permutation', 'screenIds must name each of the Device\'s Screens exactly once.')

    await this.screensRepository.manager.transaction(manager => writeOrder(manager, ordered))
    this.logger.log(`Reordered screens for device ${deviceId}`)
  }

  async updateExternalScreen(id: string) {
    this.logger.log(`Refetching screen: ${id}`)
    const screen = await this.findScreenWithDevice(id)
    if (!screen.externalLink) {
      throw new BadRequestException('This is only allowed for external images')
    }
    if (!screen.fetchManual) {
      throw new BadRequestException('This is only allowed for external images that are not auto refreshing')
    }
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(screen.externalLink)
    const inputPath = this.originalImagePath(screen.device.id, screen.id)
    const outputPath = this.screenImagePath(screen.device.id, screen.id)
    try {
      await downloadImage(screen.externalLink, inputPath, this.logger)
      await convertToPng(inputPath, outputPath, await this.deviceModels.renderTargetFor(screen.device), this.logger)
      this.logger.log('Updating generation date on screen')
      screen.generatedAt = new Date()
      await this.screensRepository.save(screen)
      this.logger.log('Download and conversion successful')
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to process image: ${message}. Removing screen again.`)
      throw new InternalServerErrorException('Error processing image')
    }
  }

  /**
   * Regenerates every stored image of a device (uploads and cached external
   * images) for its current model and palette, from the retained original
   * where one exists and from the previous PNG otherwise.
   */
  async reconvertImageScreens(device: Device): Promise<number> {
    const screens = await this.screensRepository.find({ where: { device: { id: device.id } } })
    const target = await this.deviceModels.renderTargetFor(device)
    let converted = 0
    for (const screen of screens.filter(s => s.type === 'file' || (s.type === 'external' && s.fetchManual))) {
      const outputPath = this.screenImagePath(device.id, screen.id)
      const originalPath = this.originalImagePath(device.id, screen.id)
      const sourcePath = await fileExists(originalPath) ? originalPath : outputPath
      if (!await fileExists(sourcePath)) {
        this.logger.warn(`No image to reconvert for screen ${screen.id}`)
        continue
      }
      const tempPath = path.join(path.dirname(outputPath), `tmp-${screen.id}.png`)
      try {
        await convertToPng(sourcePath, tempPath, target, this.logger)
        await fs.promises.rename(tempPath, outputPath)
        await this.screensRepository.update({ id: screen.id }, { generatedAt: new Date() })
        converted++
      }
      catch (err) {
        const message = getErrorMessage(err)
        this.logger.error(`Failed to reconvert screen ${screen.id}: ${message}`)
        await fs.promises.unlink(tempPath).catch(() => {})
      }
    }
    this.logger.log(`Reconverted ${converted} image screen(s) for device ${device.id} as ${target.model.name}/${target.palette.id}`)
    return converted
  }

  private async findScreenWithDevice(id: string): Promise<Screen> {
    const screen = isUUID(id) ? await this.screensRepository.findOne({ where: { id }, relations: { device: true } }) : null
    if (!screen)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id })
    return screen
  }

  private async deleteImages(deviceId: string, screenId: string): Promise<void> {
    await this.deleteFileIfExists(this.screenImagePath(deviceId, screenId))
    await this.deleteFileIfExists(this.originalImagePath(deviceId, screenId))
  }

  private screenImagePath(deviceId: string, screenId: string): string {
    return resolveAppPath('public', 'screens', 'devices', deviceId, `${screenId}.png`)
  }

  private originalImagePath(deviceId: string, screenId: string): string {
    return resolveAppPath('public', 'screens', 'devices', deviceId, `${screenId}.original`)
  }

  private async deleteFileIfExists(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath)
      this.logger.log(`Deleted file: ${filePath}`)
    }
    catch (err) {
      const errno = err as NodeJS.ErrnoException
      if (errno.code !== 'ENOENT')
        this.logger.error(`Failed to delete file: ${filePath} - ${errno.message}`)
    }
  }
}
