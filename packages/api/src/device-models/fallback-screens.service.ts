import type { DeviceRenderTarget } from './device-models.service'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { convertToPng } from '../utils/imageUtils'
import { resolveAppPath } from '../utils/pathHelper'

export type FallbackScreenKind = 'noScreen' | 'error' | 'welcome'

/**
 * Serves the built-in placeholder screens (no screen, error, welcome) converted
 * for a render target, generated on first use and cached under
 * `public/screens/fallback/<model>-<palette>/`.
 */
@Injectable()
export class FallbackScreensService {
  private readonly logger = new Logger(FallbackScreensService.name)

  constructor(private readonly configService: ConfigService) {}

  async urlFor(kind: FallbackScreenKind, target: DeviceRenderTarget): Promise<string> {
    const relativePath = ['screens', 'fallback', `${target.model.name}-${target.palette.id}`, `${kind}.png`]
    const sourcePath = resolveAppPath('public', 'screens', `${kind}.png`)
    const outputPath = resolveAppPath('public', ...relativePath)
    try {
      if (await this.isStale(sourcePath, outputPath)) {
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
        await convertToPng(sourcePath, outputPath, target, this.logger)
      }
      return `${this.apiUrl()}/${relativePath.join('/')}`
    }
    catch (err) {
      this.logger.error(`Could not generate ${kind} screen for ${target.model.name}/${target.palette.id}, serving the static image: ${err.message}`)
      return `${this.apiUrl()}/screens/${kind}.png`
    }
  }

  private async isStale(sourcePath: string, outputPath: string): Promise<boolean> {
    try {
      const [source, output] = await Promise.all([fs.promises.stat(sourcePath), fs.promises.stat(outputPath)])
      return source.mtimeMs > output.mtimeMs
    }
    catch {
      return true
    }
  }

  private apiUrl(): string {
    return this.configService.get<string>('api_url')
  }
}
