import type { RenderSignal } from 'kuroshiro-shared'
import type { FallbackScreenRequest } from '../device-models/fallback-screen-templates.js'
import type { MashupRendererService } from '../mashup/services/mashup-renderer.service.js'
import type { Plugin } from '../plugins/entities/plugin.entity.js'
import type { RotationScreen } from '../schedule/rotation.js'
import type { DisplayRequestHeadersDto } from './dto/display-request-headers.dto.js'
import type { Served } from './last-served.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { viewFull, wrapInScreenShell } from 'kuroshiro-shared'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { FallbackScreensService } from '../device-models/fallback-screens.service.js'
import { renderHtmlToPng } from '../device-models/render-html-to-png.js'
import { DeviceSensorsService } from '../device-sensors/device-sensors.service.js'
import { FirmwareService } from '../firmware/firmware.service.js'
import { templateOfSize } from '../plugins/plugin-templates.js'
import { PluginRendererService } from '../plugins/services/plugin-renderer.service.js'
import { PluginTemplateContextService } from '../plugins/services/plugin-template-context.service.js'
import { nextEligibleScreen } from '../schedule/rotation.js'
import { Screen } from '../screens/screens.entity.js'
import { fileExists } from '../utils/fileExists.js'
import { fileModifiedAt } from '../utils/fileModifiedAt.js'
import generateApikey from '../utils/generateApikey.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { convertToPng, downloadImage } from '../utils/imageUtils.js'
import { parseHeaderInt } from '../utils/parseHeaderInt.js'
import { resolveAppPath } from '../utils/pathHelper.js'
import { Device } from './devices.entity.js'
import { Display } from './display.js'
import { DisplayScreen } from './displayScreen.js'
import { SERVED_MIRROR, servedFallback, servedNoScreen, servedScreen, toLastServedRecord } from './last-served.js'
import { isDeviceAsleep, secondsUntilSleepEnd } from './sleep-mode.js'

// The fields getCurrentImage's response builders need out of applyHeaderReport,
// bundled into one object rather than passed positionally — several of them
// share a type (two booleans, two strings) and a transposed pair would compile
// cleanly while silently flipping real-device behavior.
interface HeaderReport {
  resetDevice: boolean
  specialFunction: string
  firmwareUrl: string
  updateFirmware: boolean
}

interface DisplayAnswer {
  display: Display
  served: Served
}

interface ScreenImage {
  imgUrl: string
  served: Served
}

const RENDER_FAILED = Symbol('render failed')
/** A `skip` Render Signal observed while honouring it: the Screen is left out of Rotation, its stored image untouched. */
const RENDER_SKIPPED = Symbol('render skipped')
/** A `hold` Render Signal observed while honouring it: the screenshot is discarded, the Screen's stored image untouched. */
const RENDER_HELD = Symbol('render held')

/** A rendered image's URL, `null` when the Screen has nothing to render from, or `RENDER_FAILED`/`RENDER_SKIPPED`/`RENDER_HELD`. */
type RenderOutcome = string | null | typeof RENDER_FAILED | typeof RENDER_SKIPPED | typeof RENDER_HELD

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
          this.pluginRenderer,
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
    const report = await this.applyHeaderReport(device, headers)

    const { display, served } = device.mirrorEnabled
      ? await this.buildMirrorResponse(device, headers, report)
      : await this.buildRotationResponse(device, report)
    await this.recordServed(device, display, served)
    return display
  }

  /**
   * Written on its own, to these columns only: the answer can take seconds to
   * render, and saving the whole Device afterwards would undo an admin's edit
   * made in the meantime. The Device gets its answer whether or not this
   * write succeeds.
   */
  private async recordServed(device: Device, display: Display, served: Served): Promise<void> {
    try {
      await this.deviceRepository.update({ id: device.id }, toLastServedRecord(served, display, device.lastSeen ?? new Date()))
    }
    catch (err) {
      this.logger.error(`Could not record what device ${device.id} was served: ${getErrorMessage(err)}`)
    }
  }

  /**
   * Looks up a Device by the MAC in `headers.id` and checks its API key —
   * the entry check shared by both poll endpoints (`getCurrentImage` and
   * `getCurrentImageWithoutProgressing`), each of which only needs a
   * different subset of `DisplayRequestHeadersDto`.
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

  /**
   * Records a polling Device's self-reported state (dimensions, firmware
   * version, sensors, …), acknowledges any one-shot reset/special-function
   * flags, and resolves a pending OTA push — then persists all of it in a
   * single save. Returns the fields the response builders need, since the
   * Device itself has already moved on (its one-shot flags are cleared).
   */
  private async applyHeaderReport(device: Device, headers: DisplayRequestHeadersDto): Promise<HeaderReport> {
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
    // Rotated after this poll authenticated with the old key, so the Device wipes itself before /api/setup hands out the new one (ADR-0039).
    if (resetDevice && device.resetDeviceNewApikey)
      device.apikey = generateApikey()
    device.resetDeviceNewApikey = false
    // A Special Function fires once: this response acknowledges it, the next poll gets 'none'
    const specialFunction = device.specialFunction ?? 'none'
    device.specialFunction = 'none'
    const { firmwareUrl, updateFirmware } = await this.resolveFirmwarePush(device)
    device.lastSeen = new Date()
    await this.deviceRepository.save(device)
    this.logger.log(`Device info updated for MAC: ${headers.id}`)
    return { resetDevice, specialFunction, firmwareUrl, updateFirmware }
  }

  /**
   * The non-mirrored path: holds the rotation while the Device sleeps,
   * otherwise advances to the next eligible Screen (or the no-screen
   * fallback) and generates its image.
   */
  private async buildRotationResponse(device: Device, report: HeaderReport): Promise<DisplayAnswer> {
    const now = new Date()
    if (isDeviceAsleep(device, now)) {
      this.logger.log(`Device ${device.id} is asleep. Holding rotation.`)
      return this.buildSleepResponse(device, now, report)
    }
    this.logger.log(`Device ${device.id} is not mirrored. Cycling screens.`)
    const screens = await this.screenRepository.find({
      where: { device: { id: device.id } },
      relations: { schedule: true },
      order: { order: 'ASC' },
    })
    if (screens.length > 0)
      await this.screenRepository.update({ device: { id: device.id } }, { isActive: false })

    const shown = await this.pickAndRenderScreen(screens, device, now)
    if (!shown) {
      this.logger.log(`No eligible screen for device ${device.id} returning default no screen image`)
      return {
        display: new Display({
          action: report.specialFunction,
          filename: 'noScreen.png',
          firmware_url: report.firmwareUrl,
          image_url: await this.fallbackImageUrl({ kind: 'noScreen' }, device),
          refresh_rate: device.refreshRate,
          reset_firmware: report.resetDevice,
          special_function: report.specialFunction,
          temperature_profile: 'default',
          update_firmware: report.updateFirmware,
        }),
        served: servedNoScreen(screens.length),
      }
    }
    const { screen: nextScreen, imgUrl, served, filename, renderSignal } = shown
    nextScreen.isActive = true
    nextScreen.renderSignal = renderSignal
    // A partial update, not `.save()`: rendering may just have written this Screen's
    // cached output or generatedAt, and `.save()` would overwrite them with this
    // in-memory copy's stale values from before the render ran.
    await this.screenRepository.update({ id: nextScreen.id }, { isActive: true, renderSignal })
    this.logger.log(`Returning screen ${nextScreen.id} for device ${device.id}`)

    return {
      display: new Display({
        action: report.specialFunction,
        filename,
        firmware_url: report.firmwareUrl,
        image_url: imgUrl,
        refresh_rate: device.refreshRate,
        reset_firmware: report.resetDevice,
        special_function: report.specialFunction,
        temperature_profile: 'default',
        update_firmware: report.updateFirmware,
      }),
      served,
    }
  }

  /**
   * A raw `html` Screen re-evaluates its Render Signal on every poll it comes
   * up in, so a stale stored `skip` or `hold` never excludes or short-circuits
   * it without rendering; a `plugin` or Mashup Screen's stored verdict is
   * remembered instead, so Rotation's pure pick (ADR-0031) passes over a
   * remembered `skip` without launching Chrome, and `pickAndRenderScreen`
   * serves a remembered `hold`'s stored image without launching it either.
   */
  private gatingRenderSignalOf(screen: Screen): RenderSignal | null {
    return screen.type === 'html' ? null : (screen.renderSignal ?? null)
  }

  /**
   * Tries Rotation's picked Screen in Order, retrying with the next eligible
   * one whenever Chrome observes a fresh `skip` this poll, until one is shown
   * or every eligible Screen has been tried. Bounded by the Device's Screen
   * count (ADR-0031: no cap on Chrome launches within one poll). A `hold` —
   * remembered, or freshly observed this poll — keeps this Screen's turn
   * instead of retrying the next one, serving its stored image unchanged.
   */
  private async pickAndRenderScreen(screens: Screen[], device: Device, now: Date): Promise<{ screen: Screen, imgUrl: string, served: Served, filename: string, renderSignal: RenderSignal | null } | null> {
    const byId = new Map(screens.map(screen => [screen.id, screen]))
    const rotationScreens: RotationScreen[] = screens.map(screen => ({
      id: screen.id,
      isActive: screen.isActive,
      schedule: screen.schedule,
      renderSignal: this.gatingRenderSignalOf(screen),
    }))

    for (let attempt = 0; attempt < screens.length; attempt++) {
      const candidate = nextEligibleScreen(rotationScreens, now)
      if (!candidate)
        return null
      const screen = byId.get(candidate.id)!

      if (this.gatingRenderSignalOf(screen) === 'hold')
        return await this.holdScreen(screen, device)

      const outcome = await this.generateScreenImage(screen, device, true)
      if (outcome === RENDER_HELD) {
        await this.screenRepository.update({ id: screen.id }, { renderSignal: 'hold' })
        screen.renderSignal = 'hold'
        return await this.holdScreen(screen, device)
      }
      if (outcome !== RENDER_SKIPPED) {
        return {
          screen,
          renderSignal: null,
          imgUrl: outcome.imgUrl,
          served: outcome.served,
          filename: `${screen.filename}_${screen.generatedAt.toISOString()}`,
        }
      }

      await this.screenRepository.update({ id: screen.id }, { renderSignal: 'skip' })
      candidate.renderSignal = 'skip'
    }
    return null
  }

  /** A `hold` Screen is never a reason to retry the next one: it keeps its turn either way. */
  private async holdScreen(screen: Screen, device: Device): Promise<{ screen: Screen, renderSignal: RenderSignal | null, imgUrl: string, served: Served, filename: string }> {
    return { screen, renderSignal: 'hold', ...await this.heldScreenImage(screen, device) }
  }

  /**
   * A `hold` Screen's own stored image, named by the image file's own write
   * time — not `generatedAt`, which a cache refresh that holds again moves on
   * without the stored image changing to match, and would send the Device
   * redrawing an identical image under a new name (ADR-0031) — or the
   * `noScreen` fallback for a Screen that has never produced one yet.
   */
  private async heldScreenImage(screen: Screen, device: Device): Promise<{ imgUrl: string, served: Served, filename: string }> {
    const imagePath = this.screenImagePath(device, screen)
    if (await fileExists(imagePath)) {
      const writtenAt = await fileModifiedAt(imagePath)
      return { imgUrl: this.screenImageUrl(device, screen), served: servedScreen(screen.id), filename: `${screen.filename}_${writtenAt.toISOString()}` }
    }
    return { imgUrl: await this.fallbackImageUrl({ kind: 'noScreen' }, device), served: servedFallback('noScreen', 'noneEligible', screen.id), filename: 'noScreen.png' }
  }

  /**
   * The mirrored path: proxies TRMNL's own response when mirroring itself
   * (matching MACs), otherwise mirrors another Device's `current_screen` and
   * keeps this Device's own reset/special-function/firmware fields as-is.
   */
  private async buildMirrorResponse(device: Device, headers: DisplayRequestHeadersDto, report: Pick<HeaderReport, 'resetDevice' | 'specialFunction'>): Promise<DisplayAnswer> {
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
    let localImageUrl = await this.fallbackImageUrl({ kind: 'error', cause: 'mirror' }, device)
    let firmwareUrl: string | null = null
    let resetFirmware = report.resetDevice
    let mirrorSpecialFunction = report.specialFunction
    let mirrorAction = report.specialFunction
    let updateFirmware = false
    let served = servedFallback('error', 'mirrorFailed')
    try {
      const { response, localImageUrl: localImage } = await this.fetchAndStoreMirrorImage(device, proxy ? headers : undefined)

      if (proxy) {
        refreshRate = response.refresh_rate ?? refreshRate
        firmwareUrl = response.firmware_url ?? firmwareUrl
        resetFirmware = response.reset_firmware ?? resetFirmware
        mirrorSpecialFunction = response.special_function ?? 'none'
        mirrorAction = response.action ?? mirrorSpecialFunction
        updateFirmware = response.update_firmware ?? updateFirmware
      }
      localImageUrl = localImage
      filename = response.filename
      served = SERVED_MIRROR
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to process image: ${message}`)
    }
    this.logger.log(`Returning mirrored screen for device ${device.id}`)
    return {
      display: new Display({
        action: mirrorAction,
        filename,
        firmware_url: firmwareUrl,
        image_url: localImageUrl,
        refresh_rate: refreshRate,
        reset_firmware: resetFirmware,
        special_function: mirrorSpecialFunction,
        temperature_profile: 'default',
        update_firmware: updateFirmware,
      }),
      served,
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
   * The Active Screen does not advance while a Device is asleep (ADR-0012):
   * `refresh_rate` is the seconds until `sleepEndTime` so the Device wakes
   * exactly on schedule, and the served image is either the dedicated Sleep
   * fallback screen or whatever was already showing.
   */
  private async buildSleepResponse(device: Device, now: Date, report: HeaderReport): Promise<DisplayAnswer> {
    const refreshRate = secondsUntilSleepEnd(device.sleepEndTime!, now)
    const { filename, imgUrl, served } = device.sleepScreenEnabled
      ? { filename: 'sleep.png', imgUrl: await this.fallbackImageUrl({ kind: 'sleep' }, device), served: servedFallback('sleep', 'asleep') }
      : await this.resolveFrozenImage(device)
    return {
      display: new Display({
        action: report.specialFunction,
        filename,
        firmware_url: report.firmwareUrl,
        image_url: imgUrl,
        refresh_rate: refreshRate,
        reset_firmware: report.resetDevice,
        special_function: report.specialFunction,
        temperature_profile: 'default',
        update_firmware: report.updateFirmware,
      }),
      served,
    }
  }

  /**
   * "Last content" for a sleeping Device with the dedicated Sleep screen
   * turned off: whatever the current Active Screen already has on disk, or
   * the plain no-screen fallback for a Device that never had one.
   */
  private async resolveFrozenImage(device: Device): Promise<ScreenImage & { filename: string }> {
    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen) {
      const screenCount = await this.screenRepository.count({ where: { device: { id: device.id } } })
      return {
        filename: 'noScreen.png',
        imgUrl: await this.fallbackImageUrl({ kind: 'noScreen' }, device),
        served: servedNoScreen(screenCount),
      }
    }
    const { imgUrl, served } = await fileExists(this.screenImagePath(device, activeScreen))
      ? { imgUrl: this.screenImageUrl(device, activeScreen), served: servedScreen(activeScreen.id) }
      : this.assertRendered(await this.generateScreenImage(activeScreen, device, false))
    return {
      filename: `${activeScreen.filename}_${activeScreen.generatedAt.toISOString()}`,
      imgUrl,
      served: served.kind === 'screen' ? servedScreen(activeScreen.id, 'asleep') : served,
    }
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
        image_url: await this.fallbackImageUrl({ kind: 'sleep' }, device),
        refresh_rate: refreshRate,
        rendered_at: now,
      })
    }

    const activeScreen = await this.screenRepository.findOneBy({ device: { id: device.id }, isActive: true })
    if (!activeScreen && !device.mirrorEnabled) {
      this.logger.log('No screen found returning default no screen image')
      return new DisplayScreen({
        filename: 'noScreen.png',
        image_url: await this.fallbackImageUrl({ kind: 'noScreen' }, device),
        refresh_rate: refreshRate,
        rendered_at: new Date(),
      })
    }
    const { filename, imgUrl, renderedAt } = device.mirrorEnabled
      ? await this.resolveMirrorScreen(device)
      : await this.resolveActiveScreenImage(device, activeScreen)
    return new DisplayScreen({
      filename,
      image_url: imgUrl,
      refresh_rate: refreshRate,
      rendered_at: renderedAt,
    })
  }

  private async resolveMirrorScreen(device: Device): Promise<{ filename: string, imgUrl: string, renderedAt: undefined }> {
    const filename = `mirror_${new Date().toISOString()}`
    this.logger.log(`Mirroring enabled for device ${device.id}, checking for image...`)
    let imgUrl = await this.fallbackImageUrl({ kind: 'error', cause: 'mirror' }, device)
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
    let imgUrl: string
    if (await fileExists(this.screenImagePath(device, activeScreen))) {
      imgUrl = this.screenImageUrl(device, activeScreen)
    }
    else {
      this.logger.log(`Screen image for ${activeScreen.id} missing on disk, generating on demand`)
      imgUrl = this.assertRendered(await this.generateScreenImage(activeScreen, device, false)).imgUrl
    }
    return { filename: `${activeScreen.filename}_${activeScreen.generatedAt.toISOString()}`, imgUrl, renderedAt: activeScreen.generatedAt }
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

  /**
   * The Screen's image, the error Fallback Screen when it could not be made
   * (a render that failed, an External link that could not be fetched, or a
   * Screen with nothing to render from whose stored image is missing), or
   * `RENDER_SKIPPED`/`RENDER_HELD` when `honorRenderSignal` is honouring a
   * live `skip`/`hold`.
   */
  private async generateScreenImage(screen: Screen, device: Device, honorRenderSignal: boolean): Promise<ScreenImage | typeof RENDER_SKIPPED | typeof RENDER_HELD> {
    let outcome = screen.type === 'mashup'
      ? await this.renderMashupScreen(screen, device, honorRenderSignal)
      : await this.renderPluginOrHtmlScreen(screen, device, honorRenderSignal)

    if (screen.externalLink && !screen.fetchManual)
      outcome = await this.renderExternalLinkScreen(screen, device)

    if (outcome === null && await fileExists(this.screenImagePath(device, screen)))
      outcome = this.screenImageUrl(device, screen)

    if (outcome === RENDER_SKIPPED)
      return RENDER_SKIPPED
    if (outcome === RENDER_HELD)
      return RENDER_HELD

    return typeof outcome === 'string'
      ? { imgUrl: outcome, served: servedScreen(screen.id) }
      : { imgUrl: await this.fallbackImageUrl({ kind: 'error', cause: 'render', screenName: await this.nameOf(screen) }, device), served: servedFallback('error', 'renderFailed', screen.id) }
  }

  /** `generateScreenImage` only returns `RENDER_SKIPPED`/`RENDER_HELD` when it was asked to honour the signal. */
  private assertRendered(outcome: ScreenImage | typeof RENDER_SKIPPED | typeof RENDER_HELD): ScreenImage {
    if (outcome === RENDER_SKIPPED || outcome === RENDER_HELD)
      throw new Error('A Render Signal should only be observed by the /display Rotation path')
    return outcome
  }

  /** A plugin-type Screen goes by its Plugin's name; every other Screen carries its own. */
  private async nameOf(screen: Screen): Promise<string | null> {
    if (screen.type !== 'plugin')
      return screen.filename ?? null
    const withPlugin = await this.screenRepository.findOne({ where: { id: screen.id }, relations: { plugin: true } })
    return withPlugin?.plugin?.name ?? screen.filename ?? null
  }

  private async renderMashupScreen(screen: Screen, device: Device, honorRenderSignal: boolean): Promise<RenderOutcome> {
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
      if (screenWithMashup.cachedPluginOutput) {
        this.logger.log(`Using cached mashup output for screen ${screen.id}`)
        renderedHtml = screenWithMashup.cachedPluginOutput
      }
      else {
        renderedHtml = await this.renderMashupOnDemand(screen, screenWithMashup.mashupConfiguration, device)
      }

      return await this.renderBodyToScreenPng(renderedHtml, screen, device, honorRenderSignal)
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to render mashup: ${message}`)
      return RENDER_FAILED
    }
  }

  private async renderMashupOnDemand(screen: Screen, mashupConfiguration: NonNullable<Screen['mashupConfiguration']>, device: Device): Promise<string> {
    this.logger.log(`Rendering mashup ${mashupConfiguration.id} for screen ${screen.id}`)
    const renderedHtml = await this.mashupRenderer.renderMashup(mashupConfiguration, device)
    await this.cachePluginOutput(screen, renderedHtml)
    return renderedHtml
  }

  private async renderPluginOrHtmlScreen(screen: Screen, device: Device, honorRenderSignal: boolean): Promise<RenderOutcome> {
    // Load plugin relationship if needed
    const screenWithPlugin = await this.screenRepository.findOne({
      where: { id: screen.id },
      relations: { plugin: { dataSources: true, templates: true } },
    })

    if (screenWithPlugin?.plugin)
      return await this.renderPluginScreen(screenWithPlugin, screen, device, honorRenderSignal)

    return screen.html
      ? await this.renderHtmlScreen(screen.html, screen, device, honorRenderSignal)
      : null
  }

  private async renderHtmlScreen(html: string, screen: Screen, device: Device, honorRenderSignal: boolean): Promise<RenderOutcome> {
    try {
      return await this.renderBodyToScreenPng(viewFull(html), screen, device, honorRenderSignal)
    }
    catch (err) {
      this.logger.error(`Failed to render HTML screen: ${getErrorMessage(err)}`)
      return RENDER_FAILED
    }
  }

  private async renderPluginScreen(screenWithPlugin: Screen, screen: Screen, device: Device, honorRenderSignal: boolean): Promise<RenderOutcome> {
    const plugin = screenWithPlugin.plugin!

    // Use cached output if available
    if (screenWithPlugin.cachedPluginOutput) {
      try {
        this.logger.log(`Using cached plugin output for plugin ${plugin.id}, screen ${screen.id}`)
        return await this.renderBodyToScreenPng(viewFull(screenWithPlugin.cachedPluginOutput), screen, device, honorRenderSignal)
      }
      catch (err) {
        const message = getErrorMessage(err)
        this.logger.error(`Failed to render cached plugin output: ${message}`)
        return RENDER_FAILED
      }
    }

    // No render is cached yet: a Poll-kind Plugin fetches now, a Webhook-kind one renders what it has received, or nothing.
    try {
      const renderedHtml = await this.renderPluginHtml(plugin, screen)
      return renderedHtml ? await this.renderBodyToScreenPng(viewFull(renderedHtml), screen, device, honorRenderSignal) : null
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to render plugin: ${message}`)
      return RENDER_FAILED
    }
  }

  private async renderExternalLinkScreen(screen: Screen, device: Device): Promise<string | typeof RENDER_FAILED> {
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
      return RENDER_FAILED
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

  /**
   * `sensors` is always `[]` here, matching the scheduler tick, save-triggered
   * refresh and Webhook ingest: this render's output is cached and then shared
   * by every Device the Plugin is assigned to, so the polling Device's own
   * Sensor readings must not leak into it.
   */
  private async renderPluginHtml(plugin: Plugin, screen: Screen): Promise<string | null> {
    this.logger.log(`No cache, rendering plugin ${plugin.id} on-demand for screen ${screen.id}`)

    const fullTemplate = templateOfSize(plugin.templates, 'full')
    if (!fullTemplate)
      return null

    const { context } = await this.pluginTemplateContext.contextFor(plugin, [])

    const renderedHtml = await this.pluginRenderer.render(fullTemplate.liquidMarkup, context)
    await this.cachePluginOutput(screen, renderedHtml)
    return renderedHtml
  }

  /**
   * Screenshots screen body markup (a `.view` or `.mashup` element) inside the
   * device's model shell at the model's native pixel size and converts it to
   * the device's PNG. `honorRenderSignal` leaves the stored image untouched
   * and answers `RENDER_SKIPPED`/`RENDER_HELD` on a live `skip`/`hold` Render
   * Signal (ADR-0031); otherwise the signal is observed but has no effect, as
   * outside `/display`.
   */
  private async renderBodyToScreenPng(bodyHtml: string, screen: Screen, device: Device, honorRenderSignal: boolean): Promise<string | typeof RENDER_SKIPPED | typeof RENDER_HELD> {
    const target = await this.deviceModels.renderTargetFor(device)
    const renderSignal = await renderHtmlToPng(wrapInScreenShell(target, bodyHtml), target, this.screenImagePath(device, screen), this.logger, {}, { honorRenderSignal })
    if (honorRenderSignal && renderSignal === 'skip')
      return RENDER_SKIPPED
    if (honorRenderSignal && renderSignal === 'hold')
      return RENDER_HELD
    return this.screenImageUrl(device, screen)
  }

  private async cachePluginOutput(screen: Screen, renderedHtml: string): Promise<void> {
    const generatedAt = new Date()
    await this.screenRepository.update({ id: screen.id }, { cachedPluginOutput: renderedHtml, renderSignal: null, generatedAt })
    screen.generatedAt = generatedAt
    screen.renderSignal = null
  }

  private screenImagePath(device: Device, screen: Screen): string {
    return resolveAppPath('public', 'screens', 'devices', device.id, `${screen.id}.png`)
  }

  private screenImageUrl(device: Device, screen: Screen): string {
    return `${this.configService.get<string>('api_url')}/screens/devices/${device.id}/${screen.id}.png`
  }

  private async fallbackImageUrl(request: FallbackScreenRequest, device: Device): Promise<string> {
    return this.fallbackScreens.urlFor(request, device, await this.deviceModels.renderTargetFor(device))
  }
}
