import type { DeviceRenderTarget } from './device-models.service.js'
import type { FallbackScreenFacts, FallbackScreenRequest } from './fallback-screen-templates.js'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { toClockTime } from '../devices/sleep-mode.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { resolveAppPath } from '../utils/pathHelper.js'
import { FALLBACK_SCREEN_TEMPLATE_VERSION, fallbackScreenHtml } from './fallback-screen-templates.js'
import { renderHtmlToPng } from './render-html-to-png.js'

/** What a Fallback Screen prints about the Device it is served to. */
export interface FallbackScreenDevice {
  name: string
  friendlyId: string
  /** Seconds since midnight in the server's timezone. */
  sleepEndTime?: number | null
}

/** The folder a Device Model and Palette pair's Fallback Screens are cached under, below the template version. */
export function fallbackRenderPairFolder(target: DeviceRenderTarget): string {
  return `${target.model.name}-${target.palette.id}`
}

/**
 * Serves the four Fallback Screens, each drawn for one Device at its render
 * target's size and Palette on first use and cached under
 * `public/screens/fallback/v<template version>/<model>-<palette>/<kind>-<sheet hash>.png`.
 * The hash is taken over the whole sheet, so a Device's rename, a new wake
 * time or another Screen name each get a file of their own, and Devices whose
 * sheets print the same share one.
 */
@Injectable()
export class FallbackScreensService {
  private readonly logger = new Logger(FallbackScreensService.name)

  constructor(private readonly configService: ConfigService) {}

  async urlFor(request: FallbackScreenRequest, device: FallbackScreenDevice, target: DeviceRenderTarget): Promise<string> {
    try {
      const html = fallbackScreenHtml(request, this.factsFor(device), target.model)
      const sheetHash = createHash('sha256').update(html).digest('hex').slice(0, 16)
      const relativePath = ['screens', 'fallback', `v${FALLBACK_SCREEN_TEMPLATE_VERSION}`, fallbackRenderPairFolder(target), `${request.kind}-${sheetHash}.png`]
      const outputPath = resolveAppPath('public', ...relativePath)
      if (await this.isMissing(outputPath))
        await renderHtmlToPng(html, target, outputPath, this.logger, { dither: false })
      return `${this.apiUrl()}/${relativePath.join('/')}`
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Could not generate ${request.kind} screen for ${target.model.name}/${target.palette.id}, serving the static image: ${message}`)
      return `${this.apiUrl()}/screens/${request.kind}.png`
    }
  }

  private factsFor(device: FallbackScreenDevice): FallbackScreenFacts {
    return {
      deviceName: device.name,
      friendlyId: device.friendlyId,
      instanceUrl: this.apiUrl(),
      wakeTime: device.sleepEndTime == null ? null : toClockTime(device.sleepEndTime),
    }
  }

  private async isMissing(outputPath: string): Promise<boolean> {
    try {
      await fs.promises.stat(outputPath)
      return false
    }
    catch {
      return true
    }
  }

  private apiUrl(): string {
    return this.configService.get<string>('api_url', 'http://localhost:5173')
  }
}
