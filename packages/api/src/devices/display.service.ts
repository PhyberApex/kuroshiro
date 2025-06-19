import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto'
import buffer from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import puppeteer from 'puppeteer'
import { fileExists } from 'src/utils/fileExists'
import { convertToMonochromeBmp, downloadImage } from 'src/utils/imageUtils'
import { Repository } from 'typeorm'
import { Screen } from '../screens/screens.entity'
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
    device.height = Number.parseInt(headers.height)
    device.width = Number.parseInt(headers.width)
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
      if (nextScreen.html) {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-web-security'] })
        const page = await browser.newPage()
        await page.setViewport({ width: 800, height: 480 })
        const content = `
    <html>
      <head>
        <link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
        <script src="https://usetrmnl.com/js/latest/plugins.js"></script>
      </head>
      <body class="environment trmnl">
        <div class="screen">
          <div class="view view--full">
            ${nextScreen.html}
          </div>
        </div>
      </body>
    </html>
  `
        await page.setContent(content, { waitUntil: 'load' })
        const image: Uint8Array = await page.screenshot()
        const imgBuffer = buffer.Buffer.from(image)
        const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
        const inputPath = path.join(destDir, 'tmp-source')
        await fs.promises.mkdir(path.dirname(inputPath), { recursive: true })
        await fs.promises.writeFile(inputPath, imgBuffer)
        const outputPath = path.join(destDir, `${nextScreen.id}.bmp`)
        await convertToMonochromeBmp(inputPath, outputPath, device.width, device.height, this.logger)
      }
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
        filename: `${nextScreen.filename}_${nextScreen.generatedAt}`,
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
      let proxy = false
      if (device.mac === device.mirrorMac) {
        this.logger.log(`MACs are identical we should proxy the device.`)
        proxy = true
      }
      else {
        this.logger.log(`MACs are different we should mirror with current_screen endpoint.`)
      }
      let refreshRate = device.refreshRate
      let filename = 'error.bpm'
      let localImageUrl = `${this.configService.get<string>('api_url')}/screens/error.bmp`
      let firmwareUrl = null
      let resetFirmware = false
      let specialFunction = device.specialFunction
      let updateFirmware = false
      try {
        const mirrorHeaders = proxy
          ? { ...headers, 'ID': device.mirrorMac, 'access-token': device.mirrorApikey }
          : { 'access-token': device.mirrorApikey, 'ID': device.mirrorMac }
        this.logger.debug(`Sending headers: ${JSON.stringify(mirrorHeaders)}`)
        const res = await fetch(`https://usetrmnl.com/api/${proxy ? 'display' : 'current_screen'}`, {
          headers: mirrorHeaders,
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

        refreshRate = proxy ? response.refresh_rate : refreshRate
        firmwareUrl = proxy ? response.firmware_url : firmwareUrl
        resetFirmware = proxy ? response.reset_firmware : resetFirmware
        specialFunction = proxy ? response.special_function : specialFunction
        updateFirmware = proxy ? response.update_firmware : updateFirmware
        localImageUrl = `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${bmpFilename}`
        filename = response.filename
      }
      catch (err) {
        this.logger.error(`Failed to process image: ${err.message}`)
      }
      this.logger.log(`Returning mirrored screen for device ${device.id}`)
      return new Display({
        filename,
        firmware_url: firmwareUrl,
        image_url: localImageUrl,
        refresh_rate: refreshRate,
        reset_firmware: resetFirmware,
        special_function: specialFunction,
        update_firmware: updateFirmware,
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
    let imgUrl = `${this.configService.get<string>('api_url')}/screens/error.bmp`
    if (device.mirrorEnabled) {
      this.logger.log(`Mirroring enabled for device ${device.id}, checking for image...`)
      if (await fileExists(resolveAppPath('public', 'screens', 'devices', device.id, 'mirror.bmp'))) {
        this.logger.log(`Image found returning`)
        imgUrl = `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/mirror.bmp`
      }
    }
    else {
      this.logger.log(`Returning screen ${activeScreen.id} for device ${device.id}`)
      imgUrl = `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${activeScreen.id}.bmp`
    }
    return new DisplayScreen({
      filename: device.mirrorEnabled ? 'mirror' : `${activeScreen.filename}_${activeScreen.generatedAt}`,
      image_url: imgUrl,
      refresh_rate: device.refreshRate,
      rendered_at: device.mirrorEnabled ? undefined : activeScreen.generatedAt,
    })
  }
}
