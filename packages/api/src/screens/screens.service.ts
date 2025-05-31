import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { convertToMonochromeBmp, downloadImage } from '../utils/imageUtils'
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
  ) {}

  async getAll(): Promise<Screen[]> {
    this.logger.log('Fetching all screens')
    return this.screensRepository.find()
  }

  async add(body: CreateScreenDto, file?: any): Promise<Screen> {
    this.logger.log(`Adding screen to device ${body.deviceId}`)
    if (body.externalLink && file)
      throw new BadRequestException('Can\'t upload a file to an external image')
    if (!body.externalLink && !file)
      throw new BadRequestException('Need either external link or file to add screen')
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
      generatedAt: new Date(),
    })
    const saved = await this.screensRepository.save(newScreen)
    this.logger.log(`Screen created with id: ${saved.id} for device: ${body.deviceId}`)

    // Fetch initial image right now
    if (body.externalLink && body.fetchManual) {
      const destDir = path.join(__dirname, '..', '..', 'public', 'screens', 'devices', device.id)
      const inputPath = path.join(destDir, 'tmp-source')
      const bmpFilename = `${saved.id}.bmp`
      const outputPath = path.join(destDir, bmpFilename)
      this.logger.debug(`Input path: ${inputPath}`)
      this.logger.debug(`Planned output path: ${outputPath}`)
      try {
        await downloadImage(body.externalLink, inputPath, this.logger)
        await convertToMonochromeBmp(inputPath, outputPath, device.width, device.height, this.logger)
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
        const destDir = path.join(__dirname, '..', '..', 'public', 'screens', 'devices', device.id)
        await fs.promises.mkdir(destDir, { recursive: true })
        const inputPath = path.join(destDir, `${saved.id}-source`)
        const bmpFilename = `${saved.id}.bmp`
        const outputPath = path.join(destDir, bmpFilename)
        this.logger.debug(`Input path: ${inputPath}`)
        this.logger.debug(`Planned output path: ${outputPath}`)
        await fs.promises.writeFile(inputPath, file.buffer)
        this.logger.log(`Uploaded file saved to ${inputPath}`)
        await convertToMonochromeBmp(inputPath, outputPath, device.width, device.height, this.logger)
        await fs.promises.unlink(inputPath)
        this.logger.log(`Converted and saved BMP to ${outputPath}`)
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
    return this.screensRepository.find({ where: { device: { id: deviceId } }, order: { order: 'ASC' } })
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting screen ${id}`)
    const screen = await this.screensRepository.findOne({ where: { id }, relations: ['device'] })
    if (!screen) {
      this.logger.warn(`Screen not found: ${id}`)
      throw new NotFoundException('Screen not found')
    }
    const deviceId = screen.device.id
    // Delete BMP file if it exists
    const bmpPath = path.join(__dirname, '..', '..', 'public', 'screens', 'devices', deviceId, `${id}.bmp`)
    try {
      await fs.promises.unlink(bmpPath)
      this.logger.log(`Deleted BMP file: ${bmpPath}`)
    }
    catch (err) {
      if (err.code === 'ENOENT') {
        this.logger.warn(`BMP file not found for deletion: ${bmpPath}`)
      }
      else {
        this.logger.error(`Failed to delete BMP file: ${bmpPath} - ${err.message}`)
      }
    }
    await this.screensRepository.delete(id)
    this.logger.log(`Screen deleted: ${id}`)
    // Reindex order for remaining screens
    const screens = await this.screensRepository.find({ where: { device: { id: deviceId } }, order: { order: 'ASC' } })
    for (let i = 0; i < screens.length; i++) {
      if (screens[i].order !== i + 1) {
        screens[i].order = i + 1
        await this.screensRepository.save(screens[i])
      }
    }
    this.logger.log(`Reindexed screen order for device ${deviceId}`)
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
    const destDir = path.join(__dirname, '..', '..', 'public', 'screens', 'devices', screen.device.id)
    const inputPath = path.join(destDir, 'tmp-source')
    const bmpFilename = `${screen.id}.bmp`
    const outputPath = path.join(destDir, bmpFilename)
    try {
      await downloadImage(screen.externalLink, inputPath, this.logger)
      await convertToMonochromeBmp(inputPath, outputPath, screen.device.width, screen.device.height, this.logger)
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
