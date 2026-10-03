import type { DataSourceLiteralValue, DataSourceMode } from 'kuroshiro-shared'
import type { JsonObject, JsonValue } from '../../utils/json.js'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isPlainObject } from '../../utils/json.js'
import { assertPublicUrl } from '../../utils/ssrfGuard.js'
import { PluginRendererService } from './plugin-renderer.service.js'

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
    const context = templateContext ?? {}
    const resolvedUrl = await this.renderLiquid(url, context)

    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(resolvedUrl)

    const resolvedHeaders = await this.renderLiquidDeep(headers, context) as Record<string, string>
    const resolvedBody = body && await this.renderLiquidDeep(body, context) as JsonObject

    const response = await fetch(resolvedUrl, this.buildRequestInit(method, resolvedHeaders, resolvedBody))
    return this.parseResponse(response)
  }

  // The rendered result is never logged: a Field Value placed in a url or a header can be a secret.
  private async renderLiquid(text: string, context: object): Promise<string> {
    if (!text.includes('{{') && !text.includes('{%'))
      return text
    return this.renderer.render(text, context)
  }

  private async renderLiquidDeep(value: JsonValue, context: object): Promise<JsonValue> {
    if (typeof value === 'string')
      return this.renderLiquid(value, context)
    if (Array.isArray(value))
      return Promise.all(value.map(item => this.renderLiquidDeep(item, context)))
    if (isPlainObject(value)) {
      const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await this.renderLiquidDeep(item as JsonValue, context)] as const))
      return Object.fromEntries(entries)
    }
    return value
  }

  private buildRequestInit(method: string, headers: Record<string, string>, body?: JsonObject): RequestInit {
    const options: RequestInit = {
      method,
      headers: method === 'POST' && body
        ? { 'Content-Type': 'application/json', ...headers }
        : headers,
    }
    if (method === 'POST' && body)
      options.body = JSON.stringify(body)
    return options
  }

  private async parseResponse(response: Response): Promise<unknown> {
    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }
}
