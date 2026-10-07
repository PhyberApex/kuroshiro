import type { Device } from '../../devices/devices.entity.js'
import type { RenderOutcome } from '../../screens/render-outcome.js'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { wrapInScreenShell } from 'kuroshiro-shared'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../../device-models/device-models.service.js'
import { renderHtmlToPng } from '../../device-models/render-html-to-png.js'
import { RENDER_FAILED, RENDER_HELD, RENDER_SKIPPED } from '../../screens/render-outcome.js'
import { Screen } from '../../screens/screens.entity.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { MashupRendererService } from './mashup-renderer.service.js'

/**
 * Renders a Screen's body to its PNG, and renders+caches a Mashup's own HTML first when
 * needed. Lives in the Mashup package, not the Devices one that also calls it for every
 * other Screen type: it depends on MashupRendererService, and importing that the other way
 * round would make DevicesModule and MashupModule depend on each other.
 */
@Injectable()
export class ScreenRenderService {
  private readonly logger = new Logger(ScreenRenderService.name)

  constructor(
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    private readonly configService: ConfigService,
    private readonly deviceModels: DeviceModelsService,
    private readonly mashupRenderer: MashupRendererService,
  ) {}

  async renderMashupScreen(screen: Screen, device: Device, honorRenderSignal: boolean): Promise<RenderOutcome> {
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

      if (!screenWithMashup?.mashupConfiguration)
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

  /**
   * Screenshots screen body markup (a `.view` or `.mashup` element) inside the
   * device's model shell at the model's native pixel size and converts it to
   * the device's PNG. `honorRenderSignal` leaves the stored image untouched
   * and answers `RENDER_SKIPPED`/`RENDER_HELD` on a live `skip`/`hold` Render
   * Signal (ADR-0031); otherwise the signal is observed but has no effect, as
   * outside `/display`.
   */
  async renderBodyToScreenPng(bodyHtml: string, screen: Screen, device: Device, honorRenderSignal: boolean): Promise<string | typeof RENDER_SKIPPED | typeof RENDER_HELD> {
    const target = await this.deviceModels.renderTargetFor(device)
    const renderSignal = await renderHtmlToPng(wrapInScreenShell(target, bodyHtml), target, this.screenImagePath(device, screen), this.logger, {}, { honorRenderSignal })
    if (honorRenderSignal && renderSignal === 'skip')
      return RENDER_SKIPPED
    if (honorRenderSignal && renderSignal === 'hold')
      return RENDER_HELD
    return this.screenImageUrl(device, screen)
  }

  /**
   * Runs once a Mashup create/update's transaction commits, so the Device's next poll
   * already has an image for the new slots instead of serving the old one until a render
   * happens on demand. Never awaited by its caller; a failure here is logged and left for
   * `/display`'s own on-demand render to retry.
   */
  async renderAfterSave(screenId: string): Promise<void> {
    try {
      const screen = await this.screenRepository.findOne({ where: { id: screenId }, relations: { device: true } })
      if (!screen)
        return
      const outcome = await this.renderMashupScreen(screen, screen.device, false)
      if (outcome === RENDER_FAILED)
        this.logger.error(`Mashup screen ${screenId} could not be rendered after save`)
    }
    catch (err) {
      this.logger.error(`Mashup screen ${screenId} was saved, but could not be rendered: ${getErrorMessage(err)}`)
    }
  }

  private async renderMashupOnDemand(screen: Screen, mashupConfiguration: NonNullable<Screen['mashupConfiguration']>, device: Device): Promise<string> {
    this.logger.log(`Rendering mashup ${mashupConfiguration.id} for screen ${screen.id}`)
    const renderedHtml = await this.mashupRenderer.renderMashup(mashupConfiguration, device)
    await this.cachePluginOutput(screen, renderedHtml)
    return renderedHtml
  }

  /** Shared with `DeviceDisplayService`'s Plugin/HTML branches: the same cache-then-render-body shape, just reached from a different outcome. */
  async cachePluginOutput(screen: Screen, renderedHtml: string): Promise<void> {
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
}
