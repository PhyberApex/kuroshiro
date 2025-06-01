import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Screen } from '../screens/screens.entity'
import { convertToMonochromeBmp, downloadImage } from '../utils/imageUtils'
import { resolveAppPath } from '../utils/pathHelper'
import { Device } from './devices.entity'
import { Display } from './display'
import { DisplayScreen } from './displayScreen'

@Injectable()
export class DeviceDisplayService {
  private readonly logger = new Logger(DeviceDisplayService.name)
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private screenRepository: Repository<Screen>,
    private configService: ConfigService,
  ) {}

  async getCurrentImage(headers: DisplayRequestHeadersDto): Promise<Display> {
    this.logger.log(`Display request for MAC: ${headers.id}`)
    this.logger.debug(`Headers: ${JSON.stringify(headers)}`)
    const device = await this.deviceRepository.findOneBy({ mac: headers.id })
    if (!device) {
      this.logger.warn(`Device not found: ${headers.id}`)
      throw new NotFoundException('Device not found')
    }
    if (device.apikey !== headers['access-token']) {
      this.logger.warn(`Invalid API key for device: ${headers.id}`)
      throw new UnauthorizedException('Invalid API key')
    }
    this.logger.log(`Updating device info for MAC: ${headers.id}`)
    device.batteryVoltage = headers['battery-voltage']
    device.fwVersion = headers['fw-version']
    device.rssi = headers.rssi
    device.userAgent = headers['user-agent']
    // Check if height or width has been set already and send error if not initial set
    if (device.width && Number(headers.width) !== device.width)
      throw new BadRequestException('You can\'t change the width anymore')
    if (device.height && Number(headers.height) !== device.height)
      throw new BadRequestException('You can\'t change the height anymore')
    device.height = headers.height
    device.width = headers.width
    // Handling reset
    const resetDevice = device.resetDevice
    device.resetDevice = false
    const updateFirmware = false
    device.lastSeen = new Date()
    await this.deviceRepository.save(device)
    this.logger.log(`Device info updated for MAC: ${headers.id}`)
    const activeScreen = await this.screenRepository.findOneBy({ device, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      this.logger.log('No screen found returning default no screen image')
      return new Display({
        filename: 'noScreen.bmp',
        firmware_url: '',
        image_url: `${this.configService.get<string>('api_url')}/screens/noScreen.bmp`,
        refresh_rate: device.refreshRate,
        reset_firmware: resetDevice,
        special_function: device.specialFunction,
        update_firmware: updateFirmware,
      })
    }
    if (!device.mirrorEnabled) {
      this.logger.log(`Device ${device.id} is not mirrored. Cycling screens.`)
      await this.screenRepository.update({ device: { id: device.id } }, { isActive: false })
      let nextScreen = await this.screenRepository.findOneBy({ device, order: activeScreen.order + 1 })
      if (!nextScreen) {
        this.logger.log(`No next screen found, cycling to first screen for device ${device.id}`)
        nextScreen = await this.screenRepository.findOneBy({ device, order: 1 })
      }
      nextScreen.isActive = true
      await this.screenRepository.save(nextScreen)
      this.logger.log(`Returning screen ${nextScreen.id} for device ${device.id}`)
      let imgUrl = `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${nextScreen.id}.bmp`
      if (nextScreen.externalLink && !nextScreen.fetchManual) {
        const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
        const inputPath = path.join(destDir, 'tmp-source')
        const bmpFilename = `${nextScreen.id}.bmp`
        const outputPath = path.join(destDir, bmpFilename)
        try {
          await downloadImage(nextScreen.externalLink, inputPath, this.logger)
          await convertToMonochromeBmp(inputPath, outputPath, device.width, device.height, this.logger)
          this.logger.log('Updating generation date on screen')
          nextScreen.generatedAt = new Date()
          await this.screenRepository.save(nextScreen)
          this.logger.log('Download and conversion successful')
        }
        catch (err) {
          this.logger.error(`Failed to process image: ${err.message}`)
          imgUrl = `${this.configService.get<string>('api_url')}/screens/error.bmp`
        }
      }
      return new Display({
        filename: nextScreen.filename,
        firmware_url: '',
        image_url: imgUrl,
        refresh_rate: device.refreshRate,
        reset_firmware: false,
        special_function: device.specialFunction,
        update_firmware: false,
      })
    }
    else {
      this.logger.log(`Device ${device.id} is mirrored. Fetching from TRMNL.`)
      let refreshRate = device.refreshRate
      let filename = 'error.bpm'
      let localImageUrl = `${this.configService.get<string>('api_url')}/screens/error.bmp`
      try {
        const res = await fetch('https://usetrmnl.com/api/current_screen', {
          headers: {
            'Access-Token': device.mirrorApikey,
            'ID': device.mirrorMac,
          },
        })
        const response = await res.json()
        this.logger.debug(`Got this from TRMNL ${JSON.stringify(response)}`)
        const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
        const inputPath = path.join(destDir, response.filename)
        const bmpFilename = 'mirror.bmp'
        const outputPath = path.join(destDir, bmpFilename)

        await downloadImage(response.image_url, inputPath, this.logger)
        await convertToMonochromeBmp(inputPath, outputPath, device.width, device.height, this.logger)
        await fs.promises.unlink(inputPath)
        this.logger.log(`Deleted original image: ${inputPath}`)
        refreshRate = response.refresh_rate
        localImageUrl = `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${bmpFilename}`
        filename = bmpFilename
      }
      catch (err) {
        this.logger.error(`Failed to process image: ${err.message}`)
      }
      this.logger.log(`Returning mirrored screen for device ${device.id}`)
      return new Display({
        filename,
        firmware_url: null,
        image_url: localImageUrl,
        refresh_rate: refreshRate,
        reset_firmware: false,
        special_function: device.specialFunction,
        update_firmware: false,
      })
    }
  }

  async getCurrentImageWithoutProgressing(headers: Pick<DisplayRequestHeadersDto, 'id' | 'access-token'>): Promise<DisplayScreen> {
    this.logger.log(`Current Screen request for MAC: ${headers.id}`)
    this.logger.debug(`Headers: ${JSON.stringify(headers)}`)
    const device = await this.deviceRepository.findOneBy({ mac: headers.id })
    if (!device) {
      this.logger.warn(`Device not found: ${headers.id}`)
      throw new NotFoundException('Device not found')
    }
    if (device.apikey !== headers['access-token']) {
      this.logger.warn(`Invalid API key for device: ${headers.id}`)
      throw new UnauthorizedException('Invalid API key')
    }
    const activeScreen = await this.screenRepository.findOneBy({ device, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      this.logger.log('No screen found returning default no screen image')
      return new DisplayScreen({
        filename: 'noScreen.bmp',
        image_url: `${this.configService.get<string>('api_url')}/screens/noScreen.bmp`,
        refresh_rate: device.refreshRate,
        rendered_at: new Date(),
      })
    }
    this.logger.log(`Returning screen ${activeScreen.id} for device ${device.id}`)
    const imgUrl = device.mirrorEnabled ? `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/mirror.bmp` : `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${activeScreen.id}.bmp`
    return new DisplayScreen({
      filename: activeScreen.filename,
      image_url: imgUrl,
      refresh_rate: device.refreshRate,
      rendered_at: device.mirrorEnabled ? new Date() : activeScreen.generatedAt,
    })
  }
}
