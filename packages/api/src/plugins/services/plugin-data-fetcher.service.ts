import type { DataSourceLiteralValue, DataSourceMode } from 'kuroshiro-shared'
import type { JsonObject } from '../../utils/json'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { assertPublicUrl } from '../../utils/ssrfGuard'
import { PluginRendererService } from './plugin-renderer.service'

// The subset of a Data Source's fields fetchOrLiteral needs — shared by the
// PluginDataSource entity and PreviewSourceDto, which carry the same fields
// under slightly different types.
export interface FetchableDataSource {
  mode?: DataSourceMode
  method?: string
  url?: string | null
  headers?: Record<string, string>
  body?: JsonObject
  literalValue?: DataSourceLiteralValue
}

@Injectable()
export class PluginDataFetcherService {
  private readonly logger = new Logger(PluginDataFetcherService.name)

  constructor(
    private readonly renderer: PluginRendererService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolves one Data Source's value regardless of mode: a literal-mode
   * source contributes its stored value directly, with no network call at
   * all; a fetch-mode source is fetched as usual. Every render/schedule/
   * preview path that iterates a Plugin's Data Sources should go through
   * this rather than re-deriving the mode branch itself.
   */
  async fetchOrLiteral(source: FetchableDataSource, templateContext?: object): Promise<unknown> {
    if (source.mode === 'literal') {
      return source.literalValue ?? null
    }
    return this.fetchData(source.method || 'GET', source.url || '', source.headers, source.body, templateContext)
  }

  async fetchData(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: JsonObject,
    templateContext?: object,
  ): Promise<unknown> {
    const resolvedUrl = await this.resolveUrl(url, templateContext)

    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(resolvedUrl)

    const response = await fetch(resolvedUrl, this.buildRequestInit(method, headers, body))
    return this.parseResponse(response)
  }

  /**
   * A URL containing Liquid template syntax is rendered against the template
   * context before use; a plain URL is returned unchanged so callers never
   * pay for a render they don't need.
   */
  private async resolveUrl(url: string, templateContext?: object): Promise<string> {
    if (!url.includes('{{') && !url.includes('{%'))
      return url
    this.logger.debug(`Rendering URL template: ${url}`)
    const resolvedUrl = await this.renderer.render(url, templateContext || {})
    this.logger.debug(`Resolved URL: ${resolvedUrl}`)
    return resolvedUrl
  }

  private buildRequestInit(method: string, headers: Record<string, string>, body?: JsonObject): RequestInit {
    const options: RequestInit = {
      method,
      headers: method === 'POST' && body
        ? { 'Content-Type': 'application/json', ...headers }
        : headers,
    }

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body)
    }

    return options
  }

  private async parseResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }
}
