import type { DeviceRenderTarget } from './device-models.service'
import * as fs from 'node:fs'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { resolveAppPath } from '../utils/pathHelper'
import { FALLBACK_SCREEN_TEMPLATE_VERSION, fallbackScreenBody } from './fallback-screen-templates'
import { renderHtmlToPng } from './render-html-to-png'
import { viewFull, wrapInScreenShell } from './screen-shell'

export type FallbackScreenKind = 'noScreen' | 'error' | 'welcome' | 'sleep'

/**
 * Serves the built-in placeholder screens (no screen, error, welcome, sleep), rendered
 * natively at a render target's model size through the same puppeteer shell
 * regular screens use, generated on first use and cached under
 * `public/screens/fallback/v<template version>/<model>-<palette>/`.
 */
@Injectable()
export class FallbackScreensService {
  private readonly logger = new Logger(FallbackScreensService.name)

  constructor(private readonly configService: ConfigService) {}

  async urlFor(kind: FallbackScreenKind, target: DeviceRenderTarget): Promise<string> {
    const relativePath = ['screens', 'fallback', `v${FALLBACK_SCREEN_TEMPLATE_VERSION}`, `${target.model.name}-${target.palette.id}`, `${kind}.png`]
    const outputPath = resolveAppPath('public', ...relativePath)
    try {
      if (await this.isStale(outputPath)) {
        const html = wrapInScreenShell(target, viewFull(fallbackScreenBody(kind)))
        await renderHtmlToPng(html, target, outputPath, this.logger)
      }
      return `${this.apiUrl()}/${relativePath.join('/')}`
    }
    catch (err) {
      this.logger.error(`Could not generate ${kind} screen for ${target.model.name}/${target.palette.id}, serving the static image: ${err.message}`)
      return `${this.apiUrl()}/screens/${kind}.png`
    }
  }

  private async isStale(outputPath: string): Promise<boolean> {
    try {
      await fs.promises.stat(outputPath)
      return false
    }
    catch {
      return true
    }
  }

  private apiUrl(): string {
    return this.configService.get<string>('api_url')
  }
}
