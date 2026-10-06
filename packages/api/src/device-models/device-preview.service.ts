import type { DevicePreviewInput, DevicePreviewSignal } from 'kuroshiro-shared'
import type { Buffer } from 'node:buffer'
import type { DeviceRenderTarget } from './device-models.service.js'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { wrapInScreenShell } from 'kuroshiro-shared'
import { ApiException } from '../errors/api.exception.js'
import { DeviceModelsService } from './device-models.service.js'
import { renderHtmlToPng } from './render-html-to-png.js'

export interface DevicePreviewResult {
  buffer: Buffer
  signal: DevicePreviewSignal
}

/**
 * Draws the body HTML a browser preview already produced as the chosen Device Model and
 * Palette would (ADR-0040): the same screen shell and `renderHtmlToPng`/`convertToPng` path
 * `/display` uses, to a temp file that is always removed, never written to a Screen's own path
 * and never cached.
 */
@Injectable()
export class DevicePreviewService {
  private readonly logger = new Logger(DevicePreviewService.name)

  /** At most one render runs per Instance; a request that arrives while this is set is refused. */
  private rendering = false

  constructor(private readonly deviceModels: DeviceModelsService) {}

  async render(input: DevicePreviewInput): Promise<DevicePreviewResult> {
    if (this.rendering)
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'device-preview-busy', 'Another preview is being drawn. Try again in a moment.')
    // Set before the first `await` so a request arriving while this one is still validating
    // its target sees the guard too, not just one arriving once the render itself has started.
    this.rendering = true
    try {
      const target = await this.targetOf(input)
      return await this.renderTo(target, input.html)
    }
    finally {
      this.rendering = false
    }
  }

  private async renderTo(target: DeviceRenderTarget, html: string): Promise<DevicePreviewResult> {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kuroshiro-device-preview-'))
    const outputPath = path.join(tmpDir, 'preview.png')
    try {
      const renderSignal = await renderHtmlToPng(wrapInScreenShell(target, html), target, outputPath, this.logger)
      const buffer = await fs.promises.readFile(outputPath)
      return { buffer, signal: renderSignal ?? 'none' }
    }
    finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true })
    }
  }

  private async targetOf(input: DevicePreviewInput): Promise<DeviceRenderTarget> {
    const model = await this.deviceModels.findByName(input.deviceModelName)
    if (!model)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'device-model-unknown', `This Instance does not know the Device Model ${input.deviceModelName}.`, { names: [input.deviceModelName] })
    const palette = await this.deviceModels.findPalette(input.paletteId)
    if (!palette)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'palette-unknown', `This Instance does not know the Palette ${input.paletteId}.`, { id: input.paletteId })
    if (!await this.deviceModels.supportsPalette(model, palette))
      throw new ApiException(HttpStatus.BAD_REQUEST, 'palette-not-for-model', `The Palette ${palette.name} does not belong to ${model.label}.`)
    return { model, palette }
  }
}
