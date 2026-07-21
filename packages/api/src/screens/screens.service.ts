import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, Repository } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { convertToPng, downloadImage } from '../utils/imageUtils'
import { resolveAppPath } from '../utils/pathHelper'
import { assertPublicUrl } from '../utils/ssrfGuard'
import { CreateScreenDto } from './dto/create-screen.dto'
import { Screen } from './screens.entity'

@Injectable()
export class ScreensService {
  private readonly logger = new Logger(ScreensService.name)
  constructor(
    @InjectRepository(Screen)
    private screensRepository: Repository<Screen>,
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
    private readonly configService: ConfigService,
  ) {}

  async getAll(): Promise<Screen[]> {
    this.logger.log('Fetching all screens')
    return this.screensRepository.find()
  }

  async add(body: CreateScreenDto, file?: any): Promise<Screen> {
    this.logger.log(`Adding screen to device ${body.deviceId}`)
    if (body.externalLink && file)
      throw new BadRequestException('Can\'t upload a file to an external image')
    if (!body.externalLink && !file && !body.html)
      throw new BadRequestException('Need either external link, file or HTML to add screen')
    const device = await this.devicesRepository.findOne({ where: { id: body.deviceId }, relations: ['screens'] })
    if (!device) {
      this.logger.warn(`Device not found: ${body.deviceId}`)
      throw new NotFoundException('Device not found')
    }
    const newScreen = this.screensRepository.create({
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
    this.logger.log(`Screen created with id: ${saved.id} for device: ${body.deviceId}`)

    // Fetch initial image right now
    if (body.externalLink && body.fetchManual) {
      if (this.configService.get<boolean>('demo_mode'))
        assertPublicUrl(body.externalLink)
      const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
      const inputPath = path.join(destDir, 'tmp-source')
      const pngFilename = `${saved.id}.png`
      const outputPath = path.join(destDir, pngFilename)
      this.logger.debug(`Input path: ${inputPath}`)
      this.logger.debug(`Planned output path: ${outputPath}`)
      try {
        await downloadImage(body.externalLink, inputPath, this.logger)
        await convertToPng(inputPath, outputPath, device.width, device.height, this.logger)
        this.logger.log('Download and conversion successful')
      }
      catch (err) {
        this.logger.error(`Failed to process image: ${err.message}. Removing screen again.`)
        await this.screensRepository.remove(saved)
        throw new InternalServerErrorException('Error processing image')
      }
    }

    // Handle file upload and conversion
    else if (file) {
      try {
        const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
        await fs.promises.mkdir(destDir, { recursive: true })
        const inputPath = path.join(destDir, `${saved.id}-source`)
        const pngFilename = `${saved.id}.png`
        const outputPath = path.join(destDir, pngFilename)
        this.logger.debug(`Input path: ${inputPath}`)
        this.logger.debug(`Planned output path: ${outputPath}`)
        await fs.promises.writeFile(inputPath, file.buffer)
        this.logger.log(`Uploaded file saved to ${inputPath}`)
        await convertToPng(inputPath, outputPath, device.width, device.height, this.logger)
        await fs.promises.unlink(inputPath)
        this.logger.log(`Converted and saved PNG to ${outputPath}`)
      }
      catch {
        this.logger.error('Error on uploading file. Removing screen again.')
        await this.screensRepository.remove(saved)
        throw new InternalServerErrorException('Error processing image')
      }
    }
    this.logger.log(`Adding successful setting new active screen to ${saved.id}`)
    await this.screensRepository.update({ device: { id: device.id } }, { isActive: false })
    saved.isActive = true
    await this.screensRepository.save(saved)
    return saved
  }

  async getByDevice(deviceId: string): Promise<Screen[]> {
    this.logger.log(`Fetching screens for device ${deviceId}`)
    return this.screensRepository.find({
      where: { device: { id: deviceId } },
      relations: ['plugin'],
      order: { order: 'ASC' },
    })
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting screen ${id}`)
    const screen = await this.screensRepository.findOne({ where: { id }, relations: ['device'] })
    if (!screen) {
      this.logger.warn(`Screen not found: ${id}`)
      throw new NotFoundException('Screen not found')
    }
    const deviceId = screen.device.id
    // Delete PNG file if it exists
    const pngPath = resolveAppPath('public', 'screens', 'devices', deviceId, `${id}.png`)
    try {
      await fs.promises.unlink(pngPath)
      this.logger.log(`Deleted PNG file: ${pngPath}`)
    }
    catch (err) {
      if (err.code === 'ENOENT') {
        this.logger.warn(`PNG file not found for deletion: ${pngPath}`)
      }
      else {
        this.logger.error(`Failed to delete PNG file: ${pngPath} - ${err.message}`)
      }
    }
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
    const screen = await this.screensRepository.findOne({ where: { id }, relations: ['device'] })
    if (!screen) {
      this.logger.warn(`Screen not found: ${id}`)
      throw new NotFoundException('Screen not found')
    }
    if (!screen.externalLink) {
      throw new BadRequestException('This is only allowed for external images')
    }
    if (!screen.fetchManual) {
      throw new BadRequestException('This is only allowed for external images that are not auto refreshing')
    }
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(screen.externalLink)
    const destDir = resolveAppPath('public', 'screens', 'devices', screen.device.id)
    const inputPath = path.join(destDir, 'tmp-source')
    const pngFilename = `${screen.id}.png`
    const outputPath = path.join(destDir, pngFilename)
    try {
      await downloadImage(screen.externalLink, inputPath, this.logger)
      await convertToPng(inputPath, outputPath, screen.device.width, screen.device.height, this.logger)
      this.logger.log('Updating generation date on screen')
      screen.generatedAt = new Date()
      await this.screensRepository.save(screen)
      this.logger.log('Download and conversion successful')
    }
    catch (err) {
      this.logger.error(`Failed to process image: ${err.message}. Removing screen again.`)
      throw new InternalServerErrorException('Error processing image')
    }
  }
}
