import type { MashupRendererService } from '../mashup/services/mashup-renderer.service'
import type { Plugin } from '../plugins/entities/plugin.entity'
import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service'
import { FallbackScreensService } from '../device-models/fallback-screens.service'
import { renderHtmlToPng } from '../device-models/render-html-to-png'
import { viewFull, wrapInScreenShell } from '../device-models/screen-shell'
import { PluginDataFetcherService } from '../plugins/services/plugin-data-fetcher.service'
import { PluginRendererService } from '../plugins/services/plugin-renderer.service'
import { PluginTransformService } from '../plugins/services/plugin-transform.service'
import { Screen } from '../screens/screens.entity'
import { fileExists } from '../utils/fileExists'
import { convertToPng, downloadImage } from '../utils/imageUtils'
import { parseHeaderInt } from '../utils/parseHeaderInt'
import { resolveAppPath } from '../utils/pathHelper'
import { Device } from './devices.entity'
import { Display } from './display'
import { DisplayScreen } from './displayScreen'

interface TrmnlScreenResponse {
  action?: string
  filename: string
  image_url: string
  refresh_rate?: number
  firmware_url?: string
  reset_firmware?: boolean
  special_function?: string
  update_firmware?: boolean
}

@Injectable()
export class DeviceDisplayService {
  private readonly logger = new Logger(DeviceDisplayService.name)
  private mashupRenderer: MashupRendererService

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private screenRepository: Repository<Screen>,
    private configService: ConfigService,
    private deviceModels: DeviceModelsService,
    private fallbackScreens: FallbackScreensService,
    private pluginDataFetcher: PluginDataFetcherService,
    private pluginRenderer: PluginRendererService,
    private pluginTransformer: PluginTransformService,
  ) {
    // Lazy injection to avoid circular dependency
    setTimeout(async () => {
      try {
        const { MashupRendererService } = await import('../mashup/services/mashup-renderer.service.js')
        // Get it from the module (this is a workaround for circular deps)
        this.mashupRenderer = new MashupRendererService(
          this.pluginDataFetcher,
          this.pluginRenderer,
          this.pluginTransformer,
          this.configService,
        )
      }
      catch {
        this.logger.debug('MashupRendererService not available')
      }
    }, 0)
  }

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
    device.width = parseHeaderInt(headers.width) ?? device.width
    device.height = parseHeaderInt(headers.height) ?? device.height
    device.reportedModel = headers.model ?? device.reportedModel
    if (!device.deviceModel)
      await this.deviceModels.assignResolvedModel(device)
    // Handling reset
    const resetDevice = device.resetDevice
    device.resetDevice = false
    // A Special Function fires once: this response acknowledges it, the next poll gets 'none'
    const specialFunction = device.specialFunction
    device.specialFunction = 'none'
    const updateFirmware = false
    device.lastSeen = new Date()
    await this.deviceRepository.save(device)
    this.logger.log(`Device info updated for MAC: ${headers.id}`)
    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      this.logger.log('No screen found returning default no screen image')
      return new Display({
        action: specialFunction,
        filename: 'noScreen.png',
        firmware_url: '',
        image_url: await this.fallbackImageUrl('noScreen', device),
        refresh_rate: device.refreshRate,
        reset_firmware: resetDevice,
        special_function: specialFunction,
        temperature_profile: 'default',
        update_firmware: updateFirmware,
      })
    }
    if (!device.mirrorEnabled) {
      this.logger.log(`Device ${device.id} is not mirrored. Cycling screens.`)
      await this.screenRepository.update({ device: { id: device.id } }, { isActive: false })
      let nextScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, order: activeScreen.order + 1 })
      if (!nextScreen) {
        this.logger.log(`No next screen found, cycling to first screen for device ${device.id}`)
        nextScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, order: 1 })
      }
      nextScreen.isActive = true
      await this.screenRepository.save(nextScreen)
      this.logger.log(`Returning screen ${nextScreen.id} for device ${device.id}`)

      const imgUrl = await this.generateScreenImage(nextScreen, device)

      return new Display({
        action: specialFunction,
        filename: `${nextScreen.filename}_${nextScreen.generatedAt.toISOString()}`,
        firmware_url: '',
        image_url: imgUrl,
        refresh_rate: device.refreshRate,
        reset_firmware: false,
        special_function: specialFunction,
        temperature_profile: 'default',
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
      let filename = 'error.png'
      let localImageUrl = await this.fallbackImageUrl('error', device)
      let firmwareUrl = null
      let resetFirmware = false
      let mirrorSpecialFunction = specialFunction
      let mirrorAction = specialFunction
      let updateFirmware = false
      try {
        const { response, localImageUrl: localImage } = await this.fetchAndStoreMirrorImage(device, proxy ? headers : undefined)

        refreshRate = proxy ? response.refresh_rate : refreshRate
        firmwareUrl = proxy ? response.firmware_url : firmwareUrl
        resetFirmware = proxy ? response.reset_firmware : resetFirmware
        mirrorSpecialFunction = proxy ? response.special_function : mirrorSpecialFunction
        mirrorAction = proxy ? response.action : mirrorAction
        updateFirmware = proxy ? response.update_firmware : updateFirmware
        localImageUrl = localImage
        filename = response.filename
      }
      catch (err) {
        this.logger.error(`Failed to process image: ${err.message}`)
      }
      this.logger.log(`Returning mirrored screen for device ${device.id}`)
      return new Display({
        action: mirrorAction,
        filename,
        firmware_url: firmwareUrl,
        image_url: localImageUrl,
        refresh_rate: refreshRate,
        reset_firmware: resetFirmware,
        special_function: mirrorSpecialFunction,
        temperature_profile: 'default',
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
    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      this.logger.log('No screen found returning default no screen image')
      return new DisplayScreen({
        filename: 'noScreen.png',
        image_url: await this.fallbackImageUrl('noScreen', device),
        refresh_rate: device.refreshRate,
        rendered_at: new Date(),
      })
    }
    let imgUrl = await this.fallbackImageUrl('error', device)
    if (device.mirrorEnabled) {
      this.logger.log(`Mirroring enabled for device ${device.id}, checking for image...`)
      if (await fileExists(resolveAppPath('public', 'screens', 'devices', device.id, 'mirror.png'))) {
        this.logger.log(`Image found returning`)
        imgUrl = `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/mirror.png`
      }
      else {
        this.logger.log(`Mirror image missing on disk, fetching from TRMNL on demand`)
        try {
          const { localImageUrl } = await this.fetchAndStoreMirrorImage(device)
          imgUrl = localImageUrl
        }
        catch (err) {
          this.logger.error(`Failed to fetch mirror image on demand: ${err.message}`)
        }
      }
    }
    else {
      this.logger.log(`Returning screen ${activeScreen.id} for device ${device.id}`)
      if (await fileExists(this.screenImagePath(device, activeScreen))) {
        imgUrl = this.screenImageUrl(device, activeScreen)
      }
      else {
        this.logger.log(`Screen image for ${activeScreen.id} missing on disk, generating on demand`)
        imgUrl = await this.generateScreenImage(activeScreen, device)
      }
    }
    return new DisplayScreen({
      filename: device.mirrorEnabled ? `mirror_${new Date().toISOString()}` : `${activeScreen.filename}_${activeScreen.generatedAt.toISOString()}`,
      image_url: imgUrl,
      refresh_rate: device.refreshRate,
      rendered_at: device.mirrorEnabled ? undefined : activeScreen.generatedAt,
    })
  }

  private async fetchAndStoreMirrorImage(device: Device, proxyHeaders?: DisplayRequestHeadersDto): Promise<{ response: TrmnlScreenResponse, localImageUrl: string }> {
    const mirrorHeaders = proxyHeaders
      ? { ...proxyHeaders, 'ID': device.mirrorMac, 'access-token': device.mirrorApikey }
      : { 'access-token': device.mirrorApikey, 'ID': device.mirrorMac }
    this.logger.debug(`Sending headers: ${JSON.stringify(mirrorHeaders)}`)
    const res = await fetch(`https://usetrmnl.com/api/${proxyHeaders ? 'display' : 'current_screen'}`, {
      headers: mirrorHeaders,
    })
    const response: TrmnlScreenResponse = await res.json()
    this.logger.debug(`Got this from TRMNL ${JSON.stringify(response)}`)

    const destDir = resolveAppPath('public', 'screens', 'devices', device.id)
    const inputPath = path.join(destDir, response.filename)
    const pngFilename = 'mirror.png'
    const outputPath = path.join(destDir, pngFilename)

    await downloadImage(response.image_url, inputPath, this.logger)
    await convertToPng(inputPath, outputPath, await this.deviceModels.renderTargetFor(device), this.logger)
    await fs.promises.unlink(inputPath)
    this.logger.log(`Deleted original image: ${inputPath}`)

    return { response, localImageUrl: `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${pngFilename}` }
  }

  private async generateScreenImage(screen: Screen, device: Device): Promise<string> {
    let imgUrl: string | null = null

    // Handle mashup screen
    if (screen.type === 'mashup') {
      try {
        const screenWithMashup = await this.screenRepository.findOne({
          where: { id: screen.id },
          relations: {
            mashupConfiguration: {
              slots: {
                plugin: {
                  dataSource: true,
                  templates: true,
                },
              },
            },
          },
        })

        if (screenWithMashup?.mashupConfiguration && this.mashupRenderer) {
          let renderedHtml: string

          // Use cached output if available
          if (screenWithMashup.cachedPluginOutput) {
            this.logger.log(`Using cached mashup output for screen ${screen.id}`)
            renderedHtml = screenWithMashup.cachedPluginOutput
          }
          else {
            this.logger.log(`Rendering mashup ${screenWithMashup.mashupConfiguration.id} for screen ${screen.id}`)
            renderedHtml = await this.mashupRenderer.renderMashup(screenWithMashup.mashupConfiguration, device)
            await this.cachePluginOutput(screen, renderedHtml)
          }

          imgUrl = await this.renderBodyToScreenPng(renderedHtml, screen, device)
        }
      }
      catch (err) {
        this.logger.error(`Failed to render mashup: ${err.message}`)
        imgUrl = await this.fallbackImageUrl('error', device)
      }
    }
    // Handle plugin screen
    else {
      // Load plugin relationship if needed
      const screenWithPlugin = await this.screenRepository.findOne({
        where: { id: screen.id },
        relations: { plugin: { dataSource: true, templates: true } },
      })

      if (screenWithPlugin?.plugin) {
        const plugin = screenWithPlugin.plugin

        // Use cached output if available
        if (screenWithPlugin.cachedPluginOutput) {
          try {
            this.logger.log(`Using cached plugin output for plugin ${plugin.id}, screen ${screen.id}`)
            imgUrl = await this.renderBodyToScreenPng(viewFull(screenWithPlugin.cachedPluginOutput), screen, device)
          }
          catch (err) {
            this.logger.error(`Failed to render cached plugin output: ${err.message}`)
            imgUrl = await this.fallbackImageUrl('error', device)
          }
        }
        // Fallback: fetch and render on-demand
        else if (plugin.dataSource && plugin.templates && plugin.templates.length > 0) {
          try {
            const renderedHtml = await this.renderPluginHtml(plugin, screen)
            if (renderedHtml)
              imgUrl = await this.renderBodyToScreenPng(viewFull(renderedHtml), screen, device)
          }
          catch (err) {
            this.logger.error(`Failed to render plugin: ${err.message}`)
            imgUrl = await this.fallbackImageUrl('error', device)
          }
        }
      }
      // Handle HTML screen
      else if (screen.html) {
        imgUrl = await this.renderBodyToScreenPng(viewFull(screen.html), screen, device)
      }
    }
    // Handle external link screen
    if (screen.externalLink && !screen.fetchManual) {
      const inputPath = path.join(resolveAppPath('public', 'screens', 'devices', device.id), 'tmp-source')
      try {
        await downloadImage(screen.externalLink, inputPath, this.logger)
        await convertToPng(inputPath, this.screenImagePath(device, screen), await this.deviceModels.renderTargetFor(device), this.logger)
        this.logger.log('Updating generation date on screen')
        screen.generatedAt = new Date()
        await this.screenRepository.save(screen)
        this.logger.log('Download and conversion successful')
        imgUrl = this.screenImageUrl(device, screen)
      }
      catch (err) {
        this.logger.error(`Failed to process image: ${err.message}`)
        imgUrl = await this.fallbackImageUrl('error', device)
      }
      finally {
        try {
          await fs.promises.unlink(inputPath)
        }
        catch {
          // best-effort cleanup
        }
      }
    }
    if (imgUrl !== null)
      return imgUrl

    // No rendering source (e.g. uploaded file screens) — serve the stored image if present
    return await fileExists(this.screenImagePath(device, screen))
      ? this.screenImageUrl(device, screen)
      : await this.fallbackImageUrl('error', device)
  }

  private async renderPluginHtml(plugin: Plugin, screen: Screen): Promise<string | null> {
    this.logger.log(`No cache, rendering plugin ${plugin.id} on-demand for screen ${screen.id}`)

    // Build template context with trmnl system variables
    const templateContext: any = {
      trmnl: {
        system: {
          timestamp_utc: Math.floor(Date.now() / 1000),
        },
        plugin_settings: {
          instance_name: plugin.name,
          strategy: 'polling',
          dark_mode: 'no',
          no_screen_padding: 'no',
        },
        user: {
          id: 'kuroshiro-user',
          locale: 'en',
        },
      },
    }

    // TODO: Add plugin field values to context when we have device-specific values

    let data = await this.pluginDataFetcher.fetchData(
      plugin.dataSource.method,
      plugin.dataSource.url,
      plugin.dataSource.headers,
      plugin.dataSource.body,
      templateContext,
    )

    // Apply transform if exists
    if (plugin.dataSource.transformJs) {
      this.logger.debug('Applying transform.js to fetched data')
      data = this.pluginTransformer.transform(plugin.dataSource.transformJs, data)
    }

    const fullTemplate = plugin.templates.find(t => t.layout === 'full')
    if (!fullTemplate)
      return null

    const renderedHtml = await this.pluginRenderer.render(fullTemplate.liquidMarkup, data)
    await this.cachePluginOutput(screen, renderedHtml)
    return renderedHtml
  }

  /**
   * Screenshots screen body markup (a `.view` or `.mashup` element) inside the
   * device's model shell at the model's native pixel size and converts it to
   * the device's PNG.
   */
  private async renderBodyToScreenPng(bodyHtml: string, screen: Screen, device: Device): Promise<string> {
    const target = await this.deviceModels.renderTargetFor(device)
    await renderHtmlToPng(wrapInScreenShell(target, bodyHtml), target, this.screenImagePath(device, screen), this.logger)
    return this.screenImageUrl(device, screen)
  }

  private async cachePluginOutput(screen: Screen, renderedHtml: string): Promise<void> {
    const generatedAt = new Date()
    await this.screenRepository.update({ id: screen.id }, { cachedPluginOutput: renderedHtml, generatedAt })
    screen.generatedAt = generatedAt
  }

  private screenImagePath(device: Device, screen: Screen): string {
    return resolveAppPath('public', 'screens', 'devices', device.id, `${screen.id}.png`)
  }

  private screenImageUrl(device: Device, screen: Screen): string {
    return `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${screen.id}.png`
  }

  private async fallbackImageUrl(kind: 'noScreen' | 'error', device: Device): Promise<string> {
    return this.fallbackScreens.urlFor(kind, await this.deviceModels.renderTargetFor(device))
  }
}
