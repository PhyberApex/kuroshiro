import type { ScreenModifiers } from 'kuroshiro-shared'
import type { Device } from '../../devices/devices.entity.js'
import type { RenderOutcome } from '../../screens/render-outcome.js'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { TRMNL_FRAMEWORK_VERSION, wrapInScreenShell } from 'kuroshiro-shared'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../../device-models/device-models.service.js'
import { readHtmlRenderSignal, renderHtmlToPng } from '../../device-models/render-html-to-png.js'
import { RENDER_FAILED, RENDER_HELD, RENDER_SKIPPED } from '../../screens/render-outcome.js'
import { Screen } from '../../screens/screens.entity.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { resolveAppPath } from '../../utils/pathHelper.js'
import { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import { MashupSlot } from '../entities/mashup-slot.entity.js'
import { mashupDither } from '../mashup-dither.js'
import { mashupPageHtml } from '../mashup-page.js'
import { mashupRenderSignal, renderedSlotDrawing, slotDrawing } from '../mashup-slot-signals.js'
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
    @InjectRepository(MashupSlot)
    private readonly slotRepository: Repository<MashupSlot>,
    @InjectRepository(MashupConfiguration)
    private readonly mashupRepository: Repository<MashupConfiguration>,
  ) {}

  /**
   * Draws a Mashup from its cached output, rendering and caching that first when needed.
   * Its whole page is drawn first; only when that raises a Render Signal is each slot's own
   * read, once per cached output, since the slots share one `window` (ADR-0067). Then a
   * slot that skips draws empty and one that holds draws the markup it last drew live,
   * and the Mashup itself skips or holds only when no slot draws live.
   */
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

      const mashup = screenWithMashup?.mashupConfiguration
      if (!mashup)
        return null

      let renderedHtml: string
      if (screenWithMashup.cachedPluginOutput) {
        this.logger.log(`Using cached mashup output for screen ${screen.id}`)
        renderedHtml = screenWithMashup.cachedPluginOutput
      }
      else {
        renderedHtml = await this.renderMashupOnDemand(screen, mashup, device)
      }

      return await this.drawMashup(renderedHtml, mashup, screen, device, honorRenderSignal)
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Failed to render mashup: ${message}`)
      return RENDER_FAILED
    }
  }

  private async drawMashup(renderedHtml: string, mashup: MashupConfiguration, screen: Screen, device: Device, honorRenderSignal: boolean): Promise<RenderOutcome> {
    const slots = [...mashup.slots].sort((a, b) => a.order - b.order)
    const draw = (bodyHtml: string, honor: boolean) => this.renderBodyToScreenPng(bodyHtml, screen, device, honor, TRMNL_FRAMEWORK_VERSION, mashupDither(mashup))

    if (!mashup.slotSignalsRead) {
      const outcome = await draw(renderedHtml, true)
      const drewLive = outcome !== RENDER_SKIPPED && outcome !== RENDER_HELD
      if (drewLive) {
        await this.recordLiveMarkup(slots)
        return outcome
      }
      await this.readSlotSignals(mashup, slots, device)
    }

    const signal = mashupRenderSignal(slots)
    if (signal && honorRenderSignal)
      return signal === 'skip' ? RENDER_SKIPPED : RENDER_HELD

    // A signal not honoured (a render after save, or a stored image gone missing) is drawn slot by slot all
    // the same; whatever this page raises was already read slot by slot, so it is drawn regardless.
    await this.recordLiveMarkup(slots)
    return await draw(mashupPageHtml(mashup.layout, slots.map(slotDrawing)), false)
  }

  /** Each slot's own Render Signal, read on a page holding that slot alone, kept until the Mashup's cached output is written again. */
  private async readSlotSignals(mashup: MashupConfiguration, slots: MashupSlot[], device: Device): Promise<void> {
    const target = await this.deviceModels.renderTargetFor(device)
    for (const slot of slots) {
      const slotAlone = slot.renderedMarkup == null ? null : mashupPageHtml(mashup.layout, [renderedSlotDrawing(slot, slot.renderedMarkup)])
      slot.renderSignal = slotAlone === null ? null : await readHtmlRenderSignal(wrapInScreenShell(target, slotAlone, TRMNL_FRAMEWORK_VERSION), target)
      await this.slotRepository.update({ id: slot.id }, { renderSignal: slot.renderSignal })
    }
    mashup.slotSignalsRead = true
    await this.mashupRepository.update({ id: mashup.id }, { slotSignalsRead: true })
  }

  /** Every slot drawn live in this render keeps its markup, for a later `hold` on it to draw again. */
  private async recordLiveMarkup(slots: MashupSlot[]): Promise<void> {
    for (const slot of slots) {
      if (slot.renderSignal || slot.renderedMarkup == null || slot.liveMarkup === slot.renderedMarkup)
        continue
      slot.liveMarkup = slot.renderedMarkup
      await this.slotRepository.update({ id: slot.id }, { liveMarkup: slot.liveMarkup })
    }
  }

  /**
   * Screenshots screen body markup (a `.view` or `.mashup` element) inside the
   * device's model shell at the model's native pixel size and converts it to
   * the device's PNG. `honorRenderSignal` leaves the stored image untouched
   * and answers `RENDER_SKIPPED`/`RENDER_HELD` on a live `skip`/`hold` Render
   * Signal (ADR-0031); otherwise the signal is observed but has no effect, as
   * outside `/display`. `frameworkVersion` is the Instance pin unless the caller draws
   * a Plugin's own Screen; a Mashup always keeps the pin (ADR-0041). `dither` is the Screen's or Plugin's Dithering,
   * or for a Mashup the one derived from its slots. `modifiers` are a Plugin's own Screen's (ADR-0054); a Mashup has none.
   */
  async renderBodyToScreenPng(bodyHtml: string, screen: Screen, device: Device, honorRenderSignal: boolean, frameworkVersion: string = TRMNL_FRAMEWORK_VERSION, dither = true, modifiers: ScreenModifiers = {}): Promise<string | typeof RENDER_SKIPPED | typeof RENDER_HELD> {
    const target = await this.deviceModels.renderTargetFor(device)
    const renderSignal = await renderHtmlToPng(wrapInScreenShell(target, bodyHtml, frameworkVersion, modifiers), target, this.screenImagePath(device, screen), this.logger, { dither }, { honorRenderSignal })
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

  private async renderMashupOnDemand(screen: Screen, mashup: MashupConfiguration, device: Device): Promise<string> {
    this.logger.log(`Rendering mashup ${mashup.id} for screen ${screen.id}`)
    const { html, slots } = await this.mashupRenderer.renderMashup(mashup, device)
    for (const { slot, markup } of slots) {
      slot.renderedMarkup = markup
      slot.renderSignal = null
      await this.slotRepository.update({ id: slot.id }, { renderedMarkup: markup, renderSignal: null })
    }
    mashup.slotSignalsRead = false
    await this.mashupRepository.update({ id: mashup.id }, { slotSignalsRead: false })
    await this.cachePluginOutput(screen, html)
    return html
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
