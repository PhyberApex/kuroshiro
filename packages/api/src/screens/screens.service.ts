import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { Device } from '../devices/devices.entity.js'
import { fileExists } from '../utils/fileExists.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { convertToPng, downloadImage } from '../utils/imageUtils.js'
import { resolveAppPath } from '../utils/pathHelper.js'
import { assertPublicUrl } from '../utils/ssrfGuard.js'
import { CreateScreenDto } from './dto/create-screen.dto.js'
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

  async getAll(): Promise<Screen[]> {
    this.logger.log('Fetching all screens')
    return this.screensRepository.find()
  }

  async add(body: CreateScreenDto, file?: Express.Multer.File): Promise<Screen> {
    this.logger.log(`Adding screen to device ${body.deviceId}`)
    this.assertValidAddInput(body, file)
    const device = await this.findDeviceForAdd(body.deviceId)
    const saved = await this.createScreen(body, device)

    if (body.externalLink && body.fetchManual)
      await this.fetchExternalImageForScreen(device, saved, body.externalLink)
    else if (file)
      await this.saveUploadedFileForScreen(device, saved, file)

    return this.activateScreen(saved, device.id)
  }

  private assertValidAddInput(body: CreateScreenDto, file?: Express.Multer.File): void {
    if (body.externalLink && file)
      throw new BadRequestException('Can\'t upload a file to an external image')
    if (!body.externalLink && !file && !body.html)
      throw new BadRequestException('Need either external link, file or HTML to add screen')
  }

  private async findDeviceForAdd(deviceId: string): Promise<Device> {
    const device = await this.devicesRepository.findOne({ where: { id: deviceId }, relations: { screens: true } })
    if (!device) {
      this.logger.warn(`Device not found: ${deviceId}`)
      throw new NotFoundException('Device not found')
    }
    return device
  }

  private async createScreen(body: CreateScreenDto, device: Device): Promise<Screen> {
    const newScreen = this.screensRepository.create({
      type: body.externalLink ? 'external' : body.html ? 'html' : 'file',
      filename: body.filename,
      externalLink: body.externalLink,
      device,
      order: device.screens ? device.screens.length + 1 : 1,
      isActive: false,
      fetchManual: body.fetchManual,
      html: body.html,
      generatedAt: new Date(),
    })
    const saved = await this.screensRepository.save(newScreen)
    this.logger.log(`Screen created with id: ${saved.id} for device: ${device.id}`)
    return saved
  }

  private async fetchExternalImageForScreen(device: Device, screen: Screen, externalLink: string): Promise<void> {
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(externalLink)
    const inputPath = this.originalImagePath(device.id, screen.id)
    const outputPath = this.screenImagePath(device.id, screen.id)
    this.logger.debug(`Input path: ${inputPath}`)
    this.logger.debug(`Planned output path: ${outputPath}`)
    try {
      await downloadImage(externalLink, inputPath, this.logger)
      await convertToPng(inputPath, outputPath, await this.deviceModels.renderTargetFor(device), this.logger)
      this.logger.log('Download and conversion successful')
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to process image: ${message}. Removing screen again.`)
      await this.screensRepository.remove(screen)
      throw new InternalServerErrorException('Error processing image')
    }
  }

  private async saveUploadedFileForScreen(device: Device, screen: Screen, file: Express.Multer.File): Promise<void> {
    try {
      const inputPath = this.originalImagePath(device.id, screen.id)
      const outputPath = this.screenImagePath(device.id, screen.id)
      await fs.promises.mkdir(path.dirname(inputPath), { recursive: true })
      this.logger.debug(`Input path: ${inputPath}`)
      this.logger.debug(`Planned output path: ${outputPath}`)
      await fs.promises.writeFile(inputPath, file.buffer)
      this.logger.log(`Uploaded file saved to ${inputPath}`)
      await convertToPng(inputPath, outputPath, await this.deviceModels.renderTargetFor(device), this.logger)
      this.logger.log(`Converted and saved PNG to ${outputPath}`)
    }
    catch {
      this.logger.error('Error on uploading file. Removing screen again.')
      await this.screensRepository.remove(screen)
      throw new InternalServerErrorException('Error processing image')
    }
  }

  private async activateScreen(screen: Screen, deviceId: string): Promise<Screen> {
    this.logger.log(`Adding successful setting new active screen to ${screen.id}`)
    await this.screensRepository.update({ device: { id: deviceId } }, { isActive: false })
    screen.isActive = true
    await this.screensRepository.save(screen)
    return screen
  }

  async getByDevice(deviceId: string): Promise<Screen[]> {
    this.logger.log(`Fetching screens for device ${deviceId}`)
    return this.screensRepository.find({
      where: { device: { id: deviceId } },
      relations: { plugin: true, schedule: true },
      order: { order: 'ASC' },
    })
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting screen ${id}`)
    const screen = await this.findScreenWithDevice(id)
    const deviceId = screen.device.id
    await this.deleteFileIfExists(this.screenImagePath(deviceId, id))
    await this.deleteFileIfExists(this.originalImagePath(deviceId, id))
    await this.screensRepository.delete(id)
    this.logger.log(`Screen deleted: ${id}`)
    // Reindex order for remaining screens, closing the gap left by the deleted screen
    const screens = await this.screensRepository.find({ where: { device: { id: deviceId } }, order: { order: 'ASC' } })
    await this.reindexScreens(screens)
    this.logger.log(`Reindexed screen order for device ${deviceId}`)
  }

  async reorder(deviceId: string, screenIds: string[]): Promise<Screen[]> {
    this.logger.log(`Reordering screens for device ${deviceId}`)
    const device = await this.devicesRepository.findOne({ where: { id: deviceId } })
    if (!device) {
      this.logger.warn(`Device not found: ${deviceId}`)
      throw new NotFoundException('Device not found')
    }

    const screens = await this.screensRepository.find({ where: { device: { id: deviceId } } })
    const invalidPermutationMessage = 'screenIds must be an exact permutation of the device\'s current screens'
    const uniqueIds = new Set(screenIds)
    if (uniqueIds.size !== screenIds.length || screens.length !== screenIds.length) {
      throw new BadRequestException(invalidPermutationMessage)
    }

    const screensById = new Map(screens.map(screen => [screen.id, screen]))
    const orderedScreens = screenIds.map((screenId) => {
      const screen = screensById.get(screenId)
      if (!screen)
        throw new BadRequestException(invalidPermutationMessage)
      return screen
    })

    await this.screensRepository.manager.transaction(async (manager) => {
      await this.reindexScreens(orderedScreens, manager)
    })
    this.logger.log(`Reordered screens for device ${deviceId}`)

    return this.getByDevice(deviceId)
  }

  /**
   * Assigns sequential order (1..N) to the given screens in the order they were passed,
   * persisting only the screens whose order actually changed. Shared by the delete-reindex
   * path (gap closing) and the reorder path (arbitrary new order).
   */
  private async reindexScreens(screens: Screen[], manager: EntityManager = this.screensRepository.manager): Promise<void> {
    const repository = manager.getRepository(Screen)
    for (let i = 0; i < screens.length; i++) {
      if (screens[i].order !== i + 1) {
        screens[i].order = i + 1
        await repository.save(screens[i])
      }
    }
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
    const screen = await this.screensRepository.findOne({ where: { id }, relations: { device: true } })
    if (!screen) {
      this.logger.warn(`Screen not found: ${id}`)
      throw new NotFoundException('Screen not found')
    }
    return screen
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
      if (errno.code === 'ENOENT')
        this.logger.warn(`File not found for deletion: ${filePath}`)
      else
        this.logger.error(`Failed to delete file: ${filePath} - ${errno.message}`)
    }
  }
}
