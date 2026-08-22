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
import { DeviceSensorsService } from '../device-sensors/device-sensors.service'
import { FirmwareService } from '../firmware/firmware.service'
import { PluginDataFetcherService } from '../plugins/services/plugin-data-fetcher.service'
import { PluginRendererService } from '../plugins/services/plugin-renderer.service'
import { PluginTemplateContextService } from '../plugins/services/plugin-template-context.service'
import { PluginTransformService } from '../plugins/services/plugin-transform.service'
import { isScheduleEligible } from '../schedule/schedule-eligibility'
import { Screen } from '../screens/screens.entity'
import { fileExists } from '../utils/fileExists'
import { getErrorMessage } from '../utils/getErrorMessage'
import { convertToPng, downloadImage } from '../utils/imageUtils'
import { parseHeaderInt } from '../utils/parseHeaderInt'
import { resolveAppPath } from '../utils/pathHelper'
import { Device } from './devices.entity'
import { Display } from './display'
import { DisplayScreen } from './displayScreen'
import { isDeviceAsleep, secondsUntilSleepEnd } from './sleep-mode'

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
    private firmwareService: FirmwareService,
    private pluginDataFetcher: PluginDataFetcherService,
    private pluginRenderer: PluginRendererService,
    private pluginTransformer: PluginTransformService,
    private deviceSensors: DeviceSensorsService,
    private pluginTemplateContext: PluginTemplateContextService,
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
          this.deviceSensors,
          this.pluginTemplateContext,
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
    await this.deviceSensors.syncFromHeader(device, headers.sensors)
    // Handling reset
    const resetDevice = device.resetDevice
    device.resetDevice = false
    // A Special Function fires once: this response acknowledges it, the next poll gets 'none'
    const specialFunction = device.specialFunction ?? 'none'
    device.specialFunction = 'none'
    const { firmwareUrl: pushedFirmwareUrl, updateFirmware: pushedUpdateFirmware } = await this.resolveFirmwarePush(device)
    device.lastSeen = new Date()
    await this.deviceRepository.save(device)
    this.logger.log(`Device info updated for MAC: ${headers.id}`)
    if (!device.mirrorEnabled) {
      const now = new Date()
      if (isDeviceAsleep(device, now)) {
        this.logger.log(`Device ${device.id} is asleep. Holding rotation.`)
        return this.buildSleepResponse(device, now, specialFunction, pushedFirmwareUrl, resetDevice, pushedUpdateFirmware)
      }
      this.logger.log(`Device ${device.id} is not mirrored. Cycling screens.`)
      const screens = await this.screenRepository.find({
        where: { device: { id: device.id } },
        relations: { schedule: true },
        order: { order: 'ASC' },
      })
      const nextScreen = this.nextEligibleScreen(screens, new Date())
      if (screens.length > 0)
        await this.screenRepository.update({ device: { id: device.id } }, { isActive: false })
      if (!nextScreen) {
        this.logger.log(`No eligible screen for device ${device.id} returning default no screen image`)
        return new Display({
          action: specialFunction,
          filename: 'noScreen.png',
          firmware_url: pushedFirmwareUrl,
          image_url: await this.fallbackImageUrl('noScreen', device),
          refresh_rate: device.refreshRate,
          reset_firmware: resetDevice,
          special_function: specialFunction,
          temperature_profile: 'default',
          update_firmware: pushedUpdateFirmware,
        })
      }
      nextScreen.isActive = true
      await this.screenRepository.save(nextScreen)
      this.logger.log(`Returning screen ${nextScreen.id} for device ${device.id}`)

      const imgUrl = await this.generateScreenImage(nextScreen, device)

      return new Display({
        action: specialFunction,
        filename: `${nextScreen.filename}_${nextScreen.generatedAt.toISOString()}`,
        firmware_url: pushedFirmwareUrl,
        image_url: imgUrl,
        refresh_rate: device.refreshRate,
        reset_firmware: resetDevice,
        special_function: specialFunction,
        temperature_profile: 'default',
        update_firmware: pushedUpdateFirmware,
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
      let firmwareUrl: string | null = null
      let resetFirmware = resetDevice
      let mirrorSpecialFunction = specialFunction
      let mirrorAction = specialFunction
      let updateFirmware = false
      try {
        const { response, localImageUrl: localImage } = await this.fetchAndStoreMirrorImage(device, proxy ? headers : undefined)

        refreshRate = proxy ? (response.refresh_rate ?? refreshRate) : refreshRate
        firmwareUrl = proxy ? (response.firmware_url ?? firmwareUrl) : firmwareUrl
        resetFirmware = proxy ? (response.reset_firmware ?? resetFirmware) : resetFirmware
        mirrorSpecialFunction = proxy ? (response.special_function ?? 'none') : mirrorSpecialFunction
        mirrorAction = proxy ? (response.action ?? mirrorSpecialFunction) : mirrorAction
        updateFirmware = proxy ? (response.update_firmware ?? updateFirmware) : updateFirmware
        localImageUrl = localImage
        filename = response.filename
      }
      catch (err) {
        const message = getErrorMessage(err)
        this.logger.error(`Failed to process image: ${message}`)
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

  /**
   * A non-mirrored Device's own OTA push: a one-shot pull of its assigned target
   * Firmware, triggered only by an explicit admin assignment (never inferred from
   * `fwVersion`). The flag only clears once the binary is actually served, so a
   * checksum mismatch (a corrupted file on disk) leaves it set to retry on the
   * Device's next poll instead of silently skipping the update for good. A
   * mirrored Device is left untouched — its firmware comes from TRMNL's own
   * pass-through instead.
   */
  private async resolveFirmwarePush(device: Device): Promise<{ firmwareUrl: string, updateFirmware: boolean }> {
    if (device.mirrorEnabled || !device.updateFirmware || !device.targetFirmware)
      return { firmwareUrl: '', updateFirmware: false }
    const target = device.targetFirmware
    if (!await this.firmwareService.verifyChecksum(target)) {
      this.logger.warn(`Firmware ${target.id} (${target.version}) failed checksum verification, skipping OTA push for device ${device.id}`)
      return { firmwareUrl: '', updateFirmware: false }
    }
    device.updateFirmware = false
    return { firmwareUrl: this.firmwareService.fileUrl(target.id), updateFirmware: true }
  }

  /**
   * Scans forward by `order` from the Active Screen, wrapping past the end, and
   * returns the first Screen whose Schedule currently lets it show. Scanning from
   * the start of the Rotation when no Screen is active is what lets a Device that
   * had nothing eligible pick the Rotation back up on a later poll.
   */
  private nextEligibleScreen(screens: Screen[], now: Date): Screen | null {
    const activeIndex = screens.findIndex(screen => screen.isActive)
    const startIndex = activeIndex === -1 ? 0 : activeIndex + 1
    for (let offset = 0; offset < screens.length; offset++) {
      const candidate = screens[(startIndex + offset) % screens.length]
      if (isScheduleEligible(candidate.schedule, now))
        return candidate
    }
    return null
  }

  /**
   * The Active Screen does not advance while a Device is asleep (ADR-0012):
   * `refresh_rate` is the seconds until `sleepEndTime` so the Device wakes
   * exactly on schedule, and the served image is either the dedicated Sleep
   * fallback screen or whatever was already showing.
   */
  private async buildSleepResponse(device: Device, now: Date, specialFunction: string, firmwareUrl: string, resetDevice: boolean, updateFirmware: boolean): Promise<Display> {
    const refreshRate = secondsUntilSleepEnd(device.sleepEndTime!, now)
    const { filename, imgUrl } = device.sleepScreenEnabled
      ? { filename: 'sleep.png', imgUrl: await this.fallbackImageUrl('sleep', device) }
      : await this.resolveFrozenImage(device)
    return new Display({
      action: specialFunction,
      filename,
      firmware_url: firmwareUrl,
      image_url: imgUrl,
      refresh_rate: refreshRate,
      reset_firmware: resetDevice,
      special_function: specialFunction,
      temperature_profile: 'default',
      update_firmware: updateFirmware,
    })
  }

  /**
   * "Last content" for a sleeping Device with the dedicated Sleep screen
   * turned off: whatever the current Active Screen already has on disk, or
   * the plain no-screen fallback for a Device that never had one.
   */
  private async resolveFrozenImage(device: Device): Promise<{ filename: string, imgUrl: string }> {
    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen)
      return { filename: 'noScreen.png', imgUrl: await this.fallbackImageUrl('noScreen', device) }
    const imgUrl = await fileExists(this.screenImagePath(device, activeScreen))
      ? this.screenImageUrl(device, activeScreen)
      : await this.generateScreenImage(activeScreen, device)
    return { filename: `${activeScreen.filename}_${activeScreen.generatedAt.toISOString()}`, imgUrl }
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
    const now = new Date()
    const asleep = !device.mirrorEnabled && isDeviceAsleep(device, now)
    const refreshRate = asleep ? secondsUntilSleepEnd(device.sleepEndTime!, now) : device.refreshRate

    if (asleep && device.sleepScreenEnabled) {
      this.logger.log(`Device ${device.id} is asleep. Returning the dedicated sleep screen.`)
      return new DisplayScreen({
        filename: 'sleep.png',
        image_url: await this.fallbackImageUrl('sleep', device),
        refresh_rate: refreshRate,
        rendered_at: now,
      })
    }

    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      this.logger.log('No screen found returning default no screen image')
      return new DisplayScreen({
        filename: 'noScreen.png',
        image_url: await this.fallbackImageUrl('noScreen', device),
        refresh_rate: refreshRate,
        rendered_at: new Date(),
      })
    }
    let imgUrl = await this.fallbackImageUrl('error', device)
    let filename: string
    let renderedAt: Date | undefined
    if (device.mirrorEnabled) {
      filename = `mirror_${new Date().toISOString()}`
      renderedAt = undefined
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
          const message = getErrorMessage(err)
          this.logger.error(`Failed to fetch mirror image on demand: ${message}`)
        }
      }
    }
    else {
      if (!activeScreen)
        throw new NotFoundException('No active screen found for device')
      this.logger.log(`Returning screen ${activeScreen.id} for device ${device.id}`)
      if (await fileExists(this.screenImagePath(device, activeScreen))) {
        imgUrl = this.screenImageUrl(device, activeScreen)
      }
      else {
        this.logger.log(`Screen image for ${activeScreen.id} missing on disk, generating on demand`)
        imgUrl = await this.generateScreenImage(activeScreen, device)
      }
      filename = `${activeScreen.filename}_${activeScreen.generatedAt.toISOString()}`
      renderedAt = activeScreen.generatedAt
    }
    return new DisplayScreen({
      filename,
      image_url: imgUrl,
      refresh_rate: refreshRate,
      rendered_at: renderedAt,
    })
  }

  private async fetchAndStoreMirrorImage(device: Device, proxyHeaders?: DisplayRequestHeadersDto): Promise<{ response: TrmnlScreenResponse, localImageUrl: string }> {
    if (!device.mirrorMac || !device.mirrorApikey) {
      throw new Error(`Device ${device.id} has mirroring enabled but is missing a mirror MAC or API key`)
    }
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
                  dataSources: true,
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
        const message = getErrorMessage(err)
        this.logger.error(`Failed to render mashup: ${message}`)
        imgUrl = await this.fallbackImageUrl('error', device)
      }
    }
    // Handle plugin screen
    else {
      // Load plugin relationship if needed
      const screenWithPlugin = await this.screenRepository.findOne({
        where: { id: screen.id },
        relations: { plugin: { dataSources: true, templates: true } },
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
            const message = getErrorMessage(err)
            this.logger.error(`Failed to render cached plugin output: ${message}`)
            imgUrl = await this.fallbackImageUrl('error', device)
          }
        }
        // Fallback: fetch and render on-demand
        else if (plugin.dataSources && plugin.dataSources.length > 0 && plugin.templates && plugin.templates.length > 0) {
          try {
            const renderedHtml = await this.renderPluginHtml(plugin, screen, device)
            if (renderedHtml)
              imgUrl = await this.renderBodyToScreenPng(viewFull(renderedHtml), screen, device)
          }
          catch (err) {
            const message = getErrorMessage(err)
            this.logger.error(`Failed to render plugin: ${message}`)
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
        const message = getErrorMessage(err)
        this.logger.error(`Failed to process image: ${message}`)
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

  private async renderPluginHtml(plugin: Plugin, screen: Screen, device: Device): Promise<string | null> {
    this.logger.log(`No cache, rendering plugin ${plugin.id} on-demand for screen ${screen.id}`)

    const sensors = await this.deviceSensors.findForDevice(device.id)
    const templateContext = this.pluginTemplateContext.build(plugin, sensors)

    // Fetch all of the plugin's data sources in parallel; a source that fails
    // gets an error marker instead of aborting the whole render (ADR-0005)
    const results = await Promise.allSettled(
      plugin.dataSources.map(async (source) => {
        let rawData = await this.pluginDataFetcher.fetchData(source.method, source.url, source.headers, source.body, templateContext)
        if (source.transformJs) {
          this.logger.debug(`Applying transform.js to data source: ${source.name}`)
          rawData = this.pluginTransformer.transform(source.transformJs, rawData)
        }
        return rawData
      }),
    )

    const data: Record<string, unknown> = {}
    results.forEach((result, index) => {
      const name = plugin.dataSources[index].name
      if (result.status === 'fulfilled') {
        data[name] = result.value
      }
      else {
        this.logger.warn(`Data source "${name}" failed for plugin ${plugin.id}: ${result.reason?.message || result.reason}`)
        data[name] = { error: true, message: result.reason?.message || String(result.reason) }
      }
    })

    const fullTemplate = plugin.templates.find(t => t.layout === 'full')
    if (!fullTemplate)
      return null

    const renderedHtml = await this.pluginRenderer.render(fullTemplate.liquidMarkup, { ...templateContext, ...data })
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

  private async fallbackImageUrl(kind: 'noScreen' | 'error' | 'sleep', device: Device): Promise<string> {
    return this.fallbackScreens.urlFor(kind, await this.deviceModels.renderTargetFor(device))
  }
}
