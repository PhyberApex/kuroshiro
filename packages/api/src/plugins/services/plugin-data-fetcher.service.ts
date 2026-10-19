import type { DataSourceLiteralValue, DataSourceMode } from 'kuroshiro-shared'
import type { JsonObject, JsonValue } from '../../utils/json.js'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isPlainObject } from '../../utils/json.js'
import { assertPublicUrl } from '../../utils/ssrfGuard.js'
import { PluginRendererService } from './plugin-renderer.service.js'

// The subset of a Data Source's fields fetchOrLiteral needs — shared by the
// PluginDataSource entity and PreviewDataSourceDto, which carry the same fields
// under slightly different types.
/** What a Template reads in place of the data of a request that failed (ADR-0005). */
export interface FetchErrorMarker {
  error: true
  message: string
}

export interface FetchableDataSource {
  mode?: DataSourceMode
  method?: string
  url?: string | null
  headers?: Record<string, string> | null
  body?: JsonObject | null
  literalValue?: DataSourceLiteralValue
}

/**
 * The addresses a Data Source's rendered URL names, one per line as TRMNL reads a Polling URL (ADR-0058): line breaks of
 * either kind split it, each line's inner whitespace collapses, blank lines are dropped.
 */
export function pollingUrlsOf(rendered: string): string[] {
  return rendered.split(/\r\n|\r|\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(line => line !== '')
}

/** What a line that failed reads as, next to the lines that did not (ADR-0005). */
function errorMarkerOf(reason: unknown): FetchErrorMarker {
  return { error: true, message: reason instanceof Error ? reason.message : String(reason) }
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
    return this.fetchData(source.method || 'GET', source.url || '', source.headers ?? undefined, source.body ?? undefined, templateContext)
  }

  async fetchData(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: JsonObject,
    templateContext?: object,
  ): Promise<unknown> {
    const context = templateContext ?? {}
    const urls = pollingUrlsOf(await this.renderLiquid(url, context))
    const resolvedHeaders = await this.renderLiquidDeep(headers, context) as Record<string, string>
    const resolvedBody = body && await this.renderLiquidDeep(body, context) as JsonObject
    const init = this.buildRequestInit(method, resolvedHeaders, resolvedBody)

    if (urls.length <= 1)
      return this.fetchOne(urls[0] ?? '', init)

    const responses = await Promise.allSettled(urls.map(line => this.fetchOne(line, init)))
    return Object.fromEntries(responses.map((response, index) => [`IDX_${index}`, response.status === 'fulfilled' ? response.value : errorMarkerOf(response.reason)]))
  }

  private async fetchOne(url: string, init: RequestInit): Promise<unknown> {
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(url)
    return this.parseResponse(await fetch(url, init))
  }

  /** The `fetch` a transform calls (ADR-0052): the request as given, refused for an internal host in demo mode like a Data Source URL. */
  async fetchForTransform(url: string, init?: RequestInit): Promise<Response> {
    if (this.configService.get<boolean>('demo_mode'))
      assertPublicUrl(url)
    return fetch(url, init)
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

  /** JSON when the body is JSON; otherwise the body's text, as TRMNL hands an XML feed or an HTML page to a transform; nothing for an empty body. */
  private async parseResponse(response: Response): Promise<unknown> {
    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status}`)
    const text = await response.text()
    if (text.trim() === '')
      return null
    try {
      return JSON.parse(text)
    }
    catch {
      return text
    }
  }
}
