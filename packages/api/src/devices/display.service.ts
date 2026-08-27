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
import { PluginDataResolverService } from '../plugins/services/plugin-data-resolver.service'
import { PluginRendererService } from '../plugins/services/plugin-renderer.service'
import { PluginTemplateContextService } from '../plugins/services/plugin-template-context.service'
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

export interface TrmnlScreenResponse {
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
    private pluginDataResolver: PluginDataResolverService,
    private pluginRenderer: PluginRendererService,
    private deviceSensors: DeviceSensorsService,
    private pluginTemplateContext: PluginTemplateContextService,
  ) {
    // Lazy injection to avoid circular dependency
    setTimeout(async () => {
      try {
        const { MashupRendererService } = await import('../mashup/services/mashup-renderer.service.js')
        // Get it from the module (this is a workaround for circular deps)
        this.mashupRenderer = new MashupRendererService(
          this.pluginDataResolver,
          this.pluginRenderer,
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
    const device = await this.authenticateDevice(headers)

    this.logger.log(`Updating device info for MAC: ${headers.id}`)
    await this.updateDeviceFromHeaders(device, headers)

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

    if (device.mirrorEnabled) {
      this.logger.log(`Device ${device.id} is mirrored. Fetching from TRMNL.`)
      return this.buildMirroredDisplay(device, headers, specialFunction, resetDevice)
    }

    this.logger.log(`Device ${device.id} is not mirrored. Cycling screens.`)
    return this.buildRotationDisplay(device, specialFunction, pushedFirmwareUrl, resetDevice, pushedUpdateFirmware)
  }

  /**
   * Finds the Device by MAC and checks its API key, the two checks every
   * poll endpoint requires before doing anything else.
   */
  private async authenticateDevice(headers: Pick<DisplayRequestHeadersDto, 'id' | 'access-token'>): Promise<Device> {
    const device = await this.deviceRepository.findOneBy({ mac: headers.id })
    if (!device) {
      this.logger.warn(`Device not found: ${headers.id}`)
      throw new NotFoundException('Device not found')
    }
    if (device.apikey !== headers['access-token']) {
      this.logger.warn(`Invalid API key for device: ${headers.id}`)
      throw new UnauthorizedException('Invalid API key')
    }
    return device
  }

  private async updateDeviceFromHeaders(device: Device, headers: DisplayRequestHeadersDto): Promise<void> {
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
   * The non-mirrored path: holds rotation while the Device sleeps, otherwise
   * advances to the next eligible Screen (or the no-screen fallback when
   * nothing in the rotation currently qualifies).
   */
  private async buildRotationDisplay(
    device: Device,
    specialFunction: string,
    firmwareUrl: string,
    resetDevice: boolean,
    updateFirmware: boolean,
  ): Promise<Display> {
    const now = new Date()
    if (isDeviceAsleep(device, now)) {
      this.logger.log(`Device ${device.id} is asleep. Holding rotation.`)
      return this.buildSleepResponse(device, now, specialFunction, firmwareUrl, resetDevice, updateFirmware)
    }

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
        firmware_url: firmwareUrl,
        image_url: await this.fallbackImageUrl('noScreen', device),
        refresh_rate: device.refreshRate,
        reset_firmware: resetDevice,
        special_function: specialFunction,
        temperature_profile: 'default',
        update_firmware: updateFirmware,
      })
    }
    nextScreen.isActive = true
    await this.screenRepository.save(nextScreen)
    this.logger.log(`Returning screen ${nextScreen.id} for device ${device.id}`)

    const imgUrl = await this.generateScreenImage(nextScreen, device)

    return new Display({
      action: specialFunction,
      filename: `${nextScreen.filename}_${nextScreen.generatedAt.toISOString()}`,
      firmware_url: firmwareUrl,
      image_url: imgUrl,
      refresh_rate: device.refreshRate,
      reset_firmware: resetDevice,
      special_function: specialFunction,
      temperature_profile: 'default',
      update_firmware: updateFirmware,
    })
  }

  /**
   * The mirrored path: proxies the firmware's own request straight through
   * to TRMNL when the mirror MAC matches the Device's own, otherwise polls
   * TRMNL's `current_screen` on the mirrored MAC. A failure to reach TRMNL
   * falls back to the error image rather than rejecting the poll.
   */
  private async buildMirroredDisplay(
    device: Device,
    headers: DisplayRequestHeadersDto,
    specialFunction: string,
    resetDevice: boolean,
  ): Promise<Display> {
    const proxy = this.shouldProxyMirror(device)
    let fields = {
      refreshRate: device.refreshRate,
      filename: 'error.png',
      localImageUrl: await this.fallbackImageUrl('error', device),
      firmwareUrl: null as string | null,
      resetFirmware: resetDevice,
      mirrorSpecialFunction: specialFunction,
      mirrorAction: specialFunction,
      updateFirmware: false,
    }
    try {
      const { response, localImageUrl } = await this.fetchAndStoreMirrorImage(device, proxy ? headers : undefined)
      fields = {
        ...fields,
        ...(proxy ? this.mirrorFieldsFromResponse(response, fields) : {}),
        localImageUrl,
        filename: response.filename,
      }
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to process image: ${message}`)
    }
    this.logger.log(`Returning mirrored screen for device ${device.id}`)
    return new Display({
      action: fields.mirrorAction,
      filename: fields.filename,
      firmware_url: fields.firmwareUrl,
      image_url: fields.localImageUrl,
      refresh_rate: fields.refreshRate,
      reset_firmware: fields.resetFirmware,
      special_function: fields.mirrorSpecialFunction,
      temperature_profile: 'default',
      update_firmware: fields.updateFirmware,
    })
  }

  private shouldProxyMirror(device: Device): boolean {
    if (device.mac === device.mirrorMac) {
      this.logger.log(`MACs are identical we should proxy the device.`)
      return true
    }
    this.logger.log(`MACs are different we should mirror with current_screen endpoint.`)
    return false
  }

  /**
   * The firmware's own proxied request lets TRMNL's response own the
   * refresh/firmware/reset/special-function fields outright; a non-proxy
   * mirror poll keeps whatever was already pending locally for all of those.
   */
  private mirrorFieldsFromResponse(response: TrmnlScreenResponse, current: { refreshRate: number, firmwareUrl: string | null, resetFirmware: boolean, mirrorSpecialFunction: string, updateFirmware: boolean }) {
    const mirrorSpecialFunction = response.special_function ?? 'none'
    return {
      refreshRate: response.refresh_rate ?? current.refreshRate,
      firmwareUrl: response.firmware_url ?? current.firmwareUrl,
      resetFirmware: response.reset_firmware ?? current.resetFirmware,
      mirrorSpecialFunction,
      mirrorAction: response.action ?? mirrorSpecialFunction,
      updateFirmware: response.update_firmware ?? current.updateFirmware,
    }
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
    return await this.resolveScreenImageFile(device, activeScreen)
  }

  /**
   * The stored image for a Screen, generating it on demand if nothing is
   * cached on disk yet.
   */
  private async resolveScreenImageFile(device: Device, screen: Screen): Promise<{ filename: string, imgUrl: string }> {
    const imgUrl = await fileExists(this.screenImagePath(device, screen))
      ? this.screenImageUrl(device, screen)
      : await this.generateScreenImage(screen, device)
    return { filename: `${screen.filename}_${screen.generatedAt.toISOString()}`, imgUrl }
  }

  async getCurrentImageWithoutProgressing(headers: Pick<DisplayRequestHeadersDto, 'id' | 'access-token'>): Promise<DisplayScreen> {
    this.logger.log(`Current Screen request for MAC: ${headers.id}`)
    this.logger.debug(`Headers: ${JSON.stringify(headers)}`)
    const device = await this.authenticateDevice(headers)
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

    const { filename, imgUrl, renderedAt } = device.mirrorEnabled
      ? await this.resolveMirrorScreen(device)
      : await this.resolveActiveScreenImage(device, activeScreen)

    return new DisplayScreen({ filename, image_url: imgUrl, refresh_rate: refreshRate, rendered_at: renderedAt })
  }

  /**
   * A mirrored Device's current-screen answer: whatever's already cached on
   * disk from the last poll/mirror fetch, or a fresh on-demand pull from
   * TRMNL if nothing is cached yet (falling back to the error image if that
   * pull fails).
   */
  private async resolveMirrorScreen(device: Device): Promise<{ filename: string, imgUrl: string, renderedAt: undefined }> {
    const filename = `mirror_${new Date().toISOString()}`
    this.logger.log(`Mirroring enabled for device ${device.id}, checking for image...`)
    let imgUrl = await this.fallbackImageUrl('error', device)
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
    return { filename, imgUrl, renderedAt: undefined }
  }

  private async resolveActiveScreenImage(device: Device, activeScreen: Screen | null): Promise<{ filename: string, imgUrl: string, renderedAt: Date }> {
    if (!activeScreen)
      throw new NotFoundException('No active screen found for device')
    this.logger.log(`Returning screen ${activeScreen.id} for device ${device.id}`)
    const { filename, imgUrl } = await this.resolveScreenImageFile(device, activeScreen)
    return { filename, imgUrl, renderedAt: activeScreen.generatedAt }
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
    let imgUrl = screen.type === 'mashup'
      ? await this.renderMashupScreen(screen, device)
      : await this.renderNonMashupScreen(screen, device)

    // Handle external link screen
    if (screen.externalLink && !screen.fetchManual)
      imgUrl = await this.renderExternalLinkScreen(screen, device)

    if (imgUrl !== null)
      return imgUrl

    // No rendering source (e.g. uploaded file screens) — serve the stored image if present
    return await fileExists(this.screenImagePath(device, screen))
      ? this.screenImageUrl(device, screen)
      : await this.fallbackImageUrl('error', device)
  }

  private async renderMashupScreen(screen: Screen, device: Device): Promise<string | null> {
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

      if (!screenWithMashup?.mashupConfiguration || !this.mashupRenderer)
        return null

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

      return await this.renderBodyToScreenPng(renderedHtml, screen, device)
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to render mashup: ${message}`)
      return await this.fallbackImageUrl('error', device)
    }
  }

  private async renderNonMashupScreen(screen: Screen, device: Device): Promise<string | null> {
    // Load plugin relationship if needed
    const screenWithPlugin = await this.screenRepository.findOne({
      where: { id: screen.id },
      relations: { plugin: { dataSources: true, templates: true } },
    })

    if (screenWithPlugin?.plugin)
      return await this.renderPluginScreen(screenWithPlugin.plugin, screenWithPlugin.cachedPluginOutput, screen, device)

    // Handle HTML screen
    if (screen.html)
      return await this.renderBodyToScreenPng(viewFull(screen.html), screen, device)

    return null
  }

  private async renderPluginScreen(plugin: Plugin, cachedPluginOutput: string | null | undefined, screen: Screen, device: Device): Promise<string | null> {
    // Use cached output if available
    if (cachedPluginOutput) {
      try {
        this.logger.log(`Using cached plugin output for plugin ${plugin.id}, screen ${screen.id}`)
        return await this.renderBodyToScreenPng(viewFull(cachedPluginOutput), screen, device)
      }
      catch (err) {
        const message = getErrorMessage(err)
        this.logger.error(`Failed to render cached plugin output: ${message}`)
        return await this.fallbackImageUrl('error', device)
      }
    }

    // Fallback: fetch and render on-demand
    if (!plugin.dataSources || plugin.dataSources.length === 0 || !plugin.templates || plugin.templates.length === 0)
      return null

    try {
      const renderedHtml = await this.renderPluginHtml(plugin, screen, device)
      return renderedHtml ? await this.renderBodyToScreenPng(viewFull(renderedHtml), screen, device) : null
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to render plugin: ${message}`)
      return await this.fallbackImageUrl('error', device)
    }
  }

  private async renderExternalLinkScreen(screen: Screen, device: Device): Promise<string | null> {
    const inputPath = path.join(resolveAppPath('public', 'screens', 'devices', device.id), 'tmp-source')
    try {
      await downloadImage(screen.externalLink!, inputPath, this.logger)
      await convertToPng(inputPath, this.screenImagePath(device, screen), await this.deviceModels.renderTargetFor(device), this.logger)
      this.logger.log('Updating generation date on screen')
      screen.generatedAt = new Date()
      await this.screenRepository.save(screen)
      this.logger.log('Download and conversion successful')
      return this.screenImageUrl(device, screen)
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to process image: ${message}`)
      return await this.fallbackImageUrl('error', device)
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

  private async renderPluginHtml(plugin: Plugin, screen: Screen, device: Device): Promise<string | null> {
    this.logger.log(`No cache, rendering plugin ${plugin.id} on-demand for screen ${screen.id}`)

    const sensors = await this.deviceSensors.findForDevice(device.id)
    const templateContext = this.pluginTemplateContext.build(plugin, sensors)
    const data = await this.pluginDataResolver.resolveAll(plugin.dataSources, templateContext)

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
